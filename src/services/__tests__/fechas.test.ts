import { describe, expect, it } from '@jest/globals';

import { cuandoFue } from '@/services/fechas';

describe('cuandoFue', () => {
  const ahora = new Date(2026, 8, 24, 6, 0);

  it('hoy y ayer con la hora', () => {
    expect(cuandoFue(new Date(2026, 8, 24, 5, 30), ahora)).toBe('hoy a las 05:30');
    expect(cuandoFue(new Date(2026, 8, 23, 11, 2), ahora)).toBe('ayer a las 11:02');
  });

  it('otros días con la fecha', () => {
    expect(cuandoFue(new Date(2026, 8, 21, 9, 0), ahora)).toBe('el lunes 21 sept a las 09:00');
  });
});
