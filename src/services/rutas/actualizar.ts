import { AppState } from 'react-native';

import { leerAgenda, suscribirseAgenda } from '@/data/agenda';
import { guardarHorasPunta, leerHorasPunta, type Trayecto } from '@/data/horasPunta';
import { cargarPerfil, leerPerfil, suscribirsePerfil, type Perfil } from '@/data/perfil';
import { guardarSalidas, leerSalidas, type Salida, type Salidas } from '@/data/salidas';
import { sitioTrabajo } from '@/services/agenda';
import { claveDia, diaSemanaDesdeLunes, fechaDesdeClave, sumarDias } from '@/services/fechas';
import { ubicacionActual } from '@/services/ubicacion';

import { hayQueRecalcular, proximasCitas, YA_ESTAS_ALLI_M } from './citas';
import { horasDeAtasco, MINUTOS_MUESTRA, type Muestra } from './horasPunta';
import { calcularRutas } from './index';
import { distanciaM } from './distancia';
import { pedirAlServidor } from './servidor';
import { horaDeSalida } from './textos';
import { modoDeViaje, type Punto } from './tipos';

// Lo que se recalcula solo, sin que el usuario haga nada (fase 6):
//   - La hora de salida de las citas con lugar de las próximas 24 horas (para Hoy,
//     el Mapa y el aviso "Sal ya").
//   - Una vez por semana, las horas punta de casa al trabajo y vuelta.
//
// Se hace al abrir la app, al volver a ella, al cambiar eventos o perfil y cada
// 10 minutos con la app abierta. En segundo plano no: ni iOS ni Expo Go dejan
// hacerlo de forma fiable (ver CLAUDE.md > Fase 6).

function puntoDe(c: { latitud: number; longitud: number } | null | undefined): Punto | null {
  return c ? [c.latitud, c.longitud] : null;
}

// Desde dónde se sale: donde estás ahora; si no se sabe, desde casa.
async function origenActual(perfil: Perfil): Promise<Punto | null> {
  return (await ubicacionActual()) ?? puntoDe(perfil.vivienda.coordenadas);
}

function iguales(a: Salidas, b: Salidas): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function actualizarSalidas(): Promise<void> {
  const perfil = await leerPerfil();
  const anteriores = await leerSalidas();
  const modo = modoDeViaje(perfil?.transporte);
  if (!perfil || !modo) {
    if (Object.keys(anteriores).length > 0) await guardarSalidas({});
    return;
  }
  const ahora = new Date();
  const citas = proximasCitas(await leerAgenda({ tareas: false }), perfil, ahora);
  const origen = citas.length > 0 ? await origenActual(perfil) : null;

  const nuevas: Salidas = {};
  let sinServidor = false;
  for (const cita of citas) {
    if (!origen || distanciaM(origen, cita.destino) < YA_ESTAS_ALLI_M) continue;
    const previa = anteriores[cita.clave];
    const base = { titulo: cita.evento.titulo, lugar: cita.lugar };
    if (previa && previa.modo === modo && !hayQueRecalcular(previa, ahora, origen, cita.llegada)) {
      nuevas[cita.clave] = { ...previa, ...base };
      continue;
    }
    if (sinServidor) continue;
    const resultado = await calcularRutas({
      origen,
      destino: cita.destino,
      modo,
      alternativas: 0,
      llegada: cita.llegada.toISOString(),
    });
    const ruta = resultado.estado === 'ok' ? resultado.rutas[0] : undefined;
    if (!ruta) {
      if (resultado.estado === 'sin-servidor') sinServidor = true;
      // Sin conexión: se conserva la estimación anterior, si la había.
      if (previa && previa.modo === modo) nuevas[cita.clave] = { ...previa, ...base };
      continue;
    }
    const salida: Salida = {
      clave: cita.clave,
      eventoId: cita.evento.id,
      dia: cita.dia,
      ...base,
      llegada: cita.llegada.toISOString(),
      salida: horaDeSalida(cita.llegada, ruta.duracionSeg).toISOString(),
      duracionSeg: ruta.duracionSeg,
      retrasoSeg: ruta.retrasoSeg,
      modo,
      calculadaEl: ahora.toISOString(),
      origen,
    };
    nuevas[cita.clave] = salida;
  }
  if (!iguales(nuevas, anteriores)) await guardarSalidas(nuevas);
}

// --- Horas punta ---

const SEMANA_MS = 7 * 24 * 3600 * 1000;

// El próximo día de trabajo a partir de mañana (el tráfico de un laborable).
export function proximoLaborable(hoy: string, diasTrabajo: number[]): string {
  const dias = diasTrabajo.length > 0 ? diasTrabajo : [0, 1, 2, 3, 4];
  for (let n = 1; n <= 7; n++) {
    const dia = sumarDias(hoy, n);
    if (dias.includes(diaSemanaDesdeLunes(fechaDesdeClave(dia)))) return dia;
  }
  return sumarDias(hoy, 1);
}

type RespuestaMuestras = { trayectos: { minuto: number; duracionSeg: number | null }[][] };

export async function actualizarHorasPunta(): Promise<void> {
  const perfil = await leerPerfil();
  const modo = modoDeViaje(perfil?.transporte);
  if (!perfil || !modo || modo === 'a-pie') return;
  const casa = puntoDe(perfil.vivienda.coordenadas);
  const trabajo = puntoDe(sitioTrabajo(perfil)?.coordenadas);
  if (!casa || !trabajo || distanciaM(casa, trabajo) < YA_ESTAS_ALLI_M) return;

  const huella = JSON.stringify([modo, casa, trabajo]);
  const anterior = await leerHorasPunta();
  const reciente = anterior && Date.now() - new Date(anterior.calculadasEl).getTime() < SEMANA_MS;
  if (anterior && anterior.huella === huella && reciente) return;

  const dia = fechaDesdeClave(proximoLaborable(claveDia(new Date()), perfil.horario.diasTrabajo));
  const salidas = MINUTOS_MUESTRA.map((minuto) =>
    new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, minuto).toISOString(),
  );
  const respuesta = await pedirAlServidor<RespuestaMuestras>({
    accion: 'muestras',
    modo,
    salidas,
    trayectos: [
      { origen: casa, destino: trabajo },
      { origen: trabajo, destino: casa },
    ],
  });
  if (respuesta.estado !== 'ok') return;

  const nombres = ['Casa → Trabajo', 'Trabajo → Casa'];
  const trayectos: Trayecto[] = respuesta.datos.trayectos.map((muestras, i) => ({
    nombre: nombres[i] ?? `Trayecto ${i + 1}`,
    muestras: muestras
      .map((m, j) => ({ minuto: MINUTOS_MUESTRA[j], duracionSeg: m.duracionSeg }))
      .filter((m): m is Muestra => typeof m.duracionSeg === 'number'),
  }));
  await guardarHorasPunta({
    calculadasEl: new Date().toISOString(),
    huella,
    trayectos,
    horas: horasDeAtasco(trayectos.map((t) => t.muestras)),
  });
}

// --- Arranque ---

let cola: Promise<unknown> = Promise.resolve();

// Una actualización detrás de otra, nunca dos a la vez.
export function actualizarTrafico(): Promise<void> {
  const tarea = cola.then(async () => {
    const { perfil, bienvenidaCompletada } = await cargarPerfil();
    if (!perfil || !bienvenidaCompletada) return;
    await actualizarSalidas();
    await actualizarHorasPunta();
  });
  cola = tarea.catch(() => {});
  return tarea;
}

let espera: ReturnType<typeof setTimeout> | null = null;

function actualizarEnUnMomento() {
  if (espera) clearTimeout(espera);
  espera = setTimeout(() => {
    espera = null;
    actualizarTrafico().catch(() => {});
  }, 2000);
}

const CADA_MS = 10 * 60 * 1000;

// Se llama una vez al arrancar la app (_layout.tsx). Devuelve la función para pararlo.
export function iniciarTrafico(): () => void {
  actualizarEnUnMomento();
  // La agenda: tus eventos y, con el plan empresa, tus turnos y eventos de empresa (fase 15).
  const quitar = [suscribirseAgenda(actualizarEnUnMomento), suscribirsePerfil(actualizarEnUnMomento)];
  const app = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') actualizarEnUnMomento();
  });
  const reloj = setInterval(() => {
    if (AppState.currentState === 'active') actualizarEnUnMomento();
  }, CADA_MS);
  return () => {
    quitar.forEach((q) => q());
    app.remove();
    clearInterval(reloj);
  };
}
