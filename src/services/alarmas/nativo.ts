import { useSyncExternalStore } from 'react';
import type { AlarmAction, AlarmWeekday } from 'react-native-alarm-scheduler';

import { guardarAjuste, leerAjuste } from '@/data/ajustes';
import { MINUTOS_POSPONER } from '@/services/avisos/tipos';

import { diferencias, firma, type DefinicionNativa, type Programadas } from './definiciones';
import { moduloAlarmas, nivelPosible, type NivelAlarmas } from './nivel';

// Alarmas de verdad en la app propia (fase 7), con react-native-alarm-scheduler:
// AlarmKit en iPhone (iOS 26 o más) y AlarmManager con pantalla completa en Android.
// En Expo Go y en la web el módulo no existe y todo esto no hace nada.
//
// SIN PROBAR EN UN MÓVIL: solo funciona en una build de EAS (ver CLAUDE.md > Fase 7).
//
//   - permisoAlarmas(pedir): el permiso de alarmas (AlarmKit / alarmas exactas).
//   - nivelEfectivo(): "nativo" solo si hay módulo y permiso; si no, "avisos".
//   - sincronizarNativas(definiciones): deja en el móvil justo esas alarmas.
//   - atenderAlarmasNativas(): qué pasó mientras la app estaba cerrada ("Posponer",
//     "Cómo llegar"). Se llama al abrir la app y cada vez que vuelve a primer plano.

export type EstadoPermisoAlarmas = 'concedido' | 'denegado' | 'sin-preguntar' | 'no-disponible';

export type PermisoAlarmas = {
  estado: EstadoPermisoAlarmas;
  pantallaCompleta: boolean; // Android 14+: sin él, suena pero sin pantalla completa
};

let permiso: PermisoAlarmas = { estado: 'no-disponible', pantallaCompleta: true };
const oyentes = new Set<() => void>();

function cambiarPermiso(nuevo: PermisoAlarmas) {
  if (nuevo.estado === permiso.estado && nuevo.pantallaCompleta === permiso.pantallaCompleta) return;
  permiso = nuevo;
  oyentes.forEach((o) => o());
}

export async function permisoAlarmas(pedir = false): Promise<PermisoAlarmas> {
  const m = moduloAlarmas();
  if (!m || nivelPosible() !== 'nativo') return permiso;
  try {
    const r = pedir ? await m.requestPermissionsAsync() : await m.getPermissionsAsync();
    const estado: EstadoPermisoAlarmas =
      r.status === 'notDetermined'
        ? 'sin-preguntar'
        : r.canScheduleExactAlarms && r.status !== 'denied' && r.status !== 'unavailable'
          ? 'concedido'
          : 'denegado';
    cambiarPermiso({ estado, pantallaCompleta: r.canUseFullScreenIntent !== false });
  } catch {
    cambiarPermiso({ estado: 'no-disponible', pantallaCompleta: true });
  }
  return permiso;
}

// Abre los ajustes del sistema donde se da el permiso (alarmas exactas en Android).
export async function abrirAjustesAlarmas(): Promise<void> {
  const m = moduloAlarmas();
  if (!m) return;
  if (!permiso.pantallaCompleta && permiso.estado === 'concedido') {
    await m.openFullScreenIntentSettingsAsync().catch(() => false);
  } else {
    await m.openAlarmSettingsAsync().catch(() => false);
  }
}

export function suscribirsePermisoAlarmas(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function leerPermiso() {
  return permiso;
}

export function usePermisoAlarmas(): PermisoAlarmas {
  return useSyncExternalStore(suscribirsePermisoAlarmas, leerPermiso, leerPermiso);
}

// Con el permiso que se sabe ahora mismo (sin preguntar al sistema).
export function nivelActual(): NivelAlarmas {
  const posible = nivelPosible();
  if (posible !== 'nativo') return posible;
  return permiso.estado === 'concedido' ? 'nativo' : 'avisos';
}

export async function nivelEfectivo(): Promise<NivelAlarmas> {
  if (nivelPosible() === 'nativo') await permisoAlarmas();
  return nivelActual();
}

export function useNivelAlarmas(): NivelAlarmas {
  usePermisoAlarmas();
  return nivelActual();
}

// --- Lo programado ---

type Info = Pick<DefinicionNativa, 'tipo' | 'titulo' | 'eventoId' | 'dia'>;
type Registro = {
  programadas: Record<string, Programadas[string] & Info>;
  pospuestas: ({ uuid: string; hasta: string } & Info)[];
};

const CLAVE = 'alarmasNativas';

async function leerRegistro(): Promise<Registro> {
  const r = await leerAjuste<Registro>(CLAVE, { programadas: {}, pospuestas: [] });
  return { programadas: r?.programadas ?? {}, pospuestas: r?.pospuestas ?? [] };
}

function nuevoUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === 'x' ? n : (n & 0x3) | 0x8).toString(16);
  });
}

async function programar(uuid: string, d: Omit<DefinicionNativa, 'clave'>): Promise<void> {
  const m = moduloAlarmas();
  if (!m) return;
  const metadata: Record<string, string> = { tipo: d.tipo };
  if (d.eventoId) metadata.eventoId = d.eventoId;
  if (d.dia) metadata.dia = d.dia;
  await m.scheduleAlarmAsync({
    id: uuid,
    hour: d.hora,
    minute: d.minuto,
    title: d.titulo,
    weekdays: d.diasIso as AlarmWeekday[],
    // Android copia estas opciones de las de iOS.
    ios: {
      metadata,
      alertTitle: d.titulo,
      stopButtonTitle: 'Parar',
      // AlarmKit solo deja un botón más: "Posponer" o, en las de salida, "Cómo llegar".
      // Los dos abren la app, que pospone o enseña la ruta (atenderAlarmasNativas).
      secondaryButtonTitle: d.tipo === 'salida' ? 'Cómo llegar' : `Posponer ${MINUTOS_POSPONER} min`,
      secondaryButtonBehavior: 'openApp',
      stopIntentBehavior: 'recordOnly',
      silent: d.vibrar,
    },
    android: {
      alertBody: d.tipo === 'salida' ? 'Hora de salir' : 'Rusko',
      maxRingDurationSeconds: 300,
    },
  });
}

let cola: Promise<unknown> = Promise.resolve();

// Deja en el móvil justo estas alarmas. Primero programa las nuevas o cambiadas y
// después quita las viejas: si algo falla a medias, sigue sonando la de antes.
export function sincronizarNativas(deseadas: DefinicionNativa[]): Promise<void> {
  const tarea = cola.then(async () => {
    const m = moduloAlarmas();
    if (!m) return;
    const registro = await leerRegistro();
    const { crear, quitar } = diferencias(registro.programadas, deseadas);
    for (const d of crear) {
      const uuid = nuevoUuid();
      try {
        await programar(uuid, d);
      } catch {
        continue; // se queda la anterior (si la había) y se reintenta la próxima vez
      }
      const anterior = registro.programadas[d.clave];
      registro.programadas[d.clave] = {
        uuid,
        firma: firma(d),
        tipo: d.tipo,
        titulo: d.titulo,
        eventoId: d.eventoId,
        dia: d.dia,
      };
      if (anterior) await m.cancelAlarmAsync(anterior.uuid).catch(() => false);
    }
    for (const { clave, uuid } of quitar) {
      if (registro.programadas[clave]?.uuid !== uuid) continue; // ya sustituida arriba
      if (deseadas.some((d) => d.clave === clave)) continue; // su nueva versión falló: se queda
      await m.cancelAlarmAsync(uuid).catch(() => false);
      delete registro.programadas[clave];
    }
    // Las pospuestas que ya sonaron.
    const ahora = Date.now();
    registro.pospuestas = registro.pospuestas.filter((p) => new Date(p.hasta).getTime() > ahora - 60000);
    await guardarAjuste(CLAVE, registro);
  });
  cola = tarea.catch(() => {});
  return tarea;
}

// Quita todas (por ejemplo, si se retira el permiso y pasan a ser avisos).
export function quitarTodasLasNativas(): Promise<void> {
  return sincronizarNativas([]);
}

// "Posponer 5 min": otra alarma, de una vez, dentro de 5 minutos.
async function posponer(info: Info): Promise<Date> {
  const cuando = new Date(Date.now() + MINUTOS_POSPONER * 60000);
  cuando.setSeconds(0, 0);
  cuando.setMinutes(cuando.getMinutes() + 1); // redondeado al minuto siguiente
  const uuid = nuevoUuid();
  await programar(uuid, {
    ...info,
    hora: cuando.getHours(),
    minuto: cuando.getMinutes(),
    diasIso: [],
    vibrar: false,
  });
  const registro = await leerRegistro();
  registro.pospuestas.push({ uuid, hasta: cuando.toISOString(), ...info });
  await guardarAjuste(CLAVE, registro);
  return cuando;
}

export type ResultadoAlarma =
  | { que: 'pospuesta'; hasta: Date }
  | { que: 'como-llegar'; eventoId: string; dia: string }
  | null;

// Busca la alarma por su identificador del sistema.
async function infoDe(uuid: string): Promise<Info | null> {
  const registro = await leerRegistro();
  const programada = Object.values(registro.programadas).find((p) => p.uuid === uuid);
  if (programada) return programada;
  return registro.pospuestas.find((p) => p.uuid === uuid) ?? null;
}

async function atenderAccion(accion: AlarmAction): Promise<ResultadoAlarma> {
  if (accion.action !== 'secondaryOpen' && accion.action !== 'snooze') return null;
  const info = await infoDe(accion.alarmId);
  if (!info) return null;
  if (info.tipo === 'salida' && info.eventoId && info.dia) {
    return { que: 'como-llegar', eventoId: info.eventoId, dia: info.dia };
  }
  return { que: 'pospuesta', hasta: await posponer(info) };
}

// Lo que pulsó el usuario en una alarma mientras la app estaba cerrada o en segundo
// plano. Los eventos de la librería solo llegan con la app viva: por eso se mira
// lo guardado cada vez que se abre.
export async function atenderAlarmasNativas(): Promise<ResultadoAlarma> {
  const m = moduloAlarmas();
  if (!m) return null;
  try {
    const entrega = await m.getPendingNativeAlarmHandoffAsync();
    await m.clearPendingNativeAlarmHandoffAsync();
    const pendientes = await m.getPendingAlarmActionsAsync();
    await m.clearPendingAlarmActionsAsync(pendientes.map((a) => a.id));
    const acciones = entrega ? [entrega, ...pendientes.filter((a) => a.id !== entrega.id)] : pendientes;
    let resultado: ResultadoAlarma = null;
    for (const accion of acciones) {
      resultado = (await atenderAccion(accion)) ?? resultado;
    }
    return resultado;
  } catch {
    return null;
  }
}
