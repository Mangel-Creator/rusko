import { useEffect, useSyncExternalStore } from 'react';

import { guardarAjuste, leerAjuste } from '@/data/ajustes';
import { claveDia, sumarDias, type ClaveDia } from '@/services/fechas';

import { crearEpocaEjemplo } from './ejemplo';
// En el móvil carga repositorio.ts (SQLite) y en la web repositorio.web.ts.
import { repositorio } from './repositorio';
import type { BloqueGuardado, Epoca, EstadoBloque, PlanesDelDia, RegistroBloque } from './tipos';

export type {
  AvisosEpoca,
  BloqueGuardado,
  Descanso,
  Dificultad,
  Epoca,
  EstadoBloque,
  Hito,
  Imprescindible,
  PlanesDelDia,
  RegistroBloque,
  RitmoEpoca,
  TemaHito,
  TipoEpoca,
} from './tipos';
export { normalizarTemas } from './tipos';

// Épocas doradas y el registro de bloques hechos o saltados. Se leen una vez
// y se guardan en memoria para que todas las pantallas vean lo mismo.
//
//   - En pantallas: const { cargado, epocas, registro } = useEpocas();
//   - Fuera de pantallas: await leerEpocas();  y  suscribirseEpocas(avisar)
//   - Para cambiar: guardarEpoca, borrarEpoca, terminarEpoca, marcarBloque...
// La lógica (qué época está activa, el plan...) está en services/epoca.

export type EstadoEpocas = {
  cargado: boolean;
  epocas: Epoca[];
  registro: RegistroBloque[];
  planesDelDia: PlanesDelDia; // lo que cada día tenía previsto (ver tipos.ts)
};

let estado: EstadoEpocas = { cargado: false, epocas: [], registro: [], planesDelDia: {} };
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function cambiar(cambios: Partial<EstadoEpocas>) {
  estado = { ...estado, ...cambios, cargado: true };
  oyentes.forEach((avisar) => avisar());
}

const CLAVE_EJEMPLO = 'epocaEjemploCreada';
const CLAVE_PLANES_DEL_DIA = 'planesDelDia';
// Días que se guarda lo previsto: lo justo para preguntar por lo que quedó sin marcar.
const DIAS_PLANES_DEL_DIA = 10;

export function cargarEpocas(): Promise<void> {
  if (!cargando) {
    cargando = (async () => {
      let [epocas, registro] = await Promise.all([repositorio.leerEpocas(), repositorio.leerRegistro()]);
      const planesDelDia = await leerAjuste<PlanesDelDia>(CLAVE_PLANES_DEL_DIA, {});
      // En modo desarrollo, la primera vez se crea una época de ejemplo.
      if (__DEV__ && epocas.length === 0 && !(await leerAjuste(CLAVE_EJEMPLO, false))) {
        const ejemplo = crearEpocaEjemplo(claveDia(new Date()));
        await repositorio.guardarEpoca(ejemplo.epoca);
        for (const r of ejemplo.registro) await repositorio.guardarRegistro(r);
        await guardarAjuste(CLAVE_EJEMPLO, true);
        epocas = [ejemplo.epoca];
        registro = [...registro, ...ejemplo.registro];
      }
      cambiar({ epocas, registro, planesDelDia });
    })();
  }
  return cargando;
}

export function nuevoIdEpoca(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Crea o actualiza una época (con sus hitos).
export async function guardarEpoca(epoca: Epoca): Promise<void> {
  await cargarEpocas();
  await repositorio.guardarEpoca(epoca);
  cambiar({ epocas: [...estado.epocas.filter((e) => e.id !== epoca.id), epoca] });
}

export async function borrarEpoca(id: string): Promise<void> {
  await cargarEpocas();
  await repositorio.borrarEpoca(id);
  cambiar({
    epocas: estado.epocas.filter((e) => e.id !== id),
    registro: estado.registro.filter((r) => r.epocaId !== id),
  });
}

// Termina la época hoy mismo: pasa a ser de ayer y la app vuelve al ritmo normal.
export async function terminarEpoca(id: string): Promise<void> {
  const epoca = estado.epocas.find((e) => e.id === id);
  if (!epoca) return;
  const ayer = sumarDias(claveDia(new Date()), -1);
  await guardarEpoca({ ...epoca, fin: ayer, inicio: epoca.inicio > ayer ? ayer : epoca.inicio });
}

export async function marcarResumenVisto(id: string): Promise<void> {
  const epoca = estado.epocas.find((e) => e.id === id);
  if (epoca) await guardarEpoca({ ...epoca, resumenVisto: true });
}

export type BloqueAMarcar = Pick<RegistroBloque, 'id' | 'epocaId' | 'hitoId' | 'dia' | 'inicio' | 'fin'>;
export type Marca = { bloque: BloqueAMarcar; estado: EstadoBloque | null; motivo?: string | null };

// Marca un bloque del plan como hecho o saltado (o lo deja pendiente con null).
// "motivo" es por qué no se hizo, si lo quiere apuntar (solo en los saltados).
export function marcarBloque(bloque: BloqueAMarcar, nuevo: EstadoBloque | null, motivo?: string | null): Promise<void> {
  return marcarBloques([{ bloque, estado: nuevo, motivo }]);
}

// Varios de una vez (lo que se quedó sin marcar de un día).
export async function marcarBloques(marcas: Marca[]): Promise<void> {
  await cargarEpocas();
  const ids = new Set(marcas.map((m) => m.bloque.id));
  const nuevos: RegistroBloque[] = [];
  for (const { bloque, estado: nuevo, motivo } of marcas) {
    const { id, epocaId, hitoId, dia, inicio, fin } = bloque;
    if (nuevo === null) {
      await repositorio.borrarRegistro(id);
      continue;
    }
    const texto = nuevo === 'saltado' ? motivo?.trim() || null : null;
    const registro: RegistroBloque = { id, epocaId, hitoId, dia, inicio, fin, estado: nuevo, motivo: texto };
    await repositorio.guardarRegistro(registro);
    nuevos.push(registro);
  }
  cambiar({ registro: [...estado.registro.filter((r) => !ids.has(r.id)), ...nuevos] });
}

// Guarda lo que el plan de hoy tiene previsto (los bloques pendientes). Solo escribe
// si ha cambiado, y olvida lo de hace más de unos días. Una lista vacía también se
// guarda: dice que el plan de ese día ya se miró (y que no queda nada).
export async function guardarPlanDelDia(epocaId: string, dia: ClaveDia, bloques: BloqueGuardado[]): Promise<void> {
  await cargarEpocas();
  const clave = `${epocaId}:${dia}`;
  const antes = estado.planesDelDia[clave];
  if (antes && JSON.stringify(antes) === JSON.stringify(bloques)) return;
  const desde = sumarDias(dia, -DIAS_PLANES_DEL_DIA);
  const planesDelDia: PlanesDelDia = {};
  for (const [otra, lista] of Object.entries(estado.planesDelDia)) {
    const suDia = otra.slice(otra.lastIndexOf(':') + 1);
    if (suDia >= desde && otra !== clave) planesDelDia[otra] = lista;
  }
  planesDelDia[clave] = bloques;
  cambiar({ planesDelDia });
  await guardarAjuste(CLAVE_PLANES_DEL_DIA, planesDelDia);
}

export async function crearEpocaDeEjemplo(): Promise<void> {
  await borrarEpocasDeEjemplo();
  const ejemplo = crearEpocaEjemplo(claveDia(new Date()));
  await repositorio.guardarEpoca(ejemplo.epoca);
  for (const r of ejemplo.registro) await repositorio.guardarRegistro(r);
  cambiar({ epocas: [...estado.epocas, ejemplo.epoca], registro: [...estado.registro, ...ejemplo.registro] });
}

export async function borrarEpocasDeEjemplo(): Promise<number> {
  await cargarEpocas();
  const ejemplos = estado.epocas.filter((e) => e.ejemplo);
  for (const e of ejemplos) await borrarEpoca(e.id);
  return ejemplos.length;
}

export function suscribirseEpocas(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

// Para la lógica sin pantallas (por ejemplo, programar los avisos).
export async function leerEpocas(): Promise<EstadoEpocas> {
  await cargarEpocas();
  return estado;
}

function leerEstado() {
  return estado;
}

export function useEpocas(): EstadoEpocas {
  useEffect(() => {
    cargarEpocas();
  }, []);
  return useSyncExternalStore(suscribirseEpocas, leerEstado, leerEstado);
}
