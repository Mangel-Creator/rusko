import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { asegurarSesion, obtenerSupabase } from '@/data/supabase';
import { claveDia, formatearHora } from '@/services/fechas';
import { limiteDelError, mensajeLimite } from '@/services/ia';

import { entenderLocal } from './local';
import { ID_CASA, validarInterpretacion, type Interpretacion } from './validar';

export { entenderLocal, interpretarLocal } from './local';

export {
  validarInterpretacion,
  validarPropuesta,
  type Confianza,
  type Interpretacion,
  type Propuesta,
  type PropuestaAlarma,
} from './validar';

// Captura rápida (desde el 30/10/2026, lo pidió el usuario): la frase va siempre a la IA
// (Edge Function "captura" de Supabase, con Claude Haiku), que dice qué se pide —apuntar
// una cita o una tarea, un recordatorio, una alarma o una pregunta por la agenda— y lo
// devuelve en JSON con un título limpio («Cita DNI», no «Tengo cita dni»). La app lo
// comprueba (validar.ts) y lo enseña para que el usuario lo confirme: aquí nunca se
// guarda nada. Sin conexión, sin clave o si la IA falla, lo lee la app sola (local.ts).

export const MAX_FRASE = 300;
const ESPERA_MAX_MS = 20000;

export type MotivoFallo = 'sin-configurar' | 'sin-conexion' | 'limite' | 'limite-ia' | 'no-entendido' | 'error';

export type ResultadoCaptura =
  | { estado: 'ok'; interpretacion: Interpretacion }
  | { estado: 'fallo'; motivo: MotivoFallo; mensaje: string };

// Mensajes cortos para el formulario que se abre cuando algo falla.
const MENSAJES: Record<MotivoFallo, string> = {
  'sin-configurar': 'La captura con IA aún no está activada. Rellénalo tú, ya te he puesto la frase.',
  'sin-conexion': 'Sin conexión. Rellénalo tú, ya te he puesto la frase.',
  limite: 'Has llegado al límite de capturas de hoy. Rellénalo tú, ya te he puesto la frase.',
  'limite-ia': 'Has gastado la IA por ahora. Rellénalo tú, ya te he puesto la frase.',
  'no-entendido': 'No lo he pillado del todo. Revisa los datos, ya te he puesto la frase.',
  error: 'No he podido entenderlo ahora. Rellénalo tú, ya te he puesto la frase.',
};

function fallo(motivo: MotivoFallo): ResultadoCaptura {
  return { estado: 'fallo', motivo, mensaje: MENSAJES[motivo] };
}

// Lo que se envía: la frase, el día y la hora de ahora, la zona horaria y los
// nombres de los sitios habituales (sin sus direcciones).
export function datosPeticion(frase: string, ahora: Date, perfil: Perfil | null) {
  return {
    frase: frase.trim().slice(0, MAX_FRASE),
    hoy: claveDia(ahora),
    ahora: formatearHora(ahora),
    zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/Madrid',
    sitios: [
      { id: ID_CASA, nombre: 'Casa' },
      ...(perfil?.sitios ?? []).map((s) => ({ id: s.id, nombre: s.nombre })),
    ],
  };
}

// "ahora": cuándo se dijo la frase (lo de Siri se recoge más tarde).
export async function interpretarFrase(
  frase: string,
  perfil: Perfil | null,
  eventos: readonly Evento[] = [],
  ahora: Date = new Date(),
): Promise<ResultadoCaptura> {
  const resultado = await interpretarConIA(frase, perfil, ahora);
  // Si la IA lo ha leído y no lo ve claro, mejor la ficha con la frase que adivinar.
  if (resultado.estado === 'ok' || resultado.motivo === 'no-entendido') return resultado;

  // La IA no está o falla: vale lo que saque la app sola, para revisarlo.
  const local = entenderLocal(frase, { ahora, perfil, eventos });
  if (!local) return resultado;
  if (local.accion === 'apuntar' && local.propuesta.confianza === 'baja') return resultado;
  return { estado: 'ok', interpretacion: local };
}

async function interpretarConIA(frase: string, perfil: Perfil | null, ahora: Date): Promise<ResultadoCaptura> {
  const supabase = obtenerSupabase();
  if (!supabase) return fallo('sin-configurar');

  const peticion = datosPeticion(frase, ahora, perfil);

  try {
    await asegurarSesion(supabase);
    const { data, error } = await supabase.functions.invoke('captura', {
      body: peticion,
      timeout: ESPERA_MAX_MS,
    });
    if (error) {
      // Se ha acabado la IA de las 5 horas o de la semana: se dice cuándo vuelve.
      const limite = await limiteDelError(error);
      if (limite) {
        const mensaje = `${mensajeLimite(limite, new Date())} Rellénalo tú, ya te he puesto la frase.`;
        return { estado: 'fallo', motivo: 'limite-ia', mensaje };
      }
      return fallo(await motivoDelError(error));
    }

    const interpretacion = validarInterpretacion((data as { propuesta?: unknown } | null)?.propuesta, {
      hoy: peticion.hoy,
      sitiosIds: peticion.sitios.map((s) => s.id),
      ahora: peticion.ahora,
      horaAviso: perfil?.horario.levantarse,
    });
    if (!interpretacion) return fallo('no-entendido');
    if (interpretacion.accion === 'apuntar' && interpretacion.propuesta.confianza === 'baja') {
      return fallo('no-entendido');
    }
    return { estado: 'ok', interpretacion };
  } catch (error) {
    return fallo(await motivoDelError(error));
  }
}

async function motivoDelError(error: unknown): Promise<MotivoFallo> {
  if (error instanceof FunctionsHttpError) {
    const respuesta = error.context as Response | undefined;
    if (respuesta?.status === 429) return 'limite';
    return 'error';
  }
  if (error instanceof FunctionsFetchError) return 'sin-conexion';
  // Sin conexión, fetch falla con TypeError ("Network request failed", "Failed to fetch").
  if (error instanceof TypeError) return 'sin-conexion';
  const mensaje = error instanceof Error ? error.message.toLowerCase() : '';
  if (mensaje.includes('network') || mensaje.includes('fetch') || mensaje.includes('timeout')) {
    return 'sin-conexion';
  }
  return 'error';
}
