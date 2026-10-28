import { describe, expect, it } from '@jest/globals';

import {
  agotado,
  cuandoSeLibera,
  dolares,
  leerEstadoIA,
  leerLimiteAlcanzado,
  lineaLimite,
  mensajeLimite,
  miles,
  porcentaje,
  porcentajeClave,
  quedaDeLaClave,
  textoCantidad,
  textoExtra,
  textoTokens,
  tokensQuedan,
} from '@/services/ia/limites';

// Martes 29 de septiembre de 2026, 13:00 (hora del dispositivo).
const ahora = new Date(2026, 8, 29, 13, 0);

describe('porcentaje', () => {
  it('redondea hacia arriba y no pasa de 100', () => {
    expect(porcentaje({ usado: 0, limite: 150000, libre: null })).toBe(0);
    expect(porcentaje({ usado: 1, limite: 150000, libre: null })).toBe(1);
    expect(porcentaje({ usado: 60000, limite: 150000, libre: null })).toBe(40);
    expect(porcentaje({ usado: 200000, limite: 150000, libre: null })).toBe(100);
  });

  it('agotado al llegar justo al límite', () => {
    expect(agotado({ usado: 149999, limite: 150000, libre: null })).toBe(false);
    expect(agotado({ usado: 150000, limite: 150000, libre: null })).toBe(true);
  });
});

describe('cuandoSeLibera', () => {
  it('hoy, mañana, esta semana y más lejos', () => {
    expect(cuandoSeLibera(new Date(2026, 8, 29, 18, 40), ahora)).toBe('a las 18:40');
    expect(cuandoSeLibera(new Date(2026, 8, 30, 9, 10), ahora)).toBe('mañana a las 09:10');
    expect(cuandoSeLibera(new Date(2026, 9, 5, 10, 0), ahora)).toBe('el lunes a las 10:00');
    expect(cuandoSeLibera(new Date(2026, 9, 12, 10, 0), ahora)).toBe('el 12/10 a las 10:00');
  });
});

describe('lineaLimite', () => {
  it('dice cuándo se libera si la ventana está en marcha', () => {
    const libre = new Date(2026, 8, 29, 17, 30).toISOString();
    expect(lineaLimite({ usado: 10, limite: 100, libre }, 'ventana', 5, ahora)).toBe('Se libera a las 17:30.');
  });

  it('explica que aún no ha empezado', () => {
    expect(lineaLimite({ usado: 0, limite: 100, libre: null }, 'ventana', 5, ahora)).toBe(
      'Empieza a contar la próxima vez que uses la IA y dura 5 horas.',
    );
    expect(lineaLimite({ usado: 0, limite: 100, libre: null }, 'semana', 5, ahora)).toContain('7 días');
  });
});

describe('mensajeLimite', () => {
  it('de las 5 horas y de la semana', () => {
    const libre = new Date(2026, 8, 29, 18, 40).toISOString();
    expect(mensajeLimite({ motivo: 'ventana', libre, horas: 5 }, ahora)).toBe(
      'Has gastado la IA de estas 5 horas. Vuelve a tenerla a las 18:40.',
    );
    const lunes = new Date(2026, 9, 5, 10, 0).toISOString();
    expect(mensajeLimite({ motivo: 'semana', libre: lunes, horas: 5 }, ahora)).toBe(
      'Has gastado la IA de esta semana. Vuelve a tenerla el lunes a las 10:00.',
    );
  });

  it('sin hora conocida', () => {
    expect(mensajeLimite({ motivo: 'ventana', libre: null, horas: 5 }, ahora)).toBe(
      'Has gastado la IA de estas 5 horas. Vuelve en un rato.',
    );
  });
});

describe('textoExtra', () => {
  it('pasa el saldo a días o semanas de uso', () => {
    expect(textoExtra(0, 500000)).toBeNull();
    expect(textoExtra(50000, 500000)).toBe('Te queda un poco de IA extra.');
    expect(textoExtra(250000, 500000)).toBe('Te queda IA extra para 4 días más o menos.');
    expect(textoExtra(500000, 500000)).toBe('Te queda IA extra para una semana más o menos.');
    expect(textoExtra(1000000, 500000)).toBe('Te queda IA extra para unas 2 semanas.');
  });
});

describe('leer respuestas del servidor', () => {
  it('el 429 de límite de IA', () => {
    expect(leerLimiteAlcanzado({ error: 'limite-ia', motivo: 'semana', libre: 'x', horas: 5 })).toEqual({
      motivo: 'semana',
      libre: 'x',
      horas: 5,
    });
    expect(leerLimiteAlcanzado({ error: 'limite-usuario' })).toBeNull();
    expect(leerLimiteAlcanzado(null)).toBeNull();
  });

  it('el estado', () => {
    const estado = leerEstadoIA({
      horas: 5,
      ventana: { usado: 10, limite: 150000, libre: null },
      semana: { usado: 10, limite: 500000, libre: '2026-10-05T08:00:00Z' },
      extra: 0,
      compra: false,
    });
    expect(estado?.semana.libre).toBe('2026-10-05T08:00:00Z');
    expect(estado?.compra).toBe(false);
    expect(estado?.sinLimite).toBe(false);
    expect(estado?.clave).toBeNull();
    expect(leerEstadoIA({ horas: 5, ventana: {} })).toBeNull();
  });

  it('el dueño: sin límite y con el saldo de la clave', () => {
    const estado = leerEstadoIA({
      horas: 5,
      ventana: { usado: 0, limite: 150000, libre: null },
      semana: { usado: 0, limite: 500000, libre: null },
      extra: 0,
      compra: false,
      sinLimite: true,
      clave: { saldo: 5_000_000, gastado: 1200, llamadas: 3, entrada: 6000, salida: 1200, desde: '2026-10-28' },
    });
    expect(estado?.sinLimite).toBe(true);
    expect(estado?.clave?.gastado).toBe(1200);
    expect(leerEstadoIA({ ...estado, clave: { saldo: 'x' } })?.clave).toBeNull();
  });
});

describe('saldo de la clave', () => {
  const clave = { saldo: 5_000_000, gastado: 10_000, llamadas: 40, entrada: 50_000, salida: 10_000, desde: '2026-10-28' };

  it('dinero y miles en español', () => {
    expect(dolares(5_000_000)).toBe('5,00 $');
    expect(dolares(4_990_000)).toBe('4,99 $');
    expect(dolares(953)).toBe('0,001 $');
    expect(dolares(0)).toBe('0,00 $');
    expect(miles(1234567)).toBe('1.234.567');
  });

  it('lo que queda, el porcentaje y los tokens al ritmo de ahora', () => {
    expect(quedaDeLaClave(clave)).toBe(4_990_000);
    expect(porcentajeClave(clave)).toBe(1);
    expect(porcentajeClave({ ...clave, gastado: 0 })).toBe(0);
    // 10.000 millonésimas por 60.000 tokens: 1/6 por token.
    expect(tokensQuedan(clave)).toBe(29_940_000);
    // Sin gastar nada, al coste medio de Haiku 5.5.
    expect(tokensQuedan({ ...clave, gastado: 0, entrada: 0, salida: 0 })).toBe(31_250_000);
    expect(quedaDeLaClave({ ...clave, gastado: 6_000_000 })).toBe(0);
  });

  it('cantidades grandes en palabras', () => {
    expect(textoCantidad(850)).toBe('850');
    expect(textoCantidad(12_400)).toBe('unos 12 mil');
    expect(textoCantidad(1_000_000)).toBe('un millón');
    expect(textoCantidad(2_500_000)).toBe('unos 2,5 millones');
    expect(textoCantidad(29_940_000)).toBe('unos 30 millones');
    expect(textoTokens(29_940_000)).toBe('unos 30 millones de tokens');
    expect(textoTokens(12_400)).toBe('unos 12 mil tokens');
    expect(dolares(4_998_787, true)).toBe('4,99 $');
  });
});
