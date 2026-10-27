import type { Evento, TipoEvento } from '@/data/eventos/tipos';

import type { CitaExterna, Ventana } from './ics';

// Pasa las citas de otro calendario a eventos de Organizy y decide qué cambiar cada
// vez que se vuelve a traer. Puro, con pruebas.
//
// Reglas (el usuario quiere "mover todo" a Organizy, 27/09/2026):
// - Lo nuevo de fuera se crea como evento normal de Organizy (se ve, se edita y cuenta
//   para huecos, carga, planes y avisos).
// - Lo que cambia fuera se cambia aquí... salvo que lo hayas cambiado en Organizy: lo
//   tuyo manda y ese evento ya no se toca.
// - Lo que desaparece fuera se borra aquí, con la misma excepción. Lo anterior a la
//   ventana no se borra (no viene en la lectura, pero no es que lo hayan borrado).

// Resumen corto y estable de un texto (FNV-1a de 32 bits, dos veces): para ids y huellas.
export function resumen(texto: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(36) + b.toString(36);
}

// Lo que cuenta como "cambiado": lo que viene de fuera más el tipo.
export function huellaDe(e: Pick<Evento, 'titulo' | 'fecha' | 'horaInicio' | 'horaFin' | 'repeticion' | 'tipo' | 'lugar' | 'notas'>): string {
  const lugar = e.lugar?.tipo === 'otro' ? e.lugar.direccion : (e.lugar?.tipo ?? '');
  return resumen(JSON.stringify([e.titulo, e.fecha, e.horaInicio, e.horaFin, e.repeticion, e.tipo, lugar, e.notas]));
}

export function idFuente(enlace: string): string {
  return resumen(enlace);
}

export function eventoDesdeCita(cita: CitaExterna, fuente: string, tipo: TipoEvento, id?: string): Evento {
  const base = {
    titulo: cita.titulo,
    fecha: cita.fecha,
    horaInicio: cita.horaInicio,
    horaFin: cita.horaFin,
    repeticion: cita.repeticion,
    tipo,
    lugar: cita.lugar ? { tipo: 'otro' as const, direccion: cita.lugar, coordenadas: null } : null,
    notas: cita.notas,
  };
  return {
    ...base,
    id: id ?? `cal-${resumen(`${fuente}|${cita.uid}`)}`,
    flexible: false,
    duracionMin: null,
    hecha: false,
    foco: false,
    avisoMin: null, // la antelación del perfil
    ejemplo: false,
    cliente: null,
    origen: { fuente, uid: cita.uid, huella: huellaDe(base) },
  };
}

// ¿Lo has cambiado en Organizy desde que llegó?
export function cambiadoAqui(evento: Evento): boolean {
  return !!evento.origen && huellaDe(evento) !== evento.origen.huella;
}

export type Cambios = {
  guardar: Evento[];
  borrar: string[];
  nuevos: number;
  cambiados: number;
  borrados: number;
  tuyos: number; // cambiados en Organizy: se respetan
};

export function sincronizar(
  eventos: Evento[],
  fuente: string,
  tipo: TipoEvento,
  citas: CitaExterna[],
  ventana: Ventana,
): Cambios {
  const cambios: Cambios = { guardar: [], borrar: [], nuevos: 0, cambiados: 0, borrados: 0, tuyos: 0 };
  const deLaFuente = new Map<string, Evento>();
  for (const e of eventos) if (e.origen?.fuente === fuente) deLaFuente.set(e.origen.uid, e);

  const vistos = new Set<string>();
  for (const cita of citas) {
    if (vistos.has(cita.uid)) continue; // por si el calendario repite un UID
    vistos.add(cita.uid);
    const actual = deLaFuente.get(cita.uid);
    if (!actual) {
      cambios.guardar.push(eventoDesdeCita(cita, fuente, tipo));
      cambios.nuevos += 1;
      continue;
    }
    if (cambiadoAqui(actual)) {
      cambios.tuyos += 1;
      continue;
    }
    const nuevo = eventoDesdeCita(cita, fuente, tipo, actual.id);
    if (nuevo.origen?.huella !== actual.origen?.huella) {
      // Se conserva lo que solo existe en Organizy (antelación del aviso, cliente...).
      cambios.guardar.push({ ...actual, ...nuevo, avisoMin: actual.avisoMin, cliente: actual.cliente ?? null });
      cambios.cambiados += 1;
    }
  }

  for (const [uid, actual] of deLaFuente) {
    if (vistos.has(uid) || cambiadoAqui(actual)) continue;
    if (actual.repeticion === 'nunca' && actual.fecha < ventana.desde) continue;
    cambios.borrar.push(actual.id);
    cambios.borrados += 1;
  }
  return cambios;
}

// "He traído 45 eventos." / "3 nuevos, 1 cambiado y 2 borrados." / "Está al día."
export function textoCambios(c: Cambios, primeraVez: boolean, todoElDia: number): string {
  const partes: string[] = [];
  if (primeraVez) {
    partes.push(c.nuevos === 1 ? 'He traído 1 evento.' : `He traído ${c.nuevos} eventos.`);
  } else {
    const cosas = [
      c.nuevos ? `${c.nuevos} ${c.nuevos === 1 ? 'nuevo' : 'nuevos'}` : null,
      c.cambiados ? `${c.cambiados} ${c.cambiados === 1 ? 'cambiado' : 'cambiados'}` : null,
      c.borrados ? `${c.borrados} ${c.borrados === 1 ? 'borrado' : 'borrados'}` : null,
    ].filter((x): x is string => !!x);
    partes.push(
      cosas.length === 0
        ? 'Está al día.'
        : `${cosas.length === 1 ? cosas[0] : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`}.`.replace(
            /^./,
            (l) => l.toUpperCase(),
          ),
    );
  }
  if (todoElDia > 0) {
    partes.push(
      todoElDia === 1
        ? '1 evento de todo el día no se trae: Rusko aún no los tiene.'
        : `${todoElDia} eventos de todo el día no se traen: Rusko aún no los tiene.`,
    );
  }
  return partes.join(' ');
}
