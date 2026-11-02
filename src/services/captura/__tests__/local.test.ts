import { describe, expect, it } from '@jest/globals';

import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { entenderLocal, interpretarLocal } from '@/services/captura/local';

// Lunes 26 de octubre de 2026, a las 10:00.
const ahora = new Date(2026, 9, 26, 10, 0);
const perfil = {
  sitios: [{ id: 's-estudio', nombre: 'Estudio', direccion: '', coordenadas: null }],
} as unknown as Perfil;

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: Math.random().toString(36).slice(2),
    titulo: 'Evento',
    fecha: '2026-10-27',
    horaInicio: '17:00',
    horaFin: '18:00',
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

const leer = (frase: string, eventos: Evento[] = []) => interpretarLocal(frase, { ahora, perfil, eventos });

describe('interpretarLocal', () => {
  it('«mañana pádel por la tarde»: mañana a las 17, unas 2 horas, con amigos', () => {
    expect(leer('mañana padel por la tarde')).toEqual({
      titulo: 'Pádel',
      fecha: '2026-10-27',
      horaInicio: '17:00',
      horaFin: '19:00',
      tipo: 'amigos',
      lugar: null,
      flexible: false,
      duracionMin: null,
      avisarA: null,
      avisoMin: null,
      confianza: 'alta',
      opcionesHora: ['17:00', '18:00', '19:00'],
    });
  });

  it('quita «tengo» y pone las siglas en mayúsculas', () => {
    expect(leer('tengo cita del dni el sabado a las 12')).toMatchObject({
      titulo: 'Cita del DNI',
      fecha: '2026-10-31',
      horaInicio: '12:00',
    });
    expect(leer('tengo que pasar la itv el jueves')).toMatchObject({ titulo: 'Pasar la ITV', flexible: true });
  });

  it('entiende la frase tal cual la dijo el usuario («a las por la tarde»)', () => {
    const p = leer('mañana padel a las por la tarde');
    expect(p).toMatchObject({ titulo: 'Pádel', fecha: '2026-10-27', horaInicio: '17:00', horaFin: '19:00' });
  });

  it('por la tarde coge la primera hora libre', () => {
    const p = leer('mañana pádel por la tarde', [evento({ horaInicio: '17:00', horaFin: '18:00' })]);
    expect(p).toMatchObject({ horaInicio: '18:00', horaFin: '20:00' });
  });

  it('«a las 8» de un plan de tarde es a las 20:00, y el jueves es el de esta semana', () => {
    expect(leer('pádel con Javi el jueves a las 8')).toMatchObject({
      titulo: 'Pádel con Javi',
      fecha: '2026-10-29',
      horaInicio: '20:00',
      horaFin: '22:00',
      tipo: 'amigos',
      confianza: 'alta',
    });
  });

  it('el médico a las 10 es por la mañana y dura una hora', () => {
    expect(leer('dentista el viernes a las 10')).toMatchObject({
      titulo: 'Dentista',
      fecha: '2026-10-30',
      horaInicio: '10:00',
      horaFin: '11:00',
      tipo: 'yo',
    });
  });

  it('una hora que ya ha pasado hoy, sin decir el día, es mañana', () => {
    expect(leer('médico a las 9')).toMatchObject({ fecha: '2026-10-27', horaInicio: '09:00' });
  });

  it('«proyecto» es del tipo Proyectos', () => {
    expect(leer('mañana proyecto de la web a las 5')).toMatchObject({
      fecha: '2026-10-27',
      horaInicio: '17:00',
      tipo: 'proyectos',
    });
  });

  it('rangos, minutos y tipo cliente', () => {
    expect(leer('reunión con Acme de 5 a 7 y media')).toMatchObject({
      titulo: 'Reunión con Acme',
      fecha: '2026-10-26',
      horaInicio: '17:00',
      horaFin: '19:30',
      tipo: 'cliente',
    });
    expect(leer('pasado mañana yoga a las 17:30')).toMatchObject({
      fecha: '2026-10-28',
      horaInicio: '17:30',
      horaFin: '18:30',
    });
  });

  it('día del mes con nombre y comida a mediodía', () => {
    expect(leer('el 5 de noviembre comida con mama')).toMatchObject({
      titulo: 'Comida con mamá',
      fecha: '2026-11-05',
      horaInicio: '14:00',
      horaFin: '15:30',
      tipo: 'amigos',
    });
  });

  it('solo la actividad: la supone, pero pide revisarla', () => {
    expect(leer('cena con Ana')).toMatchObject({
      fecha: '2026-10-26',
      horaInicio: '20:00',
      horaFin: '22:00',
      confianza: 'media',
    });
  });

  it('un recado sin hora es una tarea flexible de ese día', () => {
    expect(leer('llamar al taller mañana')).toMatchObject({
      titulo: 'Llamar al taller',
      fecha: '2026-10-27',
      horaInicio: null,
      flexible: true,
      duracionMin: 30,
      confianza: 'alta',
    });
  });

  it('duración dicha y lugar', () => {
    expect(leer('mañana estudiar en el estudio a las 5 durante 3 horas')).toMatchObject({
      titulo: 'Estudiar',
      horaInicio: '17:00',
      horaFin: '20:00',
      lugar: { tipo: 'sitio', sitioId: 's-estudio' },
    });
    expect(leer('gimnasio en casa esta tarde')).toMatchObject({
      lugar: { tipo: 'casa' },
      fecha: '2026-10-26',
      horaInicio: '17:00',
    });
  });
});

describe('entenderLocal', () => {
  const entender = (frase: string) =>
    entenderLocal(frase, {
      ahora,
      perfil: { ...perfil, horario: { levantarse: '07:30' } } as unknown as Perfil,
      eventos: [],
    });

  it('«recuérdame…»: una tarea de ese día que avisa a la hora dicha', () => {
    expect(entender('recuérdame mañana a las 6 llamar a mamá')).toEqual({
      accion: 'apuntar',
      propuesta: expect.objectContaining({
        titulo: 'Llamar a mamá',
        fecha: '2026-10-27',
        flexible: true,
        horaInicio: null,
        avisarA: '18:00',
      }),
    });
  });

  it('un aviso sin hora suena al levantarse; si es hoy y ya pasó, en la próxima hora', () => {
    expect(entender('ponme un aviso para sacar la basura el jueves')).toMatchObject({
      propuesta: { titulo: 'Sacar la basura', fecha: '2026-10-29', avisarA: '07:30' },
    });
    expect(entender('avísame de regar las plantas')).toMatchObject({
      propuesta: { titulo: 'Regar las plantas', fecha: '2026-10-26', avisarA: '11:00' },
    });
  });

  it('«ponme una alarma a las 7»: alarma de mañana a las 07:00', () => {
    expect(entender('ponme una alarma a las 7')).toEqual({
      accion: 'alarma',
      alarma: { fecha: '2026-10-27', hora: '07:00', etiqueta: '', confianza: 'alta' },
    });
    expect(entender('despiértame el sábado a las 9 y media')).toMatchObject({
      alarma: { fecha: '2026-10-31', hora: '09:30' },
    });
    expect(entender('pon una alarma')).toBeNull();
  });
});
