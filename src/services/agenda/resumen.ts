import type { Evento } from '@/data/eventos/tipos';
import { horaDesdeMinutos } from '@/services/fechas';

import type { Intervalo } from './huecos';

// Frase que resume el día, hecha con reglas sencillas (sin IA), en tono cercano.
// "Tienes 2 clientes y un plan con amigos. Hueco libre: de 17:00 a 19:00."

export const FRASE_DIA_LIBRE = 'Día libre. ¿Lo aprovechamos?';

// contar(1, "un cliente", "clientes") -> "un cliente"; contar(2, ...) -> "2 clientes"
function contar(n: number, uno: string, plural: string): string | null {
  if (n === 0) return null;
  return n === 1 ? uno : `${n} ${plural}`;
}

// "a", "a y b", "a, b y c"
export function unirConY(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

function tramo(i: Intervalo): string {
  return `de ${horaDesdeMinutos(i.inicio)} a ${horaDesdeMinutos(i.fin)}`;
}

type Datos = {
  eventos: Evento[]; // eventos con hora fija del día
  tareasPendientes: number;
  huecos: Intervalo[]; // huecos libres que quedan
};

export function fraseResumen({ eventos, tareasPendientes, huecos }: Datos): string {
  if (eventos.length === 0 && tareasPendientes === 0) return FRASE_DIA_LIBRE;

  const normales = eventos.filter((e) => !e.foco);
  const partes = [
    contar(normales.filter((e) => e.tipo === 'cliente').length, 'un cliente', 'clientes'),
    contar(normales.filter((e) => e.tipo === 'amigos').length, 'un plan con amigos', 'planes con amigos'),
    contar(normales.filter((e) => e.tipo === 'entreno').length, 'un entreno', 'entrenos'),
    contar(normales.filter((e) => e.tipo === 'estudios').length, 'algo de estudios', 'cosas de estudios'),
    contar(normales.filter((e) => e.tipo === 'yo').length, 'una cosa tuya', 'cosas tuyas'),
    contar(eventos.length - normales.length, 'un bloque de foco', 'bloques de foco'),
    contar(tareasPendientes, 'una tarea', 'tareas'),
  ].filter((p): p is string => p !== null);

  const tienes = `Tienes ${unirConY(partes)}.`;
  if (huecos.length === 0) return `${tienes} No te queda ningún hueco libre.`;
  if (huecos.length === 1) return `${tienes} Hueco libre: ${tramo(huecos[0])}.`;
  const mayor = huecos.reduce((a, b) => (b.fin - b.inicio > a.fin - a.inicio ? b : a));
  return `${tienes} Tu mejor hueco: ${tramo(mayor)}.`;
}
