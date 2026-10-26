import type { Epoca, Hito } from '@/data/epocas/tipos';
import type { Evento, LugarEvento } from '@/data/eventos/tipos';
import type { DiaSemana } from '@/data/perfil';
import type { Intervalo } from '@/services/agenda';
import {
  diaSemanaDesdeLunes,
  fechaDesdeClave,
  minutosDelDia,
  minutosDesdeHora,
  claveDia,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';

// En qué punto está cada época y qué cambia en un día concreto.
// Funciones puras, con pruebas en __tests__.

export type EstadoEpoca = 'programada' | 'activa' | 'pasada';

export function estadoEpoca(epoca: Epoca, hoy: ClaveDia): EstadoEpoca {
  if (hoy < epoca.inicio) return 'programada';
  if (hoy > epoca.fin) return 'pasada';
  return 'activa';
}

// Época dorada (cambia el ritmo del día) o solo plan de estudio (26/10/2026).
// Las guardadas antes no tienen el campo: eran todas doradas.
export function esDorada(epoca: Pick<Epoca, 'dorada'>): boolean {
  return epoca.dorada !== false;
}

export function nombreModo(epoca: Pick<Epoca, 'dorada'>): string {
  return esDorada(epoca) ? 'Época dorada' : 'Plan de estudio';
}

// La época activa ese día. Solo puede haber una: si dos se solapan (se avisa al
// guardar), manda la que empezó antes.
export function epocaActiva(epocas: Epoca[], dia: ClaveDia): Epoca | null {
  const activas = epocas
    .filter((e) => estadoEpoca(e, dia) === 'activa')
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id));
  return activas[0] ?? null;
}

// La época activa hoy o, si no hay, la primera que empieza en los próximos
// "dias" días (para programar sus avisos con antelación).
export function epocaProxima(epocas: Epoca[], hoy: ClaveDia, dias: number): Epoca | null {
  const activa = epocaActiva(epocas, hoy);
  if (activa) return activa;
  const limite = sumarDias(hoy, dias);
  return (
    epocas
      .filter((e) => e.inicio > hoy && e.inicio <= limite)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null
  );
}

// Las épocas (menos ella misma) que comparten algún día con "epoca".
export function epocasSolapadas(epoca: Pick<Epoca, 'id' | 'inicio' | 'fin'>, epocas: Epoca[]): Epoca[] {
  return epocas.filter((otra) => otra.id !== epoca.id && otra.inicio <= epoca.fin && epoca.inicio <= otra.fin);
}

// Días entre dos fechas: diasEntre("2026-09-24", "2026-09-28") = 4.
export function diasEntre(desde: ClaveDia, hasta: ClaveDia): number {
  return Math.round((fechaDesdeClave(hasta).getTime() - fechaDesdeClave(desde).getTime()) / 86400000);
}

// Horas despierto en la época, en minutos desde medianoche. Si se acuesta
// después de medianoche, el día acaba a las 24:00.
export function ventanaEpoca(epoca: Epoca): Intervalo {
  const inicio = minutosDesdeHora(epoca.ritmo.levantarse);
  const fin = minutosDesdeHora(epoca.ritmo.acostarse);
  return { inicio, fin: fin > inicio ? fin : 24 * 60 };
}

function diaDeLaSemana(dia: ClaveDia): DiaSemana {
  return diaSemanaDesdeLunes(fechaDesdeClave(dia)) as DiaSemana;
}

export function esDiaLibre(epoca: Epoca, dia: ClaveDia): boolean {
  return epoca.ritmo.diaLibre === diaDeLaSemana(dia);
}

// Dónde estudia ese día: el sitio de ese día de la semana, el sitio de la época
// si es un día que "va", o casa los demás días.
export function lugarDelDia(epoca: Epoca, dia: ClaveDia): LugarEvento {
  const d = diaDeLaSemana(dia);
  if (!epoca.ritmo.diasVas.includes(d)) return { tipo: 'casa' };
  return epoca.ritmo.lugarPorDia[d] ?? epoca.ritmo.lugar;
}

// Las cosas que no quiere dejar de hacer ese día, como eventos con hora fija
// (no se guardan: se crean al vuelo). Su id empieza por "epoca-" para que al
// tocarlas se abra la sección de la época y no la ficha de evento.
export const PREFIJO_EPOCA = 'epoca-';

export function imprescindiblesDelDia(epoca: Epoca, dia: ClaveDia): Evento[] {
  if (dia < epoca.inicio || dia > epoca.fin) return [];
  const d = diaDeLaSemana(dia);
  return epoca.ritmo.imprescindibles
    .filter((i) => i.dias.includes(d))
    .map((i) => ({
      id: `${PREFIJO_EPOCA}imp:${i.id}:${dia}`,
      titulo: i.nombre,
      fecha: dia,
      horaInicio: i.horaInicio,
      horaFin: i.horaFin,
      tipo: 'yo' as const,
      lugar: null,
      notas: '',
      repeticion: 'nunca' as const,
      flexible: false,
      duracionMin: null,
      hecha: false,
      foco: false,
      avisoMin: 0,
      ejemplo: false,
    }));
}

export function hitosDelDia(epoca: Epoca, dia: ClaveDia): Hito[] {
  return epoca.hitos.filter((h) => h.fecha === dia);
}

// "quedan 12 días", "quedan 2 días" o "último día".
export function textoQuedan(epoca: Epoca, hoy: ClaveDia): string {
  const dias = diasEntre(hoy, epoca.fin) + 1;
  return dias <= 1 ? 'último día' : `quedan ${dias} días`;
}

// Cuenta atrás al siguiente hito: "Estadística en 4 días", "mañana" o "hoy a las 9:00".
export type CuentaAtras = { hito: Hito; dias: number; texto: string };

export function cuentaAtras(epoca: Epoca, ahora: Date): CuentaAtras | null {
  const hoy = claveDia(ahora);
  const minuto = minutosDelDia(ahora);
  const siguiente = [...epoca.hitos]
    .filter((h) => h.fecha > hoy || (h.fecha === hoy && minutosDesdeHora(h.hora) > minuto))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))[0];
  if (!siguiente) return null;
  const dias = diasEntre(hoy, siguiente.fecha);
  const cuando = dias === 0 ? `hoy a las ${siguiente.hora}` : dias === 1 ? 'mañana' : `en ${dias} días`;
  return { hito: siguiente, dias, texto: `${siguiente.nombre} ${cuando}` };
}
