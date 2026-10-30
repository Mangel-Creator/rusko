import { describe, expect, it } from '@jest/globals';

import * as filtro from '../filtroCorreo.js';

describe('filtro con IA del correo', () => {
  it('limpia la lista que manda la app', () => {
    expect(filtro.leerFiltro('x')).toBeNull();
    expect(filtro.leerFiltro(['  Lo de  la carrera ', 'Lo de la carrera', '', 3, 'x'.repeat(201)])).toEqual([
      'Lo de la carrera',
    ]);
    expect(filtro.leerFiltro(Array.from({ length: 15 }, (_, i) => `r${i}`))).toHaveLength(filtro.MAX_FILTRO);
  });

  it('lee las decisiones y descarta lo raro', () => {
    const datos = {
      decisiones: [
        { n: 0, decision: 'pasa' },
        { n: 1, decision: 'fuera' },
        { n: 2, decision: 'igual' },
        { n: 7, decision: 'pasa' },
        { n: '3', decision: 'pasa' },
        { n: 3, decision: 'quizá' },
      ],
    };
    expect(filtro.leerDecisiones(datos, 4)).toEqual({ 0: 'pasa', 1: 'fuera' });
    expect(filtro.leerDecisiones(null, 4)).toEqual({});
  });

  it('pasa, fuera o se queda como estaba', () => {
    expect(filtro.entraConFiltro(false, 'pasa')).toBe(true);
    expect(filtro.entraConFiltro(true, 'fuera')).toBe(false);
    expect(filtro.entraConFiltro(true, undefined)).toBe(true);
    expect(filtro.entraConFiltro(false, undefined)).toBe(false);
  });
});
