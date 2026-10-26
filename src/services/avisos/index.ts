import { AppState, Linking } from 'react-native';

import { leerAjuste } from '@/data/ajustes';
import { leerAdelantos, leerAlarmas, suscribirseAdelantos, suscribirseAlarmas } from '@/data/alarmas';
import { leerAjustesAvisos, suscribirseAjustesAvisos } from '@/data/avisos';
import { leerCorreos, suscribirseCorreos } from '@/data/correos';
import { leerEpocas, suscribirseEpocas } from '@/data/epocas';
import { leerAgenda } from '@/data/agenda';
import { suscribirseEmpresa } from '@/data/empresa';
import { leerEventos, moverTareas, suscribirseEventos } from '@/data/eventos';
import { leerNavegador, suscribirseNavegador } from '@/data/navegador';
import { cargarPerfil, suscribirsePerfil } from '@/data/perfil';
import { leerPlanes, suscribirsePlanes } from '@/data/planes';
import { leerRecordatorios, suscribirseRecordatorios } from '@/data/recordatorios';
import { leerSalidas, suscribirseSalidas } from '@/data/salidas';
import { tareasPendientes, type Energia } from '@/services/agenda';
import { nivelEfectivo, suscribirsePermisoAlarmas } from '@/services/alarmas/nativo';
import { claveEnvio, proximaCita, puedeRecordar } from '@/services/clientes';
import { mandarRecordatorio } from '@/services/clientes/enviar';
import { epocaProxima, planificarEpoca } from '@/services/epoca';
import { claveDia, formatearHora, sumarDias } from '@/services/fechas';
import { consultarPermiso } from '@/services/permisos';
import { navegadorPara, NOMBRE_NAVEGADOR } from '@/services/rutas/navegador';
import { enlaceWhatsapp } from '@/services/rutas/textos';

import { avisosDeClientes } from './clientes';
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

// Avisos (notificaciones locales, fase 4). Sin servidor: todo se programa en el móvil.
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
  const [eventos, ajustes, salidas] = await Promise.all([leerAgenda({ tareas: false }), leerAjustesAvisos(), leerSalidas()]);
  const navegador = NOMBRE_NAVEGADOR[navegadorPara(await leerNavegador(), perfil.transporte)];
  const ctx = { ahora: new Date(), eventos, perfil, ajustes, salidas: Object.values(salidas), navegador };
  await enviarAvisoDePrueba(avisoDeHoy(tipo, ctx));
}

// Envía en 5 segundos el recordatorio de la próxima cita con un cliente que lo acepta
// (fase 10), tal cual llegará el día antes. Devuelve false si no hay ninguna.
export async function probarRecordatorioCliente(): Promise<boolean> {
  const { perfil } = await cargarPerfil();
  if (!perfil) return false;
  const [eventos, { ajustes }] = await Promise.all([leerEventos(), leerRecordatorios()]);
  const ahora = new Date();
  const proximas = eventos
    .filter(puedeRecordar)
    .map((evento) => ({ evento, dia: proximaCita(evento, ahora) }))
    .filter((p): p is { evento: typeof p.evento; dia: string } => p.dia !== null)
    .sort((a, b) => `${a.dia} ${a.evento.horaInicio}`.localeCompare(`${b.dia} ${b.evento.horaInicio}`));
  const primera = proximas[0];
  if (!primera) return false;
  // El aviso "del día antes" de esa cita, aunque ya esté enviado o el interruptor apagado.
  const [aviso] = avisosDeClientes(
    { ajustes: { ...ajustes, activo: true }, envios: {} },
    [primera.evento],
    perfil,
    sumarDias(primera.dia, -1),
  );
  if (!aviso) return false;
  await enviarAvisoDePrueba(aviso);
  return true;
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
    const [eventos, ajustes, { epocas, registro }, energia, salidas, alarmas, adelantos, nivel, planes, recordatorios, correo] =
      await Promise.all([
        // Con el plan empresa, también sus turnos y eventos (sus tareas no: no se pasan a mañana).
        leerAgenda({ tareas: false }),
        leerAjustesAvisos(),
        leerEpocas(),
        leerAjuste<Energia>(`energia:${hoy}`, 'normal'),
        leerSalidas(),
        leerAlarmas(),
        leerAdelantos(),
        nivelEfectivo(),
        leerPlanes(),
        leerRecordatorios(),
        leerCorreos(),
      ]);
    // Época dorada activa (o que empieza estos días) con su plan, para sus avisos.
    const epoca = epocaProxima(epocas, hoy, DIAS_A_PROGRAMAR);
    const datosEpoca = epoca
      ? { epoca, plan: planificarEpoca({ epoca, eventos, registro, hoy, energias: { [hoy]: energia } }) }
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
        alarmas: { lista: alarmas.alarmas, ajustes: alarmas.ajustes, adelantos, comoAvisos: nivel === 'avisos' },
        // Planes (fase 8): "Recordar a todos 3 h antes".
        planes,
        // Recordatorios a clientes (fase 10): el día antes, a la hora elegida.
        recordatorios,
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
    suscribirseRecordatorios(reprogramarEnUnMomento), // recordatorios a clientes (fase 10)
    suscribirseCorreos(reprogramarEnUnMomento), // plazos que llegaron por correo (fase 11)
    suscribirseEmpresa(reprogramarEnUnMomento), // turnos y eventos de empresa (fase 15)
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
  | { pantalla: 'empresa'; seccion?: string; id?: string } // plan empresa (fase 15)
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
  // "Enviar por WhatsApp" (cliente, fase 10): abre el chat del cliente con el recordatorio
  // escrito y apunta el envío, así la ficha lo enseña y no se vuelve a avisar.
  if (accion === 'whatsapp' && datos.mensaje && datos.telefono && datos.destino.pantalla === 'evento') {
    await mandarRecordatorio(
      claveEnvio(datos.destino.id, datos.dia),
      enlaceWhatsapp(datos.mensaje, datos.telefono),
    ).catch(() => {});
    return datos.destino;
  }
  // "Recordar por WhatsApp" (planes, fase 8): lo mismo, con el recordatorio del plan.
  if (accion === 'whatsapp' && datos.mensaje) {
    await Linking.openURL(enlaceWhatsapp(datos.mensaje)).catch(() => {});
  }
  return datos.destino;
}
