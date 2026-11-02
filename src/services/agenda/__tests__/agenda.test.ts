import { describe, expect, it } from '@jest/globals';

import { normalizarLugar, type Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import {
  FRASE_DIA_LIBRE,
  bloqueDeFocoQuePisa,
  colocarEnCarriles,
  calcularHuecos,
  cargaDelDia,
  eventosDelDia,
  fraseResumen,
  ocurreEnDia,
  repartirTareas,
  resolverLugar,
  siguienteEvento,
  sitioTrabajo,
  tareasPendientes,
  unirIntervalos,
} from '@/services/agenda';
import { formatearDiaCorto, numeroSemana } from '@/services/fechas';

const h = (hora: string) => {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
};
const tramo = (a: string, b: string) => ({ inicio: h(a), fin: h(b) });

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: Math.random().toString(36).slice(2),
    titulo: 'Evento',
    fecha: '2026-09-24',
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

function tarea(titulo: string, duracionMin: number, fecha = '2026-09-24'): Evento {
  return evento({ titulo, flexible: true, horaInicio: null, horaFin: null, duracionMin, fecha });
}

describe('fechas', () => {
  it('formatea el día corto en español', () => {
    expect(formatearDiaCorto(new Date(2026, 8, 24))).toBe('Jueves 24 sept');
  });
  it('calcula el número de semana europeo', () => {
    expect(numeroSemana(new Date(2026, 8, 24))).toBe(39);
    expect(numeroSemana(new Date(2027, 0, 1))).toBe(53); // viernes: aún es la última de 2026
    expect(numeroSemana(new Date(2027, 0, 4))).toBe(1);
  });
});

describe('huecos libres', () => {
  it('junta tramos que se solapan', () => {
    expect(unirIntervalos([tramo('09:00', '10:00'), tramo('09:30', '11:00'), tramo('12:00', '13:00')])).toEqual([
      tramo('09:00', '11:00'),
      tramo('12:00', '13:00'),
    ]);
  });

  it('encuentra los huecos de 1 hora o más dentro del horario', () => {
    const ocupados = [tramo('09:00', '10:00'), tramo('10:30', '17:00'), tramo('19:00', '20:00')];
    expect(calcularHuecos(ocupados, tramo('08:00', '23:00'))).toEqual([
      tramo('08:00', '09:00'),
      tramo('17:00', '19:00'),
      tramo('20:00', '23:00'),
    ]); // el de 10:00 a 10:30 es demasiado corto
  });

  it('ignora lo que cae fuera del horario', () => {
    expect(calcularHuecos([tramo('06:00', '09:00')], tramo('08:00', '12:00'))).toEqual([tramo('09:00', '12:00')]);
  });

  it('un día sin nada es un único hueco', () => {
    expect(calcularHuecos([], tramo('08:00', '22:00'))).toEqual([tramo('08:00', '22:00')]);
  });
});

describe('carga del día', () => {
  it('divide las horas ocupadas entre la jornada', () => {
    const carga = cargaDelDia([tramo('09:00', '11:00'), tramo('10:00', '12:00')], 0, 8 * 60);
    expect(carga.ocupadoMin).toBe(180);
    expect(carga.proporcion).toBeCloseTo(0.375);
    expect(carga.alta).toBe(false);
  });

  it('marca como alta la carga de más del 80 %', () => {
    expect(cargaDelDia([tramo('09:00', '15:00')], 60, 8 * 60).alta).toBe(true); // 7 h de 8
    expect(cargaDelDia([tramo('09:00', '15:24')], 0, 8 * 60).alta).toBe(false); // justo el 80 %
  });

  it('sin jornada no divide por cero', () => {
    expect(cargaDelDia([tramo('09:00', '10:00')], 0, 0).proporcion).toBe(0);
  });
});

describe('repeticiones', () => {
  it('semanal: mismo día de la semana a partir de la primera fecha', () => {
    const e = evento({ fecha: '2026-09-24', repeticion: 'semanal' }); // jueves
    expect(ocurreEnDia(e, '2026-10-01')).toBe(true);
    expect(ocurreEnDia(e, '2026-10-02')).toBe(false);
    expect(ocurreEnDia(e, '2026-09-17')).toBe(false);
  });

  it('semanal con días elegidos y fin: solo esos días y hasta el último', () => {
    const e = evento({ fecha: '2026-09-24', repeticion: 'semanal', dias: [0, 3], hasta: '2026-10-05' });
    expect(ocurreEnDia(e, '2026-09-28')).toBe(true); // lunes
    expect(ocurreEnDia(e, '2026-09-29')).toBe(false); // martes
    expect(ocurreEnDia(e, '2026-10-05')).toBe(true); // lunes, último día
    expect(ocurreEnDia(e, '2026-10-08')).toBe(false); // jueves, ya pasado el fin
    expect(ocurreEnDia(e, '2026-09-21')).toBe(false); // antes de empezar
  });

  it('mensual: mismo número de día; se salta los meses sin ese día', () => {
    const e = evento({ fecha: '2026-08-31', repeticion: 'mensual' });
    expect(ocurreEnDia(e, '2026-10-31')).toBe(true);
    expect(ocurreEnDia(e, '2026-09-30')).toBe(false);
  });

  it('las tareas flexibles no entran en la lista de eventos con hora', () => {
    const lista = eventosDelDia(
      [evento({ titulo: 'B', horaInicio: '12:00' }), evento({ titulo: 'A', horaInicio: '08:00' }), tarea('T', 30)],
      '2026-09-24',
    );
    expect(lista.map((e) => e.titulo)).toEqual(['A', 'B']);
  });

  it('hoy incluye las tareas pendientes de días anteriores', () => {
    const vieja = tarea('Vieja', 30, '2026-09-20');
    const hecha = { ...tarea('Hecha', 30), hecha: true };
    const manana = tarea('Mañana', 30, '2026-09-25');
    const lista = tareasPendientes([manana, tarea('Hoy', 30), hecha, vieja], '2026-09-24', '2026-09-24');
    expect(lista.map((t) => t.titulo)).toEqual(['Vieja', 'Hoy']);
  });
});

describe('frase resumen', () => {
  it('día libre', () => {
    expect(fraseResumen({ eventos: [], tareasPendientes: 0, huecos: [tramo('08:00', '22:00')] })).toBe(
      FRASE_DIA_LIBRE,
    );
  });

  it('cuenta clientes, planes y el hueco libre', () => {
    const eventos = [evento({ tipo: 'cliente' }), evento({ tipo: 'cliente' }), evento({ tipo: 'amigos' })];
    expect(fraseResumen({ eventos, tareasPendientes: 0, huecos: [tramo('17:00', '19:00')] })).toBe(
      'Tienes 2 clientes y un plan con amigos. Hueco libre: de 17:00 a 19:00.',
    );
  });

  it('con varios huecos dice el mayor', () => {
    const frase = fraseResumen({
      eventos: [evento({ tipo: 'yo', foco: true })],
      tareasPendientes: 2,
      huecos: [tramo('08:00', '09:00'), tramo('17:00', '20:00')],
    });
    expect(frase).toBe('Tienes un bloque de foco y 2 tareas. Tu mejor hueco: de 17:00 a 20:00.');
  });

  it('sin huecos lo dice', () => {
    expect(fraseResumen({ eventos: [evento({ tipo: 'amigos' })], tareasPendientes: 0, huecos: [] })).toBe(
      'Tienes un plan con amigos. No te queda ningún hueco libre.',
    );
  });
});

describe('reparto de tareas flexibles', () => {
  const huecos = [tramo('09:00', '10:00'), tramo('16:00', '19:00')];
  const tareas = [tarea('A', 30), tarea('B', 30), tarea('C', 30), tarea('D', 60)];
  const dur = (t: Evento) => t.duracionMin ?? 30;

  it('a tope: las pone en el momento en que rinde más', () => {
    const r = repartirTareas(tareas, dur, huecos, 'a-tope', 'tarde');
    expect(r.colocadas.every((c) => c.inicio >= h('16:00'))).toBe(true);
    expect(r.colocadas.map((c) => c.tarea.titulo)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('a tope de mañana: empieza por el hueco de la mañana', () => {
    const r = repartirTareas(tareas, dur, huecos, 'a-tope', 'manana');
    expect(r.colocadas[0]).toMatchObject({ inicio: h('09:00'), fin: h('09:30') });
    expect(r.colocadas[1]).toMatchObject({ inicio: h('09:30'), fin: h('10:00') });
  });

  it('normal: las reparte entre los huecos', () => {
    const r = repartirTareas(tareas, dur, huecos, 'normal', 'tarde');
    // Por turnos: A y C en el hueco de la mañana, B y D en el de la tarde.
    expect(r.colocadas.map((c) => [c.tarea.titulo, c.inicio])).toEqual([
      ['A', h('09:00')],
      ['C', h('09:30')],
      ['B', h('16:00')],
      ['D', h('16:30')],
    ]);
  });

  it('tranqui: solo 2 para hoy y el resto a mañana', () => {
    const r = repartirTareas(tareas, dur, huecos, 'tranqui', 'tarde');
    expect(r.colocadas).toHaveLength(2);
    expect(r.paraManana.map((t) => t.titulo)).toEqual(['C', 'D']);
  });

  it('nunca pisa eventos: lo que no cabe se queda sin hueco', () => {
    const r = repartirTareas([tarea('Larga', 120)], dur, [tramo('09:00', '10:00')], 'normal', 'manana');
    expect(r.colocadas).toHaveLength(0);
    expect(r.sinHueco).toHaveLength(1);
  });

  it('las tareas colocadas quedan dentro de los huecos y no se pisan entre sí', () => {
    for (const energia of ['a-tope', 'normal', 'tranqui'] as const) {
      const { colocadas } = repartirTareas(tareas, dur, huecos, energia, 'noche');
      for (const c of colocadas) {
        expect(huecos.some((hu) => c.inicio >= hu.inicio && c.fin <= hu.fin)).toBe(true);
      }
      const ordenadas = [...colocadas].sort((a, b) => a.inicio - b.inicio);
      for (let i = 1; i < ordenadas.length; i++) {
        expect(ordenadas[i].inicio).toBeGreaterThanOrEqual(ordenadas[i - 1].fin);
      }
    }
  });
});

describe('siguiente evento y bloques de foco', () => {
  const eventos = [
    evento({ titulo: 'Mañana', fecha: '2026-09-25', horaInicio: '09:00', horaFin: '10:00' }),
    evento({ titulo: 'Ahora', horaInicio: '10:00', horaFin: '11:00' }),
    evento({ titulo: 'Luego', horaInicio: '12:00', horaFin: '13:00' }),
  ];

  it('devuelve el que está en curso', () => {
    const s = siguienteEvento(eventos, new Date(2026, 8, 24, 10, 30));
    expect(s).toMatchObject({ enCurso: true, dia: '2026-09-24' });
    expect(s?.evento.titulo).toBe('Ahora');
  });

  it('si ya no queda nada hoy, busca en los días siguientes', () => {
    const s = siguienteEvento(eventos, new Date(2026, 8, 24, 15, 0));
    expect(s?.evento.titulo).toBe('Mañana');
    expect(s?.dia).toBe('2026-09-25');
  });

  it('avisa si un evento pisa un bloque de foco', () => {
    const foco = evento({ titulo: 'Foco', foco: true, horaInicio: '09:00', horaFin: '11:00' });
    expect(bloqueDeFocoQuePisa(evento({ horaInicio: '10:30', horaFin: '12:00' }), [foco])).toBe(foco);
    expect(bloqueDeFocoQuePisa(evento({ horaInicio: '11:00', horaFin: '12:00' }), [foco])).toBeNull();
    // Editar el propio bloque de foco no avisa
    expect(bloqueDeFocoQuePisa(foco, [foco])).toBeNull();
  });
});

describe('lugar de los eventos', () => {
  const perfil: Perfil = {
    nombre: 'Ana',
    vivienda: { direccion: 'Chamberí, Madrid', coordenadas: { latitud: 40.43, longitud: -3.7 } },
    sitios: [{ id: 't1', nombre: ' trabajo ', direccion: 'Calle Alcalá 50, Madrid', coordenadas: null }],
    transporte: 'coche',
    uso: 'ambos',
    horario: {
      levantarse: '07:00',
      acostarse: '23:00',
      empiezoTrabajo: '09:00',
      terminoTrabajo: '18:00',
      diasTrabajo: [0, 1, 2, 3, 4],
    },
    rindeMas: 'manana',
    antelacionAvisoMin: 30,
  };

  it('Casa y los sitios se leen del perfil de ahora (si te mudas, cambian solos)', () => {
    expect(resolverLugar({ tipo: 'casa' }, perfil)).toEqual({ nombre: 'Casa', ...perfil.vivienda });
    const mudado = { ...perfil, vivienda: { direccion: 'Getafe', coordenadas: null } };
    expect(resolverLugar({ tipo: 'casa' }, mudado)?.direccion).toBe('Getafe');
    expect(resolverLugar({ tipo: 'sitio', sitioId: 't1' }, perfil)?.direccion).toBe('Calle Alcalá 50, Madrid');
  });

  it('otro sitio guarda su dirección tal cual; un sitio borrado se queda sin lugar', () => {
    const otro = { tipo: 'otro' as const, direccion: 'Calle Mayor 1', coordenadas: null };
    expect(resolverLugar(otro, null)).toEqual({ nombre: null, direccion: 'Calle Mayor 1', coordenadas: null });
    expect(resolverLugar({ tipo: 'sitio', sitioId: 'no-existe' }, perfil)).toBeNull();
  });

  it('encuentra el sitio Trabajo aunque tenga espacios o minúsculas', () => {
    expect(sitioTrabajo(perfil)?.id).toBe('t1');
    expect(sitioTrabajo({ ...perfil, sitios: [] })).toBeNull();
  });

  it('los lugares guardados con el formato antiguo pasan a "otro sitio"', () => {
    expect(normalizarLugar({ nombre: null, direccion: 'Calle Mayor 1', coordenadas: null })).toEqual({
      tipo: 'otro',
      direccion: 'Calle Mayor 1',
      coordenadas: null,
    });
    expect(normalizarLugar({ tipo: 'casa' })).toEqual({ tipo: 'casa' });
    expect(normalizarLugar(null)).toBeNull();
  });
});

describe('carriles de la línea de horas', () => {
  it('pone en columnas distintas los eventos que se solapan', () => {
    const tramos = [tramo('09:00', '10:00'), tramo('09:30', '11:00'), tramo('10:00', '10:30'), tramo('12:00', '13:00')];
    const colocados = colocarEnCarriles(tramos, (t) => t);
    expect(colocados.map((c) => [c.carril, c.carriles])).toEqual([
      [0, 2],
      [1, 2],
      [0, 2], // aprovecha la columna que dejó libre el de las 9:00
      [0, 1], // este no se solapa con nadie: ancho completo
    ]);
  });
});
