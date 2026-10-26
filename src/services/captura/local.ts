import type { Evento, LugarEvento, TipoEvento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { eventosDelDia, intervaloDe } from '@/services/agenda';
import {
  claveDia,
  diaSemanaDesdeLunes,
  horaDesdeMinutos,
  minutosDelDia,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';

import { DURACIONES, MAX_TITULO, type Propuesta } from './validar';

// Captura rápida sin IA ni conexión (26/10, lo pidió el usuario: "mañana pádel por la
// tarde" tiene que entenderse). Lee el día, la hora o la franja ("por la tarde" = 17, 18
// o 19, la primera libre) y cuánto suele durar cada cosa (el pádel, unas 2 horas). Si ve
// un día o una hora, la propuesta sale con confianza "alta" y no hace falta la IA.

type Franja = 'manana' | 'mediodia' | 'tarde' | 'noche';

// Horas que se proponen para cada franja, por orden de preferencia.
const HORAS_FRANJA: Record<Franja, number[]> = {
  manana: [9, 10, 11],
  mediodia: [14, 13],
  tarde: [17, 18, 19],
  noche: [20, 21, 22],
};

type Actividad = {
  re: RegExp;
  minutos: number;
  tipo: TipoEvento;
  franja: Franja | null;
};

// Lo más habitual, con lo que suele durar y cuándo se suele hacer. La primera que
// aparezca en la frase manda.
const ACTIVIDADES: Actividad[] = [
  { re: /\bpadel\b/, minutos: 120, tipo: 'amigos', franja: 'tarde' },
  { re: /\btenis\b/, minutos: 120, tipo: 'amigos', franja: 'tarde' },
  {
    re: /\b(futbol|furbo|partido|baloncesto|basket)\b/,
    minutos: 120,
    tipo: 'amigos',
    franja: 'tarde',
  },
  { re: /\b(gimnasio|gym)\b/, minutos: 90, tipo: 'yo', franja: 'tarde' },
  {
    re: /\b(correr|running|yoga|pilates|nadar|piscina)\b/,
    minutos: 60,
    tipo: 'yo',
    franja: 'tarde',
  },
  { re: /\b(cena|cenar)\b/, minutos: 120, tipo: 'amigos', franja: 'noche' },
  {
    re: /\b(comida|comer|almuerzo)\b/,
    minutos: 90,
    tipo: 'amigos',
    franja: 'mediodia',
  },
  {
    re: /\b(desayuno|desayunar)\b/,
    minutos: 60,
    tipo: 'amigos',
    franja: 'manana',
  },
  { re: /\b(cafe|cafes)\b/, minutos: 60, tipo: 'amigos', franja: 'tarde' },
  {
    re: /\b(cerveza|cervezas|canas|copa|copas|vermut|vermu)\b/,
    minutos: 120,
    tipo: 'amigos',
    franja: 'noche',
  },
  {
    re: /\b(cine|peli|pelicula)\b/,
    minutos: 150,
    tipo: 'amigos',
    franja: 'noche',
  },
  {
    re: /\b(concierto|teatro)\b/,
    minutos: 150,
    tipo: 'amigos',
    franja: 'noche',
  },
  {
    re: /\b(cumple|cumpleanos|fiesta)\b/,
    minutos: 180,
    tipo: 'amigos',
    franja: 'noche',
  },
  {
    re: /\b(reunion|meeting|cliente|clientes|visita|presupuesto)\b/,
    minutos: 60,
    tipo: 'cliente',
    franja: 'manana',
  },
  {
    re: /\b(medico|medica|dentista|doctor|doctora|fisio|revision|analisis)\b/,
    minutos: 60,
    tipo: 'yo',
    franja: 'manana',
  },
  {
    re: /\b(peluqueria|peluquero|peluquera)\b/,
    minutos: 60,
    tipo: 'yo',
    franja: 'tarde',
  },
  { re: /\bexamen\b/, minutos: 120, tipo: 'yo', franja: 'manana' },
  { re: /\bclase\b/, minutos: 60, tipo: 'yo', franja: 'tarde' },
  { re: /\bestudiar\b/, minutos: 120, tipo: 'yo', franja: 'tarde' },
  // Recados: sin franja, así que sin hora salen como tarea flexible.
  {
    re: /\b(llamar|llamada|comprar|compra|recoger|pagar|enviar|mandar)\b/,
    minutos: 30,
    tipo: 'yo',
    franja: null,
  },
];

// Tildes que se suelen comer al escribir rápido, para el título.
const CON_TILDE: Record<string, string> = {
  padel: 'pádel',
  futbol: 'fútbol',
  reunion: 'reunión',
  medico: 'médico',
  medica: 'médica',
  cafe: 'café',
  peluqueria: 'peluquería',
  cumpleanos: 'cumpleaños',
  pelicula: 'película',
  revision: 'revisión',
  analisis: 'análisis',
  mama: 'mamá',
  papa: 'papá',
};

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const NUMEROS: Record<string, number> = {
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
};

// Minúsculas y sin tildes, con la misma longitud que la frase (para poder quitar trozos).
function normalizar(frase: string): string {
  return frase
    .normalize('NFC')
    .split('')
    .map((c) => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0) || c)
    .join('');
}

type Tramo = [number, number];

// Hora "suelta" (1-12) a 24 h según la franja o, si no hay, según la actividad.
function horaDel(h: number, franja: Franja | null, actividad: Actividad | null): number {
  if (h >= 13 || h === 0) return h;
  if (franja === 'manana') return h === 12 ? 12 : h;
  if (franja === 'mediodia') return h <= 5 ? h + 12 : h;
  if (franja === 'tarde') return h < 12 ? h + 12 : h;
  if (franja === 'noche') return h >= 6 && h < 12 ? h + 12 : h === 12 ? 0 : h;
  if (h === 12) return 12;
  if (h <= 7) return h + 12; // "a las 5": de la tarde
  // De 8 a 11: por la tarde si es un plan de tarde o de noche (pádel, cena...).
  const tarde = actividad?.franja === 'tarde' || actividad?.franja === 'noche';
  return tarde ? h + 12 : h;
}

// "5", "5:30", "5 y media", "5 y cuarto", "6 menos cuarto" -> [hora, minutos]
const RE_HORA = '(\\d{1,2})(?:(?::|\\.|h)(\\d{2})| y (media|cuarto)| menos (cuarto))?';
function leerHora(m: RegExpExecArray, i: number): [number, number] {
  let h = Number(m[i]);
  let min = m[i + 1] ? Number(m[i + 1]) : 0;
  if (m[i + 2] === 'media') min = 30;
  if (m[i + 2] === 'cuarto') min = 15;
  if (m[i + 3]) {
    h -= 1;
    min = 45;
  }
  return [h, min];
}

export type ContextoLocal = {
  ahora: Date;
  perfil: Perfil | null;
  eventos: readonly Evento[];
};

export function interpretarLocal(frase: string, { ahora, perfil, eventos }: ContextoLocal): Propuesta | null {
  const original = frase.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!original) return null;
  const t = normalizar(original);
  const hoy = claveDia(ahora);
  const quitar: Tramo[] = [];
  const marcar = (m: RegExpExecArray, desde = 0) => quitar.push([m.index + desde, m.index + m[0].length]);

  // --- Qué es ---
  const actividad = ACTIVIDADES.find((a) => a.re.test(t)) ?? null;

  // --- Franja: "por la tarde", "esta noche", "a mediodía"... ---
  let franja: Franja | null = null;
  let franjaDicha = false;
  let fechaDicha: ClaveDia | null = null;
  const reFranja = /\b(?:(por|de|esta|a) la (manana|tarde|noche)|(?:a|al) mediodia|a primera hora|de madrugada)\b/g;
  for (let m = reFranja.exec(t); m; m = reFranja.exec(t)) {
    franja = m[2] ? (m[2] as Franja) : m[0].includes('mediodia') ? 'mediodia' : 'manana';
    franjaDicha = true;
    if (m[1] === 'esta') fechaDicha = hoy;
    marcar(m);
  }

  // --- Día ---
  const reManana = /\b(pasado )?manana\b/g;
  for (let m = reManana.exec(t); m; m = reManana.exec(t)) {
    if (quitar.some(([a, b]) => m!.index >= a && m!.index < b)) continue; // era "por la mañana"
    fechaDicha = sumarDias(hoy, m[1] ? 2 : 1);
    marcar(m);
  }
  const reHoy = /\bhoy\b/.exec(t);
  if (reHoy) {
    fechaDicha = hoy;
    marcar(reHoy);
  }
  const reDia =
    /\b(?:el |este |el proximo )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?: que viene| proximo)?\b/.exec(
      t,
    );
  if (reDia) {
    const hasta = (DIAS.indexOf(reDia[1]) - diaSemanaDesdeLunes(ahora) + 7) % 7 || 7;
    fechaDicha = sumarDias(hoy, hasta);
    marcar(reDia);
  }
  const reFinde = /\b(?:el |este )?(?:finde|fin de semana)\b/.exec(t);
  if (reFinde && !reDia) {
    fechaDicha = sumarDias(hoy, (5 - diaSemanaDesdeLunes(ahora) + 7) % 7 || 7);
    marcar(reFinde);
  }
  const reSemana = /\b(?:la semana que viene|la proxima semana)\b/.exec(t);
  if (reSemana && !reDia) {
    fechaDicha = sumarDias(hoy, 7 - diaSemanaDesdeLunes(ahora));
    marcar(reSemana);
  }
  const reNumero = new RegExp(
    `\\b(?:el (?:dia )?(\\d{1,2})|(\\d{1,2}) de (${MESES.join('|')}))(?: de (${MESES.join('|')}))?\\b`,
  ).exec(t);
  if (reNumero) {
    const dia = Number(reNumero[1] ?? reNumero[2]);
    const mesDicho = reNumero[3] ?? reNumero[4];
    let mes = mesDicho ? MESES.indexOf(mesDicho) : ahora.getMonth();
    let anio = ahora.getFullYear();
    if (!mesDicho && dia < ahora.getDate()) mes += 1; // "el 3" ya pasado: el del mes que viene
    if (mesDicho && mes < ahora.getMonth()) anio += 1;
    const fecha = new Date(anio, mes, dia);
    if (dia >= 1 && dia <= 31 && fecha.getDate() === dia) {
      fechaDicha = claveDia(fecha);
      marcar(reNumero);
    }
  }

  // --- Hora: "de 5 a 7", "a las 8", "17:30" ---
  let inicio: number | null = null;
  let fin: number | null = null;
  const reRango = new RegExp(`\\b(?:de|desde las?) ${RE_HORA} (?:a|hasta) (?:las? )?${RE_HORA}\\b`).exec(t);
  const reALas = new RegExp(`\\ba (?:las?) ${RE_HORA}(?:\\s*h)?\\b`).exec(t);
  const reSuelta = /\b(\d{1,2}):(\d{2})\b/.exec(t);
  if (reRango) {
    const [h1, m1] = leerHora(reRango, 1);
    const [h2, m2] = leerHora(reRango, 5);
    const a = horaDel(h1, franja, actividad);
    let b = horaDel(h2, franja, actividad);
    if (b < a && b < 12) b += 12;
    inicio = a * 60 + m1;
    fin = b * 60 + m2;
    marcar(reRango);
  } else if (reALas) {
    const [h, m] = leerHora(reALas, 1);
    inicio = horaDel(h, franja, actividad) * 60 + m;
    marcar(reALas);
  } else if (reSuelta) {
    inicio = horaDel(Number(reSuelta[1]), franja, actividad) * 60 + Number(reSuelta[2]);
    marcar(reSuelta);
  }
  if (inicio !== null && (inicio < 0 || inicio > 23 * 60 + 59)) inicio = null;
  const horaDicha = inicio !== null;

  // --- Duración dicha: "2 horas", "hora y media", "media hora", "45 minutos" ---
  let duracion: number | null = null;
  const reDur =
    /\b(?:durante |por )?(?:(\d+|un|una|dos|tres|cuatro|cinco) horas?(?: y media)?|hora y media|media hora|(\d+) min(?:utos)?)\b/.exec(
      t,
    );
  if (reDur) {
    if (reDur[0].includes('media hora')) duracion = 30;
    else if (reDur[0].includes('hora y media')) duracion = 90;
    else if (reDur[2]) duracion = Number(reDur[2]);
    else {
      const n = NUMEROS[reDur[1]] ?? Number(reDur[1]);
      duracion = n * 60 + (reDur[0].includes('y media') ? 30 : 0);
    }
    marcar(reDur);
  }
  const minutos = duracion ?? actividad?.minutos ?? 60;

  // --- Lugar: "en casa" o un sitio habitual por su nombre ---
  let lugar: LugarEvento | null = null;
  const reCasa = /\b(?:en|a) casa\b/.exec(t);
  if (reCasa) {
    lugar = { tipo: 'casa' };
    marcar(reCasa);
  } else {
    for (const sitio of perfil?.sitios ?? []) {
      const nombre = normalizar(sitio.nombre.trim());
      if (!nombre) continue;
      const m = new RegExp(`\\b(?:en (?:el |la )?)?${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).exec(t);
      if (m) {
        lugar = { tipo: 'sitio', sitioId: sitio.id };
        if (m[0].startsWith('en ')) marcar(m);
        break;
      }
    }
  }

  // --- Tipo ---
  let tipo: TipoEvento = actividad?.tipo ?? 'yo';
  if (tipo === 'yo' && /\bcon [a-z]/.test(t) && !actividad) tipo = 'amigos';

  // --- Día y hora finales ---
  const ocupados = (fecha: ClaveDia) =>
    eventosDelDia([...eventos], fecha)
      .filter((e) => e.horaInicio && !e.flexible)
      .map(intervaloDe);
  const libre = (fecha: ClaveDia, desde: number) =>
    ocupados(fecha).every((o) => desde + minutos <= o.inicio || desde >= o.fin);
  const yaPasada = (fecha: ClaveDia, desde: number) => fecha === hoy && desde < minutosDelDia(ahora);

  let fecha = fechaDicha ?? hoy;
  let opcionesHora: string[] | undefined;
  const franjaFinal = franja ?? (inicio === null ? (actividad?.franja ?? null) : null);

  if (inicio === null && franjaFinal) {
    // Solo la franja: la primera hora libre (y que no haya pasado) de las de esa franja.
    let horas = HORAS_FRANJA[franjaFinal].map((h) => h * 60);
    if (!fechaDicha && horas.every((h) => yaPasada(fecha, h))) fecha = sumarDias(hoy, 1);
    const futuras = horas.filter((h) => !yaPasada(fecha, h));
    if (futuras.length > 0) horas = futuras;
    inicio = horas.find((h) => libre(fecha, h)) ?? horas[0];
    opcionesHora = [...horas].sort((a, b) => a - b).map(horaDesdeMinutos);
  } else if (inicio !== null && !fechaDicha && yaPasada(fecha, inicio)) {
    fecha = sumarDias(hoy, 1); // "a las 9" cuando ya son las 10: mañana
  }

  // --- Título: la frase sin el día, la hora ni el lugar ---
  const titulo = limpiarTitulo(original, quitar);
  // Si ha visto un día, una hora o una franja, va sin dudas; si solo lo supone por la
  // actividad ("cena con Ana"), que lo revise.
  const confianza = fechaDicha !== null || horaDicha || franjaDicha ? 'alta' : 'media';

  if (inicio === null) {
    // Sin hora ni franja: algo por hacer ese día, sin hora fija.
    const estimada = DURACIONES.reduce(
      (mejor, d) => (Math.abs(d - minutos) < Math.abs(mejor - minutos) ? d : mejor),
      30,
    );
    return {
      titulo,
      fecha,
      horaInicio: null,
      horaFin: null,
      tipo,
      lugar,
      flexible: true,
      duracionMin: estimada,
      confianza: fechaDicha ? 'alta' : 'media',
    };
  }

  const finFinal = Math.min(fin !== null && fin > inicio ? fin : inicio + minutos, 23 * 60 + 59);
  if (finFinal <= inicio) return null;
  return {
    titulo,
    fecha,
    horaInicio: horaDesdeMinutos(inicio),
    horaFin: horaDesdeMinutos(finFinal),
    tipo,
    lugar,
    flexible: false,
    duracionMin: null,
    confianza,
    ...(opcionesHora && opcionesHora.length > 1 ? { opcionesHora } : {}),
  };
}

const CONECTORES = /^(?:el|la|los|las|a|al|de|del|por|y|en|para|este|esta|que|sobre|hacia)$/;

function limpiarTitulo(original: string, quitar: Tramo[]): string {
  const borrar = new Array(original.length).fill(false);
  for (const [a, b] of quitar) for (let i = a; i < b; i++) borrar[i] = true;
  let palabras = original
    .split('')
    .map((c, i) => (borrar[i] ? ' ' : c))
    .join('')
    .split(/\s+/)
    .filter(Boolean);
  // Restos sueltos: "a las" sin hora ("mañana pádel a las por la tarde") y conectores en los bordes.
  palabras = palabras.filter(
    (p, i) =>
      !(/^las?$/i.test(p) && /^a$/i.test(palabras[i - 1] ?? '')) &&
      !(/^a$/i.test(p) && /^las?$/i.test(palabras[i + 1] ?? '')),
  );
  while (palabras.length > 0 && CONECTORES.test(normalizar(palabras[0]).replace(/[,.;:]/g, ''))) palabras.shift();
  while (palabras.length > 0 && CONECTORES.test(normalizar(palabras[palabras.length - 1]).replace(/[,.;:]/g, '')))
    palabras.pop();
  const arreglado = palabras
    .map((p) => {
      const limpio = normalizar(p).replace(/[,.;:]/g, '');
      const tilde = CON_TILDE[limpio];
      return tilde && limpio === p.toLowerCase().replace(/[,.;:]/g, '') ? p.replace(/[^,.;:]+/, tilde) : p;
    })
    .join(' ')
    .replace(/[\s,.;:]+$/, '')
    .slice(0, MAX_TITULO)
    .trim();
  if (!arreglado) return 'Nuevo evento';
  return arreglado.charAt(0).toLocaleUpperCase('es-ES') + arreglado.slice(1);
}
