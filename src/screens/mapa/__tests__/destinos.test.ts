import { describe, expect, it } from '@jest/globals';

import type { Evento } from '@/data/eventos/tipos';
import { palabrasClave } from '@/services/palabras';

import { eventoSinSitio, sugerencias } from '../destinos';

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: 'ingles',
    titulo: 'Clase de inglés',
    fecha: '2026-11-03',
    horaInicio: '18:00',
    horaFin: '19:00',
    tipo: 'estudios',
    lugar: { tipo: 'otro', direccion: 'Calle Alfonso I 10, Zaragoza', coordenadas: null },
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

const ahora = new Date(2026, 10, 3, 9, 0);

describe('buscar entre tus citas', () => {
  it('quita las palabras de relleno', () => {
    expect(palabrasClave('Donde tengo la clase de inglés')).toEqual(['clase', 'ingles']);
  });

  it('encuentra la cita por cómo la dices, aunque no tenga coordenadas y sea en semanas', () => {
    const lejos = evento({ fecha: '2026-11-25' });
    const [d] = sugerencias(null, [lejos], ahora, 'donde tengo la clase de ingles');
    expect(d.nombre).toBe('Clase de inglés');
    expect(d.direccion).toBe('Calle Alfonso I 10, Zaragoza');
    expect(sugerencias(null, [lejos], ahora, 'clase de piano')).toEqual([]);
  });

  it('avisa si la cita no tiene sitio', () => {
    expect(eventoSinSitio([evento({ lugar: null })], 'la clase de inglés')?.id).toBe('ingles');
    expect(eventoSinSitio([evento({})], 'la clase de inglés')).toBeNull();
  });
});
