import type { Epoca, Hito, RegistroBloque, TemaHito } from '@/data/epocas/tipos';
import type { ClaveDia } from '@/services/fechas';

import type { PlanEpoca } from './plan';

// Qué tema toca en cada bloque. Los temas de un hito se estudian en orden: los
// minutos hechos van "llenando" el primer tema, luego el segundo... Cada bloque
// del plan se etiqueta con el tema en el que cae su mitad. Funciones puras, con
// pruebas en __tests__.

function minutosDe(tema: TemaHito): number {
  return Math.round(tema.horas * 60);
}

// El tema en el que cae un minuto del estudio de ese hito (0 = el principio).
// Pasado el último, se queda en el último (suele ser el repaso).
export function temaEnMinuto(temas: TemaHito[], minuto: number): TemaHito | null {
  let acumulado = 0;
  for (const tema of temas) {
    acumulado += minutosDe(tema);
    if (minuto < acumulado) return tema;
  }
  return temas[temas.length - 1] ?? null;
}

// Nombre del tema de cada bloque del plan: id del bloque -> "Tema 3: Regresión".
// Los bloques de hitos sin temas no salen.
export function temasDelPlan(
  epoca: Epoca,
  registro: RegistroBloque[],
  plan: PlanEpoca,
  hoy: ClaveDia,
): Map<string, string> {
  const resultado = new Map<string, string>();
  for (const hito of epoca.hitos) {
    const temas = hito.temas ?? [];
    if (temas.length === 0) continue;
    // Lo hecho en días anteriores ya no está en el plan (empieza hoy).
    let cursor = registro
      .filter((r) => r.epocaId === epoca.id && r.hitoId === hito.id && r.estado === 'hecho' && r.dia < hoy)
      .reduce((total, r) => total + (r.fin - r.inicio), 0);
    const bloques = plan.bloques
      .filter((b) => b.hitoId === hito.id && b.estado !== 'saltado')
      .sort((a, b) => a.dia.localeCompare(b.dia) || a.inicio - b.inicio);
    for (const bloque of bloques) {
      const duracion = bloque.fin - bloque.inicio;
      const tema = temaEnMinuto(temas, cursor + duracion / 2);
      if (tema) resultado.set(bloque.id, tema.nombre);
      cursor += duracion;
    }
  }
  return resultado;
}

// Por qué tema vas con lo que llevas hecho: "vas por el 3 de 6".
export type TemaActual = { tema: TemaHito; numero: number; total: number; terminado: boolean };

export function temaActual(hito: Hito, hechoMin: number): TemaActual | null {
  const temas = hito.temas ?? [];
  if (temas.length === 0) return null;
  const total = temas.reduce((t, tema) => t + minutosDe(tema), 0);
  const tema = temaEnMinuto(temas, hechoMin);
  if (!tema) return null;
  return { tema, numero: temas.indexOf(tema) + 1, total: temas.length, terminado: hechoMin >= total };
}

// Horas de todos los temas juntos (para las horas de preparación del hito).
export function horasDeTemas(temas: TemaHito[]): number {
  return temas.reduce((t, tema) => t + tema.horas, 0);
}

// "Son pocas horas" / "Son demasiadas" (03/11/2026): sube un 30 % o baja un 25 % las
// horas del hito y las de cada tema, a medias horas. El plan se recoloca solo.
export type AjusteHoras = 'pocas' | 'muchas';
const FACTOR_AJUSTE: Record<AjusteHoras, number> = { pocas: 1.3, muchas: 0.75 };

export function ajustarHorasHito(hito: Hito, ajuste: AjusteHoras): Hito {
  const escalar = (horas: number, minimo: number) =>
    Math.min(200, Math.max(minimo, Math.round(horas * FACTOR_AJUSTE[ajuste] * 2) / 2));
  return {
    ...hito,
    horasPreparacion: escalar(hito.horasPreparacion, 1),
    ...(hito.temas ? { temas: hito.temas.map((t) => ({ ...t, horas: escalar(t.horas, 0.5) })) } : {}),
  };
}
