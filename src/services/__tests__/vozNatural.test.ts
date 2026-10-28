import { describe, expect, it } from '@jest/globals';

import { elegirVoz, trocearEnFrases, type VozDisponible } from '@/services/vozNatural';

const voz = (name: string, lang = 'es-ES', voiceURI = name): VozDisponible => ({ name, lang, voiceURI, localService: true });

describe('elegirVoz', () => {
  it('en el iPhone prefiere la voz mejorada a la normal y nunca una de juguete', () => {
    const iphone = [
      voz('Rocko (Español (España))'),
      voz('Abuela (Español (España))'),
      voz('Mónica', 'es-ES', 'com.apple.voice.compact.es-ES.Monica'),
      voz('Mónica (mejorada)', 'es-ES', 'com.apple.voice.enhanced.es-ES.Monica'),
      voz('Samantha', 'en-US'),
    ];
    expect(elegirVoz(iphone)?.name).toBe('Mónica (mejorada)');
    expect(elegirVoz(iphone.filter((v) => !/mejorada/.test(v.name)))?.name).toBe('Mónica');
  });

  it('en Edge elige la voz neuronal y en Chrome la de Google', () => {
    const edge = [
      voz('Microsoft Helena - Spanish (Spain)'),
      voz('Microsoft Elvira Online (Natural) - Spanish (Spain)'),
      voz('Microsoft Dalia Online (Natural) - Spanish (Mexico)', 'es-MX'),
    ];
    expect(elegirVoz(edge)?.name).toBe('Microsoft Elvira Online (Natural) - Spanish (Spain)');
    expect(elegirVoz([voz('Microsoft Helena - Spanish (Spain)'), voz('Google español')])?.name).toBe('Google español');
  });

  it('sin voces en español, ninguna', () => {
    expect(elegirVoz([voz('Samantha', 'en-US')])).toBeNull();
    expect(elegirVoz([])).toBeNull();
    expect(elegirVoz([voz('Paulina', 'es_MX')])?.name).toBe('Paulina');
  });
});

describe('trocearEnFrases', () => {
  it('separa por puntos y no pierde nada', () => {
    expect(trocearEnFrases('Hoy solo te queda Cena, a las nueve. La tarde la tienes libre.')).toEqual([
      'Hoy solo te queda Cena, a las nueve.',
      'La tarde la tienes libre.',
    ]);
    expect(trocearEnFrases('Sin punto final')).toEqual(['Sin punto final']);
    expect(trocearEnFrases('')).toEqual([]);
  });
});
