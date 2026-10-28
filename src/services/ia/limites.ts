import { claveDia, diaSemanaDesdeLunes, formatearHora, sumarDias } from '@/services/fechas';

// Límites de IA como los de Claude (29/09/2026): una "ventana" de horas (5 por
// defecto) que empieza con el primer uso y se libera entera al acabar, y otra de
// una semana. Lo cuenta el servidor (supabase/functions/_shared/limiteIA.ts) en
// millonésimas de dólar; aquí solo se pasa a porcentajes y frases.

export type LimiteIA = { usado: number; limite: number; libre: string | null };

// Lo gastado de la clave de Anthropic (solo le llega al dueño, 28/10/2026). Dinero en
// millonésimas de dólar; `desde` es el día de la última recarga ("AAAA-MM-DD").
export type SaldoClave = {
  saldo: number;
  gastado: number;
  llamadas: number;
  entrada: number;
  salida: number;
  desde: string;
};

export type EstadoIA = {
  horas: number;
  ventana: LimiteIA;
  semana: LimiteIA;
  extra: number; // saldo comprado que queda, en millonésimas de dólar
  compra: boolean; // si ya se puede comprar más
  sinLimite: boolean; // el dueño: la IA no se le para nunca
  clave: SaldoClave | null;
};

export type MotivoLimiteIA = 'ventana' | 'semana';
export type LimiteAlcanzado = { motivo: MotivoLimiteIA; libre: string | null; horas: number };

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// De 0 a 100. Se redondea hacia arriba para no decir "0 %" si ya se ha usado algo,
// y no pasa de 100 aunque el extra haga gastar más.
export function porcentaje(l: LimiteIA): number {
  if (l.limite <= 0) return 100;
  if (l.usado <= 0) return 0;
  return Math.min(100, Math.ceil((l.usado / l.limite) * 100));
}

export function agotado(l: LimiteIA): boolean {
  return l.usado >= l.limite;
}

// "a las 18:40", "mañana a las 09:10", "el lunes a las 10:00" o "el 12/10 a las 10:00".
export function cuandoSeLibera(libre: Date, ahora: Date): string {
  const hora = formatearHora(libre);
  const dia = claveDia(libre);
  const hoy = claveDia(ahora);
  if (dia === hoy) return `a las ${hora}`;
  if (dia === sumarDias(hoy, 1)) return `mañana a las ${hora}`;
  if (dia <= sumarDias(hoy, 6)) return `el ${DIAS[diaSemanaDesdeLunes(libre)]} a las ${hora}`;
  const dd = String(libre.getDate()).padStart(2, '0');
  const mm = String(libre.getMonth() + 1).padStart(2, '0');
  return `el ${dd}/${mm} a las ${hora}`;
}

function libreComoFecha(libre: string | null): Date | null {
  if (!libre) return null;
  const fecha = new Date(libre);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Línea bajo cada barra: "Se libera a las 18:40" o, si aún no ha empezado, qué pasa.
export function lineaLimite(l: LimiteIA, tipo: MotivoLimiteIA, horas: number, ahora: Date): string {
  const libre = libreComoFecha(l.libre);
  if (!libre || libre <= ahora) {
    return tipo === 'ventana'
      ? `Empieza a contar la próxima vez que uses la IA y dura ${horas} horas.`
      : 'Empieza a contar la próxima vez que uses la IA y dura 7 días.';
  }
  return `Se libera ${cuandoSeLibera(libre, ahora)}.`;
}

// El saldo extra, en algo que se entienda: cuántas semanas de uso normal son.
export function textoExtra(extra: number, limiteSemana: number): string | null {
  if (extra <= 0) return null;
  if (limiteSemana <= 0) return 'Tienes IA extra.';
  const semanas = extra / limiteSemana;
  if (semanas < 0.15) return 'Te queda un poco de IA extra.';
  if (semanas < 1) return `Te queda IA extra para ${Math.round(semanas * 7)} días más o menos.`;
  const redondeo = Math.round(semanas);
  if (redondeo === 1) return 'Te queda IA extra para una semana más o menos.';
  return `Te queda IA extra para unas ${redondeo} semanas.`;
}

// Lo que dice la app cuando se acaba: "Has gastado la IA de estas 5 horas. Vuelve a
// tenerla a las 18:40."
export function mensajeLimite(limite: LimiteAlcanzado, ahora: Date): string {
  const inicio =
    limite.motivo === 'semana' ? 'Has gastado la IA de esta semana.' : `Has gastado la IA de estas ${limite.horas} horas.`;
  const libre = libreComoFecha(limite.libre);
  const vuelta = libre && libre > ahora ? ` Vuelve a tenerla ${cuandoSeLibera(libre, ahora)}.` : ' Vuelve en un rato.';
  return `${inicio}${vuelta}`;
}

// Lee la respuesta 429 de las funciones de IA ({ error: 'limite-ia', motivo, libre }).
export function leerLimiteAlcanzado(cuerpo: unknown): LimiteAlcanzado | null {
  if (!cuerpo || typeof cuerpo !== 'object') return null;
  const c = cuerpo as { error?: unknown; motivo?: unknown; libre?: unknown; horas?: unknown };
  if (c.error !== 'limite-ia') return null;
  return {
    motivo: c.motivo === 'semana' ? 'semana' : 'ventana',
    libre: typeof c.libre === 'string' ? c.libre : null,
    horas: Number(c.horas) > 0 ? Number(c.horas) : 5,
  };
}

// Comprueba lo que devuelve la función "ia" (acción "estado").
export function leerEstadoIA(datos: unknown): EstadoIA | null {
  if (!datos || typeof datos !== 'object') return null;
  const d = datos as Record<string, unknown>;
  const limite = (v: unknown): LimiteIA | null => {
    if (!v || typeof v !== 'object') return null;
    const l = v as Record<string, unknown>;
    const usado = Number(l.usado);
    const lim = Number(l.limite);
    if (!Number.isFinite(usado) || !Number.isFinite(lim)) return null;
    return { usado, limite: lim, libre: typeof l.libre === 'string' ? l.libre : null };
  };
  const ventana = limite(d.ventana);
  const semana = limite(d.semana);
  const horas = Number(d.horas);
  if (!ventana || !semana || !Number.isFinite(horas) || horas <= 0) return null;
  const extra = Number(d.extra);
  return {
    horas,
    ventana,
    semana,
    extra: Number.isFinite(extra) ? extra : 0,
    compra: d.compra === true,
    sinLimite: d.sinLimite === true,
    clave: leerSaldoClave(d.clave),
  };
}

function leerSaldoClave(v: unknown): SaldoClave | null {
  if (!v || typeof v !== 'object') return null;
  const c = v as Record<string, unknown>;
  const numeros = [c.saldo, c.gastado, c.llamadas, c.entrada, c.salida].map(Number);
  if (numeros.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [saldo, gastado, llamadas, entrada, salida] = numeros;
  const desde = typeof c.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.desde) ? c.desde : '';
  return { saldo, gastado, llamadas, entrada, salida, desde };
}

// ---------- Saldo de la clave (dueño) ----------

// Lo que cuesta de media un token si aún no se ha gastado nada: Claude Haiku 5.5 (0,10 $
// y 0,50 $ por millón) con unos 85 de cada 100 tokens de entrada.
const COSTE_MEDIO_TOKEN = 0.16; // millonésimas de dólar

// 1234567 -> "1.234.567"
export function miles(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Millonésimas de dólar -> "4,99 $" (y "0,004 $" si es menos de un céntimo). Lo que
// queda va hacia abajo, para no decir "5,00 $" si ya se ha gastado algo.
export function dolares(millonesimas: number, haciaAbajo = false): string {
  const d = millonesimas / 1_000_000;
  const texto =
    d > 0 && d < 0.01 ? d.toFixed(3) : haciaAbajo ? (Math.floor(d * 100) / 100).toFixed(2) : d.toFixed(2);
  return `${texto.replace('.', ',')} $`;
}

export function quedaDeLaClave(c: SaldoClave): number {
  return Math.max(0, c.saldo - c.gastado);
}

// De 0 a 100, lo gastado del saldo (hacia arriba, como las barras).
export function porcentajeClave(c: SaldoClave): number {
  if (c.saldo <= 0) return 100;
  if (c.gastado <= 0) return 0;
  return Math.min(100, Math.ceil((c.gastado / c.saldo) * 100));
}

// Cuántos tokens quedan, al coste medio por token de lo gastado hasta ahora.
export function tokensQuedan(c: SaldoClave): number {
  const tokens = c.entrada + c.salida;
  const medio = tokens > 0 && c.gastado > 0 ? c.gastado / tokens : COSTE_MEDIO_TOKEN;
  return Math.floor(quedaDeLaClave(c) / medio);
}

// "850", "unos 12 mil", "un millón", "unos 2,5 millones", "unos 31 millones". Delante
// de un nombre, los millones llevan "de": textoTokens.
export function textoCantidad(n: number): string {
  if (n < 10_000) return miles(n);
  if (n < 1_000_000) return `unos ${miles(n / 1000)} mil`;
  const millones = n / 1_000_000;
  if (millones < 10) {
    const texto = millones.toFixed(1).replace('.', ',').replace(/,0$/, '');
    return texto === '1' ? 'un millón' : `unos ${texto} millones`;
  }
  return `unos ${miles(millones)} millones`;
}

// "850 tokens", "unos 12 mil tokens", "unos 31 millones de tokens".
export function textoTokens(n: number): string {
  const cantidad = textoCantidad(n);
  return /mill[oó]n/.test(cantidad) ? `${cantidad} de tokens` : `${cantidad} tokens`;
}
