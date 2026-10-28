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

// El dueño de la app (ia_cuentas.dueno, 28/10/2026) no tiene límites: ni de 5 horas y
// semana ni por día en cada función. Para sumarUso, su límite por persona es este.
export const SIN_LIMITE = 1_000_000;

export async function esDueno(usuario: string): Promise<boolean> {
  const { data, error } = await clienteAdmin().rpc('ia_es_dueno', { p_usuario: usuario });
  if (error) console.error(`ia_es_dueno: ${error.message}`);
  return data === true;
}

export type PermisoIA =
  | { permitido: true; dueno: boolean }
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
    return { permitido: true, dueno: false };
  }
  const d = data as { permitido: boolean; dueno?: boolean; motivo?: 'ventana' | 'semana'; libre?: string | null };
  if (d.permitido) return { permitido: true, dueno: d.dueno === true };
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

// Solo suma a lo gastado de la clave, sin tocar los límites (el correo, que va aparte).
export async function apuntarGasto(funcion: string, modelo: string, uso: UsoTokens): Promise<void> {
  const { error } = await clienteAdmin().rpc('ia_sumar_gasto', {
    p_funcion: funcion,
    p_entrada: uso.input_tokens,
    p_salida: uso.output_tokens,
    p_coste: costeLlamada(modelo, uso),
  });
  if (error) console.error(`ia_sumar_gasto: ${error.message}`);
}

// Saldo de la clave de Anthropic: Anthropic no deja leerlo con la clave, así que se
// resta lo apuntado en ia_gasto desde la última recarga. Si el usuario recarga, cambiar
// los secretos IA_SALDO_CLAVE (millonésimas de dólar; 5 $ por defecto) e
// IA_SALDO_DESDE (día de la recarga, AAAA-MM-DD).
const SALDO_CLAVE = numeroDeEntorno('IA_SALDO_CLAVE', 5_000_000);
const SALDO_DESDE = /^\d{4}-\d{2}-\d{2}$/.test(Deno.env.get('IA_SALDO_DESDE') ?? '')
  ? Deno.env.get('IA_SALDO_DESDE')!
  : '2026-10-28';

export type SaldoClave = {
  saldo: number;
  gastado: number;
  llamadas: number;
  entrada: number;
  salida: number;
  desde: string;
};

async function saldoClave(): Promise<SaldoClave> {
  const { data, error } = await clienteAdmin().rpc('ia_gasto_clave', { p_desde: SALDO_DESDE });
  if (error || !data) throw new Error(`ia_gasto_clave: ${error?.message ?? 'sin datos'}`);
  const d = data as { llamadas: number; entrada: number; salida: number; coste: number };
  return {
    saldo: SALDO_CLAVE,
    gastado: Number(d.coste),
    llamadas: Number(d.llamadas),
    entrada: Number(d.entrada),
    salida: Number(d.salida),
    desde: SALDO_DESDE,
  };
}

export type EstadoIA = {
  horas: number;
  ventana: { usado: number; limite: number; libre: string | null };
  semana: { usado: number; limite: number; libre: string | null };
  extra: number;
  compra: boolean;
  // Solo para el dueño: sin límites y con el saldo de la clave.
  sinLimite?: true;
  clave?: SaldoClave;
};

export async function estadoIA(usuario: string): Promise<EstadoIA> {
  const { data, error } = await clienteAdmin().rpc('ia_estado', { p_usuario: usuario, p_horas: LIMITES_IA.horas });
  if (error || !data) throw new Error(`ia_estado: ${error?.message ?? 'sin datos'}`);
  const d = data as { ventana: number; ventanaFin: string | null; semana: number; semanaFin: string | null; extra: number };
  const dueno = await esDueno(usuario);
  return {
    ...(dueno ? { sinLimite: true as const, clave: await saldoClave() } : {}),
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
