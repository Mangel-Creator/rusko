import type { Evento } from '@/data/eventos/tipos';
import type { Perfil } from '@/data/perfil';
import { eventosDelDia, resolverLugar, tareasPendientes } from '@/services/agenda';
import {
  capitalizar,
  claveDia,
  diaSemanaDesdeLunes,
  fechaDesdeClave,
  inicioDeSemana,
  minutosDelDia,
  minutosDesdeHora,
  nombreMes,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';

// "¿Qué tengo el miércoles?" sin IA (lo pidió el usuario el 26/10/2026): reglas para
// reconocer la pregunta y el día, y una respuesta corta que se puede leer en voz alta.
// No sale nada del móvil.
//
//   - entenderPregunta(frase, hoy): el día por el que preguntas, o null si no es una
//     pregunta por tu agenda (entonces la frase sigue a la captura de siempre).
//   - respuestaDelDia(...): "El miércoles tienes dos cosas: Reunión, a las diez de la
//     mañana en Oficina, y luego Pádel, a las seis de la tarde."

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

// Minúsculas, sin tildes ni signos: "¿Qué tengo el MIÉRCOLES?" -> "que tengo el miercoles".
function normalizar(frase: string): string {
  return frase
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lo que convierte una frase en pregunta por tu agenda. "Lo que tengo" no cuenta
// ("llevar lo que tengo en el trastero" es algo que apuntar).
const PREGUNTA =
  /\b(que|q) (tengo|tenia|hay|me toca|toca|hago|planes tengo)\b|\btengo algo\b|\b(estoy|lo tengo|tengo el dia) libre\b|\bcomo (tengo|voy) (el|la|hoy|manana|pasado|este|esta)\b|^(mi )?agenda\b/;

// El día por el que se pregunta, o null si la frase no es una pregunta por la agenda.
// Sin día ("¿qué tengo?"), hoy.
export function entenderPregunta(frase: string, hoy: ClaveDia): ClaveDia | null {
  const texto = normalizar(frase);
  if (!PREGUNTA.test(texto.replace(/\blo que\b/g, 'lo_que'))) return null;
  return diaDeLaFrase(texto, hoy) ?? hoy;
}

function diaDeLaFrase(texto: string, hoy: ClaveDia): ClaveDia | null {
  // "Por la mañana" habla de una parte del día, no de mañana.
  const t = texto.replace(/\b(por|de) la manana\b/g, ' ');
  if (/\bpasado manana\b/.test(t)) return sumarDias(hoy, 2);
  if (/\banteayer\b/.test(t)) return sumarDias(hoy, -2);
  if (/\bayer\b/.test(t)) return sumarDias(hoy, -1);
  if (/\besta (manana|tarde|noche)\b|\bhoy\b/.test(t)) return hoy;
  if (/\bmanana\b/.test(t)) return sumarDias(hoy, 1);

  const fecha = fechaEscrita(t, hoy);
  if (fecha) return fecha;

  const nombre = t.match(new RegExp(`\\b(${DIAS.join('|')})\\b`));
  if (nombre) {
    const objetivo = DIAS.indexOf(nombre[1]);
    // "El jueves de la semana que viene": el de la semana siguiente (de lunes a domingo).
    if (/\b(semana que viene|proxima semana|siguiente semana)\b/.test(t)) {
      return sumarDias(claveDia(inicioDeSemana(fechaDesdeClave(hoy))), 7 + objetivo);
    }
    const hoyEs = diaSemanaDesdeLunes(fechaDesdeClave(hoy));
    // "Este miércoles" siendo miércoles es hoy; "el miércoles", el que viene.
    if (objetivo === hoyEs && /\beste\b/.test(t)) return hoy;
    const faltan = (objetivo - hoyEs + 7) % 7 || 7;
    return sumarDias(hoy, faltan);
  }
  return null;
}

// "El 5", "el día 5", "el 5 de noviembre", "5/11" o "5-11-2026".
function fechaEscrita(t: string, hoy: ClaveDia): ClaveDia | null {
  const [anoHoy, mesHoy, diaHoy] = hoy.split('-').map(Number);
  const crear = (ano: number, mes: number, dia: number): ClaveDia | null => {
    const fecha = new Date(ano, mes - 1, dia);
    return fecha.getMonth() === mes - 1 && fecha.getDate() === dia ? claveDia(fecha) : null;
  };
  // Sin año: este año, o el que viene si ya pasó hace más de un mes.
  const conMes = (mes: number, dia: number, ano?: number): ClaveDia | null => {
    if (ano) return crear(ano < 100 ? 2000 + ano : ano, mes, dia);
    const esteAno = crear(anoHoy, mes, dia);
    if (esteAno && esteAno >= sumarDias(hoy, -31)) return esteAno;
    return crear(anoHoy + 1, mes, dia);
  };

  const numerica = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numerica) return conMes(Number(numerica[2]), Number(numerica[1]), numerica[3] ? Number(numerica[3]) : undefined);

  const escrita = t.match(new RegExp(`\\b(\\d{1,2}) de (${MESES.join('|')})\\b`));
  if (escrita) return conMes(MESES.indexOf(escrita[2]) + 1, Number(escrita[1]));

  // Solo el número: este mes, o el que viene si ese día ya pasó.
  const suelto = t.match(/\b(?:el|dia) (?:dia )?(\d{1,2})\b/);
  if (suelto) {
    const dia = Number(suelto[1]);
    if (dia >= diaHoy) return crear(anoHoy, mesHoy, dia);
    return mesHoy === 12 ? crear(anoHoy + 1, 1, dia) : crear(anoHoy, mesHoy + 1, dia);
  }
  return null;
}

const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// Como lo diría una persona: "Hoy", "Mañana", "Pasado mañana", "Ayer", "El miércoles"
// (si cae en los próximos 6 días) o "El miércoles 4 de noviembre".
export function nombreDelDia(dia: ClaveDia, hoy: ClaveDia): string {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  if (dia === sumarDias(hoy, 2)) return 'Pasado mañana';
  if (dia === sumarDias(hoy, -1)) return 'Ayer';
  const fecha = fechaDesdeClave(dia);
  const semana = NOMBRES_DIA[diaSemanaDesdeLunes(fecha)];
  if (dia > hoy && dia <= sumarDias(hoy, 6)) return `El ${semana}`;
  return `El ${semana} ${fecha.getDate()} de ${nombreMes(fecha).toLocaleLowerCase('es-ES')}`;
}

// Horas y números en palabras: la voz lee "18:00" como "dieciocho horas" y "la 1" como
// "la uno".
const NUMEROS = [
  'cero',
  'una',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];

function enLetra(n: number): string {
  return NUMEROS[n] ?? String(n);
}

type Franja = 'de la madrugada' | 'de la mañana' | 'del mediodía' | 'de la tarde' | 'de la noche';

function franjaDe(hora: number): Franja {
  if (hora >= 1 && hora < 6) return 'de la madrugada';
  if (hora >= 6 && hora < 12) return 'de la mañana';
  if (hora >= 12 && hora < 14) return 'del mediodía';
  if (hora >= 14 && hora < 21) return 'de la tarde';
  return 'de la noche';
}

// "a las seis y media de la tarde", "a la una menos cuarto", "hasta las once y diez".
// La franja se calla si es la misma que la de antes ("…de la tarde, y luego a las ocho").
function horaHablada(hora: string, prefijo: 'a' | 'hasta', franjaAntes: Franja | null = null) {
  const total = minutosDesdeHora(hora);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const franja = franjaDe(h);
  // A partir de y treinta y algo se dice "menos": "las siete menos veinte".
  const menos = m > 30;
  const reloj = (menos ? h + 1 : h) % 12 || 12;
  const minutos =
    m === 0
      ? ''
      : m === 15
        ? ' y cuarto'
        : m === 30
          ? ' y media'
          : m === 45
            ? ' menos cuarto'
            : menos
              ? ` menos ${enLetra(60 - m)}`
              : ` y ${enLetra(m)}`;
  const texto = `${prefijo} ${reloj === 1 ? 'la' : 'las'} ${enLetra(reloj)}${minutos}${franja === franjaAntes ? '' : ` ${franja}`}`;
  return { texto, franja };
}

function unirConY(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

// "una cosa", "tres cosas", "12 cosas" (todo lo que se cuenta aquí es femenino).
function contar(n: number, una: string, varias: string): string {
  return n === 1 ? `una ${una}` : `${n <= 10 ? enLetra(n) : n} ${varias}`;
}

// Para no decir siempre lo mismo, pero sin azar: el mismo día, la misma frase.
function elegir(opciones: string[], dia: ClaveDia): string {
  return opciones[fechaDesdeClave(dia).getDate() % opciones.length];
}

// Más de esto cansa de oír: el resto se dice como "y luego tres cosas más".
const MAX_EN_VOZ = 5;

type Cosa = { titulo: string; inicio: string; sitio: string | null };

function limpiarTitulo(titulo: string): string {
  return titulo.trim().replace(/\.+$/, '');
}

// Las citas contadas como un relato: "Empiezas a las diez de la mañana con Reunión en
// Oficina, luego Comida, a las dos de la tarde, y acabas a las seis con Pádel."
function relato(cosas: Cosa[], pasado: boolean): string {
  let franja: Franja | null = null;
  const partes = cosas.slice(0, MAX_EN_VOZ).map((c) => {
    const hora = horaHablada(c.inicio, 'a', franja);
    franja = hora.franja;
    return { titulo: c.titulo, hora: hora.texto, en: c.sitio ? ` en ${c.sitio}` : '' };
  });
  const resto = cosas.length - partes.length;

  if (partes.length === 1) return `${partes[0].titulo}, ${partes[0].hora}${partes[0].en}`;
  if (partes.length === 2) {
    const [a, b] = partes;
    return `${a.titulo}, ${a.hora}${a.en}, y luego ${b.titulo}, ${b.hora}${b.en}`;
  }
  const [primera, ...siguientes] = partes;
  const ultima = resto > 0 ? null : siguientes.pop();
  const trozos = [`${pasado ? 'Empezaste' : 'Empiezas'} ${primera.hora} con ${primera.titulo}${primera.en}`];
  siguientes.forEach((c, i) => trozos.push(`${['luego ', 'después '][i] ?? ''}${c.titulo}, ${c.hora}${c.en}`));
  const final = ultima
    ? `y ${pasado ? 'acabaste' : 'acabas'} ${ultima.hora} con ${ultima.titulo}${ultima.en}`
    : `y luego ${contar(resto, 'cosa', 'cosas')} más`;
  return `${trozos.join(', ')}, ${final}`;
}

type Datos = {
  eventos: Evento[];
  dia: ClaveDia;
  ahora: Date;
  perfil: Perfil | null;
};

// La respuesta, lista para leerla en voz alta, con el tono de alguien que mira tu agenda
// contigo (lo pidió el usuario el 28/10/2026: "mucho más humana y cercana"). De hoy solo
// cuenta lo que queda y, si estás en algo, lo dice primero.
export function respuestaDelDia({ eventos, dia, ahora, perfil }: Datos): string {
  const hoy = claveDia(ahora);
  const esHoy = dia === hoy;
  const pasado = dia < hoy;
  const nombre = nombreDelDia(dia, hoy);
  const delDia = eventosDelDia(eventos, dia);
  const minuto = minutosDelDia(ahora);
  const inicio = (e: Evento) => minutosDesdeHora(e.horaInicio ?? '00:00');
  const fin = (e: Evento) => minutosDesdeHora(e.horaFin ?? e.horaInicio ?? '00:00');
  const citas = esHoy ? delDia.filter((e) => fin(e) > minuto) : delDia;
  // Las tareas sin hacer de días pasados salen hoy; de un día pasado no se cuentan.
  const tareas = pasado ? [] : tareasPendientes(eventos, dia, hoy);

  if (citas.length === 0 && tareas.length === 0) {
    if (pasado) return `${nombre} no tenías nada apuntado.`;
    if (esHoy && delDia.length > 0) return 'Por hoy ya está. Lo que queda de día es para ti.';
    return elegir([`${nombre} lo tienes libre del todo.`, `${nombre} no tienes nada. Día libre.`], dia);
  }

  const cosa = (e: Evento): Cosa => {
    const lugar = resolverLugar(e.lugar, perfil);
    return {
      titulo: limpiarTitulo(e.titulo),
      inicio: e.horaInicio ?? '00:00',
      sitio: lugar ? (lugar.nombre ?? lugar.direccion.split(',')[0]) : null,
    };
  };

  const frases: string[] = [];
  const enCurso = esHoy ? citas.filter((e) => inicio(e) <= minuto) : [];
  const proximas = citas.filter((e) => e !== enCurso[0]);
  if (enCurso.length > 0) {
    const e = enCurso[0];
    const hasta = e.horaFin ? `, ${horaHablada(e.horaFin, 'hasta').texto}` : '';
    frases.push(`Ahora mismo estás con ${cosa(e).titulo}${hasta}.`);
  }

  if (proximas.length > 0) {
    const n = proximas.length;
    const cuantas = contar(n, 'cosa', 'cosas');
    let cabecera: string;
    if (enCurso.length > 0) cabecera = n === 1 ? 'Después solo te queda' : `Después te quedan ${cuantas}`;
    else if (esHoy) cabecera = n === 1 ? 'Hoy solo te queda' : `Hoy te quedan ${cuantas}`;
    else if (pasado) cabecera = n === 1 ? `${nombre} solo tuviste` : `${nombre} tuviste ${cuantas}`;
    else cabecera = n === 1 ? `${nombre} solo tienes` : `${nombre} tienes ${cuantas}`;
    const lista = relato(proximas.map(cosa), pasado);
    // Una o dos van seguidas; con más, el relato va en su propia frase.
    frases.push(n >= 3 ? `${cabecera}. ${lista}.` : `${cabecera}${n === 1 ? '' : ':'} ${lista}.`);
  } else if (citas.length === 0) {
    frases.push(`${nombre} no tienes nada a una hora fija.`);
  }

  if (tareas.length > 0) {
    const titulos = tareas.slice(0, MAX_EN_VOZ).map((t) => limpiarTitulo(t.titulo));
    if (tareas.length > MAX_EN_VOZ) titulos.push(`${contar(tareas.length - MAX_EN_VOZ, 'más', 'más')}`);
    const tienes = citas.length > 0 ? 'Además, tienes' : 'Solo tienes';
    frases.push(
      tareas.length === 1
        ? `${tienes} pendiente ${titulos[0]}.`
        : `${tienes} ${contar(tareas.length, 'tarea', 'tareas')} pendientes: ${unirConY(titulos)}.`,
    );
  }

  // Un comentario al final, como lo haría alguien que mira tu agenda contigo.
  if (!pasado && citas.length > 0) {
    const quedaManana = !esHoy || minuto < 12 * 60;
    if (citas.length >= 4) frases.push(elegir(['Día completito: tómatelo con calma.', 'Vas a ir a tope.'], dia));
    else if (citas.every((e) => fin(e) <= 14 * 60)) frases.push('La tarde la tienes libre.');
    else if (quedaManana && citas.every((e) => inicio(e) >= 14 * 60)) frases.push('Por la mañana, libre.');
  }
  return capitalizar(frases.join(' '));
}
