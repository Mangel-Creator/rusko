import { describe, expect, it } from '@jest/globals';

import type { Epoca, Hito, RegistroBloque } from '@/data/epocas/tipos';
import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { avisosDeEpoca } from '@/services/avisos/epoca';
import {
  cuentaAtras,
  epocaActiva,
  epocasSolapadas,
  estadoEpoca,
  imprescindiblesDelDia,
  lugarDelDia,
  planificarEpoca,
  progresoHitos,
  progresoSemana,
  resumenEpoca,
  textoQuedan,
} from '@/services/epoca';

// Jueves 24 de septiembre de 2026.
const HOY = '2026-09-24';
const h = (hora: string) => {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
};

function hito(parcial: Partial<Hito>): Hito {
  return {
    id: 'h1',
    nombre: 'Estadística',
    fecha: '2026-09-28',
    hora: '09:00',
    lugar: null,
    dificultad: 'media',
    horasPreparacion: 4,
    ...parcial,
  };
}

function epoca(parcial: Partial<Epoca> = {}): Epoca {
  return {
    id: 'e1',
    nombre: 'Exámenes',
    tipo: 'examenes',
    inicio: '2026-09-21',
    fin: '2026-10-04',
    ritmo: {
      levantarse: '08:00',
      acostarse: '23:00',
      lugar: { tipo: 'otro', direccion: 'Biblioteca', coordenadas: null },
      lugarPorDia: {},
      diasVas: [0, 1, 2, 3, 4],
      horasDia: 2,
      rindeMas: 'manana',
      descanso: '50-10',
      diaLibre: null,
      trayectoMin: 20,
      imprescindibles: [],
    },
    hitos: [hito({})],
    avisos: { salir: true, inicioBloque: true, finDescanso: true, dormir: true },
    ejemplo: false,
    dorada: true,
    resumenVisto: false,
    ...parcial,
  };
}

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: 'ev',
    titulo: 'Evento',
    fecha: HOY,
    horaInicio: '10:00',
    horaFin: '11:00',
    tipo: 'yo',
    lugar: null,
    notas: '',
    repeticion: 'nunca',
    flexible: false,
    duracionMin: null,
    hecha: false,
    foco: false,
    avisoMin: null,
    ejemplo: false,
    ...parcial,
  };
}

const minutos = (bloques: { inicio: number; fin: number }[]) => bloques.reduce((t, b) => t + b.fin - b.inicio, 0);

describe('estado de la época', () => {
  it('programada, activa y pasada', () => {
    const e = epoca();
    expect(estadoEpoca(e, '2026-09-20')).toBe('programada');
    expect(estadoEpoca(e, HOY)).toBe('activa');
    expect(estadoEpoca(e, '2026-10-05')).toBe('pasada');
  });

  it('solo una activa: si se solapan, manda la que empezó antes', () => {
    const a = epoca({ id: 'a', inicio: '2026-09-22' });
    const b = epoca({ id: 'b', inicio: '2026-09-20' });
    expect(epocaActiva([a, b], HOY)?.id).toBe('b');
    expect(epocaActiva([a, b], '2026-12-01')).toBeNull();
  });

  it('detecta las épocas que se solapan en fechas', () => {
    const otra = epoca({ id: 'o', inicio: '2026-10-04', fin: '2026-10-10' });
    const lejos = epoca({ id: 'l', inicio: '2026-11-01', fin: '2026-11-10' });
    expect(epocasSolapadas(epoca(), [otra, lejos]).map((e) => e.id)).toEqual(['o']);
  });

  it('dice cuántos días quedan', () => {
    expect(textoQuedan(epoca(), HOY)).toBe('quedan 11 días');
    expect(textoQuedan(epoca(), '2026-10-04')).toBe('último día');
  });

  it('cuenta atrás al siguiente hito', () => {
    const e = epoca({ hitos: [hito({ fecha: '2026-09-28' }), hito({ id: 'h2', nombre: 'Inglés', fecha: HOY, hora: '18:00' })] });
    expect(cuentaAtras(e, new Date(2026, 8, 24, 10, 0))?.texto).toBe('Inglés hoy a las 18:00');
    expect(cuentaAtras(e, new Date(2026, 8, 24, 19, 0))?.texto).toBe('Estadística en 4 días');
  });

  it('sitio del día: los días que no va, en casa; y un sitio distinto un día concreto', () => {
    const e = epoca({
      ritmo: { ...epoca().ritmo, lugarPorDia: { 3: { tipo: 'sitio', sitioId: 'oficina' } } },
    });
    expect(lugarDelDia(e, HOY)).toEqual({ tipo: 'sitio', sitioId: 'oficina' }); // jueves
    expect(lugarDelDia(e, '2026-09-25')).toEqual(e.ritmo.lugar); // viernes
    expect(lugarDelDia(e, '2026-09-26')).toEqual({ tipo: 'casa' }); // sábado
  });

  it('lo que no quiere dejar de hacer sale como evento con hora fija esos días', () => {
    const e = epoca({
      ritmo: {
        ...epoca().ritmo,
        imprescindibles: [{ id: 'g', nombre: 'Gimnasio', dias: [3], horaInicio: '19:00', horaFin: '20:00' }],
      },
    });
    expect(imprescindiblesDelDia(e, HOY).map((i) => [i.titulo, i.horaInicio])).toEqual([['Gimnasio', '19:00']]);
    expect(imprescindiblesDelDia(e, '2026-09-25')).toEqual([]);
  });
});

describe('plan automático', () => {
  it('reparte las horas del hito en bloques antes de su fecha', () => {
    const plan = planificarEpoca({ epoca: epoca(), eventos: [], registro: [], hoy: HOY });
    // 4 h de preparación, 2 h al día: jueves y viernes (el examen es el lunes).
    expect(minutos(plan.bloques)).toBe(240);
    expect(plan.bloques.every((b) => b.dia < '2026-09-28')).toBe(true);
    expect(new Set(plan.bloques.map((b) => b.dia))).toEqual(new Set([HOY, '2026-09-25']));
    // Bloques de 50 min con 10 de descanso, empezando por la mañana.
    expect(plan.bloques[0]).toMatchObject({ inicio: h('08:00'), fin: h('08:50'), descansoFin: h('09:00') });
    expect(plan.faltanMin).toEqual({});
  });

  it('nunca pisa eventos con hora fija ni lo que no quiere dejar de hacer', () => {
    const e = epoca({
      ritmo: {
        ...epoca().ritmo,
        horasDia: 4,
        imprescindibles: [{ id: 'g', nombre: 'Comida', dias: [3], horaInicio: '14:00', horaFin: '15:00' }],
      },
    });
    const eventos = [evento({ horaInicio: '08:30', horaFin: '12:00' })];
    const hoy = planificarEpoca({ epoca: e, eventos, registro: [], hoy: HOY }).bloques.filter((b) => b.dia === HOY);
    for (const b of hoy) {
      expect(b.fin <= h('08:30') || b.inicio >= h('12:00')).toBe(true);
      expect(b.fin <= h('14:00') || b.inicio >= h('15:00')).toBe(true);
    }
  });

  it('respeta el día libre', () => {
    const e = epoca({ ritmo: { ...epoca().ritmo, diaLibre: 4, horasDia: 1 } }); // viernes libre
    const plan = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY });
    expect(plan.bloques.some((b) => b.dia === '2026-09-25')).toBe(false);
  });

  it('da prioridad a lo más cercano y difícil', () => {
    const e = epoca({
      ritmo: { ...epoca().ritmo, horasDia: 1 },
      hitos: [
        hito({ id: 'lejos', fecha: '2026-10-03', dificultad: 'facil', horasPreparacion: 3 }),
        hito({ id: 'cerca', fecha: '2026-09-26', dificultad: 'dificil', horasPreparacion: 3 }),
      ],
    });
    const plan = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY });
    expect(plan.bloques[0].hitoId).toBe('cerca');
  });

  it('avisa si las horas ya no caben antes del hito', () => {
    const e = epoca({ hitos: [hito({ fecha: '2026-09-25', horasPreparacion: 5 })] });
    const plan = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY });
    expect(plan.faltanMin).toEqual({ h1: 180 }); // solo cabe hoy (2 h de 5)
  });

  it('con "Tranqui" hoy baja a la mitad y el resto pasa a otros días', () => {
    const plan = planificarEpoca({ epoca: epoca(), eventos: [], registro: [], hoy: HOY, energias: { [HOY]: 'tranqui' } });
    // La mitad de 2 h es 1 h: cabe un bloque de 50 min (los 10 que sobran no llegan
    // al mínimo de 15 y pasan a otro día).
    expect(minutos(plan.bloques.filter((b) => b.dia === HOY))).toBe(50);
    expect(minutos(plan.bloques)).toBe(240);
  });

  it('lo hecho cuenta y un bloque saltado se reparte en los días que quedan', () => {
    const base = planificarEpoca({ epoca: epoca(), eventos: [], registro: [], hoy: HOY });
    const primero = base.bloques[0];
    const saltado: RegistroBloque = { ...primero, estado: 'saltado' };
    const conSalto = planificarEpoca({ epoca: epoca(), eventos: [], registro: [saltado], hoy: HOY });
    // El saltado sigue en el plan de hoy (se ve como saltado) y sus minutos van a otro día.
    expect(conSalto.bloques.find((b) => b.id === primero.id)?.estado).toBe('saltado');
    const pendientes = conSalto.bloques.filter((b) => b.estado === 'pendiente');
    expect(minutos(pendientes)).toBe(240);
    expect(pendientes.some((b) => b.dia === '2026-09-26')).toBe(true);

    const hecho: RegistroBloque = { ...primero, estado: 'hecho' };
    const conHecho = planificarEpoca({ epoca: epoca(), eventos: [], registro: [hecho], hoy: HOY });
    expect(minutos(conHecho.bloques.filter((b) => b.estado === 'pendiente'))).toBe(190);
  });

  it('un bloque de un día pasado sin marcar se vuelve a repartir', () => {
    const ayer = planificarEpoca({ epoca: epoca(), eventos: [], registro: [], hoy: '2026-09-23' });
    const hoy = planificarEpoca({ epoca: epoca(), eventos: [], registro: [], hoy: HOY });
    // Ayer no se marcó nada: hoy siguen quedando las 4 h enteras.
    expect(minutos(ayer.bloques)).toBe(240);
    expect(minutos(hoy.bloques)).toBe(240);
  });
});

describe('progreso y resumen', () => {
  const registro: RegistroBloque[] = [
    { id: 'r1', epocaId: 'e1', hitoId: 'h1', dia: '2026-09-22', inicio: h('08:00'), fin: h('08:50'), estado: 'hecho' },
    { id: 'r2', epocaId: 'e1', hitoId: 'h1', dia: '2026-09-23', inicio: h('08:00'), fin: h('08:50'), estado: 'saltado' },
  ];

  it('horas hechas por hito y por semana', () => {
    const e = epoca();
    const plan = planificarEpoca({ epoca: e, eventos: [], registro, hoy: HOY });
    expect(progresoHitos(e, registro, plan)[0]).toMatchObject({ hechoMin: 50, totalMin: 240 });
    const semana = progresoSemana(e, registro, plan, HOY);
    expect(semana.hechoMin).toBe(50);
    expect(semana.planeadoMin).toBe(240); // 50 hechos + 190 pendientes de esta semana
  });

  it('resumen al terminar', () => {
    expect(resumenEpoca(epoca(), registro, '2026-10-05')).toEqual({
      minutosHechos: 50,
      bloquesHechos: 1,
      hitosSuperados: 1,
      hitosTotal: 1,
    });
  });
});

describe('avisos de la época', () => {
  const perfil = {
    nombre: 'Ana',
    vivienda: { direccion: 'Chamberí', coordenadas: null },
    sitios: [],
  } as unknown as Perfil;

  it('salir, inicio de bloque, fin del descanso y hora de dormir', () => {
    const e = epoca();
    const plan = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY });
    const avisos = avisosDeEpoca({ epoca: e, plan }, perfil, HOY);
    const tipos = avisos.map((a) => a.tipo);
    expect(tipos.filter((t) => t === 'epoca-salir')).toHaveLength(1);
    expect(tipos.filter((t) => t === 'epoca-bloque')).toHaveLength(3); // 50 + 50 + 20 min
    expect(tipos.filter((t) => t === 'epoca-descanso')).toHaveLength(2);
    expect(tipos.filter((t) => t === 'epoca-dormir')).toHaveLength(1);
    const salir = avisos.find((a) => a.tipo === 'epoca-salir');
    expect(salir?.titulo).toBe('Hora de salir hacia Biblioteca');
    expect(salir?.cuando).toEqual(new Date(2026, 8, 24, 7, 40)); // 8:00 menos 20 min
  });

  it('se apagan uno a uno y no hay aviso de salir si estudia en casa', () => {
    const e = epoca({
      avisos: { salir: true, inicioBloque: false, finDescanso: false, dormir: false },
      ritmo: { ...epoca().ritmo, lugar: { tipo: 'casa' } },
    });
    const plan = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY });
    expect(avisosDeEpoca({ epoca: e, plan }, perfil, HOY)).toEqual([]);
  });

  it('fuera de la época no hay avisos', () => {
    const e = epoca();
    const plan = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY });
    expect(avisosDeEpoca({ epoca: e, plan }, perfil, '2026-10-10')).toEqual([]);
  });
});
