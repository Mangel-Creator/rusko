import { describe, expect, test } from '@jest/globals';

import { domingoDePascua, festivoDelDia, festivosDelAno, type ZonaFestivos } from '@/services/festivos';

const zona = (cambios: Partial<ZonaFestivos> = {}): ZonaFestivos => ({
  ocupacion: 'trabajo',
  donde: 'casa',
  municipio: 'Alicante',
  comunidad: 'val',
  subzona: null,
  locales: [],
  ...cambios,
});

describe('festivos', () => {
  test('Comunitat Valenciana 2026: los 12 de la tabla del BOE', () => {
    const fechas = festivosDelAno(2026, zona()).map((f) => f.fecha);
    expect(fechas).toEqual([
      '2026-01-01',
      '2026-01-06',
      '2026-03-19',
      '2026-04-03',
      '2026-04-06',
      '2026-05-01',
      '2026-06-24',
      '2026-08-15',
      '2026-10-09',
      '2026-10-12',
      '2026-12-08',
      '2026-12-25',
    ]);
  });

  test('Madrid 2027 no tiene Lunes de Pascua y sí el 16 de agosto', () => {
    const fechas = festivosDelAno(2027, zona({ comunidad: 'mad' })).map((f) => f.fecha);
    expect(fechas).not.toContain('2027-03-29');
    expect(fechas).toContain('2027-08-16');
  });

  test('las islas suman su fiesta y Arán cambia San Esteban', () => {
    const tenerife = festivosDelAno(2026, zona({ comunidad: 'can', subzona: 'tenerife' })).map((f) => f.fecha);
    expect(tenerife).toContain('2026-02-02');
    const aran = festivosDelAno(2026, zona({ comunidad: 'cat', subzona: 'aran' })).map((f) => f.fecha);
    expect(aran).toContain('2026-06-17');
    expect(aran).not.toContain('2026-12-26');
  });

  test('las fiestas locales cuentan solo en su año', () => {
    const conLocales = zona({ locales: [{ fecha: '2026-06-23', nombre: 'Hogueras' }] });
    expect(festivoDelDia('2026-06-23', conLocales)).toEqual({ fecha: '2026-06-23', nombre: 'Hogueras', ambito: 'local' });
    expect(festivosDelAno(2027, conLocales).some((f) => f.ambito === 'local')).toBe(false);
  });

  test('sin tabla del BOE: las nacionales y el Viernes Santo calculado', () => {
    const fechas = festivosDelAno(2028, zona()).map((f) => f.fecha);
    expect(fechas).toContain('2028-04-14'); // Pascua 2028: 16 de abril
    expect(fechas).toHaveLength(10);
  });

  test('Pascua', () => {
    expect(domingoDePascua(2026).getDate()).toBe(5);
    expect(domingoDePascua(2027).getMonth()).toBe(2); // 28 de marzo
    expect(domingoDePascua(2027).getDate()).toBe(28);
  });

  test('sin festivos en el perfil no hay ningún festivo', () => {
    expect(festivoDelDia('2026-10-12', null)).toBeNull();
  });
});
