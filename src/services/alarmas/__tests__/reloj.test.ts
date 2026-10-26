import { describe, expect, it } from '@jest/globals';

import type { Alarma } from '@/data/alarmas';
import type { Salida } from '@/data/salidas';
import { enlaceEjecutarAtajo, NOMBRE_ATAJO } from '@/services/alarmas/atajo';
import { claveAdelanto } from '@/services/alarmas/calculo';
import { alarmasParaReloj, DIAS_RELOJ } from '@/services/alarmas/reloj';
import { urlDeDestino } from '@/services/avisos/destinos';

// Jueves 24 de septiembre de 2026 a las 06:00
const ahora = new Date(2026, 8, 24, 6, 0);

function alarma(parcial: Partial<Alarma>): Alarma {
  return {
    id: 'a1',
    tipo: 'despertador',
    hora: '07:30',
    dias: [0, 1, 2, 3, 4],
    unaVezEl: null,
    etiqueta: '',
    sonido: 'alarma',
    activada: true,
    adelantoMaxMin: 20,
    ...parcial,
  };
}

const salida: Salida = {
  clave: 'e1:2026-09-24',
  eventoId: 'e1',
  dia: '2026-09-24',
  titulo: 'Dentista',
  lugar: 'Clínica',
  llegada: new Date(2026, 8, 24, 10, 0).toISOString(),
  salida: new Date(2026, 8, 24, 9, 35).toISOString(),
  duracionSeg: 20 * 60,
  retrasoSeg: 0,
  modo: 'coche',
  calculadaEl: ahora.toISOString(),
  origen: [41.65, -0.88],
};

const vacio = { ahora, alarmas: [], adelantos: {}, salidas: [], eventosConAlarma: [] };

describe('alarmasParaReloj', () => {
  it('sube cada vez de las próximas dos semanas con su hora de aquí', () => {
    const lista = alarmasParaReloj({ ...vacio, alarmas: [alarma({})] });
    // De lunes a viernes durante 15 días (hoy incluido): 11 veces.
    expect(lista).toHaveLength(11);
    expect(lista[0]).toEqual({
      cuando: new Date(2026, 8, 24, 7, 30).toISOString(),
      hora: '07:30',
      etiqueta: 'Despertador',
    });
    expect(DIAS_RELOJ).toBe(14);
  });

  it('la inteligente lleva su adelanto en la hora y en el nombre', () => {
    const inteligente = alarma({ tipo: 'inteligente', etiqueta: 'Trabajo' });
    const adelantos = {
      [claveAdelanto('a1', '2026-09-25')]: {
        clave: claveAdelanto('a1', '2026-09-25'),
        alarmaId: 'a1',
        dia: '2026-09-25',
        minutos: 15,
        retrasoMin: 15,
        destino: 'el trabajo',
        calculadoEl: ahora.toISOString(),
      },
    };
    const [hoy, manana] = alarmasParaReloj({ ...vacio, alarmas: [inteligente], adelantos });
    expect(hoy.hora).toBe('07:30');
    expect(manana).toEqual({
      cuando: new Date(2026, 8, 25, 7, 15).toISOString(),
      hora: '07:15',
      etiqueta: 'Trabajo · 15 min antes por el tráfico',
    });
  });

  it('las apagadas y las de una vez ya pasadas no se suben', () => {
    const lista = alarmasParaReloj({
      ...vacio,
      alarmas: [alarma({ activada: false }), alarma({ id: 'a2', dias: [], unaVezEl: '2026-09-23' })],
    });
    expect(lista).toEqual([]);
  });

  it('añade las alarmas de salida y lo ordena todo por hora', () => {
    const lista = alarmasParaReloj({
      ...vacio,
      alarmas: [alarma({ dias: [], unaVezEl: '2026-09-24', etiqueta: 'Una vez' })],
      salidas: [salida, { ...salida, clave: 'e2:2026-09-24', eventoId: 'e2' }],
      eventosConAlarma: ['e1'],
    });
    expect(lista.map((a) => `${a.hora} ${a.etiqueta}`)).toEqual(['07:30 Una vez', '09:35 Sal ya: Dentista']);
  });
});

describe('Atajo del Reloj', () => {
  it('se ejecuta con el enlace oficial de Atajos', () => {
    expect(NOMBRE_ATAJO).toBe('Organizy alarmas');
    expect(enlaceEjecutarAtajo()).toBe('shortcuts://run-shortcut?name=Organizy%20alarmas');
  });
});

describe('urlDeDestino (avisos web)', () => {
  it('lleva a la pantalla de cada aviso', () => {
    expect(urlDeDestino({ pantalla: 'hoy' })).toBe('/');
    expect(urlDeDestino({ pantalla: 'alarmas' })).toBe('/alarmas');
    expect(urlDeDestino({ pantalla: 'resumenes' })).toBe('/resumenes');
    expect(urlDeDestino({ pantalla: 'evento', id: 'cal-a b' })).toBe('/evento?id=cal-a%20b');
    expect(urlDeDestino({ pantalla: 'plan', id: 'p1' })).toBe('/plan?id=p1');
    expect(urlDeDestino({ pantalla: 'mapa', id: 'e1', dia: '2026-09-24' })).toBe('/mapa?evento=e1&dia=2026-09-24');
  });
});
