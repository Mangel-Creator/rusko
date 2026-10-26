import { describe, expect, it } from '@jest/globals';

import type { Epoca, Hito, RegistroBloque, TemaHito } from '@/data/epocas/tipos';
import {
  aplicarPropuesta,
  datosRepaso,
  planificarEpoca,
  propuestaUtil,
  temaActual,
  temaEnMinuto,
  temasDelPlan,
  textoPropuesta,
  validarPreparacion,
  validarRepaso,
  validarTemas,
} from '@/services/epoca';

// Jueves 24 de septiembre de 2026.
const HOY = '2026-09-24';

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
      lugar: { tipo: 'casa' },
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

const temas: TemaHito[] = [
  { id: 't1', nombre: 'Tema 1', horas: 1 },
  { id: 't2', nombre: 'Tema 2', horas: 2 },
  { id: 't3', nombre: 'Repaso', horas: 1 },
];

describe('temas del hito', () => {
  it('cada minuto cae en su tema, y pasado el final se queda en el último', () => {
    expect(temaEnMinuto(temas, 0)?.nombre).toBe('Tema 1');
    expect(temaEnMinuto(temas, 59)?.nombre).toBe('Tema 1');
    expect(temaEnMinuto(temas, 60)?.nombre).toBe('Tema 2');
    expect(temaEnMinuto(temas, 200)?.nombre).toBe('Repaso');
    expect(temaEnMinuto(temas, 999)?.nombre).toBe('Repaso');
    expect(temaEnMinuto([], 10)).toBeNull();
  });

  it('los bloques del plan van pasando por los temas en orden, contando lo ya hecho', () => {
    const e = epoca({ hitos: [hito({ temas })] });
    // Ayer ya hizo 50 min: el primer bloque de hoy empieza casi al final del tema 1.
    const registro: RegistroBloque[] = [
      { id: 'e1:2026-09-23:480', epocaId: 'e1', hitoId: 'h1', dia: '2026-09-23', inicio: 480, fin: 530, estado: 'hecho' },
    ];
    const plan = planificarEpoca({ epoca: e, eventos: [], registro, hoy: HOY });
    const nombres = temasDelPlan(e, registro, plan, HOY);
    const orden = plan.bloques.map((b) => nombres.get(b.id));
    // 4 h de preparación - 50 min hechos = 190 min: 4 bloques de 50 y uno de 40.
    // El primero ya cae sobre todo en el tema 2 (su mitad está pasado el minuto 60).
    expect(orden).toEqual(['Tema 2', 'Tema 2', 'Tema 2', 'Repaso', 'Repaso']);
  });

  it('sin temas, los bloques no llevan tema', () => {
    const e = epoca();
    const plan = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY });
    expect(temasDelPlan(e, [], plan, HOY).size).toBe(0);
  });

  it('dice por qué tema vas', () => {
    const h = hito({ temas });
    expect(temaActual(h, 90)).toMatchObject({ numero: 2, total: 3, terminado: false });
    expect(temaActual(h, 240)).toMatchObject({ numero: 3, terminado: true });
    expect(temaActual(hito({}), 90)).toBeNull();
  });
});

describe('IA: "Cuéntamelo y lo preparo"', () => {
  const ctx = { hoy: HOY, sitiosIds: ['bib'] };
  const base = {
    nombre: '  Exámenes   de octubre ',
    tipo: 'examenes',
    inicio: null,
    fin: '2026-10-10',
    lugar: { tipo: 'sitio', sitioId: 'bib', direccion: null },
    diasVas: [0, 1, 2, 3, 4, 4, 9],
    horasDia: 5.3,
    rindeMas: 'manana',
    descanso: '50-10',
    diaLibre: 6,
    levantarse: '7:40',
    acostarse: '23:30',
    imprescindibles: [
      { nombre: 'Gimnasio', dias: [0, 2], horaInicio: '19:00', horaFin: '20:00' },
      { nombre: 'Mal', dias: [1], horaInicio: '20:00', horaFin: '19:00' },
    ],
    hitos: [
      { nombre: 'Álgebra', fecha: '2026-10-20', hora: '10:00', dificultad: 'dificil', horasPreparacion: 25.4 },
      { nombre: 'Estadística', fecha: '2026-10-05', hora: null, dificultad: 'rara', horasPreparacion: 500 },
      { nombre: 'Pasado', fecha: '2026-09-01', hora: '09:00', dificultad: 'facil', horasPreparacion: 3 },
      { nombre: 'Falsa', fecha: '2026-02-30', hora: '09:00', dificultad: 'facil', horasPreparacion: 3 },
    ],
    notas: 'He supuesto que estudias en la biblioteca.',
  };

  it('limpia y ajusta lo que devuelve', () => {
    const p = validarPreparacion(base, ctx);
    expect(p).not.toBeNull();
    expect(p?.nombre).toBe('Exámenes de octubre');
    expect(p?.lugar).toEqual({ tipo: 'sitio', sitioId: 'bib' });
    expect(p?.diasVas).toEqual([0, 1, 2, 3, 4]);
    expect(p?.horasDia).toBe(5.5);
    expect(p?.levantarse).toBe('07:45');
    expect(p?.imprescindibles).toHaveLength(1);
    // Solo los hitos con fecha real y futura, ordenados; horas dentro de lo razonable.
    expect(p?.hitos.map((h) => h.nombre)).toEqual(['Estadística', 'Álgebra']);
    expect(p?.hitos[0]).toMatchObject({ hora: '09:00', dificultad: 'media', horasPreparacion: 200 });
    // El fin se alarga para que quepa el último hito.
    expect(p?.fin).toBe('2026-10-20');
  });

  it('no se fía de sitios que no existen ni de fechas absurdas', () => {
    const p = validarPreparacion(
      { ...base, lugar: { tipo: 'sitio', sitioId: 'inventado' }, inicio: '2026-10-30', fin: '2026-10-01', hitos: [] },
      ctx,
    );
    expect(p?.lugar).toBeNull();
    expect(p?.fin).toBeNull(); // fin antes que el inicio: se descarta
  });

  it('"otro sitio" necesita la dirección', () => {
    expect(validarPreparacion({ ...base, lugar: { tipo: 'otro', direccion: 'Biblioteca central' } }, ctx)?.lugar).toEqual({
      tipo: 'otro',
      direccion: 'Biblioteca central',
    });
    expect(validarPreparacion({ ...base, lugar: { tipo: 'otro', direccion: '' } }, ctx)?.lugar).toBeNull();
  });

  it('sabe cuándo no ha entendido nada', () => {
    const vacia = validarPreparacion({ hitos: [], notas: 'No sé qué es esto' }, ctx);
    expect(vacia && propuestaUtil(vacia)).toBe(false);
    expect(validarPreparacion('hola', ctx)).toBeNull();
  });
});

describe('IA: temario por temas', () => {
  let n = 0;
  const id = () => `t${++n}`;

  it('se queda con los temas válidos y redondea las horas', () => {
    const r = validarTemas(
      {
        temas: [
          { nombre: 'Tema 1: Probabilidad', horas: 3.2 },
          { nombre: '', horas: 2 },
          { nombre: 'Tema 2', horas: -1 },
          { nombre: 'Repaso general', horas: 2 },
        ],
        consejo: 'Deja el repaso para los dos últimos días.',
      },
      id,
    );
    expect(r?.temas.map((t) => [t.nombre, t.horas])).toEqual([
      ['Tema 1: Probabilidad', 3],
      ['Tema 2', 0.5],
      ['Repaso general', 2],
    ]);
    expect(r?.consejo).toBe('Deja el repaso para los dos últimos días.');
  });

  it('sin temas no hay propuesta', () => {
    expect(validarTemas({ temas: [] }, id)).toBeNull();
    expect(validarTemas(null, id)).toBeNull();
  });
});

describe('IA: repaso de cómo vas', () => {
  const e = epoca({ hitos: [hito({}), hito({ id: 'h0', nombre: 'Pasado', fecha: '2026-09-22' })] });

  it('manda solo números y nombres de hitos que quedan', () => {
    const registro: RegistroBloque[] = [
      { id: 'a', epocaId: 'e1', hitoId: 'h1', dia: '2026-09-23', inicio: 480, fin: 530, estado: 'hecho' },
      { id: 'b', epocaId: 'e1', hitoId: 'h1', dia: '2026-09-22', inicio: 480, fin: 530, estado: 'saltado' },
    ];
    const plan = planificarEpoca({ epoca: e, eventos: [], registro, hoy: HOY });
    const datos = datosRepaso(e, registro, plan, HOY);
    expect(datos.hitos.map((h) => h.id)).toEqual(['h1']);
    expect(datos.ultimos7Dias).toEqual({ bloquesHechos: 1, bloquesSaltados: 1, horasHechas: 0.8 });
    expect(datos.hitos[0]).toMatchObject({ horasHechas: 0.8, bloquesSaltados: 1, diasHasta: 4 });
  });

  it('descarta propuestas que no cambian nada o de hitos que no existen', () => {
    const r = validarRepaso(
      {
        resumen: 'Vas bien, pero Estadística va justa.',
        propuestas: [
          { tipo: 'horas-hito', hitoId: 'h1', horas: 8, motivo: 'Te faltan horas' },
          { tipo: 'horas-hito', hitoId: 'nada', horas: 8, motivo: '' },
          { tipo: 'horas-hito', hitoId: 'h0', horas: 8, motivo: 'Ya pasó' },
          { tipo: 'horas-dia', horas: 2, motivo: 'Igual que ahora' },
          { tipo: 'dificultad', hitoId: 'h1', dificultad: 'dificil', motivo: 'Saltas muchos bloques' },
          { tipo: 'descanso', descanso: '25-5', motivo: 'Bloques más cortos' },
        ],
      },
      e,
      HOY,
    );
    expect(r?.propuestas.map((p) => p.tipo)).toEqual(['horas-hito', 'dificultad', 'descanso']);
    expect(validarRepaso({ resumen: '', propuestas: [] }, e, HOY)).toBeNull();
  });

  it('aplica una propuesta y la cuenta en español', () => {
    const r = validarRepaso(
      { resumen: 'Ok', propuestas: [{ tipo: 'horas-hito', hitoId: 'h1', horas: 8, motivo: '' }] },
      e,
      HOY,
    );
    const propuesta = r!.propuestas[0];
    expect(textoPropuesta(e, propuesta)).toBe('Estadística: de 4 h a 8 h de preparación');
    expect(aplicarPropuesta(e, propuesta).hitos[0].horasPreparacion).toBe(8);
    expect(e.hitos[0].horasPreparacion).toBe(4); // no toca la original
  });
});
