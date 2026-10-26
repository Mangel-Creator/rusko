import { describe, expect, it } from '@jest/globals';

import type { AjustesAvisos } from '@/data/avisos';
import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import type { Salida } from '@/data/salidas';
import {
  FRASE_BUENAS_NOCHES,
  FRASE_DIA_JUSTO,
  MAX_AVISOS,
  avisoDeHoy,
  horaCierre,
  listaTareas,
  planificarAvisos,
  textoAntelacion,
  textoAvisoSalida,
  textoCierre,
} from '@/services/avisos/planificar';

// Los mismos que data/avisos.ts (no se importa porque usa AsyncStorage).
const AJUSTES_AVISOS_POR_DEFECTO: AjustesAvisos = {
  eventos: true,
  resumenManana: true,
  cierreDia: true,
  cierreSinPendientes: 'buenas-noches',
  salida: true,
  plazosCorreo: true,
};

const perfil: Perfil = {
  nombre: 'Ana',
  vivienda: { direccion: 'Zaragoza', coordenadas: null },
  sitios: [{ id: 's1', nombre: 'Oficina', direccion: 'Calle Mayor 1', coordenadas: null }],
  transporte: 'coche',
  uso: 'ambos',
  horario: {
    levantarse: '07:30',
    acostarse: '23:30',
    empiezoTrabajo: '09:00',
    terminoTrabajo: '18:00',
    diasTrabajo: [0, 1, 2, 3, 4],
  },
  rindeMas: 'manana',
  antelacionAvisoMin: 30,
};

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: Math.random().toString(36).slice(2),
    titulo: 'Evento',
    fecha: '2026-09-24',
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

const tarea = (titulo: string, fecha = '2026-09-24') =>
  evento({ titulo, fecha, flexible: true, horaInicio: null, horaFin: null, duracionMin: 30 });

// Jueves 24 de septiembre de 2026 a las 06:00
const ahora = new Date(2026, 8, 24, 6, 0);

function planificar(eventos: Evento[], ajustes: Partial<AjustesAvisos> = {}, cuando = ahora, dias = 1) {
  return planificarAvisos(
    { ahora: cuando, eventos, perfil, ajustes: { ...AJUSTES_AVISOS_POR_DEFECTO, ...ajustes } },
    dias,
  );
}

const hora = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('aviso antes de cada evento', () => {
  it('usa la antelación del perfil y dice el lugar', () => {
    const reunion = evento({
      id: 'r1',
      titulo: 'Reunión con Laura',
      lugar: { tipo: 'sitio', sitioId: 's1' },
    });
    const [aviso] = planificar([reunion], { resumenManana: false, cierreDia: false });
    expect(aviso.id).toBe('evento:r1:2026-09-24');
    expect(hora(aviso.cuando)).toBe('09:30');
    expect(aviso.titulo).toBe('En 30 min: Reunión con Laura en Oficina');
    expect(aviso.cuerpo).toBe('10:00 – 11:00');
    expect(aviso.destino).toEqual({ pantalla: 'evento', id: 'r1' });
  });

  it('dice "casa" o la dirección escrita a mano', () => {
    const avisos = planificar(
      [
        evento({ titulo: 'Cena', horaInicio: '21:00', horaFin: '22:00', lugar: { tipo: 'casa' } }),
        evento({ titulo: 'Médico', lugar: { tipo: 'otro', direccion: 'Calle Sol 3', coordenadas: null } }),
      ],
      { resumenManana: false, cierreDia: false },
    );
    expect(avisos.map((a) => a.titulo)).toEqual(['En 30 min: Médico en Calle Sol 3', 'En 30 min: Cena en casa']);
  });

  it('respeta la antelación propia del evento y "sin aviso"', () => {
    const avisos = planificar(
      [evento({ titulo: 'A', avisoMin: 10 }), evento({ titulo: 'B', avisoMin: 0 })],
      { resumenManana: false, cierreDia: false },
    );
    expect(avisos).toHaveLength(1);
    expect(hora(avisos[0].cuando)).toBe('09:50');
    expect(avisos[0].titulo).toBe('En 10 min: A');
  });

  it('no avisa de tareas flexibles ni de lo que ya ha pasado', () => {
    const avisos = planificar([tarea('Llamar'), evento({ horaInicio: '06:10', horaFin: '07:00' })], {
      resumenManana: false,
      cierreDia: false,
    });
    expect(avisos).toHaveLength(0); // 06:10 - 30 min = 05:40, ya pasó
  });

  it('avisa en cada repetición', () => {
    const diario = evento({ id: 'd', repeticion: 'diaria' });
    const avisos = planificar([diario], { resumenManana: false, cierreDia: false }, ahora, 3);
    expect(avisos.map((a) => a.id)).toEqual(['evento:d:2026-09-24', 'evento:d:2026-09-25', 'evento:d:2026-09-26']);
  });

  it('se puede apagar', () => {
    expect(planificar([evento({})], { eventos: false, resumenManana: false, cierreDia: false })).toHaveLength(0);
  });
});

describe('resumen de la mañana', () => {
  it('llega al levantarse con la frase de Hoy', () => {
    const avisos = planificar([evento({ tipo: 'cliente' })], { eventos: false, cierreDia: false });
    expect(avisos).toHaveLength(1);
    expect(hora(avisos[0].cuando)).toBe('07:30');
    expect(avisos[0].titulo).toBe('¿Qué toca hoy, Ana?');
    expect(avisos[0].cuerpo).toMatch(/^Tienes un cliente\./);
    expect(avisos[0].cuerpo).not.toContain(FRASE_DIA_JUSTO);
  });

  it('avisa si el día va muy cargado', () => {
    const lleno = evento({ horaInicio: '09:00', horaFin: '17:00' }); // 8 h de 9 h de jornada
    const [aviso] = planificar([lleno], { eventos: false, cierreDia: false });
    expect(aviso.cuerpo).toContain(FRASE_DIA_JUSTO);
  });
});

describe('cierre del día', () => {
  it('una hora antes de acostarse, con las tareas pendientes y botones', () => {
    const avisos = planificar([tarea('Llamar al taller'), tarea('Comprar pan')], {
      eventos: false,
      resumenManana: false,
    });
    expect(avisos).toHaveLength(1);
    expect(hora(avisos[0].cuando)).toBe('22:30');
    expect(avisos[0].cuerpo).toBe('Te quedaron 2 cosas: Llamar al taller y Comprar pan. ¿Las paso a mañana?');
    expect(avisos[0].categoria).toBe('cierre-dia');
    expect(avisos[0].dia).toBe('2026-09-24');
  });

  it('sin pendientes: buenas noches o nada', () => {
    const [aviso] = planificar([tarea('Hecha')].map((t) => ({ ...t, hecha: true })), {
      eventos: false,
      resumenManana: false,
    });
    expect(aviso.titulo).toBe('Buenas noches, Ana');
    expect(aviso.cuerpo).toBe(FRASE_BUENAS_NOCHES);
    expect(aviso.categoria).toBeUndefined();
    expect(planificar([], { eventos: false, resumenManana: false, cierreSinPendientes: 'nada' })).toHaveLength(0);
  });

  it('si te acuestas después de medianoche, cae de madrugada y no se pierde', () => {
    const trasnochador = { ...perfil, horario: { ...perfil.horario, acostarse: '01:30' } };
    expect(horaCierre(trasnochador)).toBe('00:30');
    // Son las 00:10 del día 25: el cierre del 24 todavía no ha llegado.
    const avisos = planificarAvisos(
      {
        ahora: new Date(2026, 8, 25, 0, 10),
        eventos: [],
        perfil: trasnochador,
        ajustes: { ...AJUSTES_AVISOS_POR_DEFECTO, eventos: false, resumenManana: false },
      },
      1,
    );
    expect(avisos[0].id).toBe('cierre-dia:2026-09-24');
    expect(avisos[0].cuando).toEqual(new Date(2026, 8, 25, 0, 30));
  });
});

describe('avisos de prueba', () => {
  it('el cierre de hoy aunque sea de día y con los botones', () => {
    const mediodia = new Date(2026, 8, 24, 12, 0);
    const ctx = { ahora: mediodia, eventos: [tarea('Llamar')], perfil, ajustes: AJUSTES_AVISOS_POR_DEFECTO };
    const cierre = avisoDeHoy('cierre-dia', ctx);
    expect(cierre.categoria).toBe('cierre-dia');
    expect(cierre.dia).toBe('2026-09-24');
    expect(avisoDeHoy('resumen-manana', ctx).cuerpo).toMatch(/^Tienes una tarea\./);
    // Sin pendientes y con "No avisar", la prueba da las buenas noches igualmente.
    const vacio = { ...ctx, eventos: [], ajustes: { ...AJUSTES_AVISOS_POR_DEFECTO, cierreSinPendientes: 'nada' as const } };
    expect(avisoDeHoy('cierre-dia', vacio).cuerpo).toBe(FRASE_BUENAS_NOCHES);
  });
});

describe('límite de iOS', () => {
  it('como mucho MAX_AVISOS, los más cercanos primero', () => {
    const muchos = Array.from({ length: 40 }, (_, i) =>
      evento({ id: `e${i}`, repeticion: 'diaria', horaInicio: '12:00', horaFin: '12:30' }),
    );
    const avisos = planificar(muchos, {}, ahora, 7);
    expect(avisos).toHaveLength(MAX_AVISOS);
    for (let i = 1; i < avisos.length; i++) {
      expect(avisos[i].cuando.getTime()).toBeGreaterThanOrEqual(avisos[i - 1].cuando.getTime());
    }
  });
});

describe('textos', () => {
  it('antelación', () => {
    expect(textoAntelacion(10)).toBe('En 10 min');
    expect(textoAntelacion(60)).toBe('En 1 hora');
  });

  it('lista y singular', () => {
    expect(textoCierre(['Llamar'])).toBe('Te quedó 1 cosa: Llamar. ¿La paso a mañana?');
    expect(listaTareas(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c y 2 más');
  });
});

describe('Sal ya (fase 6)', () => {
  const salida: Salida = {
    clave: 'e1:2026-09-24',
    eventoId: 'e1',
    dia: '2026-09-24',
    titulo: 'Reunión con Laura',
    lugar: 'Oficina',
    llegada: new Date(2026, 8, 24, 10, 30).toISOString(),
    salida: new Date(2026, 8, 24, 10, 7).toISOString(),
    duracionSeg: 18 * 60,
    retrasoSeg: 240,
    modo: 'coche',
    calculadaEl: ahora.toISOString(),
    origen: [41.65, -0.88],
  };

  it('avisa a la hora de salir, con el botón de retraso y abriendo la ruta', () => {
    const avisos = planificarAvisos(
      { ahora, eventos: [], perfil, ajustes: AJUSTES_AVISOS_POR_DEFECTO, salidas: [salida] },
      1,
    ).filter((a) => a.tipo === 'salida');
    expect(avisos).toHaveLength(1);
    expect(hora(avisos[0].cuando)).toBe('10:07');
    expect(avisos[0].titulo).toBe('Sal ya: Reunión con Laura');
    expect(avisos[0].cuerpo).toBe('18 min en coche hasta Oficina para llegar a las 10:30.');
    expect(avisos[0].categoria).toBe('salida');
    expect(avisos[0].destino).toEqual({ pantalla: 'mapa', id: 'e1', dia: '2026-09-24' });
  });

  it('dice con qué app se abre al tocarlo', () => {
    const [aviso] = planificarAvisos(
      { ahora, eventos: [], perfil, ajustes: AJUSTES_AVISOS_POR_DEFECTO, salidas: [salida], navegador: 'Waze' },
      1,
    ).filter((a) => a.tipo === 'salida');
    expect(aviso.cuerpo).toBe('18 min en coche hasta Oficina para llegar a las 10:30. Toca para ir con Waze.');
  });

  it('no avisa si está desactivado o si ya ha pasado la hora', () => {
    const desactivado = planificarAvisos(
      { ahora, eventos: [], perfil, ajustes: { ...AJUSTES_AVISOS_POR_DEFECTO, salida: false }, salidas: [salida] },
      1,
    );
    expect(desactivado.some((a) => a.tipo === 'salida')).toBe(false);
    const tarde = planificarAvisos(
      { ahora: new Date(2026, 8, 24, 10, 20), eventos: [], perfil, ajustes: AJUSTES_AVISOS_POR_DEFECTO, salidas: [salida] },
      1,
    );
    expect(tarde.some((a) => a.tipo === 'salida')).toBe(false);
  });

  it('a pie y en moto', () => {
    expect(textoAvisoSalida({ ...salida, modo: 'a-pie', duracionSeg: 5400 }).cuerpo).toBe(
      '1 h 30 min a pie hasta Oficina para llegar a las 10:30.',
    );
    expect(textoAvisoSalida({ ...salida, modo: 'moto' }).cuerpo).toContain('en moto');
  });

  it('prueba desde Perfil: la próxima salida o una de ejemplo', () => {
    const ctx = { ahora, eventos: [], perfil, ajustes: AJUSTES_AVISOS_POR_DEFECTO };
    expect(avisoDeHoy('salida', { ...ctx, salidas: [salida] }).titulo).toBe('Sal ya: Reunión con Laura');
    const ejemplo = avisoDeHoy('salida', ctx);
    expect(ejemplo.titulo).toBe('Sal ya: Cita de ejemplo');
    expect(ejemplo.destino).toEqual({ pantalla: 'hoy' });
  });
});