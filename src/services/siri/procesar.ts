import type { Alarma } from '@/data/alarmas';
import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { interpretarLocal } from '@/services/captura/local';
import { MAX_TITULO } from '@/services/captura/validar';
import { claveDia, fechaDesdeClave, formatearDiaCorto, type ClaveDia } from '@/services/fechas';

// Siri con Atajos (27/10/2026): qué hacer con lo que espera en el buzón del servidor
// (función siri). Puro, con pruebas.
//   - "apuntar": la frase se lee como en la captura rápida (local.ts, sin IA), tomando
//     como "ahora" el momento en que se dijo ("mañana" es el día siguiente a ese). Si no
//     se entiende, va como tarea de ese día con la frase de título: nunca se pierde.
//   - "alarma": una alarma de una sola vez (el Atajo ya la puso en el Reloj). Si ya ha
//     pasado, no se añade.
// Los ids salen del buzón, así que recoger dos veces lo mismo no lo duplica.

// La misma etiqueta que usa la función alarmas-reloj para las que aún no se han recogido.
export const ETIQUETA_SIRI = 'Alarma de Siri';

export type PendienteSiri = {
  id: string;
  tipo: 'apuntar' | 'alarma';
  texto: string | null;
  dia: ClaveDia | null;
  hora: string | null;
  cuando: string | null; // ISO
  creado: string; // ISO
};

export type ResultadoSiri = {
  eventos: Evento[];
  alarmas: Alarma[];
  hechos: string[]; // lo que se enseña en Hoy: "Pádel, mañana a las 17:00"
  ids: string[]; // lo que ya se puede borrar del buzón
};

function cuandoTexto(fecha: ClaveDia, hora: string | null, ahora: Date): string {
  const hoy = claveDia(ahora);
  const manana = claveDia(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1));
  const dia =
    fecha === hoy ? 'hoy' : fecha === manana ? 'mañana' : formatearDiaCorto(fechaDesdeClave(fecha)).toLocaleLowerCase('es-ES');
  return hora ? `${dia} a las ${hora}` : `${dia}, sin hora fija`;
}

export function procesarPendientes(
  pendientes: readonly PendienteSiri[],
  { ahora, perfil, eventos }: { ahora: Date; perfil: Perfil | null; eventos: readonly Evento[] },
): ResultadoSiri {
  const resultado: ResultadoSiri = { eventos: [], alarmas: [], hechos: [], ids: [] };
  const todos = [...eventos];
  const ordenados = [...pendientes].sort((a, b) => a.creado.localeCompare(b.creado));

  for (const p of ordenados) {
    resultado.ids.push(p.id);

    if (p.tipo === 'alarma') {
      if (!p.dia || !p.hora || !p.cuando || Date.parse(p.cuando) <= ahora.getTime()) continue;
      resultado.alarmas.push({
        id: p.id,
        tipo: 'despertador',
        hora: p.hora,
        dias: [],
        unaVezEl: p.dia,
        etiqueta: ETIQUETA_SIRI,
        sonido: 'alarma',
        activada: true,
        adelantoMaxMin: 20,
      });
      resultado.hechos.push(`Alarma ${cuandoTexto(p.dia, p.hora, ahora)}`);
      continue;
    }

    const texto = (p.texto ?? '').trim();
    if (!texto) continue;
    const dicho = Number.isFinite(Date.parse(p.creado)) ? new Date(p.creado) : ahora;
    // Ya existe (se recogió antes pero no se pudo borrar del buzón): no se toca.
    if (todos.some((e) => e.id === `siri-${p.id}`)) continue;
    const propuesta = interpretarLocal(texto, { ahora: dicho, perfil, eventos: todos });
    const evento: Evento = propuesta
      ? {
          id: `siri-${p.id}`,
          titulo: propuesta.titulo || texto.slice(0, MAX_TITULO),
          fecha: propuesta.fecha,
          horaInicio: propuesta.flexible ? null : propuesta.horaInicio,
          horaFin: propuesta.flexible ? null : propuesta.horaFin,
          tipo: propuesta.tipo,
          lugar: propuesta.lugar,
          notas: '',
          repeticion: 'nunca',
          flexible: propuesta.flexible,
          duracionMin: propuesta.flexible ? (propuesta.duracionMin ?? 30) : null,
          hecha: false,
          foco: false,
          avisoMin: null,
          ejemplo: false,
        }
      : {
          id: `siri-${p.id}`,
          titulo: texto.slice(0, MAX_TITULO),
          fecha: claveDia(dicho),
          horaInicio: null,
          horaFin: null,
          tipo: 'yo',
          lugar: null,
          notas: '',
          repeticion: 'nunca',
          flexible: true,
          duracionMin: 30,
          hecha: false,
          foco: false,
          avisoMin: null,
          ejemplo: false,
        };
    todos.push(evento);
    resultado.eventos.push(evento);
    resultado.hechos.push(`${evento.titulo}, ${cuandoTexto(evento.fecha, evento.horaInicio, ahora)}`);
  }
  return resultado;
}
