import type { Evento } from '@/data/eventos/tipos';
import type { ClaveDia } from '@/services/fechas';
import { coincide, palabrasClave } from '@/services/palabras';

// «La clase de inglés es en el Basic Fit de Montera» (03/11/2026): dice dónde es algo que
// ya está apuntado. Se lee aquí, sin IA. Solo vale si hay una cita de hoy en adelante que
// se llame así; si no, la frase sigue su camino normal (puede ser una cita nueva).

const FORMAS = [
  /^(?:(?:pon|apunta)\s+que\s+)?(.+?)\s+(?:es|está|esta|será|sera|queda|va a ser|ahora es)\s+en\s+(.+)$/i,
  /^(?:el\s+)?(?:sitio|lugar)\s+de\s+(.+?)\s+es\s+(?:en\s+)?(.+)$/i,
];

// Con día u hora («… es en la oficina a las 5») es otra cosa: mejor la captura normal.
const CUANDO = /(^|\s)(a las?|hoy|mañana|manana|pasado|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)(\s|$)/i;

export type SitioDeCita = { evento: Evento; sitio: string };

export function sitioDeCita(frase: string, eventos: readonly Evento[], hoy: ClaveDia): SitioDeCita | null {
  const limpia = frase.trim().replace(/[.!¡¿?\s]+$/, '');
  for (const forma of FORMAS) {
    const partes = forma.exec(limpia);
    if (!partes) continue;
    const sitio = partes[2].trim();
    const palabras = palabrasClave(partes[1]);
    if (sitio.length < 2 || palabras.length === 0 || CUANDO.test(sitio)) return null;
    // La más próxima: las que ya se repiten cuentan como de hoy.
    const desde = (e: Evento) => (e.fecha > hoy ? e.fecha : hoy);
    const evento = eventos
      .filter((e) => !e.hecha && coincide(e.titulo, palabras))
      .filter((e) => e.fecha >= hoy || (e.repeticion !== 'nunca' && (!e.hasta || e.hasta >= hoy)))
      .sort((a, b) => desde(a).localeCompare(desde(b)))[0];
    return evento ? { evento, sitio } : null;
  }
  return null;
}
