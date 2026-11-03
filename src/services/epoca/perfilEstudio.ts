import type { Epoca, RegistroBloque } from '@/data/epocas/tipos';
import type { DiaSemana, MomentoDelDia } from '@/data/perfil';
import { diaSemanaDesdeLunes, fechaDesdeClave, type ClaveDia } from '@/services/fechas';

import { densidadDe, type PdfLeido } from './apuntes';
import { diasEntre } from './estado';
import { DIAS_LEJOS } from './plan';
import { HABITOS_VACIOS, type AsignaturaCuestionario, type HabitosCuestionario } from './validarIA';

// Perfil de estudio (03/11/2026): lo que Rusko sabe de cómo estudia la persona,
// para no volver a preguntarlo y para que cada plan salga mejor que el anterior.
// Se guarda en el dispositivo ("organizy:perfilEstudio", data/perfilEstudio.ts) y
// viaja en la copia. Guarda:
// - Sus respuestas al cuestionario (hábitos y su tiempo).
// - Su ritmo real: al acabar cada plan dice si le sobró o le faltó tiempo.
// - Lo que hizo en cada plan (hecho o saltado entre semana, el fin de semana, lejos
//   o cerca del examen, y por qué), aunque luego borre la época.
// - Por examen: cómo es (búsqueda de la IA) y lo que ocupan sus apuntes.
// Funciones puras, con pruebas en __tests__.

export type Densidad = 'baja' | 'media' | 'alta';
// Un tema medido en sus apuntes: cuánto ocupa, no lo que dice.
export type TemaMedido = { nombre: string; paginas: number; densidad: Densidad };
export type ExamenGuardado = {
  ficha?: { texto: string; fecha: ClaveDia }; // cómo es el examen (búsqueda en internet)
  apuntes?: { temas: TemaMedido[]; fecha: ClaveDia };
};

type Par = { hechos: number; saltados: number };
export type Valoracion = 'sobro' | 'justo' | 'falto';
export type Recuento = {
  fin: ClaveDia;
  semana: Par;
  finde: Par;
  lejos: Par; // con el examen a más de DIAS_LEJOS días
  cerca: Par;
  motivos: string[]; // por qué se saltó bloques, si lo dijo
  valoracion?: Valoracion;
};

export type TiempoEstudio = { horasDia: number; rindeMas: MomentoDelDia; diaLibre: DiaSemana | null };

export type PerfilEstudio = {
  habitos: HabitosCuestionario;
  tiempo: TiempoEstudio | null;
  ritmo: number; // 1 = como se estima; 1,3 = le lleva un 30 % más
  recuentos: Record<string, Recuento>; // por época
  examenes: Record<string, ExamenGuardado>; // por nombre (claveExamen)
};

export const PERFIL_ESTUDIO_VACIO: PerfilEstudio = {
  habitos: HABITOS_VACIOS,
  tiempo: null,
  ritmo: 1,
  recuentos: {},
  examenes: {},
};

const MAX_EXAMENES = 30;
const MAX_RECUENTOS = 12;
const RITMO_MIN = 0.6;
const RITMO_MAX = 2;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Lo guardado puede venir de una copia antigua o tocada: se completa lo que falte.
export function normalizarPerfilEstudio(v: unknown): PerfilEstudio {
  if (!esObjeto(v)) return PERFIL_ESTUDIO_VACIO;
  const ritmo = typeof v.ritmo === 'number' && Number.isFinite(v.ritmo) ? v.ritmo : 1;
  return {
    habitos: { ...HABITOS_VACIOS, ...(esObjeto(v.habitos) ? (v.habitos as Partial<HabitosCuestionario>) : {}) },
    tiempo: esObjeto(v.tiempo) ? (v.tiempo as TiempoEstudio) : null,
    ritmo: Math.min(RITMO_MAX, Math.max(RITMO_MIN, ritmo)),
    recuentos: esObjeto(v.recuentos) ? (v.recuentos as Record<string, Recuento>) : {},
    examenes: esObjeto(v.examenes) ? (v.examenes as Record<string, ExamenGuardado>) : {},
  };
}

// "Inglés B2 " y "inglés b2" son el mismo examen.
export function claveExamen(nombre: string): string {
  return nombre
    .trim()
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export function conExamen(perfil: PerfilEstudio, nombre: string, cambios: ExamenGuardado): PerfilEstudio {
  const clave = claveExamen(nombre);
  if (!clave) return perfil;
  const { [clave]: anterior, ...resto } = perfil.examenes;
  // El último que se toca, al final: si hay demasiados, se van los más antiguos.
  const examenes = Object.entries({ ...resto, [clave]: { ...anterior, ...cambios } }).slice(-MAX_EXAMENES);
  return { ...perfil, examenes: Object.fromEntries(examenes) };
}

export function examenGuardado(perfil: PerfilEstudio, nombre: string): ExamenGuardado {
  return perfil.examenes[claveExamen(nombre)] ?? {};
}

// Lo que contesta la IA al medir un PDF (acción "medir"): dónde empieza y acaba cada
// tema. Con el PDF leído en el dispositivo, la densidad sale de su texto, no de la
// IA. Devuelve null si no hay nada que valga.
export function temasMedidos(datos: unknown, leido?: PdfLeido): TemaMedido[] | null {
  const lista = esObjeto(datos) && Array.isArray(datos.temas) ? datos.temas : [];
  const temas = lista
    .filter(esObjeto)
    .map((t): TemaMedido | null => {
      const nombre = typeof t.nombre === 'string' ? t.nombre.trim().slice(0, 60) : '';
      const inicio = Number(t.paginaInicio);
      const fin = Number(t.paginaFin);
      if (!nombre || !Number.isInteger(inicio) || !Number.isInteger(fin) || fin < inicio) return null;
      const densidad = leido
        ? densidadDe(leido.paginas.slice(inicio - 1, fin))
        : t.densidad === 'baja' || t.densidad === 'alta'
          ? t.densidad
          : 'media';
      return { nombre, paginas: Math.min(500, fin - inicio + 1), densidad };
    })
    .filter((t): t is TemaMedido => t !== null)
    .slice(0, 40);
  return temas.length > 0 ? temas : null;
}

// ---------- Horas que necesita cada examen ----------
// La app las calcula (siempre igual para lo mismo) y la IA solo puede moverlas
// un 15 % (MARGEN_ESTIMACION) explicando por qué. Base: COIE de la UNED (2 a 4 h
// por tema y repasos aparte) y ritmos de lectura de estudio (4 a 9 min por página
// según lo densa que sea, más el esquema).

const HORAS_TEMA: Record<AsignaturaCuestionario['dificultad'], number> = { facil: 2, media: 3, dificil: 4.5 };
const MIN_PAGINA: Record<Densidad, number> = { baja: 4, media: 6, alta: 9 };
const ESQUEMA = 1.3; // hacer el esquema o las fichas mientras se estudia
const REPASOS = 1.5; // repasos y simulacros: un tercio del total
const AVANCE: Record<AsignaturaCuestionario['avance'], number> = { nada: 1, poco: 0.8, mitad: 0.55, casi: 0.3 };
const LECTURA = { lenta: 1.2, normal: 1, rapida: 0.85 } as const;
const ENTENDER = { rapido: 0.8, normal: 1, cuesta: 1.4 } as const;
const IMPREVISTOS = { 'casi-nunca': 1.1, 'a-veces': 1.2, 'a-menudo': 1.3 } as const;

export function estimarHoras(
  a: Pick<AsignaturaCuestionario, 'temas' | 'dificultad' | 'tipoExamen' | 'avance'>,
  perfil: Pick<PerfilEstudio, 'habitos' | 'ritmo'>,
  apuntes?: TemaMedido[],
): number {
  const { lectura, entender, imprevistos } = perfil.habitos;
  const aprender =
    apuntes && apuntes.length > 0
      ? (apuntes.reduce((t, x) => t + x.paginas * MIN_PAGINA[x.densidad], 0) * ESQUEMA * LECTURA[lectura ?? 'normal']) / 60
      : a.temas * HORAS_TEMA[a.dificultad] * (a.tipoExamen === 'desarrollo' || a.tipoExamen === 'problemas' ? 1.2 : 1);
  const horas =
    aprender *
    REPASOS *
    AVANCE[a.avance] *
    ENTENDER[entender ?? 'normal'] *
    perfil.ritmo *
    IMPREVISTOS[imprevistos ?? 'a-veces'];
  return Math.min(200, Math.max(1, Math.round(horas * 2) / 2));
}

// ---------- Lo que aprende de sus planes ----------

const par = (): Par => ({ hechos: 0, saltados: 0 });

export function recuentoEpoca(epoca: Epoca, registro: RegistroBloque[]): Recuento | null {
  const propio = registro.filter((r) => r.epocaId === epoca.id);
  if (epoca.ejemplo || propio.length === 0) return null;
  const r: Recuento = { fin: epoca.fin, semana: par(), finde: par(), lejos: par(), cerca: par(), motivos: [] };
  for (const b of propio) {
    const campo = b.estado === 'hecho' ? 'hechos' : 'saltados';
    r[diaSemanaDesdeLunes(fechaDesdeClave(b.dia)) >= 5 ? 'finde' : 'semana'][campo]++;
    const hito = epoca.hitos.find((h) => h.id === b.hitoId);
    if (hito) r[diasEntre(b.dia, hito.fecha) > DIAS_LEJOS ? 'lejos' : 'cerca'][campo]++;
    const motivo = b.motivo?.trim().slice(0, 60);
    if (b.estado === 'saltado' && motivo) r.motivos.push(motivo);
  }
  r.motivos = r.motivos.slice(-10);
  return r;
}

// Apunta lo de las épocas que hay ahora (las borradas se quedan como estaban).
export function conRecuentos(perfil: PerfilEstudio, epocas: Epoca[], registro: RegistroBloque[]): PerfilEstudio {
  const recuentos = { ...perfil.recuentos };
  for (const e of epocas) {
    const r = recuentoEpoca(e, registro);
    if (r) recuentos[e.id] = { ...r, valoracion: recuentos[e.id]?.valoracion };
  }
  const ultimos = Object.entries(recuentos)
    .sort(([, a], [, b]) => a.fin.localeCompare(b.fin))
    .slice(-MAX_RECUENTOS);
  return { ...perfil, recuentos: Object.fromEntries(ultimos) };
}

const AJUSTE_RITMO: Record<Valoracion, number> = { sobro: 0.9, justo: 1, falto: 1.15 };

// Al acabar un plan: "Me sobró / Justo / Me faltó tiempo". Cuenta una vez por época.
export function conValoracion(perfil: PerfilEstudio, epocaId: string, fin: ClaveDia, valoracion: Valoracion): PerfilEstudio {
  const anterior = perfil.recuentos[epocaId];
  if (anterior?.valoracion) return perfil;
  const vacio: Recuento = { fin, semana: par(), finde: par(), lejos: par(), cerca: par(), motivos: [] };
  return {
    ...perfil,
    ritmo: Math.min(RITMO_MAX, Math.max(RITMO_MIN, Math.round(perfil.ritmo * AJUSTE_RITMO[valoracion] * 100) / 100)),
    recuentos: { ...perfil.recuentos, [epocaId]: { ...(anterior ?? vacio), valoracion } },
  };
}

const MIN_MUESTRA = 6;
const porcentaje = (p: Par) => Math.round((p.hechos / (p.hechos + p.saltados)) * 100);
const suma = (pares: Par[]): Par =>
  pares.reduce((t, p) => ({ hechos: t.hechos + p.hechos, saltados: t.saltados + p.saltados }), par());

// Frases para la IA (de él) y para la tarjeta "Lo que he aprendido de ti" (de tú, con
// tu = true). Solo lo que tiene datos suficientes (MIN_MUESTRA bloques marcados por grupo).
export function lineasAprendidas(perfil: PerfilEstudio, tu = false): string[] {
  const recuentos = Object.values(perfil.recuentos);
  const lineas: string[] = [];
  const valoradas = recuentos.filter((r) => r.valoracion).length;
  if (valoradas > 0 && perfil.ritmo !== 1) {
    const diferencia = Math.round(Math.abs(perfil.ritmo - 1) * 100);
    const planes = valoradas === 1 ? `${tu ? 'tu' : 'su'} último plan` : `${tu ? 'tus' : 'sus'} ${valoradas} últimos planes`;
    lineas.push(
      `Según ${planes}, ${tu ? 'necesitas' : 'necesita'} un ${diferencia} % ${perfil.ritmo > 1 ? 'más' : 'menos'} de tiempo del que se calcula.`,
    );
  }
  const comparar = (a: Par, b: Par, textoA: string, textoB: string) => {
    if (a.hechos + a.saltados < MIN_MUESTRA || b.hechos + b.saltados < MIN_MUESTRA) return;
    lineas.push(`${textoA} ${tu ? 'haces' : 'hace'} el ${porcentaje(a)} % de los bloques; ${textoB}, el ${porcentaje(b)} %.`);
  };
  comparar(suma(recuentos.map((r) => r.semana)), suma(recuentos.map((r) => r.finde)), 'Entre semana', 'el fin de semana');
  comparar(
    suma(recuentos.map((r) => r.lejos)),
    suma(recuentos.map((r) => r.cerca)),
    'Con el examen a más de 4 semanas',
    'con el examen cerca',
  );
  const veces = new Map<string, number>();
  for (const m of recuentos.flatMap((r) => r.motivos)) {
    const clave = m.toLocaleLowerCase('es-ES');
    veces.set(clave, (veces.get(clave) ?? 0) + 1);
  }
  const repetidos = [...veces.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => `"${m}"`);
  if (repetidos.length > 0) {
    lineas.push(`Cuando ${tu ? 'te saltas' : 'se salta'} bloques, suele ser por: ${repetidos.join(', ')}.`);
  }
  return lineas;
}
