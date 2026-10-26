import type { Epoca, RegistroBloque } from '@/data/epocas/tipos';
import type { Evento } from '@/data/eventos/tipos';
import { sumarDias, type ClaveDia } from '@/services/fechas';

import { diasEntre } from './estado';
import { planificarEpoca } from './plan';

// Cuándo empezar a estudiar: el último día que deja tiempo para todos los
// exámenes o entregas, con un margen por si surge algo. Función pura, con pruebas.
//
// Se prueba el plan empezando cada día (búsqueda binaria entre hoy y la víspera
// del último hito): empezar antes nunca da menos tiempo, así que basta con buscar
// el último día con el que todo cabe. El margen es pedir que quepa un 20 % más.

export const MARGEN_INICIO = 1.2;

export type InicioRecomendado = {
  dia: ClaveDia;
  llega: boolean; // false = ni empezando hoy cabe todo (con el margen)
};

type Datos = {
  epoca: Epoca;
  eventos: Evento[];
  registro: RegistroBloque[];
  hoy: ClaveDia;
};

export function inicioRecomendado({ epoca, eventos, registro, hoy }: Datos): InicioRecomendado | null {
  const hitos = epoca.hitos.filter((h) => h.fecha > hoy && h.horasPreparacion > 0);
  if (hitos.length === 0) return null;
  // El margen va en las horas: así un día con poco hueco no se cuenta como "justo".
  const conMargen: Epoca = {
    ...epoca,
    hitos: epoca.hitos.map((h) => ({ ...h, horasPreparacion: h.horasPreparacion * MARGEN_INICIO })),
  };
  const cabe = (inicio: ClaveDia) =>
    Object.keys(planificarEpoca({ epoca: { ...conMargen, inicio }, eventos, registro, hoy }).faltanMin).length === 0;

  if (!cabe(hoy)) return { dia: hoy, llega: false };
  const ultimo = hitos.reduce((u, h) => (h.fecha > u ? h.fecha : u), hitos[0].fecha);
  let bien = 0; // días desde hoy con los que cabe
  let mal = diasEntre(hoy, ultimo); // empezar el día del último hito ya no sirve
  while (mal - bien > 1) {
    const medio = Math.floor((bien + mal) / 2);
    if (cabe(sumarDias(hoy, medio))) bien = medio;
    else mal = medio;
  }
  return { dia: sumarDias(hoy, bien), llega: true };
}
