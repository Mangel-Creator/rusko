import { describe, expect, it } from '@jest/globals';

import type { Epoca, RegistroBloque } from '@/data/epocas/tipos';
import {
  claveExamen,
  conExamen,
  conRecuentos,
  conValoracion,
  estimarHoras,
  HABITOS_VACIOS,
  lineasAprendidas,
  normalizarPerfilEstudio,
  PERFIL_ESTUDIO_VACIO,
  temasMedidos,
} from '@/services/epoca';

// Perfil de estudio: horas calculadas por la app y lo que aprende de sus planes (03/11/2026).

const examen = { temas: 10, dificultad: 'media' as const, tipoExamen: 'test' as const, avance: 'nada' as const };

describe('horas que necesita un examen', () => {
  it('sin apuntes: 3 h por tema, más repasos y margen para imprevistos', () => {
    // 10 × 3 × 1,5 (repasos) × 1,2 (imprevistos "a veces" por defecto)
    expect(estimarHoras(examen, PERFIL_ESTUDIO_VACIO)).toBe(54);
  });

  it('lo que ya lleva hecho y lo rápido que entiende lo bajan', () => {
    const rapido = { ...PERFIL_ESTUDIO_VACIO, habitos: { ...HABITOS_VACIOS, entender: 'rapido' as const } };
    expect(estimarHoras({ ...examen, avance: 'mitad' }, rapido)).toBeLessThan(estimarHoras(examen, rapido));
    expect(estimarHoras(examen, rapido)).toBeLessThan(estimarHoras(examen, PERFIL_ESTUDIO_VACIO));
  });

  it('su ritmo aprendido y los exámenes de desarrollo lo suben', () => {
    const lento = { ...PERFIL_ESTUDIO_VACIO, ritmo: 1.3 };
    expect(estimarHoras(examen, lento)).toBeGreaterThan(54);
    expect(estimarHoras({ ...examen, tipoExamen: 'desarrollo' }, PERFIL_ESTUDIO_VACIO)).toBeGreaterThan(54);
  });

  it('con apuntes medidos cuenta las páginas y lo densas que son', () => {
    const pocas = estimarHoras(examen, PERFIL_ESTUDIO_VACIO, [{ nombre: 'T1', paginas: 10, densidad: 'baja' }]);
    const muchas = estimarHoras(examen, PERFIL_ESTUDIO_VACIO, [{ nombre: 'T1', paginas: 10, densidad: 'alta' }]);
    expect(pocas).toBeLessThan(muchas);
    // 10 páginas × 4 min × 1,3 / 60 × 1,5 × 1,2
    expect(pocas).toBe(1.5);
  });

  it('nunca menos de 1 h ni más de 200', () => {
    expect(estimarHoras({ ...examen, temas: 1, dificultad: 'facil', avance: 'casi' }, PERFIL_ESTUDIO_VACIO)).toBeGreaterThanOrEqual(1);
    expect(estimarHoras({ ...examen, temas: 60, dificultad: 'dificil', tipoExamen: 'desarrollo' }, { ...PERFIL_ESTUDIO_VACIO, ritmo: 2 })).toBe(200);
  });
});

function epocaCon(hitoFecha: string): Epoca {
  return {
    id: 'e1',
    nombre: 'Exámenes',
    tipo: 'examenes',
    inicio: '2026-09-01',
    fin: hitoFecha,
    ritmo: {
      levantarse: '08:00', acostarse: '23:00', lugar: { tipo: 'casa' }, lugarPorDia: {}, diasVas: [], horasDia: 2,
      rindeMas: 'manana', descanso: '50-10', diaLibre: null, trayectoMin: 0, imprescindibles: [],
    },
    hitos: [{ id: 'h1', nombre: 'Estadística', fecha: hitoFecha, hora: '09:00', lugar: null, dificultad: 'media', horasPreparacion: 10 }],
    avisos: { salir: true, inicioBloque: true, finDescanso: true, dormir: true },
    ejemplo: false,
    dorada: false,
    resumenVisto: false,
  };
}

function bloque(dia: string, estado: 'hecho' | 'saltado', motivo?: string): RegistroBloque {
  return { id: `e1:${dia}:480`, epocaId: 'e1', hitoId: 'h1', dia, inicio: 480, fin: 530, estado, motivo };
}

describe('lo que aprende de sus planes', () => {
  // Lunes a viernes del 21 al 25 hechos, sábados y domingos del 19-20 y 26-27 saltados.
  const registro = [
    ...['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-28'].map((d) => bloque(d, 'hecho')),
    ...['2026-09-19', '2026-09-20', '2026-09-26', '2026-09-27', '2026-10-03', '2026-10-04'].map((d) =>
      bloque(d, 'saltado', 'Cansancio'),
    ),
  ];

  it('compara entre semana y fin de semana y repite los motivos', () => {
    const perfil = conRecuentos(PERFIL_ESTUDIO_VACIO, [epocaCon('2026-10-10')], registro);
    const lineas = lineasAprendidas(perfil);
    expect(lineas).toContain('Entre semana hace el 100 % de los bloques; el fin de semana, el 0 %.');
    expect(lineas).toContain('Cuando se salta bloques, suele ser por: "cansancio".');
  });

  it('lo aprendido se queda aunque se borre la época', () => {
    const perfil = conRecuentos(PERFIL_ESTUDIO_VACIO, [epocaCon('2026-10-10')], registro);
    expect(conRecuentos(perfil, [], []).recuentos.e1).toBeDefined();
  });

  it('las épocas de ejemplo no cuentan', () => {
    const perfil = conRecuentos(PERFIL_ESTUDIO_VACIO, [{ ...epocaCon('2026-10-10'), ejemplo: true }], registro);
    expect(perfil.recuentos).toEqual({});
  });

  it('"me faltó tiempo" sube su ritmo una sola vez por plan', () => {
    const una = conValoracion(PERFIL_ESTUDIO_VACIO, 'e1', '2026-10-10', 'falto');
    expect(una.ritmo).toBe(1.15);
    expect(conValoracion(una, 'e1', '2026-10-10', 'falto').ritmo).toBe(1.15);
    expect(lineasAprendidas(una)[0]).toBe('Según su último plan, necesita un 15 % más de tiempo del que se calcula.');
  });
});

describe('guardado del perfil y de cada examen', () => {
  it('completa lo que falte y limita el ritmo', () => {
    const p = normalizarPerfilEstudio({ ritmo: 9, habitos: { finde: 'uno' } });
    expect(p.ritmo).toBe(2);
    expect(p.habitos.finde).toBe('uno');
    expect(p.habitos.lejos).toBeNull();
    expect(normalizarPerfilEstudio(null)).toEqual(PERFIL_ESTUDIO_VACIO);
  });

  it('el mismo examen con otras mayúsculas o tildes es el mismo', () => {
    expect(claveExamen('  Inglés  B2 ')).toBe(claveExamen('ingles b2'));
    const p = conExamen(PERFIL_ESTUDIO_VACIO, 'Inglés B2', { ficha: { texto: 'Cuatro partes', fecha: '2026-11-03' } });
    const q = conExamen(p, 'ingles b2', { apuntes: { temas: [], fecha: '2026-11-03' } });
    expect(Object.keys(q.examenes)).toHaveLength(1);
    expect(q.examenes['ingles b2'].ficha?.texto).toBe('Cuatro partes');
  });
});

describe('apuntes medidos por la IA', () => {
  it('se queda con las páginas de cada tema y descarta lo que no vale', () => {
    const temas = temasMedidos({
      temas: [
        { nombre: ' Tema 1: Probabilidad ', paginaInicio: 3, paginaFin: 22, densidad: 'alta' },
        { nombre: 'Tema 2', paginaInicio: 23, paginaFin: 23, densidad: 'rara' },
        { nombre: 'Al revés', paginaInicio: 40, paginaFin: 30, densidad: 'media' },
        { nombre: '', paginaInicio: 1, paginaFin: 2, densidad: 'baja' },
      ],
    });
    expect(temas).toEqual([
      { nombre: 'Tema 1: Probabilidad', paginas: 20, densidad: 'alta' },
      { nombre: 'Tema 2', paginas: 1, densidad: 'media' },
    ]);
    expect(temasMedidos({ temas: [] })).toBeNull();
    expect(temasMedidos('nada')).toBeNull();
  });
});
