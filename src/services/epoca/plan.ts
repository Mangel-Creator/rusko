import type { BloqueGuardado, Descanso, Dificultad, Epoca, PlanesDelDia, RegistroBloque } from '@/data/epocas/tipos';
import type { Evento } from '@/data/eventos/tipos';
import {
  calcularHuecos,
  eventosDelDia,
  intervaloDe,
  MOMENTOS,
  type Energia,
  type Intervalo,
} from '@/services/agenda';
import { horaDesdeMinutos, sumarDias, type ClaveDia } from '@/services/fechas';

import { diasEntre, esDiaLibre, imprescindiblesDelDia, PREFIJO_EPOCA, ventanaEpoca } from './estado';

// Plan automático de la época: reparte las horas de preparación de cada hito
// en bloques de estudio (de 25, 50 o 90 min con su descanso) en los días
// anteriores a su fecha. Función pura, con pruebas en __tests__.
//
// Reglas:
// - Cada día se estudian las horas de la época (la mitad si ese día va "Tranqui").
// - Solo en los huecos del horario de la época: nunca se mueve un evento con hora
//   fija ni lo que no quiere dejar de hacer. El día libre no hay plan.
// - Primero los huecos del momento en que rinde más.
// - Cada bloque va al hito que más lo necesita: cercano, difícil y con muchas
//   horas por hacer (ver puntuacion).
// - Lo hecho y lo saltado se guardan (RegistroBloque). El plan de hoy se calcula
//   desde que empieza el día, así los bloques no cambian de hora mientras lo usas.
//   Los bloques de días pasados sin marcar y los saltados se reparten solos en los
//   días que quedan. Si ya no caben, faltanMin lo dice.
// - Si se apunta algo encima de un bloque (en el calendario o con la captura), el
//   plan se rehace solo y ese bloque va a otro hueco: nada de lo que queda por hacer
//   se pierde. Hoy, con "ahora" y "guardadoHoy" (lo que el plan de hoy tenía
//   previsto), los bloques se quedan a su hora mientras no los pise nada, y lo que
//   haya que mover va a partir de ahora, nunca a una hora que ya pasó.

export const DESCANSOS: Record<Descanso, { trabajo: number; descanso: number }> = {
  '25-5': { trabajo: 25, descanso: 5 },
  '50-10': { trabajo: 50, descanso: 10 },
  '90-15': { trabajo: 90, descanso: 15 },
};

export const PESO_DIFICULTAD: Record<Dificultad, number> = { facil: 1, media: 1.5, dificil: 2 };

// Bloque más corto que se planifica (para no dejar trocitos de 5 minutos).
export const BLOQUE_MINIMO = 15;

export type BloquePlan = {
  id: string; // "<epoca>:<día>:<minuto de inicio>"
  epocaId: string;
  hitoId: string;
  dia: ClaveDia;
  inicio: number;
  fin: number;
  descansoFin: number; // igual que fin si no hay descanso detrás
  estado: 'pendiente' | 'hecho' | 'saltado';
  motivo?: string | null; // por qué se saltó, si se dijo
};

export type PlanEpoca = {
  bloques: BloquePlan[]; // desde hoy hasta el final, por orden
  faltanMin: Record<string, number>; // hito -> minutos que ya no caben antes de su fecha
};

export type DatosPlan = {
  epoca: Epoca;
  eventos: Evento[];
  registro: RegistroBloque[];
  hoy: ClaveDia;
  energias?: Partial<Record<ClaveDia, Energia>>;
  ahora?: number; // minuto de hoy (desde medianoche); sin él, hoy se planifica entero
  guardadoHoy?: BloqueGuardado[]; // lo que el plan de hoy tenía previsto (data/epocas)
};

// Un bloque como evento con hora fija, para dibujarlo en la línea de horas de
// Semana (como bloque de foco). Su id empieza por "epoca-": al tocarlo se abre
// la sección de la época.
export function eventoDeBloque(epoca: Epoca, bloque: Pick<BloquePlan, 'id' | 'dia' | 'inicio' | 'fin' | 'hitoId'>): Evento {
  return {
    id: `${PREFIJO_EPOCA}bloque:${bloque.id}`,
    titulo: epoca.hitos.find((h) => h.id === bloque.hitoId)?.nombre ?? 'Estudio',
    fecha: bloque.dia,
    horaInicio: horaDesdeMinutos(bloque.inicio),
    horaFin: horaDesdeMinutos(bloque.fin),
    tipo: 'yo',
    lugar: null,
    notas: '',
    repeticion: 'nunca',
    flexible: false,
    duracionMin: null,
    hecha: false,
    foco: true,
    avisoMin: 0,
    ejemplo: false,
  };
}

export function idBloque(epocaId: string, dia: ClaveDia, inicio: number): string {
  return `${epocaId}:${dia}:${inicio}`;
}

// Cuánto necesita un hito el siguiente bloque: más si es difícil, si le quedan
// muchas horas y si su fecha está cerca.
export function puntuacion(dificultad: Dificultad, restanteMin: number, diasHasta: number): number {
  return (PESO_DIFICULTAD[dificultad] * restanteMin) / Math.max(1, diasHasta);
}

// Pone primero la parte de los huecos que cae en el momento preferido.
function porMomento(huecos: Intervalo[], momento: Intervalo): Intervalo[] {
  const dentro: Intervalo[] = [];
  const fuera: Intervalo[] = [];
  for (const h of huecos) {
    const inicio = Math.max(h.inicio, momento.inicio);
    const fin = Math.min(h.fin, momento.fin);
    if (fin > inicio) {
      dentro.push({ inicio, fin });
      if (h.inicio < inicio) fuera.push({ inicio: h.inicio, fin: inicio });
      if (fin < h.fin) fuera.push({ inicio: fin, fin: h.fin });
    } else {
      fuera.push(h);
    }
  }
  return [...dentro, ...fuera.sort((a, b) => a.inicio - b.inicio)];
}

// Lo que hay que guardar del plan de hoy (sus bloques pendientes).
export function bloquesParaGuardar(plan: PlanEpoca, hoy: ClaveDia): BloqueGuardado[] {
  return plan.bloques
    .filter((b) => b.dia === hoy && b.estado === 'pendiente')
    .map(({ id, hitoId, inicio, fin, descansoFin }) => ({ id, hitoId, inicio, fin, descansoFin }));
}

// El plan con lo previsto para hoy (data/epocas, planesDelDia), igual en la pestaña
// Época, Semana y los avisos. La primera vez que se mira el día no hay nada guardado:
// se planifica entero, desde que empieza, para poder marcar lo de esta mañana.
export function planDeHoy({
  planesDelDia,
  ahora,
  ...datos
}: Omit<DatosPlan, 'ahora' | 'guardadoHoy'> & { planesDelDia: PlanesDelDia; ahora: number }): PlanEpoca {
  const guardadoHoy = planesDelDia[`${datos.epoca.id}:${datos.hoy}`];
  return planificarEpoca(guardadoHoy ? { ...datos, ahora, guardadoHoy } : datos);
}

const solapa = (a: Intervalo, b: Intervalo) => a.inicio < b.fin && b.inicio < a.fin;

export function planificarEpoca({
  epoca,
  eventos,
  registro,
  hoy,
  energias = {},
  ahora,
  guardadoHoy = [],
}: DatosPlan): PlanEpoca {
  const { trabajo, descanso } = DESCANSOS[epoca.ritmo.descanso];
  const propio = registro.filter((r) => r.epocaId === epoca.id);
  const hitos = epoca.hitos.filter((h) => h.fecha > hoy);

  // Minutos que le quedan a cada hito: los de preparación menos los hechos.
  const restante = new Map<string, number>();
  for (const h of hitos) {
    const hechos = propio
      .filter((r) => r.hitoId === h.id && r.estado === 'hecho')
      .reduce((total, r) => total + (r.fin - r.inicio), 0);
    restante.set(h.id, Math.max(0, Math.round(h.horasPreparacion * 60) - hechos));
  }

  // Lo que ya se marcó hoy (y después) se queda donde está.
  const bloques: BloquePlan[] = propio
    .filter((r) => r.dia >= hoy)
    .map((r) => ({ ...r, descansoFin: r.fin }));

  const ventana = ventanaEpoca(epoca);
  const primerDia = epoca.inicio > hoy ? epoca.inicio : hoy;
  const ultimoHito = hitos.reduce((ultimo, h) => (h.fecha > ultimo ? h.fecha : ultimo), '');
  const ultimoDia = ultimoHito && ultimoHito <= epoca.fin ? sumarDias(ultimoHito, -1) : epoca.fin;

  for (let dia = primerDia; dia <= ultimoDia; dia = sumarDias(dia, 1)) {
    if (esDiaLibre(epoca, dia)) continue;

    const marcados = bloques.filter((b) => b.dia === dia);
    let cuota = Math.round(epoca.ritmo.horasDia * 60) / (energias[dia] === 'tranqui' ? 2 : 1);
    cuota -= marcados.reduce((total, b) => total + (b.fin - b.inicio), 0);

    const fijos = [
      ...eventosDelDia(eventos, dia).map(intervaloDe),
      ...imprescindiblesDelDia(epoca, dia).map(intervaloDe),
    ];
    const ocupados = [...fijos, ...marcados.map((b) => ({ inicio: b.inicio, fin: b.fin }))];
    let desde = ventana;

    // Hoy, a media jornada: lo previsto se queda a su hora (si no lo pisa nada
    // nuevo) y lo que falte se coloca a partir de ahora (redondeado a 5 min).
    if (dia === hoy && ahora !== undefined) {
      const ids = new Set(bloques.map((b) => b.id));
      for (const g of guardadoHoy) {
        const restanteHito = restante.get(g.hitoId) ?? 0;
        const minutos = g.fin - g.inicio;
        if (ids.has(g.id) || restanteHito < minutos) continue;
        if (g.inicio < ventana.inicio || g.fin > ventana.fin) continue;
        if (ocupados.some((o) => solapa(o, g))) continue;
        bloques.push({ ...g, epocaId: epoca.id, dia, estado: 'pendiente' });
        ocupados.push({ inicio: g.inicio, fin: g.descansoFin });
        restante.set(g.hitoId, restanteHito - minutos);
        cuota -= minutos;
      }
      desde = { inicio: Math.max(ventana.inicio, Math.ceil(ahora / 5) * 5), fin: ventana.fin };
    }
    const huecos = porMomento(calcularHuecos(ocupados, desde, BLOQUE_MINIMO), MOMENTOS[epoca.ritmo.rindeMas]);

    for (const hueco of huecos) {
      let cursor = hueco.inicio;
      while (cuota >= BLOQUE_MINIMO && hueco.fin - cursor >= BLOQUE_MINIMO) {
        const candidatos = hitos.filter((h) => h.fecha > dia && (restante.get(h.id) ?? 0) > 0);
        if (candidatos.length === 0) break;
        const hito = candidatos.reduce((mejor, h) =>
          puntuacion(h.dificultad, restante.get(h.id) ?? 0, diasEntre(dia, h.fecha)) >
          puntuacion(mejor.dificultad, restante.get(mejor.id) ?? 0, diasEntre(dia, mejor.fecha))
            ? h
            : mejor,
        );
        const minutos = Math.min(trabajo, cuota, restante.get(hito.id) ?? 0, hueco.fin - cursor);
        if (minutos < BLOQUE_MINIMO) break;
        bloques.push({
          id: idBloque(epoca.id, dia, cursor),
          epocaId: epoca.id,
          hitoId: hito.id,
          dia,
          inicio: cursor,
          fin: cursor + minutos,
          descansoFin: Math.min(cursor + minutos + descanso, hueco.fin),
          estado: 'pendiente',
        });
        restante.set(hito.id, (restante.get(hito.id) ?? 0) - minutos);
        cuota -= minutos;
        cursor += minutos + descanso;
      }
    }
  }

  const faltanMin: Record<string, number> = {};
  for (const [id, minutos] of restante) if (minutos > 0) faltanMin[id] = minutos;

  bloques.sort((a, b) => a.dia.localeCompare(b.dia) || a.inicio - b.inicio);
  return { bloques, faltanMin };
}
