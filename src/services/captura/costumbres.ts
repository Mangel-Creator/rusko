import type { Evento, LugarEvento, TipoEvento } from '@/data/eventos/tipos';

import { claveTitulo, type TiposAprendidos } from './aprendido';
import type { Propuesta } from './validar';

// Cómo suele apuntar las cosas cada persona, sin gastar IA (02/11/2026): título, tipo,
// horas y sitio de lo que ya tiene en la agenda, con el tipo que corrigió a mano
// (aprendido.ts) por encima. A la IA le llega esta lista corta para que repita sus
// títulos, tipos y horas; y la app rellena sola el sitio de lo que ya conoce.

export type Costumbre = {
  titulo: string;
  tipo: TipoEvento;
  lugar: LugarEvento | null; // solo Casa o un sitio habitual
  horas: string | null; // "18:00-20:00" o null (tareas)
};

export const MAX_COSTUMBRES = 30;

// Sus eventos de los más nuevos a los más viejos, sin repetir título y sin los de ejemplo.
export function costumbresDe(eventos: readonly Evento[], aprendidos: TiposAprendidos = {}): Costumbre[] {
  const vistas = new Set<string>();
  const lista: Costumbre[] = [];
  const recientes = eventos.filter((e) => !e.ejemplo).sort((a, b) => b.fecha.localeCompare(a.fecha));
  for (const e of recientes) {
    const clave = claveTitulo(e.titulo);
    if (!clave || vistas.has(clave)) continue;
    vistas.add(clave);
    lista.push({
      titulo: e.titulo,
      tipo: aprendidos[clave] ?? e.tipo,
      lugar: e.lugar && e.lugar.tipo !== 'otro' ? e.lugar : null,
      horas: e.horaInicio && e.horaFin ? `${e.horaInicio}-${e.horaFin}` : null,
    });
    if (lista.length >= MAX_COSTUMBRES) break;
  }
  return lista;
}

// Si no se dijo sitio y ese título ya lo tiene apuntado en un sitio suyo, ese sitio.
export function aplicarCostumbres(propuesta: Propuesta, costumbres: readonly Costumbre[]): Propuesta {
  if (propuesta.lugar) return propuesta;
  const conocida = costumbres.find((c) => claveTitulo(c.titulo) === claveTitulo(propuesta.titulo));
  return conocida?.lugar ? { ...propuesta, lugar: conocida.lugar } : propuesta;
}
