import type {
  AntelacionAviso,
  DiaSemana,
  Lugar,
  MomentoDelDia,
  Perfil,
  SitioHabitual,
  Transporte,
  Uso,
} from '@/data/perfil';
import { SUBZONAS, type CodigoComunidad, type FiestaLocal, type Ocupacion, type ZonaFestivos } from '@/services/festivos';
import { buscarCoordenadas } from '@/services/lugares';
import { minutosDesdeHora } from '@/services/fechas';
import type { Opcion } from '@/components';

// "Borrador": lo que el usuario va rellenando en el formulario, antes de guardar.
// Es igual que Perfil pero las opciones pueden estar aún sin elegir (null).

export type Borrador = {
  nombre: string;
  vivienda: Lugar;
  sitios: SitioHabitual[];
  transporte: Transporte | null;
  uso: Uso | null;
  levantarse: string;
  acostarse: string;
  empiezoTrabajo: string;
  terminoTrabajo: string;
  diasTrabajo: DiaSemana[];
  rindeMas: MomentoDelDia | null;
  antelacion: `${AntelacionAviso}` | null; // texto porque Selector trabaja con textos
  festivos: BorradorFestivos;
};

// Paso "Tus festivos": como ZonaFestivos, con lo que aún no se ha elegido a null.
// "buscadoPara" es el municipio cuya comunidad ya se buscó (para no repetir la búsqueda).
export type BorradorFestivos = {
  ocupacion: Ocupacion | null;
  donde: 'casa' | 'otro';
  municipio: string;
  comunidad: CodigoComunidad | null;
  subzona: string | null;
  locales: FiestaLocal[];
  buscadoPara: string | null;
};

export type Errores = Partial<Record<keyof Borrador, string>>;

export const OPCIONES_TRANSPORTE: Opcion<Transporte>[] = [
  { valor: 'coche', etiqueta: 'Coche' },
  { valor: 'moto', etiqueta: 'Moto' },
  { valor: 'transporte-publico', etiqueta: 'Transporte público' },
  { valor: 'a-pie', etiqueta: 'A pie' },
];

export const OPCIONES_USO: Opcion<Uso>[] = [
  { valor: 'personal', etiqueta: 'Personal' },
  { valor: 'clientes', etiqueta: 'Clientes' },
  { valor: 'ambos', etiqueta: 'Las dos' },
];

export const OPCIONES_MOMENTO: Opcion<MomentoDelDia>[] = [
  { valor: 'manana', etiqueta: 'Mañana' },
  { valor: 'tarde', etiqueta: 'Tarde' },
  { valor: 'noche', etiqueta: 'Noche' },
];

export const OPCIONES_ANTELACION: Opcion<`${AntelacionAviso}`>[] = [
  { valor: '10', etiqueta: '10 min' },
  { valor: '30', etiqueta: '30 min' },
  { valor: '60', etiqueta: '1 hora' },
];

export const MENSAJE_NO_ENCONTRADO =
  'No encuentro ese sitio. Prueba a escribirlo de otra forma, por ejemplo «Chamberí, Madrid».';

export function borradorDesdePerfil(perfil: Perfil | null): Borrador {
  if (!perfil) {
    return {
      nombre: '',
      vivienda: { direccion: '', coordenadas: null },
      sitios: [],
      transporte: null,
      uso: null,
      levantarse: '07:30',
      acostarse: '23:30',
      empiezoTrabajo: '09:00',
      terminoTrabajo: '18:00',
      diasTrabajo: [0, 1, 2, 3, 4], // de lunes a viernes
      rindeMas: null,
      antelacion: '30',
      festivos: borradorFestivos(null, null),
    };
  }
  return {
    nombre: perfil.nombre,
    vivienda: perfil.vivienda,
    sitios: perfil.sitios,
    transporte: perfil.transporte,
    uso: perfil.uso,
    levantarse: perfil.horario.levantarse,
    acostarse: perfil.horario.acostarse,
    empiezoTrabajo: perfil.horario.empiezoTrabajo,
    terminoTrabajo: perfil.horario.terminoTrabajo,
    diasTrabajo: perfil.horario.diasTrabajo,
    rindeMas: perfil.rindeMas,
    antelacion: `${perfil.antelacionAvisoMin}`,
    festivos: borradorFestivos(perfil.festivos, perfil.sitios),
  };
}

// Sin festivos guardados, se propone el municipio del sitio "Trabajo" si lo hay.
function borradorFestivos(zona: ZonaFestivos | null | undefined, sitios: SitioHabitual[] | null): BorradorFestivos {
  if (zona?.comunidad) {
    return { ...zona, municipio: zona.donde === 'otro' ? zona.municipio : '', buscadoPara: zona.municipio };
  }
  const trabajo = sitios?.find((s) => s.nombre.trim().toLowerCase() === 'trabajo');
  return {
    ocupacion: null,
    donde: trabajo ? 'otro' : 'casa',
    municipio: trabajo?.direccion ?? '',
    comunidad: null,
    subzona: null,
    locales: [],
    buscadoPara: null,
  };
}

// Municipio cuyas fiestas cuentan: el del trabajo o los estudios, o si no, el de casa.
export function municipioFestivos(b: Borrador): string {
  const f = b.festivos;
  const fuera = f.ocupacion && f.ocupacion !== 'ninguna' && f.donde === 'otro';
  return (fuera ? f.municipio : b.vivienda.direccion).trim();
}

function zonaDesdeBorrador(b: Borrador): ZonaFestivos | null {
  const f = b.festivos;
  if (!f.ocupacion || !f.comunidad) return null;
  return {
    ocupacion: f.ocupacion,
    donde: f.donde,
    municipio: municipioFestivos(b),
    comunidad: f.comunidad,
    subzona: SUBZONAS[f.comunidad]?.some((s) => s.valor === f.subzona) ? f.subzona : null,
    locales: f.locales,
  };
}

// Paso "Tus festivos". La comunidad la busca CamposFestivos al rellenar el municipio.
export function comprobarFestivos(b: Borrador): Errores {
  const f = b.festivos;
  if (!f.ocupacion) return { festivos: 'Dime si trabajas o estudias.' };
  if (f.ocupacion !== 'ninguna' && f.donde === 'otro' && !f.municipio.trim()) {
    return { festivos: '¿En qué municipio? Escríbelo para saber sus fiestas.' };
  }
  if (!f.comunidad) return { festivos: 'Elige tu comunidad autónoma.' };
  if (f.comunidad === 'can' && !f.subzona) return { festivos: 'Elige tu isla: cada una tiene su fiesta.' };
  return {};
}

// Solo se llama cuando el borrador ya ha pasado las dos comprobaciones.
export function perfilDesdeBorrador(b: Borrador): Perfil {
  return {
    nombre: b.nombre.trim(),
    vivienda: { ...b.vivienda, direccion: b.vivienda.direccion.trim() },
    sitios: b.sitios,
    transporte: b.transporte ?? 'coche',
    uso: b.uso ?? 'ambos',
    horario: {
      levantarse: b.levantarse,
      acostarse: b.acostarse,
      empiezoTrabajo: b.empiezoTrabajo,
      terminoTrabajo: b.terminoTrabajo,
      diasTrabajo: b.diasTrabajo,
    },
    rindeMas: b.rindeMas ?? 'manana',
    antelacionAvisoMin: Number(b.antelacion ?? '30') as AntelacionAviso,
    festivos: zonaDesdeBorrador(b),
  };
}

// Paso 1. Comprueba los campos y, si hace falta, busca las coordenadas de la vivienda.
// Devuelve el borrador (con coordenadas si se han encontrado) y los errores.
export async function comprobarPaso1(b: Borrador): Promise<{ borrador: Borrador; errores: Errores }> {
  const errores: Errores = {};
  if (!b.nombre.trim()) errores.nombre = '¿Cómo te llamo? Escribe tu nombre.';
  if (!b.vivienda.direccion.trim()) errores.vivienda = 'Dime dónde vives, que lo uso para el tráfico.';
  if (!b.transporte) errores.transporte = 'Elige una.';
  if (!b.uso) errores.uso = 'Elige una.';

  let borrador = b;
  if (!errores.vivienda && !b.vivienda.coordenadas) {
    const resultado = await buscarCoordenadas(b.vivienda.direccion.trim());
    if (resultado.estado === 'encontrado') {
      borrador = { ...b, vivienda: { ...b.vivienda, coordenadas: resultado.coordenadas } };
    } else if (resultado.estado === 'no-encontrado') {
      errores.vivienda = MENSAJE_NO_ENCONTRADO;
    }
    // "no-disponible" (sin conexión): se guarda sin coordenadas y se calculan más tarde.
  }
  return { borrador, errores };
}

// Paso 2. Solo comprueba; aquí no hace falta buscar nada.
export function comprobarPaso2(b: Borrador): Errores {
  const errores: Errores = {};
  if (minutosDesdeHora(b.terminoTrabajo) <= minutosDesdeHora(b.empiezoTrabajo)) {
    errores.terminoTrabajo = 'Tienes que terminar de trabajar después de empezar.';
  }
  if (!b.rindeMas) errores.rindeMas = 'Elige una.';
  if (!b.antelacion) errores.antelacion = 'Elige una.';
  return errores;
}

export function hayErrores(errores: Errores): boolean {
  return Object.keys(errores).length > 0;
}
