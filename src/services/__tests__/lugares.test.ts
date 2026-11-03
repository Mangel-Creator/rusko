import { describe, expect, it, jest } from '@jest/globals';

import { buscarCandidatos, etiquetaSitio } from '@/services/lugares';
import { buscarSitios } from '@/services/rutas';

jest.mock('@/data/perfil', () => ({}));
jest.mock('@/services/rutas', () => ({ buscarSitios: jest.fn() }));
// En las pruebas va como en el móvil: el buscador del teléfono.
jest.mock('expo-location', () => ({ geocodeAsync: async () => [{ latitude: 40.1, longitude: -3.2 }] }));

const gym = { id: 'a', nombre: 'Basic-Fit', direccion: 'Calle de la Montera 41', punto: [40.42, -3.7] as [number, number] };
const sitios = buscarSitios as jest.MockedFunction<typeof buscarSitios>;

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
});
