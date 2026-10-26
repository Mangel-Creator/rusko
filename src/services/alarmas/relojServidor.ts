import { cambiarAlarmasReloj, leerAlarmasReloj } from '@/data/alarmasReloj';
import { asegurarSesion, obtenerSupabase } from '@/data/supabase';

import type { AlarmaReloj } from './reloj';

// Alarmas al Reloj del iPhone (26/10/2026): lo que se habla con la función alarmas-reloj
// de Supabase. El cálculo de qué alarmas subir está en reloj.ts (puro, con pruebas).

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T | null> {
  const supabase = obtenerSupabase();
  if (!supabase) return null;
  await asegurarSesion(supabase);
  const { data, error } = await supabase.functions.invoke('alarmas-reloj', { body: cuerpo, timeout: 20000 });
  if (error) throw error;
  return data as T;
}

// Crea el enlace personal (o lo cambia por otro: el anterior deja de valer) y sube las
// alarmas. null si no hay servidor.
export async function crearEnlaceReloj(alarmas: AlarmaReloj[]): Promise<string | null> {
  const respuesta = await llamar<{ enlace: string }>({ accion: 'crear-enlace' });
  if (!respuesta?.enlace) return null;
  await cambiarAlarmasReloj({ enlace: respuesta.enlace, firma: '', subidoEl: null });
  await subirAlarmasReloj(alarmas);
  return respuesta.enlace;
}

export async function quitarEnlaceReloj(): Promise<void> {
  await llamar({ accion: 'quitar' });
  await cambiarAlarmasReloj({ enlace: null, firma: '', subidoEl: null });
}

export type EstadoRelojServidor = { conectado: boolean; actualizado: string | null; ultimaLectura: string | null };

export async function estadoRelojServidor(): Promise<EstadoRelojServidor | null> {
  return llamar<EstadoRelojServidor>({ accion: 'estado' });
}

// Lo mismo no se vuelve a subir, salvo cada 12 horas (para estirar los 14 días).
const RESUBIR_MS = 12 * 3600 * 1000;

export async function subirAlarmasReloj(alarmas: AlarmaReloj[]): Promise<void> {
  const estado = await leerAlarmasReloj();
  if (!estado.enlace) return;
  const firma = JSON.stringify(alarmas);
  const reciente = estado.subidoEl && Date.now() - Date.parse(estado.subidoEl) < RESUBIR_MS;
  if (firma === estado.firma && reciente) return;
  const respuesta = await llamar<{ conectado: boolean }>({ accion: 'subir', alarmas });
  if (!respuesta) return;
  // El enlace se quitó desde otro sitio (o se perdió la sesión): se olvida aquí también.
  if (!respuesta.conectado) {
    await cambiarAlarmasReloj({ enlace: null, firma: '', subidoEl: null });
    return;
  }
  await cambiarAlarmasReloj({ firma, subidoEl: new Date().toISOString() });
}
