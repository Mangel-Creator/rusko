import { useEffect, useSyncExternalStore } from 'react';

import { guardarAjuste, leerAjuste } from '@/data/ajustes';
import { claveDia } from '@/services/fechas';

import { crearEjemplos } from './ejemplos';
// En el móvil carga repositorio.ts (SQLite) y en la web repositorio.web.ts.
import { repositorio } from './repositorio';
import type { Cuadrante, Evento } from './tipos';

export type { Cuadrante, DatosCliente, Evento, LugarEvento, OrigenEvento, Repeticion, TipoEvento } from './tipos';

// Eventos del calendario. Se leen todos del dispositivo una vez y se guardan
// en memoria para que todas las pantallas vean lo mismo al momento.
//
//   - En pantallas: const { cargado, eventos } = useEventos();
//   - Para cambiar: crearEvento, guardarEvento, borrarEvento, marcarHecha...

export type EstadoEventos = { cargado: boolean; eventos: Evento[] };

let estado: EstadoEventos = { cargado: false, eventos: [] };
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function cambiar(eventos: Evento[]) {
  estado = { cargado: true, eventos };
  oyentes.forEach((avisar) => avisar());
}

const CLAVE_EJEMPLOS = 'ejemplosCreados';

export function cargarEventos(): Promise<void> {
  if (!cargando) {
    cargando = (async () => {
      let eventos = await repositorio.leerTodos();
      // En modo desarrollo, la primera vez se crean eventos de ejemplo.
      if (__DEV__ && eventos.length === 0 && !(await leerAjuste(CLAVE_EJEMPLOS, false))) {
        const ejemplos = crearEjemplos(claveDia(new Date()));
        for (const e of ejemplos) await repositorio.guardar(e);
        await guardarAjuste(CLAVE_EJEMPLOS, true);
        eventos = ejemplos;
      }
      cambiar(eventos);
    })();
    // Después de cargar (desde dentro esperaría a sí misma). Y cada hora, por si
    // la web se queda abierta días seguidos.
    void cargando.then(() => {
      void borrarTareasHechasAntiguas();
      setInterval(() => void borrarTareasHechasAntiguas(), 60 * 60 * 1000);
    });
  }
  return cargando;
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Las tareas marcadas como hechas se borran solas a las 24 h si no se desmarcan.
// Las del plan de estudio (id "epoca-", ver PREFIJO_EPOCA) no: las lleva su época.
// Las que se marcaron antes de existir "hechaEn" empiezan a contar ahora.
async function borrarTareasHechasAntiguas(): Promise<void> {
  const ahora = Date.now();
  const fechar: Evento[] = [];
  const borrar: string[] = [];
  for (const e of estado.eventos) {
    if (!e.flexible || !e.hecha || e.id.startsWith('epoca-')) continue;
    if (!e.hechaEn) fechar.push({ ...e, hechaEn: new Date(ahora).toISOString() });
    else if (ahora - Date.parse(e.hechaEn) >= UN_DIA_MS) borrar.push(e.id);
  }
  await cambiarEventos(fechar, borrar);
}

export function nuevoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Crea o actualiza un evento.
export async function guardarEvento(evento: Evento): Promise<void> {
  await cargarEventos();
  await repositorio.guardar(evento);
  cambiar([...estado.eventos.filter((e) => e.id !== evento.id), evento]);
}

export async function borrarEvento(id: string): Promise<void> {
  await cargarEventos();
  await repositorio.borrar(id);
  cambiar(estado.eventos.filter((e) => e.id !== id));
}

// Muchos cambios de una vez (al traer otro calendario): se avisa a las pantallas una sola vez.
export async function cambiarEventos(guardar: Evento[], borrar: string[]): Promise<void> {
  if (guardar.length === 0 && borrar.length === 0) return;
  await cargarEventos();
  await repositorio.cambiarVarios(guardar, borrar);
  const quitar = new Set([...borrar, ...guardar.map((e) => e.id)]);
  cambiar([...estado.eventos.filter((e) => !quitar.has(e.id)), ...guardar]);
}

export async function marcarHecha(id: string, hecha: boolean): Promise<void> {
  const evento = estado.eventos.find((e) => e.id === id);
  if (evento) await guardarEvento({ ...evento, hecha, hechaEn: hecha ? new Date().toISOString() : null });
}

// Coloca una tarea en la matriz de Eisenhower (null = sin clasificar).
export async function clasificarTarea(id: string, cuadrante: Cuadrante | null): Promise<void> {
  const evento = estado.eventos.find((e) => e.id === id);
  if (evento) await guardarEvento({ ...evento, cuadrante });
}

// Pasa varias tareas flexibles a otro día (por ejemplo, "Pasar el resto a mañana").
export async function moverTareas(ids: string[], fecha: string): Promise<void> {
  for (const id of ids) {
    const evento = estado.eventos.find((e) => e.id === id);
    if (evento) await guardarEvento({ ...evento, fecha });
  }
}

export async function crearEventosEjemplo(): Promise<number> {
  await borrarEventosEjemplo();
  const ejemplos = crearEjemplos(claveDia(new Date()));
  for (const e of ejemplos) await repositorio.guardar(e);
  cambiar([...estado.eventos, ...ejemplos]);
  return ejemplos.length;
}

export async function borrarEventosEjemplo(): Promise<number> {
  await cargarEventos();
  const cuantos = estado.eventos.filter((e) => e.ejemplo).length;
  await repositorio.borrarEjemplos();
  cambiar(estado.eventos.filter((e) => !e.ejemplo));
  return cuantos;
}

function suscribirse(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

// Para la lógica sin pantallas (por ejemplo, programar los avisos).
export async function leerEventos(): Promise<Evento[]> {
  await cargarEventos();
  return estado.eventos;
}

export { suscribirse as suscribirseEventos };

function leerEstado() {
  return estado;
}

// Hook para usar los eventos en pantallas. Los carga la primera vez.
export function useEventos(): EstadoEventos {
  useEffect(() => {
    cargarEventos();
  }, []);
  return useSyncExternalStore(suscribirse, leerEstado, leerEstado);
}
