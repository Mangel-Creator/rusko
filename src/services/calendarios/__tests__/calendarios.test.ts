import { describe, expect, it } from '@jest/globals';

import type { Evento } from '@/data/eventos/tipos';
import { leerIcs, nombrePorEnlace, normalizarEnlace, ventanaDesde, type CitaExterna } from '@/services/calendarios/ics';
import {
  cambiadoAqui,
  eventoDesdeCita,
  sincronizar,
  textoCambios,
} from '@/services/calendarios/sincronizar';
import { claveDia, formatearHora } from '@/services/fechas';

// Hora local del dispositivo para una hora en UTC: así las pruebas valen en cualquier zona.
const local = (iso: string) => ({ fecha: claveDia(new Date(iso)), hora: formatearHora(new Date(iso)) });

const MADRID = `BEGIN:VTIMEZONE
TZID:Europe/Madrid
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

function calendario(...eventos: string[]): string {
  // Con saltos \n sueltos a propósito: el lector los tiene que aguantar.
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Prueba//ES', MADRID, ...eventos, 'END:VCALENDAR'].join('\r\n');
}

const vevento = (lineas: string) => `BEGIN:VEVENT\n${lineas.trim()}\nEND:VEVENT`;

const ventana = { desde: '2026-07-01', hasta: '2028-09-27' };

describe('leerIcs', () => {
  it('lee un evento con zona horaria y lo pasa a la hora del dispositivo', () => {
    const { citas, todoElDia } = leerIcs(
      calendario(
        vevento(`
UID:a1@google.com
DTSTART;TZID=Europe/Madrid:20261005T100000
DTEND;TZID=Europe/Madrid:20261005T113000
SUMMARY:Reunión con Laura
LOCATION:Calle Mayor 1\\, Huesca
DESCRIPTION:Llevar el contrato\\nY las llaves
`),
      ),
      ventana,
    );
    expect(todoElDia).toBe(0);
    // 10:00 en Madrid (horario de verano) son las 08:00 UTC.
    const inicio = local('2026-10-05T08:00:00Z');
    const fin = local('2026-10-05T09:30:00Z');
    expect(citas).toEqual([
      {
        uid: 'a1@google.com',
        titulo: 'Reunión con Laura',
        fecha: inicio.fecha,
        horaInicio: inicio.hora,
        horaFin: fin.hora,
        repeticion: 'nunca',
        lugar: 'Calle Mayor 1, Huesca',
        notas: 'Llevar el contrato\nY las llaves',
      },
    ]);
  });

  it('entiende horas en UTC, sin título y fuera de la ventana', () => {
    const { citas } = leerIcs(
      calendario(
        vevento('UID:b1\nDTSTART:20261010T170000Z\nDTEND:20261010T180000Z'),
        vevento('UID:viejo\nDTSTART:20250101T170000Z\nDTEND:20250101T180000Z\nSUMMARY:Hace mucho'),
      ),
      ventana,
    );
    expect(citas.map((c) => c.uid)).toEqual(['b1']);
    expect(citas[0].titulo).toBe('(Sin título)');
    expect(citas[0].horaInicio).toBe(local('2026-10-10T17:00:00Z').hora);
  });

  it('no trae los de todo el día ni los cancelados', () => {
    const lectura = leerIcs(
      calendario(
        vevento('UID:c1\nDTSTART;VALUE=DATE:20261012\nDTEND;VALUE=DATE:20261013\nSUMMARY:Cumple de Javi'),
        vevento('UID:c2\nDTSTART:20261012T170000Z\nDTEND:20261012T180000Z\nSTATUS:CANCELLED'),
      ),
      ventana,
    );
    expect(lectura).toEqual({ citas: [], todoElDia: 1 });
  });

  it('las series sencillas pasan a series de Organizy', () => {
    const { citas } = leerIcs(
      calendario(
        vevento('UID:s1\nDTSTART;TZID=Europe/Madrid:20240108T190000\nDTEND;TZID=Europe/Madrid:20240108T200000\nRRULE:FREQ=WEEKLY;BYDAY=MO\nSUMMARY:Pádel'),
        vevento('UID:s2\nDTSTART;TZID=Europe/Madrid:20261001T090000\nDTEND;TZID=Europe/Madrid:20261001T091500\nRRULE:FREQ=DAILY\nSUMMARY:Pastilla'),
        vevento('UID:s3\nDTSTART;TZID=Europe/Madrid:20261015T100000\nDTEND;TZID=Europe/Madrid:20261015T110000\nRRULE:FREQ=MONTHLY\nSUMMARY:Alquiler'),
      ),
      ventana,
    );
    expect(citas.map((c) => [c.uid, c.repeticion, c.fecha])).toEqual([
      ['s1', 'semanal', '2024-01-08'], // empezó hace años, pero sigue viva
      ['s2', 'diaria', '2026-10-01'],
      ['s3', 'mensual', '2026-10-15'],
    ]);
  });

  it('las series complicadas se traen vez a vez, con sus días quitados y movidos', () => {
    const { citas } = leerIcs(
      calendario(
        vevento(`
UID:x1
DTSTART;TZID=Europe/Madrid:20261005T180000
DTEND;TZID=Europe/Madrid:20261005T190000
RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4
EXDATE;TZID=Europe/Madrid:20261019T180000
SUMMARY:Inglés
`),
        vevento(`
UID:x1
RECURRENCE-ID;TZID=Europe/Madrid:20261102T180000
DTSTART;TZID=Europe/Madrid:20261103T180000
DTEND;TZID=Europe/Madrid:20261103T190000
SUMMARY:Inglés (cambiado al martes)
`),
      ),
      ventana,
    );
    // 5/10, (19/10 quitado), 2/11 movido al 3/11, 16/11.
    expect(citas.map((c) => [c.fecha, c.titulo, c.repeticion])).toEqual([
      ['2026-10-05', 'Inglés', 'nunca'],
      ['2026-11-03', 'Inglés (cambiado al martes)', 'nunca'],
      ['2026-11-16', 'Inglés', 'nunca'],
    ]);
    expect(new Set(citas.map((c) => c.uid)).size).toBe(3);
  });

  it('una serie sin fin pero con días quitados no pasa de la ventana', () => {
    const { citas } = leerIcs(
      calendario(
        vevento(`
UID:d1
DTSTART;TZID=Europe/Madrid:20261001T080000
DTEND;TZID=Europe/Madrid:20261001T083000
RRULE:FREQ=DAILY
EXDATE;TZID=Europe/Madrid:20261002T080000
`),
      ),
      { desde: '2026-10-01', hasta: '2026-10-05' },
    );
    expect(citas.map((c) => c.fecha)).toEqual(['2026-10-01', '2026-10-03', '2026-10-04', '2026-10-05']);
  });

  it('lo que cruza la medianoche se corta a las 23:59', () => {
    const { citas } = leerIcs(
      calendario(vevento('UID:n1\nDTSTART:20261010T220000\nDTEND:20261011T020000\nSUMMARY:Concierto')),
      ventana,
    );
    expect(citas[0]).toMatchObject({ fecha: '2026-10-10', horaInicio: '22:00', horaFin: '23:59' });
  });

  it('rechaza lo que no es un calendario', () => {
    expect(() => leerIcs('<html>Error</html>', ventana)).toThrow();
  });
});

describe('enlaces', () => {
  it('pasa webcal a https y rechaza lo demás', () => {
    expect(normalizarEnlace(' webcal://p01-caldav.icloud.com/published/2/abc ')).toBe(
      'https://p01-caldav.icloud.com/published/2/abc',
    );
    expect(normalizarEnlace('http://calendar.google.com/x.ics')).toBeNull();
    expect(normalizarEnlace('hola')).toBeNull();
    expect(nombrePorEnlace('https://calendar.google.com/calendar/ical/x/private-y/basic.ics')).toBe('Google Calendar');
    expect(nombrePorEnlace('https://p01-caldav.icloud.com/published/2/abc')).toBe('iCloud');
  });

  it('trae desde hace 3 meses hasta dentro de 2 años', () => {
    expect(ventanaDesde(new Date(2026, 8, 27))).toEqual({ desde: '2026-06-27', hasta: '2028-09-27' });
  });
});

const cita = (uid: string, cambios: Partial<CitaExterna> = {}): CitaExterna => ({
  uid,
  titulo: 'Dentista',
  fecha: '2026-10-05',
  horaInicio: '10:00',
  horaFin: '11:00',
  repeticion: 'nunca',
  lugar: null,
  notas: '',
  ...cambios,
});

describe('sincronizar', () => {
  const F = 'fuente1';

  it('la primera vez lo crea todo, con su origen', () => {
    const c = sincronizar([], F, 'yo', [cita('a'), cita('b', { lugar: 'Calle Sol 2' })], ventana);
    expect(c).toMatchObject({ nuevos: 2, cambiados: 0, borrados: 0, borrar: [] });
    expect(c.guardar[1]).toMatchObject({
      tipo: 'yo',
      flexible: false,
      lugar: { tipo: 'otro', direccion: 'Calle Sol 2', coordenadas: null },
      origen: { fuente: F, uid: 'b' },
    });
    expect(cambiadoAqui(c.guardar[0])).toBe(false);
  });

  it('la segunda vez no duplica, cambia lo cambiado fuera y borra lo borrado fuera', () => {
    const antes = sincronizar([], F, 'yo', [cita('a'), cita('b'), cita('c')], ventana).guardar;
    const conAviso = antes.map((e) => (e.origen?.uid === 'a' ? { ...e, avisoMin: 60 } : e));
    const c = sincronizar(conAviso, F, 'yo', [cita('a', { horaInicio: '09:30' }), cita('b'), cita('d')], ventana);
    expect(c).toMatchObject({ nuevos: 1, cambiados: 1, borrados: 1, tuyos: 0 });
    const a = c.guardar.find((e) => e.origen?.uid === 'a');
    expect(a).toMatchObject({ id: antes[0].id, horaInicio: '09:30', avisoMin: 60 });
    expect(c.borrar).toEqual([antes[2].id]);
  });

  it('lo que cambias en Organizy manda: no se pisa ni se borra', () => {
    const antes = sincronizar([], F, 'yo', [cita('a'), cita('b')], ventana).guardar;
    const tocados = antes.map((e) => ({ ...e, tipo: 'cliente' as const }));
    expect(cambiadoAqui(tocados[0])).toBe(true);
    const c = sincronizar(tocados, F, 'yo', [cita('a', { titulo: 'Otro' })], ventana);
    expect(c).toMatchObject({ guardar: [], borrar: [], tuyos: 1 });
  });

  it('no toca otros calendarios ni lo anterior a la ventana', () => {
    const otro = eventoDesdeCita(cita('a'), 'otra-fuente', 'yo');
    const viejo = eventoDesdeCita(cita('v', { fecha: '2026-01-01' }), F, 'yo');
    const propio: Evento = { ...otro, id: 'mio', origen: null };
    const c = sincronizar([otro, viejo, propio], F, 'yo', [], ventana);
    expect(c.borrar).toEqual([]);
  });

  it('textos', () => {
    const vacio = { guardar: [], borrar: [], nuevos: 0, cambiados: 0, borrados: 0, tuyos: 0 };
    expect(textoCambios({ ...vacio, nuevos: 45 }, true, 3)).toBe(
      'He traído 45 eventos. 3 eventos de todo el día no se traen: Rusko aún no los tiene.',
    );
    expect(textoCambios(vacio, false, 0)).toBe('Está al día.');
    expect(textoCambios({ ...vacio, nuevos: 3, cambiados: 1, borrados: 2 }, false, 0)).toBe(
      '3 nuevos, 1 cambiado y 2 borrados.',
    );
  });
});
