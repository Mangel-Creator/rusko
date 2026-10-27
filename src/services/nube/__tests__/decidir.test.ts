import { describe, expect, it } from '@jest/globals';

import type { CopiaSeguridad } from '@/services/copia/formato';
import { copiaVacia, decidir, ESTADO_INICIAL, huellaCopia, type EstadoNube } from '@/services/nube/decidir';

const copia = (cambios: Partial<CopiaSeguridad> = {}): CopiaSeguridad => ({
  app: 'organizy',
  formato: 1,
  creadaEl: '2026-10-27T10:00:00.000Z',
  eventos: [],
  epocas: [],
  registroBloques: [],
  ajustes: { bienvenidaCompletada: true, perfil: { nombre: 'Miguel', horario: { levantarse: '07:00' } } },
  ...cambios,
});

const sincronizado: EstadoNube = {
  ...ESTADO_INICIAL,
  base: 'aaa',
  version: '2026-10-27T10:00:00+00:00',
  ultimaVez: '2026-10-27T10:00:00.000Z',
};
const remota = (cambios: Partial<{ actualizada: string; huella: string }> = {}) => ({
  actualizada: '2026-10-27T10:00:00+00:00',
  huella: 'aaa',
  dispositivo: 'otro',
  ...cambios,
});

describe('huellaCopia', () => {
  it('no cambia con el orden de las claves ni con la hora de la copia', () => {
    const una = copia();
    const otra = copia({
      creadaEl: '2026-10-28T08:00:00.000Z',
      ajustes: { perfil: { horario: { levantarse: '07:00' }, nombre: 'Miguel' }, bienvenidaCompletada: true },
    });
    expect(huellaCopia(una)).toBe(huellaCopia(otra));
  });

  it('cambia si cambia algo de verdad', () => {
    expect(huellaCopia(copia())).not.toBe(
      huellaCopia(copia({ ajustes: { bienvenidaCompletada: true, perfil: { nombre: 'Miguel Ángel' } } })),
    );
  });

  it('un campo sin valor cuenta como si no estuviera', () => {
    expect(huellaCopia(copia({ ajustes: { bienvenidaCompletada: true, x: undefined } }))).toBe(
      huellaCopia(copia({ ajustes: { bienvenidaCompletada: true } })),
    );
  });
});

describe('copiaVacia', () => {
  it('sin bienvenida ni eventos, está vacía', () => {
    expect(copiaVacia(copia({ ajustes: {} }))).toBe(true);
    expect(copiaVacia(copia())).toBe(false);
  });
});

describe('decidir', () => {
  const local = (huella: string, vacia = false) => ({ huella, vacia });

  it('sin nada en la nube, sube lo de aquí (si hay algo)', () => {
    expect(decidir(ESTADO_INICIAL, local('aaa'), null)).toBe('subir');
    expect(decidir(ESTADO_INICIAL, local('aaa', true), null)).toBe('nada');
  });

  it('todo igual: nada', () => {
    expect(decidir(sincronizado, local('aaa'), remota())).toBe('nada');
  });

  it('cambios aquí y la nube como la dejé: sube', () => {
    expect(decidir(sincronizado, local('bbb'), remota())).toBe('subir');
  });

  it('la nube tiene algo nuevo y aquí no hay cambios: lo trae', () => {
    expect(decidir(sincronizado, local('aaa'), remota({ actualizada: '2026-10-27T11:00:00+00:00', huella: 'ccc' }))).toBe(
      'traer',
    );
  });

  it('cambios en los dos sitios: gana el último', () => {
    const nube = remota({ actualizada: '2026-10-27T11:00:00+00:00', huella: 'ccc' });
    expect(decidir({ ...sincronizado, cambioEl: '2026-10-27T11:30:00.000Z' }, local('bbb'), nube)).toBe('subir');
    expect(decidir({ ...sincronizado, cambioEl: '2026-10-27T10:30:00.000Z' }, local('bbb'), nube)).toBe('traer');
  });

  it('sin hora del cambio no se sube a ciegas: se trae lo de la nube', () => {
    const nube = remota({ actualizada: '2026-10-27T11:00:00+00:00', huella: 'ccc' });
    expect(decidir(sincronizado, local('bbb'), nube)).toBe('traer');
  });

  it('si ya son iguales, solo apunta la versión', () => {
    expect(decidir(sincronizado, local('ccc'), remota({ actualizada: '2026-10-27T11:00:00+00:00', huella: 'ccc' }))).toBe(
      'adoptar',
    );
  });

  it('la primera vez con datos distintos pregunta; vacío, trae sin preguntar', () => {
    expect(decidir(ESTADO_INICIAL, local('bbb'), remota())).toBe('elegir');
    expect(decidir(ESTADO_INICIAL, local('vacio', true), remota())).toBe('traer');
  });

  it('recién traída una copia, lo de aquí es la base aunque la huella no coincida', () => {
    const recien: EstadoNube = { ...sincronizado, base: null, rebase: true };
    expect(decidir(recien, local('ddd'), remota())).toBe('nada');
  });
});
