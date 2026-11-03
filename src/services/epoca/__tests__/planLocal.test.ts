import { describe, expect, it } from '@jest/globals';

import {
  aplicarSupervision,
  conExamen,
  consejosLocales,
  estimarHoras,
  HABITOS_VACIOS,
  PERFIL_ESTUDIO_VACIO,
  planLocal,
  temasDelTexto,
  type AsignaturaCuestionario,
  type RespuestasCuestionario,
} from '@/services/epoca';

// Plan de estudio sin IA (03/11/2026): las mismas reglas que seguía la IA, gratis.

const examen = (cambio: Partial<AsignaturaCuestionario> = {}): AsignaturaCuestionario => ({
  id: 'a',
  nombre: 'Estadística',
  fecha: '2026-12-15',
  hora: '10:00',
  tipoExamen: 'test',
  temas: 6,
  avance: 'poco',
  dificultad: 'media',
  anteriores: false,
  indice: '',
  ...cambio,
});

const respuestas = (asignaturas: AsignaturaCuestionario[], habitos = HABITOS_VACIOS): RespuestasCuestionario => ({
  asignaturas,
  horasDia: 3,
  rindeMas: 'tarde',
  diaLibre: null,
  habitos,
  otros: '',
});

const nombres = (r: RespuestasCuestionario, estudio = PERFIL_ESTUDIO_VACIO) =>
  planLocal(r, estudio).hitos[0].temas.map((t) => t.nombre);

describe('plan sin IA', () => {
  it('las horas suman lo que calcula la app, en medias horas', () => {
    const a = examen();
    const hito = planLocal(respuestas([a]), PERFIL_ESTUDIO_VACIO).hitos[0];
    const suma = hito.temas.reduce((t, x) => t + x.horas, 0);
    expect(suma).toBe(hito.horasPreparacion);
    expect(Math.abs(suma - estimarHoras(a, PERFIL_ESTUDIO_VACIO))).toBeLessThanOrEqual(0.5);
    expect(hito.temas.every((t) => t.horas >= 0.5 && (t.horas * 2) % 1 === 0)).toBe(true);
  });

  it('temas en orden con repasos sin mirar cada 3 y repaso final', () => {
    expect(nombres(respuestas([examen()]))).toEqual([
      'Tema 1',
      'Tema 2',
      'Tema 3',
      'Preguntas T1-T3',
      'Tema 4',
      'Tema 5',
      'Tema 6',
      'Tests de práctica',
      'Repaso final con tus esquemas y fichas',
    ]);
  });

  it('repasa cada 2 si memorizar le cuesta, y lo llama repaso si no le gustan las preguntas', () => {
    const habitos = { ...HABITOS_VACIOS, memorizar: 'cuesta' as const, autoexamen: 'no-gusta' as const };
    expect(nombres(respuestas([examen({ temas: 4 })], habitos)).slice(0, 4)).toEqual([
      'Tema 1',
      'Tema 2',
      'Repaso T1-T2',
      'Tema 3',
    ]);
  });

  it('usa los nombres del índice, organiza si no ha empezado y hace simulacro si hay exámenes de otros años', () => {
    const a = examen({ indice: '1. Descriptiva\n2. Probabilidad', temas: 2, avance: 'nada', anteriores: true });
    expect(nombres(respuestas([a]))).toEqual([
      'Organizar el material y ver exámenes de otros años',
      'T1: Descriptiva',
      'T2: Probabilidad',
      'Simulacro con un examen de otros años',
      'Repaso final con tus esquemas y fichas',
    ]);
  });

  it('un temario largo se agrupa sin pasar de 20 piezas', () => {
    const temas = nombres(respuestas([examen({ temas: 60, tipoExamen: 'desarrollo' })]));
    expect(temas.length).toBeLessThanOrEqual(20);
    expect(temas).toContain('Segunda vuelta a todo el temario');
    expect(temas).toContain('Esquemas-guion de cada tema');
  });

  it('un idioma va por destrezas y con dos simulacros', () => {
    const temas = nombres(respuestas([examen({ nombre: 'Inglés Cambridge B2' })]));
    expect(temas).toContain('Use of English con el formato del examen');
    expect(temas).toContain('Speaking grabándote o con alguien');
    expect(temas.filter((t) => t.includes('imulacro'))).toHaveLength(2);
  });

  it('con la ficha del examen, simulacro con su formato', () => {
    const estudio = conExamen(PERFIL_ESTUDIO_VACIO, 'Estadística', { ficha: { texto: 'Test de 30 preguntas', fecha: '2026-11-03' } });
    expect(nombres(respuestas([examen()]), estudio)).toContain('Simulacro con el formato del examen');
  });

  it('un trabajo va por partes', () => {
    expect(nombres(respuestas([examen({ tipoExamen: 'trabajo' })]))).toEqual([
      'Buscar información',
      'Hacer el guion',
      'Redactar',
      'Revisar y entregar',
    ]);
  });

  it('el descanso sale de sus hábitos', () => {
    expect(planLocal(respuestas([examen()]), PERFIL_ESTUDIO_VACIO).descanso).toBe('50-10');
    const movil = { ...HABITOS_VACIOS, distraccion: 'movil' as const };
    expect(planLocal(respuestas([examen()], movil), PERFIL_ESTUDIO_VACIO).descanso).toBe('25-5');
  });
});

describe('consejos sin IA', () => {
  it('como mucho 6, primero los de su examen y sus hábitos', () => {
    const habitos = {
      ...HABITOS_VACIOS,
      arrancar: 'cuesta' as const,
      sintesis: 'releo' as const,
      distraccion: 'movil' as const,
      constancia: 'nunca' as const,
      nervios: 'mucho' as const,
      imprevistos: 'a-menudo' as const,
    };
    const lista = consejosLocales(respuestas([examen({ tipoExamen: 'problemas' })], habitos), PERFIL_ESTUDIO_VACIO);
    expect(lista).toHaveLength(6);
    expect(lista[0]).toContain('problemas');
    expect(lista[1]).toContain('arrancar');
    expect(lista.some((c) => c.includes('móvil'))).toBe(true);
  });

  it('sin hábitos raros, los generales', () => {
    const lista = consejosLocales(respuestas([examen()]), PERFIL_ESTUDIO_VACIO);
    expect(lista.at(-1)).toContain('Repasa espaciado');
  });
});

describe('plan supervisado por la IA', () => {
  const r = respuestas([examen(), examen({ id: 'b', nombre: 'Física', fecha: '2026-12-20' })]);
  const local = planLocal(r, PERFIL_ESTUDIO_VACIO);

  it('cambia solo el examen que toca, con su nota, y deja los consejos si no manda 3', () => {
    const temas = [{ nombre: 'Problemas T1-T6', horas: 20 }, { nombre: 'Simulacro', horas: 4 }];
    const plan = aplicarSupervision(r, local, { examenes: [{ numero: 2, temas }, { numero: 9, temas }], consejos: ['Uno'], notas: 'Más práctica.' });
    expect(plan?.hitos[0].temas).toEqual(local.hitos[0].temas);
    expect(plan?.hitos[1].temas.map((t) => t.nombre)).toEqual(['Problemas T1-T6', 'Simulacro']);
    expect(plan?.consejos).toEqual(local.consejos);
    expect(plan?.notas).toBe('Más práctica.');
  });

  it('no deja mover las horas más de un 15 %', () => {
    const plan = aplicarSupervision(r, local, { examenes: [{ numero: 1, temas: [{ nombre: 'Todo', horas: 100 }] }], consejos: [], notas: '' });
    const antes = local.hitos[0].horasPreparacion;
    expect(plan?.hitos[0].horasPreparacion).toBeLessThanOrEqual(Math.ceil(antes * 1.15));
    expect(plan?.notas).toContain('la IA proponía 100 h');
  });

  it('una respuesta rara no vale', () => {
    expect(aplicarSupervision(r, local, 'hola')).toBeNull();
  });
});

describe('índice pegado', () => {
  it('quita los números y separa por líneas o punto y coma', () => {
    expect(temasDelTexto('Tema 1. Matrices\n2) Determinantes; Capítulo 3: Espacios  vectoriales\n\n')).toEqual([
      'Matrices',
      'Determinantes',
      'Espacios vectoriales',
    ]);
  });
});
