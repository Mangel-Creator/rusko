import type { HoraPlan } from '@/data/planes';
import { claveDia, fechaDesdeClave, formatearFechaLarga, sumarDias } from '@/services/fechas';
import { enlaceWhatsapp } from '@/services/rutas/textos';

import { diaCorto } from './votos';

// Mensajes de los planes para WhatsApp. Funciones puras, con pruebas.
// WhatsApp solo se abre con el mensaje escrito (wa.me): la persona elige el chat o
// el grupo y lo envía ella. La app nunca envía nada sola.

export { enlaceWhatsapp };

// Página de votación: una ruta de la propia web de GitHub Pages. El código va detrás
// de "#", así no sale en los registros de ningún servidor.
export const URL_VOTACION = 'https://mangel-creator.github.io/rusko/votar';

export function enlaceVotacion(codigo: string): string {
  return `${URL_VOTACION}#${codigo}`;
}

// "Miguel te invita a: Cena de viernes. Elige hora, sin descargar nada: https://…"
export function textoInvitacion(organizador: string, titulo: string, enlace: string): string {
  const quien = organizador.trim() ? `${organizador.trim()} te invita a` : 'Te invitan a';
  return `${quien}: ${titulo.trim()}. Elige hora, sin descargar nada: ${enlace}`;
}

// "viernes 3 de octubre"
function diaLargo(dia: string): string {
  return formatearFechaLarga(fechaDesdeClave(dia)).replace(',', '');
}

// "Cerrado: Cena de viernes, el viernes 3 de octubre a las 21:00. Nos vemos."
export function textoConfirmacion(titulo: string, hora: HoraPlan): string {
  return `Cerrado: ${titulo.trim()}, el ${diaLargo(hora.dia)} a las ${hora.hora}. Nos vemos.`;
}

// "hoy", "mañana" o "el vie 3", según el día de "ahora".
export function cuandoEs(dia: string, ahora: Date): string {
  const hoy = claveDia(ahora);
  if (dia === hoy) return 'hoy';
  if (dia === sumarDias(hoy, 1)) return 'mañana';
  return `el ${diaCorto(dia)}`;
}

// "Recordatorio: Cena de viernes, hoy a las 21:00. Nos vemos."
export function textoRecordatorio(titulo: string, hora: HoraPlan, ahora: Date): string {
  return `Recordatorio: ${titulo.trim()}, ${cuandoEs(hora.dia, ahora)} a las ${hora.hora}. Nos vemos.`;
}
