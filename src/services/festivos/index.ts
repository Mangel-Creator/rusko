import { claveDia, type ClaveDia } from '@/services/fechas';

import { FIESTAS_BOE, FIESTAS_SUBZONA } from './boe';
import type { CodigoComunidad } from './comunidades';

export * from './comunidades';

// Festivos de cada persona (puro, sin pantallas). Los días de fiesta dependen de dónde
// trabaja o estudia (si no, de dónde vive): las fiestas nacionales, las de su comunidad
// (tabla del BOE, boe.ts) y las dos locales de su municipio, que escribe ella porque no
// hay una lista oficial única para los más de 8000 municipios de España.
// No son eventos: se pintan en Hoy y en Semana como días de fiesta.

export type Ocupacion = 'trabajo' | 'estudios' | 'las-dos' | 'ninguna';

export type FiestaLocal = { fecha: ClaveDia; nombre: string };

// Se guarda en el perfil (Perfil.festivos).
export type ZonaFestivos = {
  ocupacion: Ocupacion;
  donde: 'casa' | 'otro'; // dónde trabaja o estudia: donde vive u otro municipio
  municipio: string; // el municipio cuyas fiestas cuentan
  comunidad: CodigoComunidad;
  subzona: string | null; // isla de Canarias o Valle de Arán (ver SUBZONAS)
  locales: FiestaLocal[];
};

export type AmbitoFestivo = 'nacional' | 'autonomico' | 'local';

export type Festivo = {
  fecha: ClaveDia;
  nombre: string;
  ambito: AmbitoFestivo;
};

// Años con la tabla oficial del BOE. Los demás se calculan sin las fiestas de comunidad.
export function hayTablaOficial(ano: number): boolean {
  return ano in FIESTAS_BOE;
}

// Todos los festivos de un año para esa zona, por fecha.
export function festivosDelAno(ano: number, zona: ZonaFestivos): Festivo[] {
  const lista = hayTablaOficial(ano) ? fiestasOficiales(ano, zona) : calcularNacionales(ano);
  for (const local of zona.locales) {
    if (local.fecha.startsWith(`${ano}-`) && !lista.some((f) => f.fecha === local.fecha)) {
      lista.push({ fecha: local.fecha, nombre: local.nombre.trim() || 'Fiesta local', ambito: 'local' });
    }
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function fiestasOficiales(ano: number, zona: ZonaFestivos): Festivo[] {
  const subzona = zona.subzona ? FIESTAS_SUBZONA[ano]?.[zona.subzona] : undefined;
  const lista: Festivo[] = [];
  for (const fiesta of FIESTAS_BOE[ano]) {
    const nacional = fiesta.en === 'todas';
    if (!nacional && !fiesta.en.includes(zona.comunidad)) continue;
    if (subzona?.quita === fiesta.dia) continue;
    lista.push({ fecha: `${ano}-${fiesta.dia}`, nombre: fiesta.nombre, ambito: nacional ? 'nacional' : 'autonomico' });
  }
  if (subzona) lista.push({ fecha: `${ano}-${subzona.dia}`, nombre: subzona.nombre, ambito: 'autonomico' });
  return lista;
}

// Sin tabla del BOE: las fiestas nacionales que no se mueven y el Viernes Santo. Las
// que caen en domingo pueden pasar al lunes según la comunidad, y eso no se sabe hasta
// que sale la tabla.
export function calcularNacionales(ano: number): Festivo[] {
  const fijas: [string, string][] = [
    ['01-01', 'Año Nuevo'],
    ['01-06', 'Epifanía del Señor'],
    ['05-01', 'Fiesta del Trabajo'],
    ['08-15', 'Asunción de la Virgen'],
    ['10-12', 'Fiesta Nacional de España'],
    ['11-01', 'Todos los Santos'],
    ['12-06', 'Día de la Constitución Española'],
    ['12-08', 'Inmaculada Concepción'],
    ['12-25', 'Natividad del Señor'],
  ];
  const pascua = domingoDePascua(ano);
  const viernesSanto = claveDia(new Date(ano, pascua.getMonth(), pascua.getDate() - 2));
  return [
    ...fijas.map(([dia, nombre]) => ({ fecha: `${ano}-${dia}`, nombre, ambito: 'nacional' as const })),
    { fecha: viernesSanto, nombre: 'Viernes Santo', ambito: 'nacional' as const },
  ];
}

// Domingo de Pascua (calendario gregoriano, algoritmo de Meeus/Jones/Butcher).
export function domingoDePascua(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// Para preguntar día a día (Hoy, Semana) sin recalcular el año cada vez.
const cache = new WeakMap<ZonaFestivos, Map<number, Map<ClaveDia, Festivo>>>();

export function festivoDelDia(dia: ClaveDia, zona: ZonaFestivos | null | undefined): Festivo | null {
  if (!zona) return null;
  const ano = Number(dia.slice(0, 4));
  let porAno = cache.get(zona);
  if (!porAno) {
    porAno = new Map();
    cache.set(zona, porAno);
  }
  let delAno = porAno.get(ano);
  if (!delAno) {
    delAno = new Map(festivosDelAno(ano, zona).map((f) => [f.fecha, f]));
    porAno.set(ano, delAno);
  }
  return delAno.get(dia) ?? null;
}

export const NOMBRE_AMBITO: Record<AmbitoFestivo, string> = {
  nacional: 'Nacional',
  autonomico: 'De tu comunidad',
  local: 'Local',
};
