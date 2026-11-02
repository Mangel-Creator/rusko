import type { LugarEvento, Repeticion, TipoEvento } from '@/data/eventos/tipos';
import {
  claveDia,
  diaSemanaDesdeLunes,
  fechaDesdeClave,
  horaDesdeMinutos,
  minutosDesdeHora,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';

// Comprueba lo que devuelve el servidor de la captura rápida antes de usarlo.
// La IA casi siempre responde bien, pero nunca nos fiamos: si algo no cuadra se
// corrige (hora de fin, tipo, lugar...) o, si no tiene arreglo, se descarta y la
// app abre el formulario normal con la frase como título.
//
// Desde el 30/10/2026 la captura no solo apunta citas: también recordatorios («ponme un
// aviso para…»: una tarea con aviso a una hora), alarmas y preguntas por la agenda.

export type Confianza = 'alta' | 'media' | 'baja';

// Lo que la app entiende de una frase para apuntar, ya comprobado: una cita, una tarea
// o un recordatorio (tarea con aviso a una hora).
export type Propuesta = {
  titulo: string;
  fecha: ClaveDia;
  horaInicio: string | null; // null en tareas flexibles
  horaFin: string | null;
  tipo: TipoEvento;
  lugar: LugarEvento | null; // solo Casa o un sitio habitual (por referencia)
  flexible: boolean;
  duracionMin: number | null; // solo en tareas flexibles: 15, 30, 60 o 120
  avisarA: string | null; // solo en tareas: la hora del aviso ese día (recordatorio)
  avisoMin: number | null; // solo en citas: la antelación que ha pedido; null = la del perfil
  confianza: Confianza;
  opcionesHora?: string[]; // solo dijo la franja ("por la tarde"): las horas que se ofrecen
  // Solo en citas que se repiten («lunes, miércoles y jueves de 6 a 8, todo este mes»,
  // 02/11/2026). Sin "repeticion", no se repite.
  repeticion?: Repeticion;
  dias?: number[]; // cada semana: lunes = 0 ... domingo = 6
  hasta?: ClaveDia; // último día
};

// "Ponme una alarma mañana a las 7".
export type PropuestaAlarma = {
  fecha: ClaveDia;
  hora: string;
  etiqueta: string; // puede ir vacía
  confianza: Confianza;
};

// Qué quiere la persona con la frase.
export type Interpretacion =
  | { accion: 'apuntar'; propuesta: Propuesta }
  | { accion: 'alarma'; alarma: PropuestaAlarma }
  | { accion: 'pregunta'; dia: ClaveDia };

export type ContextoValidacion = {
  hoy: ClaveDia;
  // Ids de los sitios habituales del perfil. "casa" es la vivienda.
  sitiosIds: readonly string[];
  // "HH:MM" de ahora: un recordatorio para hoy no puede avisar en una hora ya pasada.
  ahora?: string;
  // Hora del aviso de un recordatorio sin hora ("recuérdame mañana llamar a mamá"):
  // la de levantarse. Por defecto, las 09:00.
  horaAviso?: string;
};

export const ID_CASA = 'casa';
export const DURACIONES = [15, 30, 60, 120] as const;
// Antelaciones de aviso que se pueden pedir para una cita (las mismas que la ficha).
export const ANTELACIONES = [10, 30, 60, 120, 1440] as const;
export const MAX_TITULO = 100;

// Días hacia atrás y hacia delante que se aceptan (lo de fuera es un error).
const DIAS_ATRAS = 7;
const DIAS_ADELANTE = 400;

const TIPOS: readonly TipoEvento[] = ['cliente', 'amigos', 'yo', 'entreno', 'estudios', 'proyectos'];
const CONFIANZAS: readonly Confianza[] = ['alta', 'media', 'baja'];

function esFechaValida(valor: unknown): valor is ClaveDia {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  // "2026-02-30" se convertiría en otro día: así se descartan los días que no existen.
  return claveDia(fechaDesdeClave(valor)) === valor;
}

function fechaCercana(valor: unknown, hoy: ClaveDia): ClaveDia | null {
  if (!esFechaValida(valor)) return null;
  if (valor < sumarDias(hoy, -DIAS_ATRAS) || valor > sumarDias(hoy, DIAS_ADELANTE)) return null;
  return valor;
}

// "8:05" o "08:05" -> "08:05". Cualquier otra cosa -> null.
export function normalizarHora(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const partes = /^(\d{1,2}):(\d{2})$/.exec(valor.trim());
  if (!partes) return null;
  const h = Number(partes[1]);
  const m = Number(partes[2]);
  if (h > 23 || m > 59) return null;
  return horaDesdeMinutos(h * 60 + m);
}

function masCercana(valor: number, opciones: readonly number[]): number {
  return opciones.reduce((mejor, d) => (Math.abs(d - valor) < Math.abs(mejor - valor) ? d : mejor), opciones[0]);
}

function duracionMasCercana(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 30;
  return masCercana(valor, DURACIONES);
}

function antelacion(valor: unknown): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) return null;
  return masCercana(valor, ANTELACIONES);
}

function limpiarTitulo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const titulo = valor.replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO).trim();
  if (!titulo) return null;
  return titulo.charAt(0).toLocaleUpperCase('es-ES') + titulo.slice(1);
}

function lugarDesdeId(valor: unknown, sitiosIds: readonly string[]): LugarEvento | null {
  if (typeof valor !== 'string') return null;
  if (valor === ID_CASA) return { tipo: 'casa' };
  return sitiosIds.includes(valor) ? { tipo: 'sitio', sitioId: valor } : null;
}

// Hora del aviso de un recordatorio: la dicha o la de por defecto. Si es para hoy y esa
// hora ya ha pasado, en la próxima hora en punto (o, si ya no cabe, a las 23:45).
export function horaDelRecordatorio(dicha: string | null, fecha: ClaveDia, contexto: ContextoValidacion): string {
  const hora = dicha ?? contexto.horaAviso ?? '09:00';
  if (fecha !== contexto.hoy || !contexto.ahora) return hora;
  const ahora = minutosDesdeHora(contexto.ahora);
  if (minutosDesdeHora(hora) > ahora) return hora;
  return horaDesdeMinutos(Math.min(Math.ceil((ahora + 1) / 60) * 60, 23 * 60 + 45));
}

// Devuelve la propuesta comprobada, o null si no se puede usar. "accion" (desde el
// 30/10/2026): "evento", "tarea" o "recordatorio"; sin ella, se mira "flexible".
export function validarPropuesta(datos: unknown, contexto: ContextoValidacion): Propuesta | null {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const d = datos as Record<string, unknown>;

  const titulo = limpiarTitulo(d.titulo);
  if (!titulo) return null;

  const fecha = fechaCercana(d.fecha, contexto.hoy);
  if (!fecha) return null;

  const tipo = TIPOS.includes(d.tipo as TipoEvento) ? (d.tipo as TipoEvento) : 'yo';
  const confianza = CONFIANZAS.includes(d.confianza as Confianza) ? (d.confianza as Confianza) : 'baja';
  const lugar = lugarDesdeId(d.sitioId, contexto.sitiosIds);
  const horaInicio = normalizarHora(d.horaInicio);
  const tarea = {
    titulo,
    fecha,
    horaInicio: null,
    horaFin: null,
    tipo,
    lugar,
    flexible: true,
    duracionMin: duracionMasCercana(d.duracionMin),
    avisarA: null,
    avisoMin: null,
    confianza,
  };

  // Recordatorio: una tarea de ese día con un aviso a la hora dicha.
  if (d.accion === 'recordatorio') {
    return { ...tarea, avisarA: horaDelRecordatorio(horaInicio, fecha, contexto) };
  }

  // Sin hora de inicio no puede ser un evento con hora: pasa a tarea flexible
  // ("llamar al taller mañana").
  if (d.accion === 'tarea' || d.flexible === true || !horaInicio) return tarea;

  // Hora de fin: la que diga, si es después del inicio; si no, 1 hora después.
  // Los eventos no cruzan la medianoche: como tarde, a las 23:59.
  const inicio = minutosDesdeHora(horaInicio);
  const finDicho = normalizarHora(d.horaFin);
  const fin = finDicho && minutosDesdeHora(finDicho) > inicio ? minutosDesdeHora(finDicho) : Math.min(inicio + 60, 1439);
  if (fin <= inicio) return null; // empieza a las 23:59: no cabe

  return {
    titulo,
    fecha,
    horaInicio,
    horaFin: horaDesdeMinutos(fin),
    tipo,
    lugar,
    flexible: false,
    duracionMin: null,
    avisarA: null,
    avisoMin: antelacion(d.avisoAntesMin),
    confianza,
    ...repeticionDe(d, fecha, contexto.hoy),
  };
}

const REPETICIONES: readonly Repeticion[] = ['diaria', 'semanal', 'mensual'];
const NOMBRES_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// La repetición de una cita: "repeticion", "diasSemana" (por su nombre) y "hasta". Con
// días de la semana, la fecha pasa al primero de ellos (y hasta debe quedar después).
function repeticionDe(
  d: Record<string, unknown>,
  fecha: ClaveDia,
  hoy: ClaveDia,
): { fecha?: ClaveDia; repeticion?: Repeticion; dias?: number[]; hasta?: ClaveDia } {
  const repeticion = REPETICIONES.find((r) => r === d.repeticion);
  if (!repeticion) return {};
  const dias =
    repeticion === 'semanal' && Array.isArray(d.diasSemana)
      ? [...new Set(d.diasSemana.map((n) => NOMBRES_DIAS.indexOf(String(n).toLocaleLowerCase('es-ES'))))]
          .filter((n) => n >= 0)
          .sort((a, b) => a - b)
      : [];
  let primero = fecha;
  if (dias.length) {
    for (let i = 0; i < 7 && !dias.includes(diaSemanaDesdeLunes(fechaDesdeClave(primero))); i++) {
      primero = sumarDias(primero, 1);
    }
  }
  const hasta = fechaCercana(d.hasta, hoy);
  if (hasta && hasta < primero) return {}; // el fin es antes del primer día: no se repite
  return {
    fecha: primero,
    repeticion,
    ...(dias.length ? { dias } : {}),
    ...(hasta ? { hasta } : {}),
  };
}

// Toda la respuesta de la IA: qué quiere hacer y sus datos. null si no se puede usar
// (o si no es nada de la agenda: "accion" = "otra").
export function validarInterpretacion(datos: unknown, contexto: ContextoValidacion): Interpretacion | null {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const d = datos as Record<string, unknown>;
  const confianza = CONFIANZAS.includes(d.confianza as Confianza) ? (d.confianza as Confianza) : 'baja';

  if (d.accion === 'otra') return null;

  if (d.accion === 'pregunta') {
    const dia = fechaCercana(d.fecha, contexto.hoy);
    return dia ? { accion: 'pregunta', dia } : null;
  }

  if (d.accion === 'alarma') {
    let fecha = fechaCercana(d.fecha, contexto.hoy);
    const hora = normalizarHora(d.horaInicio);
    if (!fecha || !hora || fecha < contexto.hoy) return null;
    // "A las 7" cuando ya son las 8: la de mañana.
    if (fecha === contexto.hoy && contexto.ahora && minutosDesdeHora(hora) <= minutosDesdeHora(contexto.ahora)) {
      fecha = sumarDias(fecha, 1);
    }
    const etiqueta = typeof d.titulo === 'string' ? (limpiarTitulo(d.titulo) ?? '') : '';
    return { accion: 'alarma', alarma: { fecha, hora, etiqueta: etiqueta.slice(0, 40), confianza } };
  }

  const propuesta = validarPropuesta(d, contexto);
  return propuesta ? { accion: 'apuntar', propuesta } : null;
}

// Una frase puede traer varias cosas («comida hoy por la tarde y pádel mañana por la
// mañana», 02/11/2026): la IA devuelve una lista y se queda lo que se puede usar.
export const MAX_ELEMENTOS = 10;

export function validarInterpretaciones(datos: unknown, contexto: ContextoValidacion): Interpretacion[] {
  const lista = Array.isArray(datos) ? datos : [datos];
  return lista
    .slice(0, MAX_ELEMENTOS)
    .map((d) => validarInterpretacion(d, contexto))
    .filter((i): i is Interpretacion => i !== null);
}
