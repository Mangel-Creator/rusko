import { numeroDeEntorno } from './limite.ts';
import { clienteAdmin } from './usuario.ts';

// Límites de IA por 5 horas y por semana, como los de Claude (29/09/2026). Todo se
// cuenta en millonésimas de dólar (lo que cuesta de verdad cada llamada), así una
// llamada de Sonnet gasta más que una de Haiku. Las tablas y las funciones SQL están
// en supabase/migrations/20260929000000_limites_ia.sql.
//
// Secretos opcionales para cambiarlos sin tocar la app:
//   IA_VENTANA_HORAS (5), IA_LIMITE_VENTANA (150000 = 0,15 $) e
//   IA_LIMITE_SEMANA (500000 = 0,50 $, como una persona que usa mucho la IA).
// Cuando haya planes de pago, cada plan tendrá sus números; hoy son los mismos para todos.

export const LIMITES_IA = {
  horas: numeroDeEntorno('IA_VENTANA_HORAS', 5),
  ventana: numeroDeEntorno('IA_LIMITE_VENTANA', 150_000),
  semana: numeroDeEntorno('IA_LIMITE_SEMANA', 500_000),
};

// Dólares por millón de tokens (entrada, salida) = millonésimas de dólar por token.
// Precios oficiales de Anthropic a 26/10/2026. Un modelo que no esté aquí se cobra
// como el más caro que podría usarse, para no quedarse corto.
const PRECIOS: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5-5': [2, 10],
  'claude-sonnet-5': [2, 10],
  'claude-opus-5-5': [4, 20],
};
const PRECIO_DESCONOCIDO: [number, number] = [5, 25];

export type UsoTokens = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function costeLlamada(modelo: string, uso: UsoTokens): number {
  const [entrada, salida] = PRECIOS[modelo] ?? PRECIO_DESCONOCIDO;
  const coste =
    uso.input_tokens * entrada +
    (uso.cache_creation_input_tokens ?? 0) * entrada * 1.25 +
    (uso.cache_read_input_tokens ?? 0) * entrada * 0.1 +
    uso.output_tokens * salida;
  return Math.ceil(coste);
}

export type PermisoIA =
  | { permitido: true }
  | { permitido: false; motivo: 'ventana' | 'semana'; libre: string | null };

// ¿Puede esta persona usar la IA ahora? Si el servidor falla, deja pasar: los
// límites por día de cada función (sumarUso) siguen protegiendo el gasto.
export async function permitirIA(usuario: string): Promise<PermisoIA> {
  const { data, error } = await clienteAdmin().rpc('ia_permitir', {
    p_usuario: usuario,
    p_horas: LIMITES_IA.horas,
    p_limite_ventana: LIMITES_IA.ventana,
    p_limite_semana: LIMITES_IA.semana,
  });
  if (error || !data) {
    console.error(`ia_permitir: ${error?.message ?? 'sin datos'}`);
    return { permitido: true };
  }
  const d = data as { permitido: boolean; motivo?: 'ventana' | 'semana'; libre?: string | null };
  if (d.permitido) return { permitido: true };
  return { permitido: false, motivo: d.motivo ?? 'ventana', libre: d.libre ?? null };
}

// Apunta lo que ha costado una llamada a Claude (también si la respuesta no valía:
// los tokens se han gastado igual).
export async function apuntarIA(usuario: string, funcion: string, modelo: string, uso: UsoTokens): Promise<void> {
  const { error } = await clienteAdmin().rpc('ia_apuntar', {
    p_usuario: usuario,
    p_funcion: funcion,
    p_entrada: uso.input_tokens,
    p_salida: uso.output_tokens,
    p_coste: costeLlamada(modelo, uso),
    p_horas: LIMITES_IA.horas,
    p_limite_ventana: LIMITES_IA.ventana,
    p_limite_semana: LIMITES_IA.semana,
  });
  if (error) console.error(`ia_apuntar: ${error.message}`);
}

export type EstadoIA = {
  horas: number;
  ventana: { usado: number; limite: number; libre: string | null };
  semana: { usado: number; limite: number; libre: string | null };
  extra: number;
  compra: boolean;
};

export async function estadoIA(usuario: string): Promise<EstadoIA> {
  const { data, error } = await clienteAdmin().rpc('ia_estado', { p_usuario: usuario, p_horas: LIMITES_IA.horas });
  if (error || !data) throw new Error(`ia_estado: ${error?.message ?? 'sin datos'}`);
  const d = data as { ventana: number; ventanaFin: string | null; semana: number; semanaFin: string | null; extra: number };
  return {
    horas: LIMITES_IA.horas,
    ventana: { usado: Number(d.ventana), limite: LIMITES_IA.ventana, libre: d.ventanaFin },
    semana: { usado: Number(d.semana), limite: LIMITES_IA.semana, libre: d.semanaFin },
    extra: Number(d.extra),
    // Comprar más IA aún no se puede: hace falta el pago de Apple/Google o Stripe.
    compra: Deno.env.get('IA_COMPRA_ACTIVA') === 'si',
  };
}

// Respuesta de las funciones cuando se acaba la IA: la app lo explica con la hora.
export function cuerpoLimiteIA(permiso: Extract<PermisoIA, { permitido: false }>) {
  return { error: 'limite-ia', motivo: permiso.motivo, libre: permiso.libre, horas: LIMITES_IA.horas };
}
