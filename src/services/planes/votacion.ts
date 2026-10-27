import type { HoraVotable, VotoInvitado } from './votos';

// Lo que usa la página de votación (/votar#código), que abren los invitados sin
// cuenta ni app. Habla con la función "votar" del servidor con un fetch normal:
// sin sesión y sin guardar nada en el dispositivo del invitado.

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const CLAVE_PUBLICA = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export type PlanVotacion = {
  plan: {
    titulo: string;
    tipo: 'amigos' | 'cliente';
    organizador: string;
    personas: number;
    estado: 'abierto' | 'cerrado';
    horaElegida: string | null;
  };
  horas: HoraVotable[];
  votos: VotoInvitado[];
  cambiado?: boolean; // al votar: ya había votado con ese nombre y se ha cambiado su voto
};

export type ErrorVotacion = 'no-existe' | 'cerrado' | 'lleno' | 'limite' | 'sin-conexion' | 'sin-servidor';

export type RespuestaVotacion = { ok: true; datos: PlanVotacion } | { ok: false; error: ErrorVotacion };

// El código va en la dirección detrás de "#": /rusko/votar#3f9c...
export function codigoDeLaDireccion(hash: string): string | null {
  const codigo = hash.replace(/^#/, '').trim().toLowerCase();
  return /^[0-9a-f]{32}$/.test(codigo) ? codigo : null;
}

async function llamar(cuerpo: Record<string, unknown>): Promise<RespuestaVotacion> {
  if (!URL.startsWith('https://') || !CLAVE_PUBLICA) return { ok: false, error: 'sin-servidor' };
  try {
    const respuesta = await fetch(`${URL}/functions/v1/votar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CLAVE_PUBLICA },
      body: JSON.stringify(cuerpo),
    });
    const datos = await respuesta.json().catch(() => null);
    if (respuesta.ok && datos?.plan) return { ok: true, datos: datos as PlanVotacion };
    const error = datos?.error;
    if (error === 'no-existe' || error === 'cerrado' || error === 'lleno') return { ok: false, error };
    if (respuesta.status === 429) return { ok: false, error: 'limite' };
    return { ok: false, error: 'sin-conexion' };
  } catch {
    return { ok: false, error: 'sin-conexion' };
  }
}

export function verPlan(codigo: string): Promise<RespuestaVotacion> {
  return llamar({ accion: 'ver', codigo });
}

export function votar(codigo: string, nombre: string, horas: string[]): Promise<RespuestaVotacion> {
  return llamar({ accion: 'votar', codigo, nombre, horas });
}
