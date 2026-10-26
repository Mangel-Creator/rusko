import { AppState, Linking } from 'react-native';

import { leerAjuste } from '@/data/ajustes';
import { leerAdelantos, leerAlarmas, suscribirseAdelantos, suscribirseAlarmas } from '@/data/alarmas';
import { leerAlarmasReloj, suscribirseAlarmasReloj } from '@/data/alarmasReloj';
import { leerAjustesAvisos, suscribirseAjustesAvisos } from '@/data/avisos';
import { leerCorreos, suscribirseCorreos } from '@/data/correos';
import { leerEpocas, suscribirseEpocas } from '@/data/epocas';
import { leerEventos, moverTareas, suscribirseEventos } from '@/data/eventos';
import { leerNavegador, suscribirseNavegador } from '@/data/navegador';
import { cargarPerfil, suscribirsePerfil } from '@/data/perfil';
import { leerPlanes, suscribirsePlanes } from '@/data/planes';
import { leerSalidas, suscribirseSalidas } from '@/data/salidas';
import { tareasPendientes, type Energia } from '@/services/agenda';
import { nivelEfectivo, suscribirsePermisoAlarmas } from '@/services/alarmas/nativo';
import { epocaProxima, planDeHoy } from '@/services/epoca';
import { claveDia, formatearHora, minutosDelDia, sumarDias } from '@/services/fechas';
import { consultarPermiso } from '@/services/permisos';
import { navegadorPara, NOMBRE_NAVEGADOR } from '@/services/rutas/navegador';
import { enlaceWhatsapp } from '@/services/rutas/textos';

import { avisoDeHoy, DIAS_A_PROGRAMAR, planificarAvisos } from './planificar';
// En el móvil carga programar.ts (expo-notifications) y en la web programar.web.ts.
import {
  avisosDisponibles,
  enviarAvisoDePrueba,
  escucharRespuestas,
  posponerAviso,
  prepararAvisos,
  programarAvisos,
} from './programar';
import type { RespuestaAviso } from './programar';

// Avisos (notificaciones locales, fase 4). En el móvil todo se programa en el propio
// móvil; en la web (26/10/2026) se suben a Supabase, que los manda con Web Push.
//
//   - iniciarAvisos(): en el arranque. Programa los avisos de los próximos días y
//     los vuelve a programar al abrir la app y al cambiar eventos, perfil o ajustes.
//   - escucharRespuestas() + atenderRespuesta(): qué hacer al tocar un aviso.

export { avisosDisponibles, escucharRespuestas };
export { contarAvisosProgramados, enviarAvisoDePrueba } from './programar';

// Envía en 5 segundos el resumen de la mañana o el cierre del día de hoy, tal
// cual (con sus botones), para probarlos sin esperar a su hora.
export async function probarAvisoDeHoy(tipo: 'resumen-manana' | 'cierre-dia' | 'salida'): Promise<void> {
  const { perfil } = await cargarPerfil();
  if (!perfil) return;
  const [eventos, ajustes, salidas] = await Promise.all([leerEventos(), leerAjustesAvisos(), leerSalidas()]);
  const navegador = NOMBRE_NAVEGADOR[navegadorPara(await leerNavegador(), perfil.transporte)];
  const ctx = { ahora: new Date(), eventos, perfil, ajustes, salidas: Object.values(salidas), navegador };
  await enviarAvisoDePrueba(avisoDeHoy(tipo, ctx));
}

export type { RespuestaAviso } from './programar';
export { horaCierre, textoAntelacion } from './planificar';

let cola: Promise<unknown> = Promise.resolve();

// Borra los avisos programados y los vuelve a calcular con los datos actuales.
// Si se llama varias veces seguidas, se hacen una detrás de otra.
export function reprogramarAvisos(): Promise<void> {
  const tarea = cola.then(async () => {
    if (!avisosDisponibles) return;
    if ((await consultarPermiso('notificaciones')) !== 'concedido') return;
    const { perfil, bienvenidaCompletada } = await cargarPerfil();
    if (!perfil || !bienvenidaCompletada) return;
    const ahora = new Date();
    const hoy = claveDia(ahora);
    const [eventos, ajustes, { epocas, registro, planesDelDia }, energia, salidas, alarmas, adelantos, nivel, planes, correo, reloj] =
      await Promise.all([
        leerEventos(),
        leerAjustesAvisos(),
        leerEpocas(),
        leerAjuste<Energia>(`energia:${hoy}`, 'normal'),
        leerSalidas(),
        leerAlarmas(),
        leerAdelantos(),
        nivelEfectivo(),
        leerPlanes(),
        leerCorreos(),
        leerAlarmasReloj(),
      ]);
    // En la web, una cita con alarma de salida solo suena si el Atajo la pasa al Reloj;
    // si no, se manda el "Sal ya" como siempre (26/10/2026).
    const ajustesAlarmas =
      nivel === 'web' && !reloj.enlace ? { ...alarmas.ajustes, salidas: [] } : alarmas.ajustes;
    // Época dorada activa (o que empieza estos días) con su plan, para sus avisos. Hoy
    // con lo que el plan tenía previsto (igual que la pestaña Época).
    const epoca = epocaProxima(epocas, hoy, DIAS_A_PROGRAMAR);
    const datosEpoca = epoca
      ? {
          epoca,
          plan: planDeHoy({
            epoca,
            eventos,
            registro,
            planesDelDia,
            hoy,
            energias: { [hoy]: energia },
            ahora: minutosDelDia(ahora),
          }),
        }
      : null;
    await programarAvisos(
      planificarAvisos({
        ahora,
        eventos,
        perfil,
        ajustes,
        epoca: datosEpoca,
        salidas: Object.values(salidas),
        navegador: NOMBRE_NAVEGADOR[navegadorPara(await leerNavegador(), perfil.transporte)],
        // Alarmas (fase 7): como avisos solo si no hay alarmas de verdad (Expo Go).
        alarmas: { lista: alarmas.alarmas, ajustes: ajustesAlarmas, adelantos, comoAvisos: nivel === 'avisos' },
        // Planes (fase 8): "Recordar a todos 3 h antes".
        planes,
        // Plazos que llegaron por correo (fase 11): la víspera.
        correos: correo.correos,
      }),
    );
  });
  cola = tarea.catch(() => {});
  return tarea;
}

let espera: ReturnType<typeof setTimeout> | null = null;

// Espera un momento por si llegan varios cambios seguidos (por ejemplo, al
// pasar varias tareas a mañana) y reprograma una sola vez.
function reprogramarEnUnMomento() {
  if (espera) clearTimeout(espera);
  espera = setTimeout(() => {
    espera = null;
    reprogramarAvisos().catch(() => {});
  }, 500);
}

// Se llama una vez al arrancar la app. Devuelve la función para pararlo.
export function iniciarAvisos(): () => void {
  if (!avisosDisponibles) return () => {};
  prepararAvisos();
  reprogramarEnUnMomento();
  const quitar = [
    suscribirseEventos(reprogramarEnUnMomento),
    suscribirsePerfil(reprogramarEnUnMomento),
    suscribirseAjustesAvisos(reprogramarEnUnMomento),
    suscribirseEpocas(reprogramarEnUnMomento),
    suscribirseSalidas(reprogramarEnUnMomento), // nueva hora de salida con el tráfico (fase 6)
    suscribirseNavegador(reprogramarEnUnMomento), // "Toca para ir con Waze" del Sal ya
    suscribirseAlarmas(reprogramarEnUnMomento), // alarmas (fase 7)
    suscribirseAdelantos(reprogramarEnUnMomento),
    suscribirsePermisoAlarmas(reprogramarEnUnMomento),
    suscribirsePlanes(reprogramarEnUnMomento), // "Recordar a todos 3 h antes" (fase 8)
    suscribirseCorreos(reprogramarEnUnMomento), // plazos que llegaron por correo (fase 11)
    suscribirseAlarmasReloj(reprogramarEnUnMomento), // web: alarmas de salida en el Reloj o no
  ];
  // Cada vez que se vuelve a abrir la app: así siempre hay avisos para los próximos días.
  const app = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') reprogramarEnUnMomento();
  });
  return () => {
    quitar.forEach((q) => q());
    app.remove();
  };
}

export type DestinoApp =
  | { pantalla: 'hoy'; movidas?: number }
  | { pantalla: 'alarmas'; pospuesta?: string } // "HH:MM" si se acaba de posponer
  | { pantalla: 'evento'; id: string }
  | { pantalla: 'mapa'; id: string; dia: string }
  | { pantalla: 'plan'; id: string } // un plan con votación (fase 8)
  | { pantalla: 'resumenes' } // resúmenes de correo (fase 11)
  | { pantalla: 'ninguna' }; // "Parar": no hace falta abrir nada

// Hace lo que pide la respuesta y dice a qué pantalla ir.
// "Sí, a mañana" pasa a mañana las tareas que sigan pendientes ese día.
export async function atenderRespuesta({
  accion,
  datos,
  titulo,
  cuerpo,
  categoria,
}: RespuestaAviso): Promise<DestinoApp> {
  // Alarmas en Expo Go (fase 7).
  if (accion === 'parar') return { pantalla: 'ninguna' };
  if (accion === 'posponer') {
    const cuando = await posponerAviso(titulo, cuerpo, datos, categoria);
    return { pantalla: 'alarmas', pospuesta: formatearHora(cuando) };
  }
  if (accion === 'como-llegar' && datos.destino.pantalla === 'mapa') return datos.destino;
  if (accion === 'a-manana' && datos.tipo === 'cierre-dia') {
    const pendientes = tareasPendientes(await leerEventos(), datos.dia, datos.dia);
    await moverTareas(
      pendientes.map((t) => t.id),
      sumarDias(datos.dia, 1),
    );
    return { pantalla: 'hoy', movidas: pendientes.length };
  }
  // "Avisar de retraso" (Sal ya, fase 6): abre WhatsApp con el mensaje escrito; la
  // persona elige a quién mandarlo y lo envía ella. Detrás queda la ruta en el Mapa.
  if (accion === 'retraso') {
    await Linking.openURL(enlaceWhatsapp()).catch(() => {});
  }
  // "Recordar por WhatsApp" (planes, fase 8): abre WhatsApp con el recordatorio del plan.
  if (accion === 'whatsapp' && datos.mensaje) {
    await Linking.openURL(enlaceWhatsapp(datos.mensaje)).catch(() => {});
  }
  return datos.destino;
}
