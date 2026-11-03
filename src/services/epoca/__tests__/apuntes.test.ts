import { describe, expect, it } from '@jest/globals';

import {
  densidadDe,
  esEscaneado,
  MAX_MAPA,
  mapaDePaginas,
  temasDelIndice,
  temasMedidos,
  type EntradaIndice,
  type PdfLeido,
} from '@/services/epoca';

const pagina = (caracteres: number, inicio = 'texto') => ({ inicio, caracteres });
const entrada = (titulo: string, pagina: number, hijos: EntradaIndice[] = []) => ({ titulo, pagina, hijos });
const pdf = (caracteres: number[], indice: EntradaIndice[] = []): PdfLeido => ({
  paginas: caracteres.map((c) => pagina(c)),
  indice,
});

describe('apuntes leídos en el dispositivo', () => {
  it('saca los temas del índice, sin portada ni bibliografía', () => {
    const leido = pdf([100, 500, 500, 3000, 3000, 4000, 200], [
      entrada('Portada', 1),
      entrada('Tema 1: Probabilidad', 2),
      entrada('Tema 2: Variables', 4),
      entrada('Bibliografía', 7),
    ]);
    expect(temasDelIndice(leido)).toEqual([
      { nombre: 'Tema 1: Probabilidad', paginas: 2, densidad: 'baja' },
      { nombre: 'Tema 2: Variables', paginas: 3, densidad: 'media' },
    ]);
  });

  it('baja al nivel de capítulos si todo cuelga de una entrada', () => {
    const leido = pdf([2000, 2000, 2000, 2000], [entrada('Apuntes', 1, [entrada('T1', 1), entrada('T2', 3)])]);
    expect(temasDelIndice(leido)?.map((t) => [t.nombre, t.paginas])).toEqual([
      ['T1', 2],
      ['T2', 2],
    ]);
  });

  it('sin índice útil, null', () => {
    expect(temasDelIndice(pdf([2000, 2000]))).toBeNull();
    expect(temasDelIndice(pdf([2000, 2000], [entrada('Tema 1', 1)]))).toBeNull();
    // Desordenado: no se fía.
    expect(temasDelIndice(pdf([2000, 2000, 2000], [entrada('B', 3), entrada('A', 1)]))).toBeNull();
  });

  it('densidad por caracteres y escaneados', () => {
    expect(densidadDe([pagina(800)])).toBe('baja');
    expect(densidadDe([pagina(2500)])).toBe('media');
    expect(densidadDe([pagina(4200)])).toBe('alta');
    expect(esEscaneado(pdf([0, 20, 40]))).toBe(true);
    expect(esEscaneado(pdf([0, 2000]))).toBe(false);
  });

  it('el mapa lleva el índice y una línea por página, y no pasa del tope', () => {
    const corto = mapaDePaginas({ paginas: [pagina(3400, 'Tema 3: Regresión')], indice: [entrada('Tema 3', 1)] });
    expect(corto).toContain('1 · Tema 3');
    expect(corto).toContain('1 · 3400 · Tema 3: Regresión');
    const largo = mapaDePaginas({ paginas: Array.from({ length: 1500 }, () => pagina(2000, 'x'.repeat(120))), indice: [] });
    expect(largo.length).toBeLessThanOrEqual(MAX_MAPA);
    expect(largo).toContain('\n1500 · 2000 · ');
  });

  it('con el PDF leído, la densidad de lo que mide la IA sale del texto', () => {
    const leido = pdf([4000, 4000, 500]);
    const temas = temasMedidos(
      {
        temas: [
          { nombre: 'T1', paginaInicio: 1, paginaFin: 2, densidad: 'baja' },
          { nombre: 'T2', paginaInicio: 3, paginaFin: 3, densidad: 'alta' },
        ],
      },
      leido,
    );
    expect(temas?.map((t) => t.densidad)).toEqual(['alta', 'baja']);
  });
});
