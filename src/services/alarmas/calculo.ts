import type { Adelantos, Alarma } from '@/data/alarmas';
import type { Evento } from '@/data/eventos/tipos';
import type { DiaSemana, Perfil } from '@/data/perfil';
import type { Salida } from '@/data/salidas';
import { eventosDelDia, sitioTrabajo } from '@/services/agenda';
import {
  claveDia,
  diaSemanaDesdeLunes,
  fechaDesdeClave,
  formatearDiaCorto,
  minutosDesdeHora,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';
import { citaDe, type Cita } from '@/services/rutas/citas';
import type { Punto } from '@/services/rutas/tipos';

// Cuándo suena cada alarma (fase 7). Funciones puras, con pruebas en __tests__:
// las usan la pestaña, los avisos de Expo Go (services/avisos) y las alarmas de
// verdad de la app propia (nativo.ts).

// Fecha de un día a cierta hora, en minutos desde medianoche (admite negativos y
// más de 24 h: pasa al día anterior o al siguiente).
export function momento(dia: ClaveDia, minutos: number): Date {
  const fecha = fechaDesdeClave(dia);
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, minutos);
}

export function diaDeLaSemana(dia: ClaveDia): DiaSemana {
  return diaSemanaDesdeLunes(fechaDesdeClave(dia)) as DiaSemana;
}

// ¿Toca esta alarma ese día? (sin mirar la hora)
export function suenaElDia(alarma: Alarma, dia: ClaveDia): boolean {
  if (!alarma.activada) return false;
  if (alarma.dias.length === 0) return alarma.unaVezEl === dia;
  return alarma.dias.includes(diaDeLaSemana(dia));
}

// Para una alarma que suena una sola vez: hoy si su hora aún no ha pasado; si no, mañana.
export function diaDeUnaVez(hora: string, ahora: Date): ClaveDia {
  const hoy = claveDia(ahora);
  return momento(hoy, minutosDesdeHora(hora)).getTime() > ahora.getTime() ? hoy : sumarDias(hoy, 1);
}

// --- Alarma inteligente ---

// Minutos que se adelanta con un retraso por tráfico dado: redondeado hacia arriba
// a 5 min y como mucho el máximo elegido. Menos de 5 min de retraso no mueve nada.
export const RETRASO_MINIMO_MIN = 5;

export function adelantoMinutos(retrasoSeg: number, maximoMin: number): number {
  const retrasoMin = Math.ceil(Math.max(0, retrasoSeg) / 60);
  if (retrasoMin < RETRASO_MINIMO_MIN) return 0;
  return Math.min(Math.ceil(retrasoMin / 5) * 5, Math.max(0, maximoMin));
}

export function claveAdelanto(alarmaId: string, dia: ClaveDia): string {
  return `${alarmaId}:${dia}`;
}

export function adelantoDe(alarma: Alarma, dia: ClaveDia, adelantos: Adelantos | undefined): number {
  if (alarma.tipo !== 'inteligente') return 0;
  const minutos = adelantos?.[claveAdelanto(alarma.id, dia)]?.minutos ?? 0;
  // Nunca más de lo que permite la alarma (por si se bajó el máximo después).
  return Math.max(0, Math.min(minutos, alarma.adelantoMaxMin));
}

// "Hoy suena 15 min antes: hay atasco camino del trabajo"
// Otro día que no sea hoy ni mañana: "Suena 15 min antes: ...".
export function motivoAdelanto(minutos: number, destino: string, cuando: 'hoy' | 'mañana' | null = 'hoy'): string {
  const dia = cuando === 'hoy' ? 'Hoy suena' : cuando === 'mañana' ? 'Mañana suena' : 'Suena';
  return `${dia} ${minutos} min antes: hay atasco ${caminoDe(destino)}`;
}

// "camino del trabajo" o "camino de Reunión con Laura"
export function caminoDe(destino: string): string {
  return destino.startsWith('el ') ? `camino d${destino}` : `camino de ${destino}`;
}

export type DestinoInteligente = {
  punto: Punto;
  nombre: string; // "el trabajo" o el título de la cita
  llegada: Date; // a qué hora hay que estar allí
};

// Hacia dónde vas ese día: la primera cita con lugar después de que suene la
// alarma; si no hay, el trabajo en tus días de trabajo (a la hora en que empiezas).
export function destinoInteligente(
  eventos: Evento[],
  perfil: Perfil | null,
  dia: ClaveDia,
  minutoAlarma: number,
): DestinoInteligente | null {
  const alarma = momento(dia, minutoAlarma).getTime();
  for (const evento of eventosDelDia(eventos, dia)) {
    const cita = citaDe(evento, dia, perfil);
    if (cita && cita.llegada.getTime() > alarma) {
      return { punto: cita.destino, nombre: evento.titulo, llegada: cita.llegada };
    }
  }
  const trabajo = sitioTrabajo(perfil)?.coordenadas;
  if (!perfil || !trabajo || !perfil.horario.diasTrabajo.includes(diaDeLaSemana(dia))) return null;
  const llegada = momento(dia, minutosDesdeHora(perfil.horario.empiezoTrabajo));
  if (llegada.getTime() <= alarma) return null;
  return { punto: [trabajo.latitud, trabajo.longitud], nombre: 'el trabajo', llegada };
}

// --- Cuándo suena ---

export type Vez = {
  alarma: Alarma;
  dia: ClaveDia;
  cuando: Date; // con el adelanto, si lo hay
  normal: Date; // a su hora de siempre
  adelantoMin: number;
};

// Las veces que suena una alarma entre "desde" y "dias" días después, en orden.
export function vecesDeAlarma(alarma: Alarma, desde: Date, dias: number, adelantos?: Adelantos): Vez[] {
  const hoy = claveDia(desde);
  const veces: Vez[] = [];
  for (let n = 0; n <= dias; n++) {
    const dia = sumarDias(hoy, n);
    if (!suenaElDia(alarma, dia)) continue;
    const normal = momento(dia, minutosDesdeHora(alarma.hora));
    const adelantoMin = adelantoDe(alarma, dia, adelantos);
    const cuando = new Date(normal.getTime() - adelantoMin * 60000);
    if (cuando.getTime() > desde.getTime()) veces.push({ alarma, dia, cuando, normal, adelantoMin });
  }
  return veces;
}

export function proximaVez(alarma: Alarma, ahora: Date, adelantos?: Adelantos): Vez | null {
  return vecesDeAlarma(alarma, ahora, 7, adelantos)[0] ?? null;
}

// ¿Una de "una sola vez" que aún no ha sonado? (su día y su hora están por llegar)
export function unaVezPendiente(alarma: Pick<Alarma, 'hora' | 'unaVezEl'>, ahora: Date): boolean {
  return Boolean(alarma.unaVezEl) && momento(alarma.unaVezEl!, minutosDesdeHora(alarma.hora)) > ahora;
}

// Las de "una sola vez" encendidas que ya sonaron: se apagan solas, como en el Reloj.
export function unaVezPasadas(alarmas: Alarma[], ahora: Date): string[] {
  return alarmas
    .filter(
      (a) =>
        a.activada &&
        a.dias.length === 0 &&
        (!a.unaVezEl || momento(a.unaVezEl, minutosDesdeHora(a.hora)).getTime() <= ahora.getTime()),
    )
    .map((a) => a.id);
}

// --- Hora de dormir ---

// Minuto del aviso: "antes" minutos antes de acostarse. Si te acuestas después de
// medianoche, cae en la madrugada del día siguiente (más de 24 h).
export function minutoDormir(perfil: Perfil, antesMin: number): number {
  const levantarse = minutosDesdeHora(perfil.horario.levantarse);
  let acostarse = minutosDesdeHora(perfil.horario.acostarse);
  if (acostarse <= levantarse) acostarse += 24 * 60;
  return acostarse - antesMin;
}

// --- Alarmas de salida ---

// Las salidas (calculadas con el tráfico en la fase 6) de los eventos que tienen la
// alarma encendida y que aún no han pasado. Como las salidas se recalculan al cambiar
// el evento, la alarma se mueve sola con él.
export function alarmasDeSalida(salidas: Salida[], eventosConAlarma: string[], ahora: Date): Salida[] {
  return salidas
    .filter((s) => eventosConAlarma.includes(s.eventoId) && new Date(s.salida).getTime() > ahora.getTime())
    .sort((a, b) => a.salida.localeCompare(b.salida));
}

// Las próximas citas con lugar (la próxima vez de cada evento), para ponerles alarma
// de salida desde la pestaña. Las series salen una vez: la alarma vale para todas.
export function citasParaAlarma(eventos: Evento[], perfil: Perfil | null, ahora: Date, dias = 7, maximo = 8): Cita[] {
  const hoy = claveDia(ahora);
  const vistas = new Set<string>();
  const citas: Cita[] = [];
  for (let n = 0; n <= dias && citas.length < maximo; n++) {
    const dia = sumarDias(hoy, n);
    for (const evento of eventosDelDia(eventos, dia)) {
      if (vistas.has(evento.id)) continue;
      const cita = citaDe(evento, dia, perfil);
      if (!cita || cita.llegada.getTime() <= ahora.getTime()) continue;
      vistas.add(evento.id);
      citas.push(cita);
    }
  }
  return citas.slice(0, maximo);
}

// Quita de la lista los eventos que ya no existen o que se quedaron sin lugar.
export function eventosConAlarmaVigentes(ids: string[], eventos: Evento[]): string[] {
  const vivos = new Set(eventos.filter((e) => e.lugar && !e.flexible).map((e) => e.id));
  return ids.filter((id) => vivos.has(id));
}

// --- Textos ---

const NOMBRES = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const NOMBRES_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

// "Todos los días", "De lunes a viernes", "Fines de semana", "lun, mié y vie", "Una vez"
export function textoDias(dias: readonly number[]): string {
  const ordenados = [...dias].sort((a, b) => a - b);
  const clave = ordenados.join(',');
  if (ordenados.length === 0) return 'Una vez';
  if (ordenados.length === 7) return 'Todos los días';
  if (clave === '0,1,2,3,4') return 'De lunes a viernes';
  if (clave === '5,6') return 'Fines de semana';
  const nombres = ordenados.map((d) => NOMBRES[d]);
  if (nombres.length === 1) return `Los ${NOMBRES_LARGOS[ordenados[0]]}`;
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

// Cuándo suena, para la lista: los días si se repite; si es de una vez y aún no ha
// pasado su día, "Hoy", "Mañana" o "Viernes 30 oct" (27/10/2026).
export function textoCuando(alarma: Pick<Alarma, 'dias' | 'unaVezEl'>, ahora: Date): string {
  const hoy = claveDia(ahora);
  if (alarma.dias.length > 0 || !alarma.unaVezEl || alarma.unaVezEl < hoy) return textoDias(alarma.dias);
  if (alarma.unaVezEl === hoy) return 'Hoy';
  if (alarma.unaVezEl === sumarDias(hoy, 1)) return 'Mañana';
  return formatearDiaCorto(fechaDesdeClave(alarma.unaVezEl));
}
