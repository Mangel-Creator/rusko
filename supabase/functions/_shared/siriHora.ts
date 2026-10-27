// Rusko · Siri con Atajos (27/10/2026): la hora de una alarma que manda el Atajo
// "Alarma en Rusko". Sin nada de Deno, para probarlo con Jest (__tests__/siriHora.test.ts).

const DIA_MS = 86400_000;

const dos = (n: number) => String(n).padStart(2, '0');

export type HoraSiri = { dia: string; hora: string; cuando: string; manana: boolean };

// "2026-10-28 07:30 +01:00" (formato personalizado del Atajo) o ISO 8601
// ("2026-10-28T07:30:00+01:00"). Hace falta la zona: así se sabe la hora del iPhone.
// Si esa hora ya ha pasado, es la de mañana (como el Reloj). Solo las próximas 2 semanas.
export function leerCuando(valor: string, ahora: number): HoraSiri | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/.exec(
    valor.trim(),
  );
  if (!m) return null;
  const [a, mes, d, h, min] = m.slice(1, 6).map(Number);
  if (h > 23 || min > 59 || mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  let desfase = 0;
  if (m[6] !== 'Z') {
    const z = m[6].replace(':', '');
    desfase = (z[0] === '-' ? -1 : 1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5)));
  }
  let local = Date.UTC(a, mes - 1, d, h, min);
  let instante = local - desfase * 60_000;
  let manana = false;
  if (instante <= ahora - 60_000) {
    local += DIA_MS;
    instante += DIA_MS;
    manana = true;
  }
  if (instante > ahora + 14 * DIA_MS) return null;
  const f = new Date(local);
  return {
    dia: `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`,
    hora: `${dos(h)}:${dos(min)}`,
    cuando: new Date(instante).toISOString(),
    manana,
  };
}
