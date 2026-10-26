import { useEffect } from 'react';

import { guardarPlanDelDia, useEpocas, type Epoca, type PlanesDelDia, type RegistroBloque } from '@/data/epocas';
import type { Evento } from '@/data/eventos';
import type { Energia } from '@/services/agenda';
import { bloquesParaGuardar, epocaActiva, planDeHoy, type PlanEpoca } from '@/services/epoca';
import { minutosDelDia, type ClaveDia } from '@/services/fechas';

// La época activa hoy y su plan, para Hoy y la sección de la época.
// El plan se calcula al vuelo (es rápido): así siempre está al día con los
// eventos, lo marcado y la energía de hoy.
//
// Lo que el plan de hoy tiene previsto se guarda (guardarPlanDelDia). Así, si se
// apunta algo encima de un bloque, solo se mueve ese bloque y a partir de ahora, y
// mañana se puede preguntar por lo que se quedó sin marcar. La primera vez que se
// mira el día no hay nada guardado: se planifica entero, desde que empieza.
export type EpocaDelDia = {
  cargado: boolean;
  epocas: Epoca[];
  registro: RegistroBloque[];
  planesDelDia: PlanesDelDia;
  epoca: Epoca | null;
  plan: PlanEpoca | null;
};

export function useEpocaActiva(
  hoy: ClaveDia,
  eventos: Evento[],
  energiaHoy: Energia,
  ahora: Date = new Date(),
): EpocaDelDia {
  const { cargado, epocas, registro, planesDelDia } = useEpocas();
  const epoca = epocaActiva(epocas, hoy);
  const plan = epoca
    ? planDeHoy({ epoca, eventos, registro, planesDelDia, hoy, energias: { [hoy]: energiaHoy }, ahora: minutosDelDia(ahora) })
    : null;
  const guardar = cargado && epoca && plan ? bloquesParaGuardar(plan, hoy) : null;
  const clave = guardar ? JSON.stringify(guardar) : '';
  useEffect(() => {
    if (epoca && guardar) void guardarPlanDelDia(epoca.id, hoy, guardar);
    // Solo cuando cambia lo previsto (clave), no en cada pintado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoca?.id, hoy, clave]);
  return { cargado, epocas, registro, planesDelDia, epoca, plan };
}
