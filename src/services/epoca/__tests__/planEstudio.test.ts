import { describe, expect, it } from '@jest/globals';

import type { BloqueGuardado, Epoca, Hito, RegistroBloque } from '@/data/epocas/tipos';
import type { Evento } from '@/data/eventos/tipos';
import {
  bloquesParaGuardar,
  esDorada,
  idBloque,
  inicioRecomendado,
  nombreModo,
  planDeHoy,
  planificarEpoca,
  sinMarcar,
} from '@/services/epoca';

// Plan de estudio sin Época dorada, cuándo empezar, replanificar hoy y lo que se
// quedó sin marcar (26/10/2026).

// Jueves 24 de septiembre de 2026.
const HOY = '2026-09-24';
const h = (hora: string) => {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
};

function hito(parcial: Partial<Hito> = {}): Hito {
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
      diasVas: [],
      horasDia: 2,
      rindeMas: 'manana',
      descanso: '50-10',
      diaLibre: null,
      trayectoMin: 0,
      imprescindibles: [],
    },
    hitos: [hito()],
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

const deHoy = (bloques: { dia: string; inicio: number; fin: number }[]) =>
  bloques.filter((b) => b.dia === HOY).map((b) => [b.inicio, b.fin]);

describe('plan de estudio o Época dorada', () => {
  it('las épocas guardadas antes no tienen el campo y son doradas', () => {
    expect(esDorada({ dorada: undefined as unknown as boolean })).toBe(true);
    expect(nombreModo(epoca())).toBe('Época dorada');
    expect(nombreModo(epoca({ dorada: false }))).toBe('Plan de estudio');
  });
});

describe('replanificar hoy', () => {
  const e = epoca();
  // Lo que el plan tenía previsto esta mañana: 08:00, 09:00 y 10:00 (2 h en total).
  const completo = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY });
  const guardadoHoy = bloquesParaGuardar(completo, HOY);

  it('guarda solo los bloques pendientes de hoy', () => {
    expect(guardadoHoy.map((b) => [b.inicio, b.fin])).toEqual([
      [h('08:00'), h('08:50')],
      [h('09:00'), h('09:50')],
      [h('10:00'), h('10:20')],
    ]);
    const otro = planificarEpoca({
      epoca: e,
      eventos: [],
      registro: [{ ...completo.bloques[0], estado: 'hecho' } as RegistroBloque],
      hoy: HOY,
    });
    const guardado = bloquesParaGuardar(otro, HOY);
    expect(guardado).toHaveLength(2);
    expect(guardado.map((b) => b.id)).not.toContain(completo.bloques[0].id);
  });

  it('sin nada nuevo, los bloques no cambian de hora al pasar el día', () => {
    for (const ahora of [h('08:30'), h('09:55'), h('15:00')]) {
      const plan = planificarEpoca({ epoca: e, eventos: [], registro: [], hoy: HOY, ahora, guardadoHoy });
      expect(deHoy(plan.bloques)).toEqual(deHoy(completo.bloques));
    }
  });

  it('si se apunta algo encima de un bloque, solo ese se mueve y a partir de ahora', () => {
    const plan = planificarEpoca({
      epoca: e,
      eventos: [evento({ horaInicio: '10:00', horaFin: '11:00' })],
      registro: [],
      hoy: HOY,
      ahora: h('09:30'),
      guardadoHoy,
    });
    expect(deHoy(plan.bloques)).toEqual([
      [h('08:00'), h('08:50')],
      [h('09:00'), h('09:50')],
      [h('11:00'), h('11:20')],
    ]);
    expect(plan.faltanMin).toEqual({});
  });

  it('lo movido nunca va a una hora que ya pasó', () => {
    const plan = planificarEpoca({
      epoca: e,
      eventos: [evento({ horaInicio: '09:00', horaFin: '10:00' })],
      registro: [],
      hoy: HOY,
      ahora: h('12:02'),
      guardadoHoy,
    });
    const hoy = deHoy(plan.bloques);
    // Se quedan el de las 08:00 y el de las 10:00; los 50 min pisados van desde las 12:05.
    expect(hoy).toEqual([
      [h('08:00'), h('08:50')],
      [h('10:00'), h('10:20')],
      [h('12:05'), h('12:55')],
    ]);
  });

  it('un bloque saltado hoy deja su hueco libre y pasa a otros días', () => {
    const saltado: RegistroBloque = {
      id: idBloque(e.id, HOY, h('09:00')),
      epocaId: e.id,
      hitoId: 'h1',
      dia: HOY,
      inicio: h('09:00'),
      fin: h('09:50'),
      estado: 'saltado',
      motivo: 'Me surgió un plan',
    };
    const plan = planificarEpoca({ epoca: e, eventos: [], registro: [saltado], hoy: HOY, ahora: h('09:10'), guardadoHoy });
    const pendientes = plan.bloques.filter((b) => b.dia === HOY && b.estado === 'pendiente');
    expect(pendientes.map((b) => [b.inicio, b.fin])).toEqual([
      [h('08:00'), h('08:50')],
      [h('10:00'), h('10:20')],
    ]);
    expect(plan.faltanMin).toEqual({});
  });

  it('planDeHoy planifica el día entero la primera vez y luego usa lo guardado', () => {
    const datos = { epoca: e, eventos: [evento({})], registro: [], hoy: HOY, ahora: h('09:30') };
    const primera = planDeHoy({ ...datos, planesDelDia: {} });
    expect(deHoy(primera.bloques)[0]).toEqual([h('08:00'), h('08:50')]);
    const despues = planDeHoy({ ...datos, planesDelDia: { [`e1:${HOY}`]: guardadoHoy } });
    expect(deHoy(despues.bloques)).toEqual([
      [h('08:00'), h('08:50')],
      [h('09:00'), h('09:50')],
      [h('11:00'), h('11:20')],
    ]);
  });
});

describe('cuándo empezar', () => {
  it('recomienda el último día que deja todo con margen', () => {
    // 4 h con un 20 % de margen son 4,8 h: a 2 h al día, 3 días antes del examen del 3 de octubre.
    const e = epoca({ inicio: HOY, hitos: [hito({ fecha: '2026-10-03' })] });
    expect(inicioRecomendado({ epoca: e, eventos: [], registro: [], hoy: HOY })).toEqual({
      dia: '2026-09-30',
      llega: true,
    });
  });

  it('si ni empezando hoy cabe, dice que vas justo', () => {
    const e = epoca({ inicio: HOY, hitos: [hito({ fecha: '2026-09-26', horasPreparacion: 10 })] });
    expect(inicioRecomendado({ epoca: e, eventos: [], registro: [], hoy: HOY })).toEqual({ dia: HOY, llega: false });
  });

  it('cuenta lo que ya tienes en el calendario', () => {
    // Un día lleno de eventos obliga a empezar un día antes.
    const e = epoca({ inicio: HOY, hitos: [hito({ fecha: '2026-10-03' })] });
    const lleno = evento({ fecha: '2026-10-01', horaInicio: '08:00', horaFin: '23:00' });
    expect(inicioRecomendado({ epoca: e, eventos: [lleno], registro: [], hoy: HOY })?.dia).toBe('2026-09-29');
  });

  it('sin hitos por delante no recomienda nada', () => {
    expect(inicioRecomendado({ epoca: epoca({ hitos: [] }), eventos: [], registro: [], hoy: HOY })).toBeNull();
  });
});

describe('lo que se quedó sin marcar', () => {
  const bloque = (dia: string, inicio: string, hitoId = 'h1'): BloqueGuardado => ({
    id: idBloque('e1', dia, h(inicio)),
    hitoId,
    inicio: h(inicio),
    fin: h(inicio) + 50,
    descansoFin: h(inicio) + 60,
  });

  it('enseña los días pasados con bloques sin marcar, del más reciente al más antiguo', () => {
    const planes = {
      'e1:2026-09-23': [bloque('2026-09-23', '08:00'), bloque('2026-09-23', '09:00')],
      'e1:2026-09-22': [bloque('2026-09-22', '08:00')],
      'e1:2026-09-24': [bloque(HOY, '08:00')], // hoy aún no se pregunta
      'e1:2026-09-20': [bloque('2026-09-20', '08:00')], // antes de empezar
      'otra:2026-09-23': [bloque('2026-09-23', '10:00')],
    };
    const hecho: RegistroBloque = {
      ...bloque('2026-09-23', '08:00'),
      epocaId: 'e1',
      dia: '2026-09-23',
      estado: 'hecho',
    };
    const dias = sinMarcar(epoca(), planes, [hecho], HOY);
    expect(dias.map((d) => [d.dia, d.bloques.map((b) => b.inicio)])).toEqual([
      ['2026-09-23', [h('09:00')]],
      ['2026-09-22', [h('08:00')]],
    ]);
  });

  it('no pregunta por hitos que ya no existen ni por más de una semana atrás', () => {
    const planes = {
      'e1:2026-09-23': [bloque('2026-09-23', '08:00', 'borrado')],
      'e1:2026-09-16': [bloque('2026-09-16', '08:00')],
    };
    expect(sinMarcar(epoca({ inicio: '2026-09-01' }), planes, [], HOY)).toEqual([]);
  });
});
