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
//   - respuestaDelDia(...): "El miércoles 28 tienes 2 cosas: a las 10:00, Reunión en
//     Oficina y a las 18:00, Pádel."

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

// "Hoy", "Mañana", "Ayer", "El miércoles 28" o, si queda lejos o en
// otro mes, "El miércoles 4 de noviembre".
export function nombreDelDia(dia: ClaveDia, hoy: ClaveDia): string {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  if (dia === sumarDias(hoy, -1)) return 'Ayer';
  const fecha = fechaDesdeClave(dia);
  const base = `El ${NOMBRES_DIA[diaSemanaDesdeLunes(fecha)]} ${fecha.getDate()}`;
  const cerca = dia > hoy && dia <= sumarDias(hoy, 6) && fecha.getMonth() === fechaDesdeClave(hoy).getMonth();
  return cerca ? base : `${base} de ${nombreMes(fecha).toLocaleLowerCase('es-ES')}`;
}

// "a las 10:00", pero "a la 1:30" (se dice "a la una").
function aLas(hora: string): string {
  const h = Number(hora.slice(0, 2));
  return `${h === 1 ? 'a la' : 'a las'} ${h}:${hora.slice(3)}`;
}

function unirConY(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

function contar(n: number, una: string, varias: string): string {
  return n === 1 ? una : `${n} ${varias}`;
}

// Más de esto cansa de oír: el resto se dice como "y 3 más".
const MAX_EN_VOZ = 6;

function lista(textos: string[]): string {
  const vistos = textos.slice(0, MAX_EN_VOZ);
  const resto = textos.length - vistos.length;
  if (resto > 0) vistos.push(resto === 1 ? 'una más' : `${resto} más`);
  return unirConY(vistos);
}

type Datos = {
  eventos: Evento[];
  dia: ClaveDia;
  ahora: Date;
  perfil: Perfil | null;
};

// La respuesta, lista para leerla en voz alta. De hoy solo cuenta lo que queda.
export function respuestaDelDia({ eventos, dia, ahora, perfil }: Datos): string {
  const hoy = claveDia(ahora);
  const pasado = dia < hoy;
  const nombre = nombreDelDia(dia, hoy);
  const delDia = eventosDelDia(eventos, dia);
  const minuto = minutosDelDia(ahora);
  const citas =
    dia === hoy ? delDia.filter((e) => minutosDesdeHora(e.horaFin ?? e.horaInicio ?? '00:00') > minuto) : delDia;
  // Las tareas sin hacer de días pasados salen hoy; de un día pasado no se cuentan.
  const tareas = pasado ? [] : tareasPendientes(eventos, dia, hoy);

  if (citas.length === 0 && tareas.length === 0) {
    if (pasado) return `${nombre} no tenías nada apuntado.`;
    if (dia === hoy && delDia.length > 0) return 'Hoy ya no te queda nada. A descansar.';
    return `${nombre} lo tienes libre.`;
  }

  const frases: string[] = [];
  if (citas.length > 0) {
    const textos = citas.map((e) => {
      const lugar = resolverLugar(e.lugar, perfil);
      const sitio = lugar ? (lugar.nombre ?? lugar.direccion.split(',')[0]) : null;
      return `${aLas(e.horaInicio ?? '00:00')}, ${e.titulo}${sitio ? ` en ${sitio}` : ''}`;
    });
    const cuantas = contar(citas.length, 'una cosa', 'cosas');
    const empieza = pasado ? `tenías ${cuantas}` : dia === hoy ? `te queda${citas.length === 1 ? '' : 'n'} ${cuantas}` : `tienes ${cuantas}`;
    frases.push(`${nombre} ${empieza}: ${lista(textos)}.`);
  } else {
    frases.push(`${nombre} no tienes nada con hora.`);
  }
  if (tareas.length > 0) {
    const cuantas = contar(tareas.length, 'una tarea', 'tareas');
    frases.push(`${citas.length > 0 ? 'Y' : 'Tienes'} ${cuantas} sin hora: ${lista(tareas.map((t) => t.titulo))}.`);
  }
  return capitalizar(frases.join(' '));
}
