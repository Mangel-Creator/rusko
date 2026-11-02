import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import {
  claveDia,
  diaSemanaDesdeLunes,
  fechaDesdeClave,
  minutosDelDia,
  minutosDesdeHora,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';

import { sePisan, type Intervalo } from './huecos';

// Qué eventos hay cada día, teniendo en cuenta las repeticiones.

// ¿El evento ocurre ese día? (las tareas flexibles solo "ocurren" en su fecha)
export function ocurreEnDia(evento: Evento, dia: ClaveDia): boolean {
  if (dia < evento.fecha) return false;
  if (evento.flexible || evento.repeticion === 'nunca') return dia === evento.fecha;
  if (evento.hasta && dia > evento.hasta) return false;
  if (evento.repeticion === 'diaria') return true;
  const primero = fechaDesdeClave(evento.fecha);
  const fecha = fechaDesdeClave(dia);
  if (evento.repeticion === 'semanal') {
    const dias = evento.dias?.length ? evento.dias : [diaSemanaDesdeLunes(primero)];
    return dias.includes(diaSemanaDesdeLunes(fecha));
  }
  // Mensual: mismo número de día. Los meses sin ese día (31 de abril) se saltan.
  return fecha.getDate() === primero.getDate();
}

// Tramo de un evento con hora fija, en minutos desde medianoche.
export function intervaloDe(evento: Evento): Intervalo {
  return {
    inicio: minutosDesdeHora(evento.horaInicio ?? '00:00'),
    fin: minutosDesdeHora(evento.horaFin ?? '00:00'),
  };
}

// Eventos con hora fija de un día, ordenados por hora de inicio.
export function eventosDelDia(eventos: Evento[], dia: ClaveDia): Evento[] {
  return eventos
    .filter((e) => !e.flexible && ocurreEnDia(e, dia))
    .sort((a, b) => (a.horaInicio ?? '').localeCompare(b.horaInicio ?? ''));
}

// Tareas flexibles sin hacer previstas para ese día. Si el día es hoy, también
// las de días anteriores que se quedaron sin hacer. Las más antiguas primero.
export function tareasPendientes(eventos: Evento[], dia: ClaveDia, hoy: ClaveDia): Evento[] {
  return eventos
    .filter((e) => e.flexible && !e.hecha && (e.fecha === dia || (dia === hoy && e.fecha < hoy)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Duración de una tarea flexible (30 min si no se indicó).
export function duracionTarea(tarea: Pick<Evento, 'duracionMin'>): number {
  return tarea.duracionMin ?? 30;
}

// Horas despierto según el perfil: de levantarse a acostarse.
// Si se acuesta después de medianoche, el día acaba a las 24:00.
export function ventanaDelDia(perfil: Perfil | null): Intervalo {
  const inicio = minutosDesdeHora(perfil?.horario.levantarse ?? '07:30');
  const fin = minutosDesdeHora(perfil?.horario.acostarse ?? '23:30');
  return { inicio, fin: fin > inicio ? fin : 24 * 60 };
}

// Minutos de la jornada de trabajo según el perfil (para la carga del día).
export function minutosDeJornada(perfil: Perfil | null): number {
  const inicio = minutosDesdeHora(perfil?.horario.empiezoTrabajo ?? '09:00');
  const fin = minutosDesdeHora(perfil?.horario.terminoTrabajo ?? '18:00');
  return Math.max(fin - inicio, 0);
}

export type Siguiente = { evento: Evento; dia: ClaveDia; enCurso: boolean };

// El próximo evento con hora fija a partir de "ahora" (o el que está en curso),
// buscando hasta "diasMax" días hacia delante.
export function siguienteEvento(eventos: Evento[], ahora: Date, diasMax = 7): Siguiente | null {
  const hoy = claveDia(ahora);
  const minutoActual = minutosDelDia(ahora);
  for (let n = 0; n < diasMax; n++) {
    const dia = sumarDias(hoy, n);
    for (const evento of eventosDelDia(eventos, dia)) {
      const { inicio, fin } = intervaloDe(evento);
      if (n > 0 || inicio >= minutoActual) return { evento, dia, enCurso: false };
      if (fin > minutoActual) return { evento, dia, enCurso: true };
    }
  }
  return null;
}

// Si "evento" pisa un bloque de foco de su mismo día, devuelve ese bloque.
// Los propios bloques de foco y las tareas flexibles no avisan.
export function bloqueDeFocoQuePisa(evento: Evento, eventos: Evento[]): Evento | null {
  if (evento.foco || evento.flexible) return null;
  const tramo = intervaloDe(evento);
  return (
    eventosDelDia(eventos, evento.fecha).find(
      (otro) => otro.foco && otro.id !== evento.id && sePisan(tramo, intervaloDe(otro)),
    ) ?? null
  );
}
