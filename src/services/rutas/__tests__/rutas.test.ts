import { describe, expect, it } from '@jest/globals';

import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { hayQueRecalcular, proximasCitas } from '@/services/rutas/citas';
import { fraseHorasPunta, horasDeAtasco, MINUTOS_MUESTRA, type Muestra } from '@/services/rutas/horasPunta';
import { distanciaM } from '@/services/rutas/distancia';
import {
  enlaceAppleMaps,
  enlaceGoogleMaps,
  enlaceNavegador,
  enlaceWaze,
  navegadorPara,
} from '@/services/rutas/navegador';
import {
  anadirLleno,
  DIAS_RECUERDO,
  ordenarParkings,
  prepararParkings,
  siguienteParking,
  textoAndando,
  textoOcupacion,
  vecesLleno,
  type MarcaLleno,
  type Parking,
} from '@/services/rutas/parkings';
import { enlaceWhatsapp, horaDeSalida, textoDistancia, textoRetraso, textoSalida } from '@/services/rutas/textos';
import { modoDeViaje, type Punto } from '@/services/rutas/tipos';

// Solo las funciones puras: sin servidor ni AsyncStorage.

const perfil: Perfil = {
  nombre: 'Ana',
  vivienda: { direccion: 'Zaragoza', coordenadas: { latitud: 41.65, longitud: -0.88 } },
  sitios: [
    { id: 's1', nombre: 'Oficina', direccion: 'Calle Mayor 1', coordenadas: { latitud: 41.66, longitud: -0.9 } },
    { id: 's2', nombre: 'Gimnasio', direccion: 'Sin coordenadas', coordenadas: null },
  ],
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
    tipo: 'cliente',
    lugar: { tipo: 'sitio', sitioId: 's1' },
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

// Jueves 24 de septiembre de 2026 a las 08:00
const ahora = new Date(2026, 8, 24, 8, 0);

describe('hora de salida', () => {
  it('resta el trayecto y 5 minutos de margen', () => {
    const llegada = new Date(2026, 8, 24, 10, 30);
    const salida = horaDeSalida(llegada, 18 * 60);
    expect(salida.getHours()).toBe(10);
    expect(salida.getMinutes()).toBe(7);
  });

  it('redondea hacia abajo al minuto', () => {
    const salida = horaDeSalida(new Date(2026, 8, 24, 10, 30), 18 * 60 + 20);
    expect(salida.getMinutes()).toBe(6);
  });

  it('frase de Hoy', () => {
    expect(textoSalida(new Date(2026, 8, 24, 10, 5), 18 * 60, 'coche')).toBe('Sal a las 10:05 · 18 min en coche');
    expect(textoSalida(new Date(2026, 8, 24, 9, 0), 3900, 'a-pie')).toBe('Sal a las 09:00 · 1 h 5 min a pie');
  });
});

describe('textos de las rutas', () => {
  it('retraso por tráfico', () => {
    expect(textoRetraso(30)).toBeNull();
    expect(textoRetraso(6 * 60)).toBe('+6 min');
  });

  it('distancia', () => {
    expect(textoDistancia(850)).toBe('850 m');
    expect(textoDistancia(12345)).toBe('12 km');
    expect(textoDistancia(4560)).toBe('4,6 km');
  });

  it('transporte público: no se calcula tráfico', () => {
    expect(modoDeViaje('transporte-publico')).toBeNull();
    expect(modoDeViaje('moto')).toBe('moto');
    expect(modoDeViaje(undefined)).toBe('coche');
  });
});

describe('enlaces', () => {
  const destino: Punto = [41.6488, -0.8891];

  it('Waze navega hasta las coordenadas', () => {
    expect(enlaceWaze(destino)).toBe('https://waze.com/ul?ll=41.648800,-0.889100&navigate=yes');
  });

  it('Google Maps con el medio de transporte', () => {
    expect(enlaceGoogleMaps(destino, 'transporte-publico')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=41.648800,-0.889100&travelmode=transit',
    );
    expect(enlaceGoogleMaps(destino)).toContain('travelmode=driving');
  });

  it('Mapas de Apple con el medio de transporte', () => {
    expect(enlaceAppleMaps(destino)).toBe('https://maps.apple.com/?daddr=41.648800,-0.889100&dirflg=d');
    expect(enlaceAppleMaps(destino, 'a-pie')).toContain('dirflg=w');
  });

  it('abrir siempre con la app elegida', () => {
    expect(enlaceNavegador('waze', destino)).toBe(enlaceWaze(destino));
    expect(enlaceNavegador('apple', destino, 'moto')).toBe(enlaceAppleMaps(destino, 'moto'));
    expect(enlaceNavegador('google', destino)).toBe(enlaceGoogleMaps(destino));
  });

  it('Waze solo en coche o en moto: si no, Google Maps', () => {
    expect(navegadorPara('waze', 'coche')).toBe('waze');
    expect(navegadorPara('waze', 'moto')).toBe('waze');
    expect(navegadorPara('waze', 'a-pie')).toBe('google');
    expect(navegadorPara('waze', 'transporte-publico')).toBe('google');
    expect(navegadorPara('apple', 'a-pie')).toBe('apple');
    expect(enlaceNavegador('waze', destino, 'transporte-publico')).toContain('travelmode=transit');
  });

  it('WhatsApp con el mensaje escrito', () => {
    expect(enlaceWhatsapp()).toBe(
      `https://wa.me/?text=${encodeURIComponent('Voy con unos 10 min de retraso, lo siento')}`,
    );
  });
});

describe('distancia', () => {
  it('en metros, en línea recta', () => {
    // 0,001 grados de latitud son unos 111 m.
    expect(distanciaM([41.65, -0.9], [41.651, -0.9])).toBeCloseTo(111, 0);
  });
});

describe('parkings', () => {
  const destino: Punto = [41.65, -0.88];
  // Jueves 24 de septiembre de 2026, 10:00
  const jueves10 = new Date(2026, 8, 24, 10, 0);
  const parking = (id: string, metros: number): Parking => ({
    id,
    nombre: `Parking ${id}`,
    direccion: '',
    // 0,001 grados de latitud son unos 111 m.
    punto: [destino[0] + metros / 111000, destino[1]],
    tipo: 'garaje',
    distanciaM: metros,
  });
  const lleno = (id: string, fecha: Date): MarcaLleno => ({ id, cuando: fecha.toISOString() });

  it('cuenta las veces que estaba lleno ese tipo de día y a esa hora (±1 h)', () => {
    const llenos = [
      lleno('a', new Date(2026, 8, 22, 10, 30)), // martes 10:30: sí
      lleno('a', new Date(2026, 8, 17, 9, 15)), // jueves 9:15: sí
      lleno('a', new Date(2026, 8, 22, 12, 0)), // martes 12:00: no (2 h después)
      lleno('a', new Date(2026, 8, 19, 10, 0)), // sábado: no
      lleno('b', new Date(2026, 8, 22, 10, 0)), // otro parking: no
    ];
    expect(vecesLleno('a', llenos, jueves10)).toBe(2);
    expect(vecesLleno('a', llenos, new Date(2026, 8, 26, 10, 0))).toBe(1); // sábado
  });

  it('ordena por cercanía, pero el que suele estar lleno baja', () => {
    const lista = [parking('cerca', 100), parking('medio', 300), parking('lejos', 900)];
    expect(ordenarParkings(lista, [], jueves10).map((p) => p.id)).toEqual(['cerca', 'medio', 'lejos']);
    const llenos = [lleno('cerca', new Date(2026, 8, 22, 10, 0))];
    // Una vez lleno pesa 400 m: 100 + 400 > 300.
    expect(ordenarParkings(lista, llenos, jueves10).map((p) => p.id)).toEqual(['medio', 'cerca', 'lejos']);
    // A otra hora no cuenta.
    expect(ordenarParkings(lista, llenos, new Date(2026, 8, 24, 18, 0))[0].id).toBe('cerca');
  });

  it('textos', () => {
    expect(textoOcupacion(0)).toBeNull();
    expect(textoOcupacion(1)).toBe('A veces se llena a esta hora');
    expect(textoOcupacion(3)).toBe('Suele estar lleno a esta hora');
    expect(textoAndando(250)).toBe('3 min andando hasta el sitio');
    expect(textoAndando(10)).toBe('1 min andando hasta el sitio');
  });

  it('el siguiente que no has probado', () => {
    const lista = [parking('a', 100), parking('b', 200), parking('c', 300)];
    expect(siguienteParking(lista, ['a'])?.id).toBe('b');
    expect(siguienteParking(lista, ['a', 'b'])?.id).toBe('c');
    expect(siguienteParking(lista, ['a', 'b', 'c'])).toBeNull();
  });

  it('apuntar que estaba lleno olvida lo muy viejo', () => {
    const viejo = new Date(jueves10.getTime() - (DIAS_RECUERDO + 1) * 24 * 3600 * 1000);
    const llenos = anadirLleno([lleno('a', viejo), lleno('b', new Date(2026, 8, 20))], 'c', jueves10);
    expect(llenos.map((m) => m.id)).toEqual(['b', 'c']);
  });

  it('pone la distancia al destino y quita repetidos', () => {
    const sinDistancia = ({ distanciaM: _, ...resto }: Parking) => resto;
    const a = sinDistancia(parking('a', 222));
    const lista = prepararParkings([a, { ...a, id: 'a-otra-vez' }, sinDistancia(parking('b', 555))], destino);
    expect(lista.map((p) => p.id)).toEqual(['a', 'b']);
    expect(lista[0].distanciaM).toBeCloseTo(222, -1);
  });
});

describe('citas con lugar', () => {
  it('solo las próximas 24 horas, con lugar y coordenadas', () => {
    const citas = proximasCitas(
      [
        evento({ id: 'oficina', horaInicio: '10:30', horaFin: '11:00' }),
        evento({ id: 'pasada', horaInicio: '07:00', horaFin: '07:30' }),
        evento({ id: 'sin-lugar', lugar: null }),
        evento({ id: 'sin-coordenadas', lugar: { tipo: 'sitio', sitioId: 's2' } }),
        evento({ id: 'manana', fecha: '2026-09-25', horaInicio: '07:30', horaFin: '08:00' }),
        evento({ id: 'lejos', fecha: '2026-09-25', horaInicio: '09:00', horaFin: '10:00' }),
        evento({ id: 'foco', foco: true }),
      ],
      perfil,
      ahora,
    );
    expect(citas.map((c) => c.evento.id)).toEqual(['oficina', 'manana']);
    expect(citas[0].lugar).toBe('Oficina');
    expect(citas[0].destino).toEqual([41.66, -0.9]);
    expect(citas[0].clave).toBe('oficina:2026-09-24');
  });

  it('cuándo volver a preguntar al servidor', () => {
    const origen: Punto = [41.65, -0.88];
    const llegada = new Date(2026, 8, 24, 10, 30);
    const anterior = {
      calculadaEl: new Date(2026, 8, 24, 7, 50).toISOString(),
      salida: new Date(2026, 8, 24, 10, 7).toISOString(),
      origen,
      llegada: llegada.toISOString(),
    };
    expect(hayQueRecalcular(undefined, ahora, origen, llegada)).toBe(true);
    // Hace 10 min y queda poco para salir: todavía vale.
    expect(hayQueRecalcular(anterior, ahora, origen, llegada)).toBe(false);
    // Hace 20 min: se recalcula (el tráfico cambia).
    expect(hayQueRecalcular(anterior, new Date(2026, 8, 24, 8, 10), origen, llegada)).toBe(true);
    // Te has movido más de 1 km.
    expect(hayQueRecalcular(anterior, ahora, [41.7, -0.88], llegada)).toBe(true);
    // Ha cambiado la hora del evento.
    expect(hayQueRecalcular(anterior, ahora, origen, new Date(2026, 8, 24, 11, 0))).toBe(true);
    // Lejos de la hora de salir basta con cada 2 horas.
    const lejos = { ...anterior, salida: new Date(2026, 8, 24, 18, 0).toISOString() };
    expect(hayQueRecalcular(lejos, new Date(2026, 8, 24, 9, 0), origen, llegada)).toBe(false);
    expect(hayQueRecalcular(lejos, new Date(2026, 8, 24, 10, 0), origen, llegada)).toBe(true);
  });
});

describe('horas punta', () => {
  // 20 minutos normalmente; 30 a las 8:00 y 27 a las 14:30.
  const trayecto = (picos: Record<number, number>): Muestra[] =>
    MINUTOS_MUESTRA.map((minuto) => ({ minuto, duracionSeg: (picos[minuto] ?? 20) * 60 }));

  it('encuentra los picos de atasco', () => {
    const ida = trayecto({ 450: 24, 480: 30, 510: 25, 870: 27 });
    expect(horasDeAtasco([ida])).toEqual([480, 870]);
  });

  it('dos picos cercanos (de ida y de vuelta) cuentan como uno', () => {
    const ida = trayecto({ 480: 30 });
    const vuelta = trayecto({ 510: 26, 1110: 28 });
    expect(horasDeAtasco([ida, vuelta])).toEqual([480, 1110]);
  });

  it('sin atascos, ninguno', () => {
    expect(horasDeAtasco([trayecto({ 480: 22 })])).toEqual([]);
  });

  it('la frase', () => {
    expect(fraseHorasPunta([480, 870])).toBe('En tu zona suele haber atasco a las 8:00 y a las 14:30.');
    expect(fraseHorasPunta([480])).toBe('En tu zona suele haber atasco a las 8:00.');
    expect(fraseHorasPunta([])).toBe('En tus trayectos habituales no suele haber atascos.');
  });
});
