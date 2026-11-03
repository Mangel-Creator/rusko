import { describe, expect, it, jest } from '@jest/globals';

import { baldosaDe, combinarColores } from '@/data/coloresTipo';
import { colorBaldosa, colorTipo } from '@/theme';

// Aquí solo se prueban las cuentas: sin guardado de verdad.
jest.mock('@/data/ajustes', () => ({}));

describe('colores de cada tipo', () => {
  it('el fondo del icono es el color al 14 % sobre la tarjeta, como en el tema', () => {
    expect(baldosaDe('#9C8BFF')).toEqual(colorBaldosa.cliente);
  });

  it('cambia solo los tipos elegidos y descarta colores no válidos', () => {
    const { colorTipo: tipos, colorBaldosa: baldosas } = combinarColores({ estudios: '#5B9BFF', yo: 'rojo' });
    expect(tipos.estudios).toBe('#5B9BFF');
    expect(baldosas.estudios.icono).toBe('#5B9BFF');
    expect(tipos.yo).toBe(colorTipo.yo);
    expect(baldosas.yo).toEqual(colorBaldosa.yo);
    expect(baldosas.estudio).toEqual(colorBaldosa.estudio);
  });
});
