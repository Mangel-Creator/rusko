import { describe, expect, it } from '@jest/globals';

import type { Evento } from '@/data/eventos/tipos';

import { ETIQUETA_SIRI, procesarPendientes, type PendienteSiri } from '../procesar';

// Martes 27/10/2026 a las 21:00 (hora del dispositivo).
const AHORA = new Date(2026, 9, 27, 21, 0);

function apuntar(id: string, texto: string, creado = AHORA): PendienteSiri {
  return { id, tipo: 'apuntar', texto, dia: null, hora: null, cuando: null, creado: creado.toISOString() };
}

function alarma(id: string, dia: string, hora: string, cuando: Date): PendienteSiri {
  return { id, tipo: 'alarma', texto: null, dia, hora, cuando: cuando.toISOString(), creado: AHORA.toISOString() };
}

describe('procesarPendientes (Siri)', () => {
  it('apunta una frase con día y franja como la captura rápida', () => {
    const r = procesarPendientes([apuntar('a1', 'mañana pádel por la tarde')], {
      ahora: AHORA,
      perfil: null,
      eventos: [],
    });
    expect(r.ids).toEqual(['a1']);
    expect(r.eventos).toHaveLength(1);
    expect(r.eventos[0]).toMatchObject({
      id: 'siri-a1',
      fecha: '2026-10-28',
      horaInicio: '17:00',
      horaFin: '19:00',
      flexible: false,
    });
    expect(r.hechos[0]).toMatch(/mañana a las 17:00$/);
  });

  it('"mañana" cuenta desde que se dijo, no desde que se recoge', () => {
    const dicho = new Date(2026, 9, 26, 22, 0); // el lunes por la noche
    const r = procesarPendientes([apuntar('a2', 'mañana a las 10 dentista', dicho)], {
      ahora: AHORA,
      perfil: null,
      eventos: [],
    });
    expect(r.eventos[0]).toMatchObject({ fecha: '2026-10-27', horaInicio: '10:00' });
  });

  it('lo que no entiende va como tarea de ese día, sin perderse', () => {
    const r = procesarPendientes([apuntar('a3', 'llamar a la gestoría')], { ahora: AHORA, perfil: null, eventos: [] });
    expect(r.eventos[0]).toMatchObject({ fecha: '2026-10-27', flexible: true });
    expect(r.eventos[0].titulo).toContain('gestoría');
  });

  it('no duplica lo que ya se recogió', () => {
    const ya = { id: 'siri-a4' } as Evento;
    const r = procesarPendientes([apuntar('a4', 'mañana a las 10 dentista')], {
      ahora: AHORA,
      perfil: null,
      eventos: [ya],
    });
    expect(r.eventos).toHaveLength(0);
    expect(r.ids).toEqual(['a4']);
  });

  it('una alarma futura se añade de una sola vez; una pasada, no', () => {
    const r = procesarPendientes(
      [
        alarma('b1', '2026-10-28', '07:30', new Date(2026, 9, 28, 7, 30)),
        alarma('b2', '2026-10-27', '08:00', new Date(2026, 9, 27, 8, 0)),
      ],
      { ahora: AHORA, perfil: null, eventos: [] },
    );
    expect(r.ids).toEqual(['b1', 'b2']);
    expect(r.alarmas).toEqual([
      expect.objectContaining({
        id: 'b1',
        hora: '07:30',
        dias: [],
        unaVezEl: '2026-10-28',
        etiqueta: ETIQUETA_SIRI,
        activada: true,
      }),
    ]);
    expect(r.hechos).toEqual(['Alarma mañana a las 07:30']);
  });
});
