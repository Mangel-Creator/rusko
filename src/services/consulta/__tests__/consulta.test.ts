import { describe, expect, it } from '@jest/globals';

import type { Evento } from '@/data/eventos/tipos';
import { entenderPregunta, nombreDelDia, respuestaDelDia } from '@/services/consulta';

// El 26/10/2026 es lunes.
const HOY = '2026-10-26';

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: Math.random().toString(36).slice(2),
    titulo: 'Evento',
    fecha: HOY,
    horaInicio: '10:00',
    horaFin: '11:00',
    tipo: 'yo',
    lugar: null,
    notas: '',
    repeticion: 'nunca',
    flexible: false,
    duracionMin: null,
    hecha: false,
    foco: false,
    avisoMin: null,
    ejemplo: false,
    ...parcial,
  };
}

const tarea = (titulo: string, fecha = HOY) =>
  evento({ titulo, fecha, flexible: true, horaInicio: null, horaFin: null, duracionMin: 30 });

describe('entenderPregunta', () => {
  it('reconoce la pregunta y el día de la semana', () => {
    expect(entenderPregunta('¿Qué tengo el miércoles?', HOY)).toBe('2026-10-28');
    expect(entenderPregunta('que tengo el miercoles', HOY)).toBe('2026-10-28');
    expect(entenderPregunta('Dime qué hay el viernes', HOY)).toBe('2026-10-30');
    expect(entenderPregunta('el domingo qué tengo', HOY)).toBe('2026-11-01');
    expect(entenderPregunta('¿Tengo algo el jueves?', HOY)).toBe('2026-10-29');
    expect(entenderPregunta('¿Estoy libre el sábado?', HOY)).toBe('2026-10-31');
  });

  it('el mismo día de la semana es el que viene, salvo con "este"', () => {
    expect(entenderPregunta('qué tengo el lunes', HOY)).toBe('2026-11-02');
    expect(entenderPregunta('qué tengo este lunes', HOY)).toBe('2026-10-26');
    expect(entenderPregunta('qué tengo el jueves de la semana que viene', HOY)).toBe('2026-11-05');
  });

  it('entiende hoy, mañana, pasado mañana y ayer', () => {
    expect(entenderPregunta('¿Qué tengo?', HOY)).toBe(HOY);
    expect(entenderPregunta('qué tengo hoy', HOY)).toBe(HOY);
    expect(entenderPregunta('qué tengo esta tarde', HOY)).toBe(HOY);
    expect(entenderPregunta('qué tengo mañana', HOY)).toBe('2026-10-27');
    expect(entenderPregunta('qué tengo mañana por la mañana', HOY)).toBe('2026-10-27');
    expect(entenderPregunta('qué tengo pasado mañana', HOY)).toBe('2026-10-28');
    expect(entenderPregunta('qué tenía ayer', HOY)).toBe('2026-10-25');
  });

  it('entiende fechas escritas', () => {
    expect(entenderPregunta('qué tengo el 5 de noviembre', HOY)).toBe('2026-11-05');
    expect(entenderPregunta('qué tengo el 5/11', HOY)).toBe('2026-11-05');
    expect(entenderPregunta('qué tengo el día 30', HOY)).toBe('2026-10-30');
    expect(entenderPregunta('qué tengo el 3', HOY)).toBe('2026-11-03'); // ya pasó este mes
    expect(entenderPregunta('qué tengo el 2 de enero', HOY)).toBe('2027-01-02');
    expect(entenderPregunta('qué tengo el 31 de febrero', HOY)).toBe(HOY); // no existe
  });

  it('deja pasar lo que hay que apuntar', () => {
    expect(entenderPregunta('pádel con Javi el jueves a las 8', HOY)).toBeNull();
    expect(entenderPregunta('tengo dentista el miércoles a las 10', HOY)).toBeNull();
    expect(entenderPregunta('llevar lo que tengo en el trastero', HOY)).toBeNull();
  });
});

describe('nombreDelDia', () => {
  it('dice los días cercanos por su nombre y los lejanos con el mes', () => {
    expect(nombreDelDia(HOY, HOY)).toBe('Hoy');
    expect(nombreDelDia('2026-10-27', HOY)).toBe('Mañana');
    expect(nombreDelDia('2026-10-29', HOY)).toBe('El jueves 29');
    expect(nombreDelDia('2026-11-01', HOY)).toBe('El domingo 1 de noviembre');
    expect(nombreDelDia('2026-11-11', HOY)).toBe('El miércoles 11 de noviembre');
  });
});

describe('respuestaDelDia', () => {
  const ahora = new Date(2026, 9, 26, 12, 0);
  const miercoles = '2026-10-28';

  it('lo tienes libre', () => {
    expect(respuestaDelDia({ eventos: [], dia: miercoles, ahora, perfil: null })).toBe('El miércoles 28 lo tienes libre.');
  });

  it('cuenta las citas en orden, con el sitio, y las tareas', () => {
    const eventos = [
      evento({ titulo: 'Pádel', fecha: miercoles, horaInicio: '18:00', horaFin: '19:30' }),
      evento({
        titulo: 'Reunión',
        fecha: miercoles,
        horaInicio: '13:00',
        horaFin: '14:00',
        lugar: { tipo: 'otro', direccion: 'Calle Mayor 3, Alicante', coordenadas: null },
      }),
      evento({ titulo: 'Médico', fecha: miercoles, horaInicio: '01:30', horaFin: '02:00' }),
      tarea('Comprar pan', miercoles),
    ];
    expect(respuestaDelDia({ eventos, dia: miercoles, ahora, perfil: null })).toBe(
      'El miércoles 28 tienes 3 cosas: a la 1:30, Médico, a las 13:00, Reunión en Calle Mayor 3 y a las 18:00, Pádel. ' +
        'Y una tarea sin hora: Comprar pan.',
    );
  });

  it('de hoy solo cuenta lo que queda', () => {
    const eventos = [
      evento({ titulo: 'Desayuno', horaInicio: '08:00', horaFin: '09:00' }),
      evento({ titulo: 'Cena', horaInicio: '21:00', horaFin: '22:00' }),
    ];
    expect(respuestaDelDia({ eventos, dia: HOY, ahora, perfil: null })).toBe('Hoy te queda una cosa: a las 21:00, Cena.');
    const tarde = new Date(2026, 9, 26, 23, 0);
    expect(respuestaDelDia({ eventos, dia: HOY, ahora: tarde, perfil: null })).toBe('Hoy ya no te queda nada. A descansar.');
  });

  it('solo tareas, días pasados y listas largas', () => {
    expect(respuestaDelDia({ eventos: [tarea('Llamar al banco', miercoles)], dia: miercoles, ahora, perfil: null })).toBe(
      'El miércoles 28 no tienes nada con hora. Tienes una tarea sin hora: Llamar al banco.',
    );
    expect(respuestaDelDia({ eventos: [], dia: '2026-10-25', ahora, perfil: null })).toBe('Ayer no tenías nada apuntado.');
    const muchas = Array.from({ length: 8 }, (_, i) =>
      evento({ titulo: `Cita ${i + 1}`, fecha: miercoles, horaInicio: `1${i}:00`, horaFin: `1${i}:30` }),
    );
    expect(respuestaDelDia({ eventos: muchas, dia: miercoles, ahora, perfil: null })).toMatch(/Cita 6 y 2 más\.$/);
  });
});
