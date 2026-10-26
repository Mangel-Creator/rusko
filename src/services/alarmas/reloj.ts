import type { Adelantos, Alarma } from '@/data/alarmas';
import type { Salida } from '@/data/salidas';
import { formatearHora } from '@/services/fechas';

import { alarmasDeSalida, vecesDeAlarma } from './calculo';
import { tituloAlarma } from './definiciones';

// Alarmas al Reloj del iPhone (26/10/2026). Función pura, con pruebas: qué alarmas sube
// la web al servidor para que el Atajo del usuario las cree cada noche en el Reloj.
// Cada una es una vez concreta (día y hora), con el adelanto de la inteligente si lo
// hay; el servidor solo da al Atajo las de las próximas 24 horas.

export const DIAS_RELOJ = 14;

export type AlarmaReloj = {
  cuando: string; // ISO
  hora: string; // "07:30", la hora de aquí, que es la que se pone en el Reloj
  etiqueta: string; // sin el "Organizy · ", que lo añade el servidor
};

export type ContextoReloj = {
  ahora: Date;
  alarmas: Alarma[];
  adelantos: Adelantos;
  salidas: Salida[];
  eventosConAlarma: string[];
};

export function alarmasParaReloj({ ahora, alarmas, adelantos, salidas, eventosConAlarma }: ContextoReloj): AlarmaReloj[] {
  const veces = alarmas.flatMap((alarma) =>
    vecesDeAlarma(alarma, ahora, DIAS_RELOJ, adelantos).map((vez) => ({
      cuando: vez.cuando,
      etiqueta: tituloAlarma(alarma, vez.adelantoMin),
    })),
  );
  const deSalida = alarmasDeSalida(salidas, eventosConAlarma, ahora).map((s) => ({
    cuando: new Date(s.salida),
    etiqueta: `Sal ya: ${s.titulo}`,
  }));
  return [...veces, ...deSalida]
    .sort((a, b) => a.cuando.getTime() - b.cuando.getTime())
    .map((a) => ({ cuando: a.cuando.toISOString(), hora: formatearHora(a.cuando), etiqueta: a.etiqueta }));
}
