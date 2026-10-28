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
  it('dice los días cercanos como una persona y los lejanos con el mes', () => {
    expect(nombreDelDia(HOY, HOY)).toBe('Hoy');
    expect(nombreDelDia('2026-10-27', HOY)).toBe('Mañana');
    expect(nombreDelDia('2026-10-28', HOY)).toBe('Pasado mañana');
    expect(nombreDelDia('2026-10-29', HOY)).toBe('El jueves');
    expect(nombreDelDia('2026-11-01', HOY)).toBe('El domingo');
    expect(nombreDelDia('2026-11-02', HOY)).toBe('El lunes 2 de noviembre');
    expect(nombreDelDia('2026-11-11', HOY)).toBe('El miércoles 11 de noviembre');
  });
});

describe('respuestaDelDia', () => {
  const ahora = new Date(2026, 9, 26, 12, 0);
  const jueves = '2026-10-29';
  const responder = (eventos: Evento[], dia = jueves, cuando = ahora) =>
    respuestaDelDia({ eventos, dia, ahora: cuando, perfil: null });

  it('lo tienes libre', () => {
    expect(responder([])).toBe('El jueves no tienes nada. Día libre.');
    expect(responder([], '2026-10-28')).toBe('Pasado mañana lo tienes libre del todo.');
  });

  it('cuenta las citas como un relato, con las horas en palabras', () => {
    const eventos = [
      evento({ titulo: 'Pádel', fecha: jueves, horaInicio: '18:00', horaFin: '19:30' }),
      evento({
        titulo: 'Reunión',
        fecha: jueves,
        horaInicio: '13:00',
        horaFin: '14:00',
        lugar: { tipo: 'otro', direccion: 'Calle Mayor 3, Alicante', coordenadas: null },
      }),
      evento({ titulo: 'Médico', fecha: jueves, horaInicio: '01:30', horaFin: '02:00' }),
      tarea('Comprar pan', jueves),
    ];
    expect(responder(eventos)).toBe(
      'El jueves tienes tres cosas. Empiezas a la una y media de la madrugada con Médico, ' +
        'luego Reunión, a la una del mediodía en Calle Mayor 3, y acabas a las seis de la tarde con Pádel. ' +
        'Además, tienes pendiente Comprar pan.',
    );
  });

  it('no repite la parte del día y dice si tienes la tarde o la mañana libre', () => {
    const manana = [
      evento({ titulo: 'Gimnasio', fecha: jueves, horaInicio: '08:00', horaFin: '09:00' }),
      evento({ titulo: 'Reunión', fecha: jueves, horaInicio: '10:15', horaFin: '11:00' }),
    ];
    expect(responder(manana)).toBe(
      'El jueves tienes dos cosas: Gimnasio, a las ocho de la mañana, y luego Reunión, a las diez y cuarto. ' +
        'La tarde la tienes libre.',
    );
    const tarde = [evento({ titulo: 'Pádel', fecha: jueves, horaInicio: '18:40', horaFin: '20:00' })];
    expect(responder(tarde)).toBe('El jueves solo tienes Pádel, a las siete menos veinte de la tarde. Por la mañana, libre.');
  });

  it('de hoy solo cuenta lo que queda y dice en qué estás ahora', () => {
    const eventos = [
      evento({ titulo: 'Desayuno', horaInicio: '08:00', horaFin: '09:00' }),
      evento({ titulo: 'Cena', horaInicio: '21:00', horaFin: '22:00' }),
    ];
    expect(responder(eventos, HOY)).toBe('Hoy solo te queda Cena, a las nueve de la noche.');
    expect(responder(eventos, HOY, new Date(2026, 9, 26, 23, 0))).toBe('Por hoy ya está. Lo que queda de día es para ti.');

    const ocupado = [
      evento({ titulo: 'Reunión', horaInicio: '10:00', horaFin: '11:00' }),
      evento({ titulo: 'Comida', horaInicio: '14:00', horaFin: '15:30' }),
    ];
    expect(responder(ocupado, HOY, new Date(2026, 9, 26, 10, 30))).toBe(
      'Ahora mismo estás con Reunión, hasta las once de la mañana. Después solo te queda Comida, a las dos de la tarde.',
    );
  });

  it('solo tareas, días pasados y listas largas', () => {
    expect(responder([tarea('Llamar al banco', jueves)])).toBe(
      'El jueves no tienes nada a una hora fija. Solo tienes pendiente Llamar al banco.',
    );
    expect(responder([], '2026-10-25')).toBe('Ayer no tenías nada apuntado.');
    expect(responder([evento({ titulo: 'Cena', fecha: '2026-10-25', horaInicio: '21:00', horaFin: '23:00' })], '2026-10-25')).toBe(
      'Ayer solo tuviste Cena, a las nueve de la noche.',
    );
    const muchas = Array.from({ length: 8 }, (_, i) =>
      evento({ titulo: `Cita ${i + 1}`, fecha: jueves, horaInicio: `1${i}:00`, horaFin: `1${i}:30` }),
    );
    expect(responder(muchas)).toMatch(
      /^El jueves tienes ocho cosas\. Empiezas .*Cita 4, a la una, Cita 5, a las dos de la tarde, y luego tres cosas más\. Vas a ir a tope\.$/,
    );
  });
});
