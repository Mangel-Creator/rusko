import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { eventosDelDia, intervaloDe, NOMBRE_CASA, resolverLugar } from '@/services/agenda';
import { claveDia, fechaDesdeClave, sumarDias, type ClaveDia } from '@/services/fechas';

import { distanciaM } from './distancia';
import type { Punto } from './tipos';

// Qué citas necesitan hora de salida y cuándo hay que volver a calcularla.
// Funciones puras, con pruebas.

export type Cita = {
  clave: string; // "<id del evento>:<día>" (una por cada repetición)
  evento: Evento;
  dia: ClaveDia;
  llegada: Date; // hora de inicio del evento
  destino: Punto;
  lugar: string; // "Oficina", "casa" o la dirección escrita a mano
};

// Solo se calcula lo que se va a mostrar pronto: las próximas 24 horas.
export const HORAS_POR_DELANTE = 24;
export const MAXIMO_CITAS = 5;
// Si ya estás a menos de esto del sitio, no hace falta ruta.
export const YA_ESTAS_ALLI_M = 300;

export function claveCita(eventoId: string, dia: ClaveDia): string {
  return `${eventoId}:${dia}`;
}

export function inicioDe(evento: Evento, dia: ClaveDia): Date {
  const fecha = fechaDesdeClave(dia);
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, intervaloDe(evento).inicio);
}

// La cita de un evento en un día concreto, si tiene un lugar con coordenadas.
export function citaDe(evento: Evento, dia: ClaveDia, perfil: Perfil | null): Cita | null {
  if (evento.flexible || evento.foco || !evento.horaInicio) return null;
  const lugar = resolverLugar(evento.lugar, perfil);
  if (!lugar?.coordenadas) return null;
  return {
    clave: claveCita(evento.id, dia),
    evento,
    dia,
    llegada: inicioDe(evento, dia),
    destino: [lugar.coordenadas.latitud, lugar.coordenadas.longitud],
    lugar: lugar.nombre === NOMBRE_CASA ? 'casa' : (lugar.nombre ?? lugar.direccion),
  };
}

// Citas con lugar que empiezan en las próximas horas, de la más cercana a la más lejana.
export function proximasCitas(
  eventos: Evento[],
  perfil: Perfil | null,
  ahora: Date,
  horas = HORAS_POR_DELANTE,
  maximo = MAXIMO_CITAS,
): Cita[] {
  const limite = ahora.getTime() + horas * 3600 * 1000;
  const hoy = claveDia(ahora);
  const citas: Cita[] = [];
  for (let n = 0; n <= Math.ceil(horas / 24); n++) {
    const dia = sumarDias(hoy, n);
    for (const evento of eventosDelDia(eventos, dia)) {
      const cita = citaDe(evento, dia, perfil);
      if (!cita) continue;
      const t = cita.llegada.getTime();
      if (t > ahora.getTime() && t <= limite) citas.push(cita);
    }
  }
  return citas.sort((a, b) => a.llegada.getTime() - b.llegada.getTime()).slice(0, maximo);
}

export type CalculoAnterior = {
  calculadaEl: string; // ISO
  salida: string; // ISO
  origen: Punto;
  llegada: string; // ISO: si cambia la hora del evento, hay que recalcular
};

// ¿Hay que volver a preguntar al servidor? Cuanto más cerca de la hora de salir,
// más a menudo (el tráfico cambia); lejos de ella, basta con cada 2 horas.
export function hayQueRecalcular(
  anterior: CalculoAnterior | undefined,
  ahora: Date,
  origen: Punto,
  llegada: Date,
): boolean {
  if (!anterior) return true;
  if (new Date(anterior.llegada).getTime() !== llegada.getTime()) return true;
  if (distanciaM(anterior.origen, origen) > 1000) return true;
  const edadMin = (ahora.getTime() - new Date(anterior.calculadaEl).getTime()) / 60000;
  const hastaSalirMin = (new Date(anterior.salida).getTime() - ahora.getTime()) / 60000;
  if (hastaSalirMin < 3 * 60) return edadMin > 15;
  return edadMin > 120;
}
