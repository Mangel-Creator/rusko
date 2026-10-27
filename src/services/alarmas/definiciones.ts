import type { Adelantos, Alarma } from '@/data/alarmas';
import type { Salida } from '@/data/salidas';
import { claveDia, minutosDesdeHora, sumarDias } from '@/services/fechas';

import { adelantoDe, alarmasDeSalida, diaDeLaSemana, momento, proximaVez } from './calculo';

// Qué alarmas de verdad (AlarmKit en iPhone, AlarmManager en Android) tiene que haber
// en el móvil. Función pura, con pruebas: nativo.ts compara esta lista con lo que ya
// programó y solo cambia lo distinto.
//
// Reglas para que una alarma nunca deje de sonar:
//   - Primero se programa la nueva y después se quita la vieja (nativo.ts).
//   - La inteligente va en una alarma semanal por cada día. Si mañana se adelanta,
//     solo cambia la de ese día de la semana; cuando pasa, se vuelve a su hora al
//     abrir la app. Si no se abre en una semana, sonará antes, pero nunca tarde.
//   - AlarmKit solo sabe "a esta hora, una vez" (la próxima vez que llegue esa hora)
//     o "cada semana". Una alarma de una sola vez para dentro de más de 24 h va como
//     semanal de ese día y se quita cuando ha pasado.

export type DefinicionNativa = {
  clave: string; // estable: "alarma:<id>", "alarma:<id>:<día>", "alarma:<id>:una-vez", "salida:<cita>"
  hora: number;
  minuto: number;
  diasIso: number[]; // 1 = lunes ... 7 = domingo. Vacío = una vez, la próxima vez que llegue la hora
  titulo: string;
  tipo: 'alarma' | 'salida';
  vibrar: boolean; // solo vibrar, sin sonido
  eventoId?: string; // salida: para "Cómo llegar"
  dia?: string;
};

export type ContextoNativo = {
  ahora: Date;
  alarmas: Alarma[];
  adelantos: Adelantos;
  salidas: Salida[];
  eventosConAlarma: string[];
};

const DIA_MS = 24 * 3600 * 1000;

function horaYMinuto(minutos: number): { hora: number; minuto: number } {
  const m = ((minutos % 1440) + 1440) % 1440;
  return { hora: Math.floor(m / 60), minuto: m % 60 };
}

export function tituloAlarma(alarma: Alarma, adelantoMin = 0): string {
  const nombre = alarma.etiqueta.trim() || (alarma.tipo === 'inteligente' ? 'Alarma inteligente' : 'Despertador');
  return adelantoMin > 0 ? `${nombre} · ${adelantoMin} min antes por el tráfico` : nombre;
}

function definicionesDeAlarma(alarma: Alarma, ctx: ContextoNativo): DefinicionNativa[] {
  if (!alarma.activada) return [];
  const base = { tipo: 'alarma' as const, vibrar: alarma.sonido === 'vibrar' };
  const normal = minutosDesdeHora(alarma.hora);

  if (alarma.dias.length === 0) {
    const vez = proximaVez(alarma, ctx.ahora, ctx.adelantos);
    // A una semana o más, la semanal sonaría antes de tiempo: se programa al acercarse.
    if (!vez || vez.cuando.getTime() - ctx.ahora.getTime() >= 7 * DIA_MS) return [];
    const cerca = vez.cuando.getTime() - ctx.ahora.getTime() <= DIA_MS;
    return [
      {
        ...base,
        clave: `alarma:${alarma.id}:una-vez`,
        ...horaYMinuto(normal - vez.adelantoMin),
        diasIso: cerca ? [] : [diaDeLaSemana(vez.dia) + 1],
        titulo: tituloAlarma(alarma, vez.adelantoMin),
      },
    ];
  }

  if (alarma.tipo === 'despertador') {
    return [
      {
        ...base,
        clave: `alarma:${alarma.id}`,
        ...horaYMinuto(normal),
        diasIso: [...alarma.dias].sort((a, b) => a - b).map((d) => d + 1),
        titulo: tituloAlarma(alarma),
      },
    ];
  }

  // Inteligente: una semanal por cada día, con el adelanto de su próxima vez.
  const hoy = claveDia(ctx.ahora);
  return [...alarma.dias]
    .sort((a, b) => a - b)
    .map((d) => {
      let dia = hoy;
      for (let n = 0; n < 8; n++) {
        dia = sumarDias(hoy, n);
        if (diaDeLaSemana(dia) === d && momento(dia, normal).getTime() > ctx.ahora.getTime()) break;
      }
      // No cruza la medianoche hacia atrás: seguiría siendo el mismo día de la semana.
      const adelanto = Math.min(adelantoDe(alarma, dia, ctx.adelantos), normal);
      return {
        ...base,
        clave: `alarma:${alarma.id}:${d}`,
        ...horaYMinuto(normal - adelanto),
        diasIso: [d + 1],
        titulo: tituloAlarma(alarma, adelanto),
      };
    });
}

export function definicionesNativas(ctx: ContextoNativo): DefinicionNativa[] {
  const salidas = alarmasDeSalida(ctx.salidas, ctx.eventosConAlarma, ctx.ahora)
    .filter((s) => new Date(s.salida).getTime() - ctx.ahora.getTime() <= DIA_MS)
    .map((s): DefinicionNativa => {
      const cuando = new Date(s.salida);
      return {
        clave: `salida:${s.clave}`,
        hora: cuando.getHours(),
        minuto: cuando.getMinutes(),
        diasIso: [],
        titulo: `Sal ya: ${s.titulo}`,
        tipo: 'salida',
        vibrar: false,
        eventoId: s.eventoId,
        dia: s.dia,
      };
    });
  return [...ctx.alarmas.flatMap((a) => definicionesDeAlarma(a, ctx)), ...salidas];
}

// --- Qué cambiar ---

export type Programada = { uuid: string; firma: string };
export type Programadas = Record<string, Programada>; // por clave

export function firma(d: DefinicionNativa): string {
  return JSON.stringify([d.hora, d.minuto, d.diasIso, d.titulo, d.tipo, d.vibrar]);
}

// Lo que hay que crear (nuevo o cambiado) y lo que hay que quitar (ya no hace falta,
// o su versión antigua). Primero se crea y luego se quita.
export function diferencias(
  programadas: Programadas,
  deseadas: DefinicionNativa[],
): { crear: DefinicionNativa[]; quitar: { clave: string; uuid: string }[] } {
  const crear = deseadas.filter((d) => programadas[d.clave]?.firma !== firma(d));
  const siguen = new Map(deseadas.map((d) => [d.clave, firma(d)]));
  const quitar = Object.entries(programadas)
    .filter(([clave, p]) => siguen.get(clave) !== p.firma)
    .map(([clave, p]) => ({ clave, uuid: p.uuid }));
  return { crear, quitar };
}
