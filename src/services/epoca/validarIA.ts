import type {
  Descanso,
  Dificultad,
  Epoca,
  RegistroBloque,
  TemaHito,
  TipoEpoca,
} from '@/data/epocas/tipos';
import type { DiaSemana, MomentoDelDia } from '@/data/perfil';
import { sumarDias, type ClaveDia } from '@/services/fechas';

import { diasEntre } from './estado';
import type { PlanEpoca } from './plan';
import { progresoHitos, progresoSemana, textoHoras } from './progreso';

// La IA ayuda a planificar la Época dorada de cuatro formas (ver
// services/epoca/ia.ts y supabase/functions/epoca):
//   0. "Cuestionario": de las respuestas, el plan entero con temas, repasos y consejos.
//   1. "Cuéntamelo y lo preparo": de un texto libre, los datos del formulario.
//   2. "Temario por temas": parte el temario de un hito en temas con horas.
//   3. "Repaso de cómo vas": mira el progreso y propone cambios.
// Aquí se comprueba lo que devuelve, sin fiarse: fechas reales y cercanas,
// horas razonables, sitios que existen... Lo que no cuadra se descarta.
// Funciones puras, con pruebas en __tests__.

const TIPOS: TipoEpoca[] = ['examenes', 'entregas', 'trabajo', 'otro'];
const MOMENTOS: MomentoDelDia[] = ['manana', 'tarde', 'noche'];
const DESCANSOS: Descanso[] = ['25-5', '50-10', '90-15'];
const DIFICULTADES: Dificultad[] = ['facil', 'media', 'dificil'];

export const MAX_TEXTO_EPOCA = 1500;
export const MAX_TEXTO_TEMARIO = 4000;
const MAX_HITOS = 20;
const MAX_IMPRESCINDIBLES = 10;
const MAX_TEMAS = 20;
const MAX_PROPUESTAS = 4;
const MAX_CONSEJOS = 6;
export const MAX_ASIGNATURAS = 10;

// ---------- Utilidades ----------

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const limpio = v.replace(/\s+/g, ' ').trim();
  return limpio ? limpio.slice(0, max) : null;
}

function uno<T extends string>(v: unknown, validos: readonly T[]): T | null {
  return validos.includes(v as T) ? (v as T) : null;
}

// "AAAA-MM-DD" de verdad (no 2026-02-30).
export function esFechaReal(v: unknown): v is ClaveDia {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [a, m, d] = v.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

// "HH:MM" redondeada al cuarto de hora (los selectores de hora van de 15 en 15).
function hora(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const total = Math.min(23 * 60 + 45, Math.round((h * 60 + min) / 15) * 15);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function minutos(h: string): number {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
}

function numero(v: unknown, minimo: number, maximo: number, paso: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const redondeado = Math.round(v / paso) * paso;
  return Math.min(maximo, Math.max(minimo, redondeado));
}

function diaSemana(v: unknown): DiaSemana | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6 ? (v as DiaSemana) : null;
}

function diasSemana(v: unknown): DiaSemana[] {
  if (!Array.isArray(v)) return [];
  const dias = v.map(diaSemana).filter((d): d is DiaSemana => d !== null);
  return [...new Set(dias)].sort((a, b) => a - b);
}

// ---------- 1. "Cuéntamelo y lo preparo" ----------

export type LugarPropuesto =
  | { tipo: 'casa' }
  | { tipo: 'sitio'; sitioId: string }
  | { tipo: 'otro'; direccion: string };

export type HitoPropuesto = {
  nombre: string;
  fecha: ClaveDia;
  hora: string;
  dificultad: Dificultad;
  horasPreparacion: number;
  temas: TemaPropuesto[]; // solo con el cuestionario: temas y repasos en orden
};

export type TemaPropuesto = Omit<TemaHito, 'id'>;

export type ImprescindiblePropuesto = {
  nombre: string;
  dias: DiaSemana[];
  horaInicio: string;
  horaFin: string;
};

// Lo que se ha entendido. null = no lo ha dicho (el formulario deja lo que tenía).
// En diaLibre, "ninguno" = ha dicho que no quiere día libre.
export type PropuestaEpoca = {
  nombre: string | null;
  tipo: TipoEpoca | null;
  inicio: ClaveDia | null;
  fin: ClaveDia | null;
  lugar: LugarPropuesto | null;
  diasVas: DiaSemana[] | null;
  horasDia: number | null;
  rindeMas: MomentoDelDia | null;
  descanso: Descanso | null;
  diaLibre: DiaSemana | 'ninguno' | null;
  levantarse: string | null;
  acostarse: string | null;
  imprescindibles: ImprescindiblePropuesto[];
  hitos: HitoPropuesto[];
  notas: string | null; // lo que ha tenido que suponer, para que lo revise
  consejos: string[]; // solo con el cuestionario: cómo estudiar cada cosa
};

export type ContextoPreparacion = { hoy: ClaveDia; sitiosIds: string[] };

function lugarPropuesto(v: unknown, sitiosIds: string[]): LugarPropuesto | null {
  if (!esObjeto(v)) return null;
  if (v.tipo === 'casa') return { tipo: 'casa' };
  if (v.tipo === 'sitio' && typeof v.sitioId === 'string' && sitiosIds.includes(v.sitioId)) {
    return { tipo: 'sitio', sitioId: v.sitioId };
  }
  const direccion = texto(v.direccion, 120);
  if (v.tipo === 'otro' && direccion) return { tipo: 'otro', direccion };
  return null;
}

export function validarPreparacion(datos: unknown, { hoy, sitiosIds }: ContextoPreparacion): PropuestaEpoca | null {
  if (!esObjeto(datos)) return null;
  const limite = sumarDias(hoy, 366);
  const cercana = (f: unknown): f is ClaveDia => esFechaReal(f) && f >= hoy && f <= limite;

  const hitos: HitoPropuesto[] = (Array.isArray(datos.hitos) ? datos.hitos : [])
    .filter(esObjeto)
    .map((h) => {
      const nombre = texto(h.nombre, 60);
      if (!nombre || !cercana(h.fecha)) return null;
      return {
        nombre,
        fecha: h.fecha,
        hora: hora(h.hora) ?? '09:00',
        dificultad: uno(h.dificultad, DIFICULTADES) ?? 'media',
        horasPreparacion: numero(h.horasPreparacion, 1, 200, 1) ?? 6,
        temas: listaTemas(h.temas),
      };
    })
    .filter((h): h is HitoPropuesto => h !== null)
    .slice(0, MAX_HITOS)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

  const imprescindibles: ImprescindiblePropuesto[] = (Array.isArray(datos.imprescindibles) ? datos.imprescindibles : [])
    .filter(esObjeto)
    .map((i) => {
      const nombre = texto(i.nombre, 40);
      const dias = diasSemana(i.dias);
      const inicio = hora(i.horaInicio);
      const fin = hora(i.horaFin);
      if (!nombre || dias.length === 0 || !inicio || !fin || minutos(fin) <= minutos(inicio)) return null;
      return { nombre, dias, horaInicio: inicio, horaFin: fin };
    })
    .filter((i): i is ImprescindiblePropuesto => i !== null)
    .slice(0, MAX_IMPRESCINDIBLES);

  // Fechas de la época: los hitos tienen que caer dentro.
  let inicio: ClaveDia | null = cercana(datos.inicio) ? datos.inicio : null;
  let fin: ClaveDia | null = cercana(datos.fin) ? datos.fin : null;
  const primerHito = hitos[0]?.fecha;
  const ultimoHito = hitos[hitos.length - 1]?.fecha;
  if (inicio && fin && fin < inicio) fin = null;
  if (ultimoHito && (!fin || fin < ultimoHito)) fin = ultimoHito;
  if (primerHito && inicio && inicio > primerHito) inicio = hoy;

  const levantarse = hora(datos.levantarse);
  let acostarse = hora(datos.acostarse);
  if (levantarse && acostarse === levantarse) acostarse = null;

  const diasVas = Array.isArray(datos.diasVas) ? diasSemana(datos.diasVas) : [];
  const diaLibre = datos.diaLibre === 'ninguno' ? 'ninguno' : diaSemana(datos.diaLibre);

  return {
    nombre: texto(datos.nombre, 60),
    tipo: uno(datos.tipo, TIPOS),
    inicio,
    fin,
    lugar: lugarPropuesto(datos.lugar, sitiosIds),
    diasVas: diasVas.length > 0 ? diasVas : null,
    horasDia: numero(datos.horasDia, 0.5, 14, 0.5),
    rindeMas: uno(datos.rindeMas, MOMENTOS),
    descanso: uno(datos.descanso, DESCANSOS),
    diaLibre,
    levantarse,
    acostarse,
    imprescindibles,
    hitos,
    notas: texto(datos.notas, 400),
    consejos: (Array.isArray(datos.consejos) ? datos.consejos : [])
      .map((c) => texto(c, 300))
      .filter((c): c is string => c !== null)
      .slice(0, MAX_CONSEJOS),
  };
}

// ¿Ha entendido algo que merezca la pena? Si no, se le dice que no lo ha pillado.
export function propuestaUtil(p: PropuestaEpoca): boolean {
  return p.hitos.length > 0 || !!p.tipo || !!p.fin || p.horasDia !== null || !!p.lugar;
}

// ---------- 2. "Temario por temas" ----------

export type PropuestaTemas = { temas: TemaHito[]; consejo: string | null };

function listaTemas(v: unknown): TemaPropuesto[] {
  return (Array.isArray(v) ? v : [])
    .filter(esObjeto)
    .map((t) => {
      const nombre = texto(t.nombre, 80);
      const horas = numero(t.horas, 0.5, 100, 0.5);
      return nombre && horas ? { nombre, horas } : null;
    })
    .filter((t): t is TemaPropuesto => t !== null)
    .slice(0, MAX_TEMAS);
}

export function validarTemas(datos: unknown, crearId: () => string): PropuestaTemas | null {
  if (!esObjeto(datos)) return null;
  const temas = listaTemas(datos.temas).map((t) => ({ id: crearId(), ...t }));
  if (temas.length === 0) return null;
  return { temas, consejo: texto(datos.consejo, 300) };
}

// ---------- 3. "Repaso de cómo vas" ----------

// Lo que se manda para el repaso: solo números y los nombres de los hitos.
export function datosRepaso(epoca: Epoca, registro: RegistroBloque[], plan: PlanEpoca, hoy: ClaveDia) {
  const hace7 = sumarDias(hoy, -7);
  const propio = registro.filter((r) => r.epocaId === epoca.id);
  const ultimos = propio.filter((r) => r.dia >= hace7 && r.dia < hoy);
  const horas = (min: number) => Math.round((min / 60) * 10) / 10;
  const semana = progresoSemana(epoca, registro, plan, hoy);

  return {
    hoy,
    fin: epoca.fin,
    diasQuedan: diasEntre(hoy, epoca.fin) + 1,
    horasDia: epoca.ritmo.horasDia,
    descanso: epoca.ritmo.descanso,
    tieneDiaLibre: epoca.ritmo.diaLibre !== null,
    semana: { horasHechas: horas(semana.hechoMin), horasPlaneadas: horas(semana.planeadoMin) },
    ultimos7Dias: {
      bloquesHechos: ultimos.filter((r) => r.estado === 'hecho').length,
      bloquesSaltados: ultimos.filter((r) => r.estado === 'saltado').length,
      horasHechas: horas(ultimos.filter((r) => r.estado === 'hecho').reduce((t, r) => t + (r.fin - r.inicio), 0)),
    },
    hitos: progresoHitos(epoca, registro, plan)
      .filter((p) => p.hito.fecha >= hoy)
      .map((p) => ({
        id: p.hito.id,
        nombre: p.hito.nombre,
        fecha: p.hito.fecha,
        diasHasta: diasEntre(hoy, p.hito.fecha),
        dificultad: p.hito.dificultad,
        horasPreparacion: p.hito.horasPreparacion,
        horasHechas: horas(p.hechoMin),
        horasQueNoCaben: horas(p.faltanMin),
        bloquesSaltados: propio.filter((r) => r.hitoId === p.hito.id && r.estado === 'saltado').length,
        temas: (p.hito.temas ?? []).length,
      })),
  };
}

export type PropuestaRepaso = { id: string; motivo: string } & (
  | { tipo: 'horas-dia'; horas: number }
  | { tipo: 'horas-hito'; hitoId: string; horas: number }
  | { tipo: 'dificultad'; hitoId: string; dificultad: Dificultad }
  | { tipo: 'descanso'; descanso: Descanso }
);

export type Repaso = { resumen: string; propuestas: PropuestaRepaso[] };

export function validarRepaso(datos: unknown, epoca: Epoca, hoy: ClaveDia): Repaso | null {
  if (!esObjeto(datos)) return null;
  const resumen = texto(datos.resumen, 500);
  if (!resumen) return null;
  const hitoVivo = (id: unknown) => epoca.hitos.find((h) => h.id === id && h.fecha >= hoy);

  const propuestas: PropuestaRepaso[] = [];
  for (const [i, p] of (Array.isArray(datos.propuestas) ? datos.propuestas : []).filter(esObjeto).entries()) {
    const motivo = texto(p.motivo, 200) ?? '';
    const id = `propuesta-${i}`;
    if (p.tipo === 'horas-dia') {
      const horas = numero(p.horas, 0.5, 14, 0.5);
      if (horas !== null && horas !== epoca.ritmo.horasDia) propuestas.push({ id, motivo, tipo: 'horas-dia', horas });
    } else if (p.tipo === 'horas-hito') {
      const hito = hitoVivo(p.hitoId);
      const horas = numero(p.horas, 1, 200, 1);
      if (hito && horas !== null && horas !== hito.horasPreparacion) {
        propuestas.push({ id, motivo, tipo: 'horas-hito', hitoId: hito.id, horas });
      }
    } else if (p.tipo === 'dificultad') {
      const hito = hitoVivo(p.hitoId);
      const dificultad = uno(p.dificultad, DIFICULTADES);
      if (hito && dificultad && dificultad !== hito.dificultad) {
        propuestas.push({ id, motivo, tipo: 'dificultad', hitoId: hito.id, dificultad });
      }
    } else if (p.tipo === 'descanso') {
      const descanso = uno(p.descanso, DESCANSOS);
      if (descanso && descanso !== epoca.ritmo.descanso) propuestas.push({ id, motivo, tipo: 'descanso', descanso });
    }
  }
  return { resumen, propuestas: propuestas.slice(0, MAX_PROPUESTAS) };
}

// Aplica una propuesta a la época (no la guarda).
export function aplicarPropuesta(epoca: Epoca, p: PropuestaRepaso): Epoca {
  switch (p.tipo) {
    case 'horas-dia':
      return { ...epoca, ritmo: { ...epoca.ritmo, horasDia: p.horas } };
    case 'descanso':
      return { ...epoca, ritmo: { ...epoca.ritmo, descanso: p.descanso } };
    case 'horas-hito':
      return {
        ...epoca,
        hitos: epoca.hitos.map((h) => (h.id === p.hitoId ? { ...h, horasPreparacion: p.horas } : h)),
      };
    case 'dificultad':
      return {
        ...epoca,
        hitos: epoca.hitos.map((h) => (h.id === p.hitoId ? { ...h, dificultad: p.dificultad } : h)),
      };
  }
}

const NOMBRE_DIFICULTAD: Record<Dificultad, string> = { facil: 'fácil', media: 'media', dificil: 'difícil' };
const NOMBRE_DESCANSO: Record<Descanso, string> = {
  '25-5': 'bloques de 25 min con 5 de descanso',
  '50-10': 'bloques de 50 min con 10 de descanso',
  '90-15': 'bloques de 90 min con 15 de descanso',
};

// "Estadística: de 12 h a 18 h de preparación"
export function textoPropuesta(epoca: Epoca, p: PropuestaRepaso): string {
  const hito = 'hitoId' in p ? epoca.hitos.find((h) => h.id === p.hitoId) : null;
  switch (p.tipo) {
    case 'horas-dia':
      return `Horas al día: de ${textoHoras(epoca.ritmo.horasDia * 60)} a ${textoHoras(p.horas * 60)}`;
    case 'descanso':
      return `Pasar a ${NOMBRE_DESCANSO[p.descanso]}`;
    case 'horas-hito':
      return `${hito?.nombre ?? 'Hito'}: de ${textoHoras((hito?.horasPreparacion ?? 0) * 60)} a ${textoHoras(p.horas * 60)} de preparación`;
    case 'dificultad':
      return `${hito?.nombre ?? 'Hito'}: marcarlo como ${NOMBRE_DIFICULTAD[p.dificultad]}`;
  }
}

// ---------- 0. Cuestionario (02/11/2026) ----------
// Preguntas basadas en las guías del COIE de la UNED: cada examen con su tipo, el
// tiempo real que tiene y sus hábitos de estudio. La IA devuelve, por examen, los
// temas en orden con repasos intercalados y los consejos. Lo que ha dicho manda:
// nombres, fechas, horas al día... salen de las respuestas, no de la IA.

export type TipoExamen = 'test' | 'test-resta' | 'desarrollo' | 'cortas' | 'problemas' | 'oral' | 'trabajo';
export type Avance = 'nada' | 'poco' | 'mitad' | 'casi';

export type AsignaturaCuestionario = {
  id: string;
  nombre: string;
  fecha: ClaveDia;
  hora: string;
  tipoExamen: TipoExamen;
  temas: number;
  avance: Avance;
  dificultad: Dificultad;
  anteriores: boolean; // tiene exámenes de otros años
  indice: string; // el índice del temario, si lo pega
};

// null = no ha contestado.
export type HabitosCuestionario = {
  constancia: 'siempre' | 'a-veces' | 'nunca' | null; // mismo sitio y hora
  concentracion: 'corta' | 'media' | 'larga' | null;
  arrancar: 'facil' | 'a-veces' | 'cuesta' | null;
  sintesis: 'esquemas' | 'a-veces' | 'releo' | null;
  repasos: 'varios' | 'final' | 'no' | null;
  lectura: 'lenta' | 'normal' | 'rapida' | null;
  nervios: 'no' | 'algo' | 'mucho' | null;
  distraccion: 'movil' | 'ruido' | 'cansancio' | 'nada' | null;
  memoria: 'viendo' | 'escuchando' | 'haciendo' | null;
};

export type RespuestasCuestionario = {
  asignaturas: AsignaturaCuestionario[];
  horasDia: number;
  rindeMas: MomentoDelDia;
  diaLibre: DiaSemana | null;
  habitos: HabitosCuestionario;
  otros: string;
};

export const MAX_INDICE = 1500;
export const MAX_OTROS = 500;

// Una por examen, en el mismo orden: la IA solo pone las horas, los temas y los repasos.
export function propuestaDeCuestionario(r: RespuestasCuestionario, ia: PropuestaEpoca): PropuestaEpoca {
  const hitos = [...r.asignaturas]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
    .map((a, i) => {
      const deIA = ia.hitos.find((h) => h.nombre.toLocaleLowerCase('es-ES') === a.nombre.toLocaleLowerCase('es-ES')) ?? ia.hitos[i];
      const temas = deIA?.temas ?? [];
      const horas = temas.length > 0 ? Math.max(1, temas.reduce((t, x) => t + x.horas, 0)) : (deIA?.horasPreparacion ?? 10);
      return { nombre: a.nombre, fecha: a.fecha, hora: a.hora, dificultad: a.dificultad, horasPreparacion: horas, temas };
    });
  const soloTrabajos = r.asignaturas.every((a) => a.tipoExamen === 'trabajo');
  return {
    ...ia,
    tipo: soloTrabajos ? 'entregas' : 'examenes',
    inicio: null,
    fin: hitos[hitos.length - 1]?.fecha ?? ia.fin,
    lugar: null,
    horasDia: r.horasDia,
    rindeMas: r.rindeMas,
    diaLibre: r.diaLibre ?? 'ninguno',
    hitos,
  };
}
