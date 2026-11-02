import type { LugarEvento, Repeticion, TipoEvento } from '@/data/eventos/tipos';
import type { ClaveDia } from '@/services/fechas';

// Datos para abrir la ficha de evento ya rellena (/evento?propuesta=<id>), por
// ejemplo desde la captura rápida: con lo que ha entendido la IA o, si algo ha
// fallado, solo con la frase como título y un mensaje corto.
// Se pasan en memoria (no en la dirección de la página) para no dejar la frase
// a la vista en la barra del navegador.

export type BorradorFicha = {
  titulo: string;
  fecha?: ClaveDia;
  horaInicio?: string | null;
  horaFin?: string | null;
  tipo?: TipoEvento;
  lugar?: LugarEvento | null;
  flexible?: boolean;
  duracionMin?: number | null;
  avisarA?: string | null; // tarea con aviso a esa hora (recordatorio)
  avisoMin?: number | null; // cita: antelación del aviso pedida; null = la del perfil
  repeticion?: Repeticion;
  dias?: number[] | null; // semanal: qué días (lunes = 0)
  hasta?: ClaveDia | null; // último día en que se repite
  mensaje?: string; // se enseña arriba de la ficha
};

// Solo hace falta el último: si se abre otro, el anterior ya no sirve.
let ultimo: { id: string; borrador: BorradorFicha } | null = null;

export function dejarBorrador(borrador: BorradorFicha): string {
  const id = Date.now().toString(36);
  ultimo = { id, borrador };
  return id;
}

// Se puede leer varias veces (React puede pintar la ficha dos veces al abrirla).
export function leerBorrador(id: string | undefined): BorradorFicha | null {
  return id && ultimo?.id === id ? ultimo.borrador : null;
}
