import { describe, expect, it } from '@jest/globals';

import type { Evento } from '@/data/eventos/tipos';

import { sitioDeCita } from '../sitioDeCita';

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: 'ingles',
    titulo: 'Clase de inglés',
    fecha: '2026-11-12',
    horaInicio: '18:00',
    horaFin: '19:00',
    tipo: 'estudios',
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

const hoy = '2026-11-03';

describe('decir dónde es una cita ya apuntada', () => {
  it('encuentra la cita y el sitio', () => {
    const r = sitioDeCita('La clase de inglés es en el Basic Fit de Montera.', [evento({})], hoy);
    expect(r?.evento.id).toBe('ingles');
    expect(r?.sitio).toBe('el Basic Fit de Montera');
  });

  it('vale con otras formas de decirlo', () => {
    expect(sitioDeCita('el sitio de la clase de ingles es Calle Mayor 5', [evento({})], hoy)?.sitio).toBe(
      'Calle Mayor 5',
    );
    expect(sitioDeCita('clase de inglés está en la academia Lingua', [evento({})], hoy)?.sitio).toBe(
      'la academia Lingua',
    );
  });

  it('elige la más próxima de hoy en adelante', () => {
    const pasada = evento({ id: 'pasada', fecha: '2026-10-01' });
    const lejos = evento({ id: 'lejos', fecha: '2026-12-01' });
    const cerca = evento({ id: 'cerca', fecha: '2026-11-05' });
    expect(sitioDeCita('la clase de inglés es en Lingua', [pasada, lejos, cerca], hoy)?.evento.id).toBe('cerca');
    const serie = evento({ id: 'serie', fecha: '2026-09-01', repeticion: 'semanal' });
    expect(sitioDeCita('la clase de inglés es en Lingua', [lejos, serie], hoy)?.evento.id).toBe('serie');
  });

  it('no salta si no hay cita así o si la frase trae día u hora', () => {
    expect(sitioDeCita('la cena es en casa de Ana', [evento({})], hoy)).toBeNull();
    expect(sitioDeCita('la clase de inglés es en Lingua a las 5', [evento({})], hoy)).toBeNull();
    expect(sitioDeCita('la clase de inglés es en Lingua', [evento({ fecha: '2026-10-01' })], hoy)).toBeNull();
    expect(sitioDeCita('pádel mañana a las 7', [evento({})], hoy)).toBeNull();
  });
});
