import type { LugarEvento, TipoEvento } from '@/data/eventos/tipos';
import {
  claveDia,
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

export type Confianza = 'alta' | 'media' | 'baja';

// Lo que la app entiende de una frase, ya comprobado.
export type Propuesta = {
  titulo: string;
  fecha: ClaveDia;
  horaInicio: string | null; // null en tareas flexibles
  horaFin: string | null;
  tipo: TipoEvento;
  lugar: LugarEvento | null; // solo Casa o un sitio habitual (por referencia)
  flexible: boolean;
  duracionMin: number | null; // solo en tareas flexibles: 15, 30, 60 o 120
  confianza: Confianza;
  opcionesHora?: string[]; // solo dijo la franja ("por la tarde"): las horas que se ofrecen
};

export type ContextoValidacion = {
  hoy: ClaveDia;
  // Ids de los sitios habituales del perfil. "casa" es la vivienda.
  sitiosIds: readonly string[];
};

export const ID_CASA = 'casa';
export const DURACIONES = [15, 30, 60, 120] as const;
export const MAX_TITULO = 100;

// Días hacia atrás y hacia delante que se aceptan (lo de fuera es un error).
const DIAS_ATRAS = 7;
const DIAS_ADELANTE = 400;

const TIPOS: readonly TipoEvento[] = ['cliente', 'amigos', 'yo'];
const CONFIANZAS: readonly Confianza[] = ['alta', 'media', 'baja'];

function esFechaValida(valor: unknown): valor is ClaveDia {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  // "2026-02-30" se convertiría en otro día: así se descartan los días que no existen.
  return claveDia(fechaDesdeClave(valor)) === valor;
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

function duracionMasCercana(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 30;
  return DURACIONES.reduce((mejor, d) => (Math.abs(d - valor) < Math.abs(mejor - valor) ? d : mejor), 30);
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

// Devuelve la propuesta comprobada, o null si no se puede usar.
export function validarPropuesta(datos: unknown, contexto: ContextoValidacion): Propuesta | null {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const d = datos as Record<string, unknown>;

  const titulo = limpiarTitulo(d.titulo);
  if (!titulo) return null;

  if (!esFechaValida(d.fecha)) return null;
  const fecha = d.fecha;
  if (fecha < sumarDias(contexto.hoy, -DIAS_ATRAS) || fecha > sumarDias(contexto.hoy, DIAS_ADELANTE)) return null;

  const tipo = TIPOS.includes(d.tipo as TipoEvento) ? (d.tipo as TipoEvento) : 'yo';
  const confianza = CONFIANZAS.includes(d.confianza as Confianza) ? (d.confianza as Confianza) : 'baja';
  const lugar = lugarDesdeId(d.sitioId, contexto.sitiosIds);
  const horaInicio = normalizarHora(d.horaInicio);

  // Sin hora de inicio no puede ser un evento con hora: pasa a tarea flexible
  // ("llamar al taller mañana").
  if (d.flexible === true || !horaInicio) {
    return {
      titulo,
      fecha,
      horaInicio: null,
      horaFin: null,
      tipo,
      lugar,
      flexible: true,
      duracionMin: duracionMasCercana(d.duracionMin),
      confianza,
    };
  }

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
    confianza,
  };
}
