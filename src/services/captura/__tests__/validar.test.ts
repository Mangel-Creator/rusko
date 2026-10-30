import { describe, expect, it } from '@jest/globals';

import { normalizarHora, validarInterpretacion, validarPropuesta } from '@/services/captura/validar';

const contexto = { hoy: '2026-09-24', sitiosIds: ['s-gimnasio', 's-trabajo'] };

// Respuesta típica de la IA para «pádel con Javi el jueves a las 8».
const buena = {
  titulo: 'pádel con Javi',
  fecha: '2026-10-01',
  horaInicio: '20:00',
  horaFin: '21:00',
  tipo: 'amigos',
  sitioId: null,
  flexible: false,
  duracionMin: null,
  confianza: 'alta',
};

describe('validarPropuesta', () => {
  it('acepta una respuesta correcta y pone el título con mayúscula', () => {
    expect(validarPropuesta(buena, contexto)).toEqual({
      titulo: 'Pádel con Javi',
      fecha: '2026-10-01',
      horaInicio: '20:00',
      horaFin: '21:00',
      tipo: 'amigos',
      lugar: null,
      flexible: false,
      duracionMin: null,
      avisarA: null,
      avisoMin: null,
      confianza: 'alta',
    });
  });

  it('descarta lo que no es un objeto', () => {
    expect(validarPropuesta(null, contexto)).toBeNull();
    expect(validarPropuesta('pádel', contexto)).toBeNull();
    expect(validarPropuesta([buena], contexto)).toBeNull();
  });

  it('descarta un título vacío o que no es texto', () => {
    expect(validarPropuesta({ ...buena, titulo: '   ' }, contexto)).toBeNull();
    expect(validarPropuesta({ ...buena, titulo: 42 }, contexto)).toBeNull();
  });

  it('recorta los títulos muy largos y los espacios de más', () => {
    const p = validarPropuesta({ ...buena, titulo: '  cena   con   Ana ' + 'x'.repeat(200) }, contexto);
    expect(p?.titulo.startsWith('Cena con Ana')).toBe(true);
    expect(p?.titulo.length).toBeLessThanOrEqual(100);
  });

  it('descarta fechas mal escritas, que no existen o demasiado lejos', () => {
    expect(validarPropuesta({ ...buena, fecha: '1/10/2026' }, contexto)).toBeNull();
    expect(validarPropuesta({ ...buena, fecha: '2026-02-30' }, contexto)).toBeNull();
    expect(validarPropuesta({ ...buena, fecha: '2025-01-01' }, contexto)).toBeNull();
    expect(validarPropuesta({ ...buena, fecha: '2031-01-01' }, contexto)).toBeNull();
  });

  it('pone 1 hora de fin si falta o si es antes del inicio', () => {
    expect(validarPropuesta({ ...buena, horaFin: null }, contexto)?.horaFin).toBe('21:00');
    expect(validarPropuesta({ ...buena, horaFin: '19:00' }, contexto)?.horaFin).toBe('21:00');
    expect(validarPropuesta({ ...buena, horaFin: 'mañana' }, contexto)?.horaFin).toBe('21:00');
  });

  it('no cruza la medianoche', () => {
    const p = validarPropuesta({ ...buena, horaInicio: '23:30', horaFin: null }, contexto);
    expect(p?.horaFin).toBe('23:59');
    expect(validarPropuesta({ ...buena, horaInicio: '23:59', horaFin: null }, contexto)).toBeNull();
  });

  it('acepta horas con una sola cifra y descarta las imposibles', () => {
    expect(validarPropuesta({ ...buena, horaInicio: '8:30', horaFin: '9:15' }, contexto)).toMatchObject({
      horaInicio: '08:30',
      horaFin: '09:15',
    });
    expect(normalizarHora('25:00')).toBeNull();
    expect(normalizarHora('10:75')).toBeNull();
    expect(normalizarHora('20h')).toBeNull();
  });

  it('sin hora de inicio lo convierte en tarea flexible', () => {
    const p = validarPropuesta({ ...buena, horaInicio: null, horaFin: null, duracionMin: null }, contexto);
    expect(p).toMatchObject({ flexible: true, horaInicio: null, horaFin: null, duracionMin: 30 });
  });

  it('en tareas flexibles quita las horas y ajusta la duración a 15, 30, 60 o 120 min', () => {
    const p = validarPropuesta({ ...buena, flexible: true, duracionMin: 45 }, contexto);
    expect(p).toMatchObject({ flexible: true, horaInicio: null, horaFin: null });
    expect([30, 60]).toContain(p?.duracionMin);
    expect(validarPropuesta({ ...buena, flexible: true, duracionMin: 500 }, contexto)?.duracionMin).toBe(120);
    expect(validarPropuesta({ ...buena, flexible: true, duracionMin: 'mucho' }, contexto)?.duracionMin).toBe(30);
  });

  it('si el tipo no es válido, lo pone como "yo"', () => {
    expect(validarPropuesta({ ...buena, tipo: 'familia' }, contexto)?.tipo).toBe('yo');
    expect(validarPropuesta({ ...buena, tipo: 'cliente' }, contexto)?.tipo).toBe('cliente');
  });

  it('solo acepta Casa o sitios habituales que existen, como referencia', () => {
    expect(validarPropuesta({ ...buena, sitioId: 'casa' }, contexto)?.lugar).toEqual({ tipo: 'casa' });
    expect(validarPropuesta({ ...buena, sitioId: 's-gimnasio' }, contexto)?.lugar).toEqual({
      tipo: 'sitio',
      sitioId: 's-gimnasio',
    });
    expect(validarPropuesta({ ...buena, sitioId: 's-inventado' }, contexto)?.lugar).toBeNull();
  });

  it('si la confianza no es válida, la toma como baja', () => {
    expect(validarPropuesta({ ...buena, confianza: 'muy alta' }, contexto)?.confianza).toBe('baja');
    expect(validarPropuesta({ ...buena, confianza: 'media' }, contexto)?.confianza).toBe('media');
  });

  it('guarda la antelación pedida para el aviso de una cita, redondeada', () => {
    expect(validarPropuesta({ ...buena, avisoAntesMin: 1440 }, contexto)?.avisoMin).toBe(1440);
    expect(validarPropuesta({ ...buena, avisoAntesMin: 50 }, contexto)?.avisoMin).toBe(60);
    expect(validarPropuesta({ ...buena, avisoAntesMin: null }, contexto)?.avisoMin).toBeNull();
  });
});

describe('validarInterpretacion', () => {
  const ahora = { ...contexto, ahora: '10:00', horaAviso: '07:30' };

  it('un recordatorio es una tarea con aviso a esa hora', () => {
    expect(
      validarInterpretacion(
        { ...buena, accion: 'recordatorio', titulo: 'Llamar a mamá', fecha: '2026-09-25', horaInicio: '18:00' },
        ahora,
      ),
    ).toEqual({
      accion: 'apuntar',
      propuesta: expect.objectContaining({ titulo: 'Llamar a mamá', flexible: true, horaInicio: null, avisarA: '18:00' }),
    });
  });

  it('un recordatorio sin hora avisa al levantarse, o en la próxima hora si hoy ya pasó', () => {
    const sinHora = { ...buena, accion: 'recordatorio', horaInicio: null };
    expect(validarInterpretacion({ ...sinHora, fecha: '2026-09-25' }, ahora)).toMatchObject({
      propuesta: { avisarA: '07:30' },
    });
    expect(validarInterpretacion({ ...sinHora, fecha: '2026-09-24' }, ahora)).toMatchObject({
      propuesta: { avisarA: '11:00' },
    });
  });

  it('una tarea no lleva hora aunque la IA la ponga', () => {
    expect(validarInterpretacion({ ...buena, accion: 'tarea' }, ahora)).toMatchObject({
      propuesta: { flexible: true, horaInicio: null, avisarA: null },
    });
  });

  it('una alarma necesita hora; si hoy ya pasó, es la de mañana', () => {
    const alarma = { ...buena, accion: 'alarma', titulo: '', fecha: '2026-09-24', horaInicio: '7:00' };
    expect(validarInterpretacion(alarma, ahora)).toEqual({
      accion: 'alarma',
      alarma: { fecha: '2026-09-25', hora: '07:00', etiqueta: '', confianza: 'alta' },
    });
    expect(validarInterpretacion({ ...alarma, horaInicio: '12:00', titulo: 'gimnasio' }, ahora)).toMatchObject({
      alarma: { fecha: '2026-09-24', hora: '12:00', etiqueta: 'Gimnasio' },
    });
    expect(validarInterpretacion({ ...alarma, horaInicio: null }, ahora)).toBeNull();
  });

  it('una pregunta devuelve el día; lo que no es de la agenda, nada', () => {
    expect(validarInterpretacion({ ...buena, accion: 'pregunta', fecha: '2026-09-30' }, ahora)).toEqual({
      accion: 'pregunta',
      dia: '2026-09-30',
    });
    expect(validarInterpretacion({ ...buena, accion: 'otra' }, ahora)).toBeNull();
  });
});
