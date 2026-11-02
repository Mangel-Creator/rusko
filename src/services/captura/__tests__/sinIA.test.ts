import { describe, expect, it } from '@jest/globals';

import { aplicarAprendido, aprenderTipo, claveTitulo, MAX_APRENDIDOS } from '@/services/captura/aprendido';
import { bastaSinIA, entenderLocal } from '@/services/captura/local';

// Lunes 26 de octubre de 2026, a las 10:00.
const ahora = new Date(2026, 9, 26, 10, 0);
const sinIA = (frase: string) => bastaSinIA(frase, entenderLocal(frase, { ahora, perfil: null, eventos: [] }));

describe('bastaSinIA', () => {
  it('lo fácil no pasa por la IA', () => {
    expect(sinIA('mañana padel por la tarde')).toBe(true);
    expect(sinIA('tengo cita del dni el jueves a las 10')).toBe(true);
    expect(sinIA('ponme una alarma mañana a las 7')).toBe(true);
  });

  it('lo dudoso o complicado va a la IA', () => {
    expect(sinIA('cena con Ana')).toBe(false); // sin día ni hora
    expect(sinIA('¿qué tengo mañana?')).toBe(false);
    expect(sinIA('que tengo el jueves')).toBe(false);
    expect(sinIA('gimnasio todos los lunes a las 7')).toBe(false);
    expect(sinIA('dentista mañana a las 10 y avísame 1 hora antes')).toBe(false);
    expect(sinIA('mañana a las 5 reunión con el gestor para revisar la declaración de la renta')).toBe(false);
  });
});

describe('tipos aprendidos', () => {
  it('lo corregido se aplica al mismo título, con o sin tildes', () => {
    const mapa = aprenderTipo({}, 'Pádel con Juan', 'entreno');
    const leido = entenderLocal('mañana padel con juan por la tarde', { ahora, perfil: null, eventos: [] })!;
    const aplicado = aplicarAprendido(leido, mapa);
    expect(aplicado.accion === 'apuntar' && aplicado.propuesta.tipo).toBe('entreno');
  });

  it('no guarda más del máximo y olvida lo más antiguo', () => {
    let mapa = {};
    for (let i = 0; i <= MAX_APRENDIDOS; i++) mapa = aprenderTipo(mapa, `cosa ${i}`, 'yo');
    expect(Object.keys(mapa)).toHaveLength(MAX_APRENDIDOS);
    expect(mapa).not.toHaveProperty(claveTitulo('cosa 0'));
  });
});
