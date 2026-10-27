/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { leerCuando } from '../siriHora';

// Las 21:00 del 27/10/2026 en Madrid (+01:00) son las 20:00 UTC.
const AHORA = Date.UTC(2026, 9, 27, 20, 0);

describe('leerCuando (Alarma en Rusko)', () => {
  it('lee el formato del Atajo con la zona', () => {
    expect(leerCuando('2026-10-27 23:30 +01:00', AHORA)).toEqual({
      dia: '2026-10-27',
      hora: '23:30',
      cuando: '2026-10-27T22:30:00.000Z',
      manana: false,
    });
  });

  it('una hora ya pasada es la de mañana', () => {
    expect(leerCuando('2026-10-27 07:30 +01:00', AHORA)).toEqual({
      dia: '2026-10-28',
      hora: '07:30',
      cuando: '2026-10-28T06:30:00.000Z',
      manana: true,
    });
  });

  it('acepta ISO 8601 con segundos y Z', () => {
    expect(leerCuando('2026-10-28T07:30:00+01:00', AHORA)?.cuando).toBe('2026-10-28T06:30:00.000Z');
    expect(leerCuando('2026-10-28T06:30:00Z', AHORA)?.hora).toBe('06:30');
    expect(leerCuando('2026-10-28 07:30 +0100', AHORA)?.hora).toBe('07:30');
  });

  it('el cambio de mes también', () => {
    expect(leerCuando('2026-10-31 06:00 +01:00', Date.UTC(2026, 9, 31, 12))?.dia).toBe('2026-11-01');
  });

  it('sin zona, mal escrito o muy lejos: nada', () => {
    expect(leerCuando('2026-10-28 07:30', AHORA)).toBeNull();
    expect(leerCuando('mañana a las 7', AHORA)).toBeNull();
    expect(leerCuando('2026-10-28 25:00 +01:00', AHORA)).toBeNull();
    expect(leerCuando('2026-12-28 07:30 +01:00', AHORA)).toBeNull();
  });
});
