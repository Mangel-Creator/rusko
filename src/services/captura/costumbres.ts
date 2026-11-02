import type { Evento, LugarEvento, TipoEvento } from '@/data/eventos/tipos';

import type { Propuesta } from './validar';

// Memoria de cada persona sin gastar IA (02/11/2026). Dos fuentes, las dos en el
// dispositivo:
//   - Sus correcciones: lo que cambió a mano en la tarjeta o en la ficha (data/costumbres).
//   - Lo que ya tiene apuntado: título, tipo, horas y sitio de sus eventos.
// Se usa dos veces: la app aplica sola lo que ya sabe (aplicarCostumbres) y a la IA le
// llega una lista corta para que use los mismos títulos, tipos y horas.

export type Correccion = { titulo: string; tipo: TipoEvento; lugar: LugarEvento | null };

export type Costumbre = {
  titulo: string;
  tipo: TipoEvento;
  lugar: LugarEvento | null; // solo Casa o un sitio habitual
  horas: string | null; // "18:00-20:00" o null (tareas)
  corregida: boolean; // la cambió la persona: manda sobre la IA
};

export const MAX_COSTUMBRES = 30;

// «Clase de Inglés » y «clase de ingles» son lo mismo.
export function claveTitulo(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es-ES')
    .replace(/\s+/g, ' ')
    .trim();
}

function lugarReferencia(lugar: LugarEvento | null | undefined): LugarEvento | null {
  return lugar && lugar.tipo !== 'otro' ? lugar : null;
}

// Primero las correcciones; luego sus eventos, de los más nuevos a los más viejos, sin
// repetir título y sin los de ejemplo.
export function costumbresDe(eventos: readonly Evento[], correcciones: readonly Correccion[]): Costumbre[] {
  const vistas = new Set<string>();
  const lista: Costumbre[] = [];
  const anadir = (c: Costumbre) => {
    const clave = claveTitulo(c.titulo);
    if (!clave || vistas.has(clave) || lista.length >= MAX_COSTUMBRES) return;
    vistas.add(clave);
    lista.push(c);
  };
  for (const c of correcciones) {
    const evento = eventos.find((e) => claveTitulo(e.titulo) === claveTitulo(c.titulo));
    anadir({ ...c, lugar: lugarReferencia(c.lugar), horas: horasDe(evento), corregida: true });
  }
  const recientes = eventos.filter((e) => !e.ejemplo).sort((a, b) => b.fecha.localeCompare(a.fecha));
  for (const e of recientes) {
    anadir({ titulo: e.titulo, tipo: e.tipo, lugar: lugarReferencia(e.lugar), horas: horasDe(e), corregida: false });
  }
  return lista;
}

function horasDe(evento: Evento | undefined): string | null {
  return evento?.horaInicio && evento.horaFin ? `${evento.horaInicio}-${evento.horaFin}` : null;
}

// Si el título ya lo conoce, pone el tipo que usa la persona y, si no se dijo sitio, el
// suyo. Solo las correcciones cambian el tipo que eligió la IA: lo apuntado sin
// corregir solo rellena el sitio que falta.
export function aplicarCostumbres(propuesta: Propuesta, costumbres: readonly Costumbre[]): Propuesta {
  const conocida = costumbres.find((c) => claveTitulo(c.titulo) === claveTitulo(propuesta.titulo));
  if (!conocida) return propuesta;
  return {
    ...propuesta,
    tipo: conocida.corregida ? conocida.tipo : propuesta.tipo,
    lugar: propuesta.lugar ?? conocida.lugar,
  };
}
