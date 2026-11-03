import { describe, expect, it, jest } from '@jest/globals';

import { buscarCandidatos, etiquetaSitio, ordenarPorCercania } from '@/services/lugares';
import { buscarSitios } from '@/services/rutas';
import { ubicacionActual } from '@/services/ubicacion';

jest.mock('@/data/perfil', () => ({}));
jest.mock('@/services/rutas', () => ({ buscarSitios: jest.fn() }));
jest.mock('@/services/ubicacion', () => ({ ubicacionActual: jest.fn(async () => null) }));
// En las pruebas va como en el móvil: el buscador del teléfono.
jest.mock('expo-location', () => ({ geocodeAsync: async () => [{ latitude: 40.1, longitude: -3.2 }] }));

const gym = { id: 'a', nombre: 'Basic-Fit', direccion: 'Calle de la Montera 41', punto: [40.42, -3.7] as [number, number] };
const sitios = buscarSitios as jest.MockedFunction<typeof buscarSitios>;
const aqui = ubicacionActual as jest.MockedFunction<typeof ubicacionActual>;

describe('¿Es aquí?: buscar sitios por su nombre', () => {
  it('da todos los de TomTom, el mejor primero', async () => {
    sitios.mockResolvedValueOnce({ estado: 'ok', sitios: [gym, { ...gym, id: 'b' }] });
    const r = await buscarCandidatos('basic fit', { latitud: 40.4, longitud: -3.7 });
    expect(r.estado === 'ok' && r.sitios.map((s) => s.id)).toEqual(['a', 'b']);
    expect(sitios).toHaveBeenLastCalledWith('basic fit', [40.4, -3.7]);
  });

  it('sin TomTom, el buscador de siempre en un solo resultado', async () => {
    sitios.mockResolvedValueOnce({ estado: 'sin-servidor' });
    const r = await buscarCandidatos('Calle Mayor 5', null);
    expect(r).toEqual({
      estado: 'ok',
      sitios: [{ id: 'unico', nombre: 'Calle Mayor 5', direccion: 'Calle Mayor 5', punto: [40.1, -3.2] }],
    });
  });

  it('el nombre del negocio va delante de su dirección', () => {
    expect(etiquetaSitio(gym)).toBe('Basic-Fit, Calle de la Montera 41');
    expect(etiquetaSitio({ ...gym, nombre: gym.direccion })).toBe('Calle de la Montera 41');
  });

  it('si sabe dónde estás, busca ahí y no en casa', async () => {
    aqui.mockResolvedValueOnce([41.39, 2.17]);
    sitios.mockResolvedValueOnce({ estado: 'ok', sitios: [gym] });
    await buscarCandidatos('basic fit', { latitud: 40.4, longitud: -3.7 });
    expect(sitios).toHaveBeenLastCalledWith('basic fit', [41.39, 2.17]);
  });

  it('primero lo que encaja con todas las palabras y, entre eso, lo más cercano', () => {
    const lejos = { ...gym, id: 'lejos', punto: [40.5, -3.6] as [number, number] };
    const cerca = { ...gym, id: 'cerca', direccion: 'Calle de Alcalá 3', punto: [40.421, -3.701] as [number, number] };
    const otro = { ...gym, id: 'otro', nombre: 'Gimnasio', direccion: 'Calle Mayor', punto: [40.42, -3.7] as [number, number] };
    expect(ordenarPorCercania([lejos, otro, cerca], 'el basic fit', [40.42, -3.7]).map((s) => s.id)).toEqual(['cerca', 'lejos', 'otro']);
    expect(ordenarPorCercania([lejos, cerca], 'basic fit montera', [40.42, -3.7]).map((s) => s.id)).toEqual(['lejos', 'cerca']);
    expect(ordenarPorCercania([lejos, cerca], 'basic fit', null)).toEqual([lejos, cerca]);
  });
});
