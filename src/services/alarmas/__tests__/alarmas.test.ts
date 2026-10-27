import { describe, expect, it } from '@jest/globals';

import type { Adelantos, AjustesAlarmas, Alarma } from '@/data/alarmas';
import type { AjustesAvisos } from '@/data/avisos';
import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import type { Salida } from '@/data/salidas';
import {
  adelantoDe,
  adelantoMinutos,
  alarmasDeSalida,
  citasParaAlarma,
  destinoInteligente,
  diaDeUnaVez,
  eventosConAlarmaVigentes,
  minutoDormir,
  motivoAdelanto,
  proximaVez,
  textoCuando,
  textoDias,
  unaVezPasadas,
  unaVezPendiente,
  vecesDeAlarma,
} from '@/services/alarmas/calculo';
import { definicionesNativas, diferencias, firma } from '@/services/alarmas/definiciones';
import { MAX_AVISOS, planificarAvisos } from '@/services/avisos/planificar';

// Jueves 24 de septiembre de 2026 a las 06:00
const ahora = new Date(2026, 8, 24, 6, 0);

const perfil: Perfil = {
  nombre: 'Ana',
  vivienda: { direccion: 'Zaragoza', coordenadas: { latitud: 41.65, longitud: -0.88 } },
  sitios: [{ id: 't', nombre: 'Trabajo', direccion: 'Calle Mayor 1', coordenadas: { latitud: 41.6, longitud: -0.9 } }],
  transporte: 'coche',
  uso: 'ambos',
  horario: {
    levantarse: '07:00',
    acostarse: '23:30',
    empiezoTrabajo: '09:00',
    terminoTrabajo: '18:00',
    diasTrabajo: [0, 1, 2, 3, 4],
  },
  rindeMas: 'manana',
  antelacionAvisoMin: 30,
};

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

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: 'e1',
    titulo: 'Reunión con Laura',
    fecha: '2026-09-24',
    horaInicio: '10:00',
    horaFin: '11:00',
    tipo: 'cliente',
    lugar: { tipo: 'sitio', sitioId: 't' },
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

function salida(parcial: Partial<Salida>): Salida {
  return {
    clave: 'e1:2026-09-24',
    eventoId: 'e1',
    dia: '2026-09-24',
    titulo: 'Reunión con Laura',
    lugar: 'Trabajo',
    llegada: new Date(2026, 8, 24, 10, 0).toISOString(),
    salida: new Date(2026, 8, 24, 9, 35).toISOString(),
    duracionSeg: 20 * 60,
    retrasoSeg: 0,
    modo: 'coche',
    calculadaEl: ahora.toISOString(),
    origen: [41.65, -0.88],
    ...parcial,
  };
}

const hora = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('próxima alarma por días', () => {
  it('suena hoy si su hora no ha pasado y es uno de sus días', () => {
    const vez = proximaVez(alarma({}), ahora);
    expect(vez?.dia).toBe('2026-09-24');
    expect(hora(vez!.cuando)).toBe('07:30');
  });

  it('salta al siguiente día que toca', () => {
    // Jueves a las 08:00: la de lunes a viernes suena el viernes.
    expect(proximaVez(alarma({}), new Date(2026, 8, 24, 8, 0))?.dia).toBe('2026-09-25');
    // Solo los lunes: el lunes 28.
    expect(proximaVez(alarma({ dias: [0] }), ahora)?.dia).toBe('2026-09-28');
    // El viernes por la noche, la de lunes a viernes salta al lunes.
    expect(proximaVez(alarma({}), new Date(2026, 8, 25, 22, 0))?.dia).toBe('2026-09-28');
  });

  it('apagada no suena', () => {
    expect(proximaVez(alarma({ activada: false }), ahora)).toBeNull();
  });

  it('una sola vez: el día elegido y luego se apaga', () => {
    expect(diaDeUnaVez('07:30', ahora)).toBe('2026-09-24');
    expect(diaDeUnaVez('05:00', ahora)).toBe('2026-09-25');
    const unaVez = alarma({ dias: [], unaVezEl: '2026-09-25' });
    expect(vecesDeAlarma(unaVez, ahora, 7).map((v) => v.dia)).toEqual(['2026-09-25']);
    expect(unaVezPasadas([unaVez], ahora)).toEqual([]);
    expect(unaVezPasadas([unaVez], new Date(2026, 8, 25, 7, 31))).toEqual(['a1']);
  });

  it('un día concreto, aunque sea dentro de semanas', () => {
    const lejos = alarma({ dias: [], unaVezEl: '2026-10-15', hora: '08:00' });
    expect(unaVezPendiente(lejos, ahora)).toBe(true);
    expect(unaVezPendiente(lejos, new Date(2026, 9, 15, 8, 0))).toBe(false);
    expect(unaVezPasadas([lejos], ahora)).toEqual([]);
    // Entra en los avisos cuando le quedan menos de 7 días.
    expect(vecesDeAlarma(lejos, ahora, 7)).toEqual([]);
    expect(vecesDeAlarma(lejos, new Date(2026, 9, 10, 9, 0), 7).map((v) => v.dia)).toEqual(['2026-10-15']);
  });

  it('cuándo suena, en la lista', () => {
    expect(textoCuando(alarma({}), ahora)).toBe('De lunes a viernes');
    expect(textoCuando(alarma({ dias: [], unaVezEl: '2026-09-24' }), ahora)).toBe('Hoy');
    expect(textoCuando(alarma({ dias: [], unaVezEl: '2026-09-25' }), ahora)).toBe('Mañana');
    expect(textoCuando(alarma({ dias: [], unaVezEl: '2026-09-27' }), ahora)).toBe('Domingo 27 sept');
    expect(textoCuando(alarma({ dias: [], unaVezEl: '2026-09-20' }), ahora)).toBe('Una vez');
  });

  it('textos de los días', () => {
    expect(textoDias([0, 1, 2, 3, 4])).toBe('De lunes a viernes');
    expect(textoDias([5, 6])).toBe('Fines de semana');
    expect(textoDias([0, 1, 2, 3, 4, 5, 6])).toBe('Todos los días');
    expect(textoDias([])).toBe('Una vez');
    expect(textoDias([2])).toBe('Los miércoles');
    expect(textoDias([4, 0, 2])).toBe('lun, mié y vie');
  });
});

describe('alarma inteligente', () => {
  it('se adelanta lo que añade el tráfico, redondeado a 5 min y con límite', () => {
    expect(adelantoMinutos(0, 20)).toBe(0);
    expect(adelantoMinutos(4 * 60, 20)).toBe(0); // menos de 5 min: nada
    expect(adelantoMinutos(12 * 60, 20)).toBe(15);
    expect(adelantoMinutos(40 * 60, 20)).toBe(20); // nunca más que el máximo
    expect(adelantoMinutos(40 * 60, 45)).toBe(40);
  });

  it('sin datos de tráfico suena a su hora; con datos, antes (nunca después)', () => {
    const inteligente = alarma({ tipo: 'inteligente', adelantoMaxMin: 20 });
    expect(hora(proximaVez(inteligente, ahora)!.cuando)).toBe('07:30');
    const adelantos: Adelantos = {
      'a1:2026-09-24': {
        clave: 'a1:2026-09-24',
        alarmaId: 'a1',
        dia: '2026-09-24',
        minutos: 15,
        retrasoMin: 14,
        destino: 'el trabajo',
        calculadoEl: ahora.toISOString(),
      },
    };
    const vez = proximaVez(inteligente, ahora, adelantos)!;
    expect(hora(vez.cuando)).toBe('07:15');
    expect(hora(vez.normal)).toBe('07:30');
    // Si después se baja el máximo, se respeta el nuevo.
    expect(adelantoDe({ ...inteligente, adelantoMaxMin: 10 }, '2026-09-24', adelantos)).toBe(10);
    // Un despertador normal nunca se adelanta.
    expect(adelantoDe(alarma({}), '2026-09-24', adelantos)).toBe(0);
  });

  it('dice el motivo', () => {
    expect(motivoAdelanto(15, 'el trabajo')).toBe('Hoy suena 15 min antes: hay atasco camino del trabajo');
    expect(motivoAdelanto(10, 'Reunión con Laura', 'mañana')).toBe(
      'Mañana suena 10 min antes: hay atasco camino de Reunión con Laura',
    );
  });

  it('va hacia la primera cita con lugar o, si no hay, al trabajo', () => {
    const cita = destinoInteligente([evento({})], perfil, '2026-09-24', 7 * 60 + 30);
    expect(cita?.nombre).toBe('Reunión con Laura');
    expect(hora(cita!.llegada)).toBe('10:00');
    const trabajo = destinoInteligente([], perfil, '2026-09-24', 7 * 60 + 30);
    expect(trabajo?.nombre).toBe('el trabajo');
    expect(hora(trabajo!.llegada)).toBe('09:00');
    // Sábado sin citas: a ningún sitio.
    expect(destinoInteligente([], perfil, '2026-09-26', 7 * 60 + 30)).toBeNull();
  });
});

describe('hora de dormir', () => {
  it('30 min antes de acostarse (o lo que se elija)', () => {
    expect(minutoDormir(perfil, 30)).toBe(23 * 60);
    expect(minutoDormir(perfil, 60)).toBe(22 * 60 + 30);
  });

  it('si te acuestas después de medianoche, cae de madrugada', () => {
    const trasnochador = { ...perfil, horario: { ...perfil.horario, acostarse: '00:30' } };
    expect(minutoDormir(trasnochador, 30)).toBe(24 * 60);
  });

  it('se programa como aviso solo si está encendido', () => {
    const base = {
      ahora,
      eventos: [],
      perfil,
      ajustes: AJUSTES_AVISOS,
    };
    const con = (dormir: boolean) =>
      planificarAvisos({ ...base, alarmas: contextoAlarmas([], { dormir }, false) }, 1).filter(
        (a) => a.tipo === 'dormir',
      );
    expect(con(false)).toEqual([]);
    expect(con(true).map((a) => hora(a.cuando))).toEqual(['23:00']);
  });
});

describe('alarma de salida', () => {
  it('suena a la hora de salir y se mueve si cambia el evento', () => {
    const antes = alarmasDeSalida([salida({})], ['e1'], ahora);
    expect(hora(new Date(antes[0].salida))).toBe('09:35');
    // El evento pasa a las 11:00: la fase 6 recalcula la salida y la alarma la sigue.
    const despues = alarmasDeSalida([salida({ salida: new Date(2026, 8, 24, 10, 35).toISOString() })], ['e1'], ahora);
    expect(hora(new Date(despues[0].salida))).toBe('10:35');
  });

  it('solo las de eventos con la alarma encendida y que no han pasado', () => {
    expect(alarmasDeSalida([salida({})], [], ahora)).toEqual([]);
    expect(alarmasDeSalida([salida({})], ['e1'], new Date(2026, 8, 24, 9, 40))).toEqual([]);
  });

  it('se olvida de los eventos borrados o sin lugar', () => {
    expect(eventosConAlarmaVigentes(['e1', 'e2'], [evento({})])).toEqual(['e1']);
    expect(eventosConAlarmaVigentes(['e1'], [evento({ lugar: null })])).toEqual([]);
  });

  it('en Expo Go sustituye al "Sal ya" de esa cita, con sus botones', () => {
    const avisos = planificarAvisos(
      {
        ahora,
        eventos: [evento({})],
        perfil,
        ajustes: AJUSTES_AVISOS,
        salidas: [salida({})],
        alarmas: contextoAlarmas([], { salidas: ['e1'] }, true),
      },
      1,
    );
    expect(avisos.filter((a) => a.tipo === 'salida')).toEqual([]);
    const alarmaSalida = avisos.find((a) => a.tipo === 'alarma-salida');
    expect(alarmaSalida?.categoria).toBe('alarma-salida');
    expect(hora(alarmaSalida!.cuando)).toBe('09:35');
  });

  it('la pestaña ofrece las próximas citas con lugar, una por evento', () => {
    const cada = evento({ repeticion: 'diaria' });
    const citas = citasParaAlarma([cada, evento({ id: 'e2', lugar: null })], perfil, ahora);
    expect(citas.map((c) => c.clave)).toEqual(['e1:2026-09-24']);
  });
});

describe('avisos de alarmas (Expo Go)', () => {
  it('las alarmas se reservan su sitio aunque haya muchos avisos', () => {
    // 80 eventos hoy con aviso: sin reserva, la alarma de dentro de 3 días quedaría fuera.
    const muchos = Array.from({ length: 80 }, (_, i) =>
      evento({ id: `m${i}`, lugar: null, horaInicio: '12:00', horaFin: '12:30', titulo: `Cosa ${i}` }),
    );
    const avisos = planificarAvisos(
      {
        ahora,
        eventos: muchos,
        perfil,
        ajustes: AJUSTES_AVISOS,
        alarmas: contextoAlarmas([alarma({ dias: [6] })], {}, true), // domingo
      },
      7,
    );
    expect(avisos.length).toBe(MAX_AVISOS);
    expect(avisos.some((a) => a.tipo === 'alarma' && a.dia === '2026-09-27')).toBe(true);
  });

  it('en la app propia no se duplican como avisos', () => {
    const avisos = planificarAvisos(
      { ahora, eventos: [], perfil, ajustes: AJUSTES_AVISOS, alarmas: contextoAlarmas([alarma({})], {}, false) },
      1,
    );
    expect(avisos.filter((a) => a.tipo === 'alarma')).toEqual([]);
  });
});

describe('alarmas de verdad (app propia)', () => {
  it('despertador: una semanal con sus días (1 = lunes)', () => {
    const defs = definicionesNativas(ctxNativo([alarma({})]));
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({ clave: 'alarma:a1', hora: 7, minuto: 30, diasIso: [1, 2, 3, 4, 5] });
  });

  it('inteligente: una por día, y solo la próxima se adelanta', () => {
    const adelantos: Adelantos = {
      'a1:2026-09-24': {
        clave: 'a1:2026-09-24',
        alarmaId: 'a1',
        dia: '2026-09-24',
        minutos: 15,
        retrasoMin: 15,
        destino: 'el trabajo',
        calculadoEl: ahora.toISOString(),
      },
    };
    const defs = definicionesNativas({ ...ctxNativo([alarma({ tipo: 'inteligente' })]), adelantos });
    expect(defs).toHaveLength(5);
    const jueves = defs.find((d) => d.clave === 'alarma:a1:3');
    const viernes = defs.find((d) => d.clave === 'alarma:a1:4');
    expect([jueves?.hora, jueves?.minuto, jueves?.diasIso]).toEqual([7, 15, [4]]);
    expect([viernes?.hora, viernes?.minuto]).toEqual([7, 30]);
  });

  it('un día concreto: semanal de ese día solo cuando falta menos de una semana', () => {
    // Jueves 24 a las 06:00. El miércoles 30 a las 08:00: semanal de los miércoles (3).
    const pronto = definicionesNativas(ctxNativo([alarma({ dias: [], unaVezEl: '2026-09-30', hora: '08:00' })]));
    expect(pronto[0]).toMatchObject({ clave: 'alarma:a1:una-vez', hora: 8, minuto: 0, diasIso: [3] });
    // El jueves 1 a las 07:00 (7 días y 1 hora): aún no, sonaría hoy antes de tiempo.
    expect(definicionesNativas(ctxNativo([alarma({ dias: [], unaVezEl: '2026-10-01', hora: '07:00' })]))).toEqual([]);
  });

  it('salida: de una vez, a la hora de salir', () => {
    const defs = definicionesNativas({ ...ctxNativo([]), salidas: [salida({})], eventosConAlarma: ['e1'] });
    expect(defs[0]).toMatchObject({ clave: 'salida:e1:2026-09-24', hora: 9, minuto: 35, diasIso: [], tipo: 'salida' });
  });

  it('solo cambia lo distinto: primero crea la nueva y quita la vieja', () => {
    const [def] = definicionesNativas(ctxNativo([alarma({})]));
    const programadas = { [def.clave]: { uuid: 'u1', firma: firma(def) } };
    expect(diferencias(programadas, [def])).toEqual({ crear: [], quitar: [] });
    const cambiada = { ...def, minuto: 45 };
    expect(diferencias(programadas, [cambiada])).toEqual({
      crear: [cambiada],
      quitar: [{ clave: def.clave, uuid: 'u1' }],
    });
    expect(diferencias(programadas, [])).toEqual({ crear: [], quitar: [{ clave: def.clave, uuid: 'u1' }] });
  });
});

// --- Ayudas ---

const AJUSTES_AVISOS: AjustesAvisos = {
  eventos: true,
  resumenManana: false,
  cierreDia: false,
  cierreSinPendientes: 'nada',
  salida: true,
  plazosCorreo: false,
};

function contextoAlarmas(lista: Alarma[], ajustes: Partial<AjustesAlarmas>, comoAvisos: boolean) {
  return {
    lista,
    ajustes: { dormir: false, dormirAntesMin: 30, salidas: [], ...ajustes },
    adelantos: {},
    comoAvisos,
  };
}

function ctxNativo(alarmas: Alarma[]) {
  return { ahora, alarmas, adelantos: {}, salidas: [], eventosConAlarma: [] };
}
