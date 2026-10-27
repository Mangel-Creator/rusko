import type {
  AvisosEpoca,
  Descanso,
  Epoca,
  Hito,
  Imprescindible,
  TipoEpoca,
} from '@/data/epocas';
import { nuevoIdEpoca } from '@/data/epocas';
import type { LugarEvento } from '@/data/eventos';
import type { DiaSemana, MomentoDelDia, Perfil } from '@/data/perfil';
import { fechaDesdeClave, minutosDesdeHora, nombreMes, sumarDias, type ClaveDia } from '@/services/fechas';
import type { PropuestaEpoca } from '@/services/epoca';
import { buscarCoordenadas } from '@/services/lugares';

import { MENSAJE_NO_ENCONTRADO } from '../formulario-perfil/borrador';
import { NOMBRE_TIPO } from './textos';

// "Borrador": lo que se va rellenando en el formulario de la época (3 pasos),
// antes de guardar. Igual que Epoca, pero con los lugares como elección de chip
// y las opciones que aún pueden estar sin elegir.

// Lugar elegido con los chips: "casa", "sitio:<id>" u "otro" (dirección exacta).
// En los días concretos, además, "epoca" = el sitio principal de la época.
export type EleccionLugar = string;

export type Trayecto = '10' | '20' | '30' | '45' | '60';

// Cuándo empieza: el día que recomienda la app (services/epoca/inicio.ts), hoy u
// otro día elegido a mano (el de "inicio").
export type CuandoEmpezar = 'recomendado' | 'hoy' | 'otro';

export type BorradorEpoca = {
  id: string | null; // null = época nueva
  nombre: string;
  tipo: TipoEpoca | null;
  inicio: ClaveDia;
  cuandoEmpezar: CuandoEmpezar;
  fin: ClaveDia;
  dorada: boolean; // false = solo plan de estudio, sin cambiar el ritmo del día
  levantarse: string;
  acostarse: string;
  lugar: EleccionLugar;
  direccion: string; // si lugar = "otro"
  lugarGuardado: LugarEvento | null; // para no volver a buscar una dirección que no cambia
  distintoPorDia: boolean;
  lugarPorDia: Partial<Record<DiaSemana, EleccionLugar>>;
  diasVas: DiaSemana[];
  horasDia: number;
  rindeMas: MomentoDelDia | null;
  descanso: Descanso | null;
  diaLibre: DiaSemana | null;
  trayecto: Trayecto;
  imprescindibles: Imprescindible[];
  hitos: Hito[];
  avisos: AvisosEpoca;
  ejemplo: boolean;
  resumenVisto: boolean;
};

export type CampoConError = 'nombre' | 'tipo' | 'fin' | 'acostarse' | 'direccion' | 'rindeMas' | 'descanso' | 'hitos';
export type Errores = Partial<Record<CampoConError, string>>;

export const AVISOS_POR_DEFECTO: AvisosEpoca = { salir: true, inicioBloque: true, finDescanso: true, dormir: true };

export function eleccionDesdeLugar(lugar: LugarEvento | null | undefined): EleccionLugar {
  if (!lugar) return 'ninguno';
  if (lugar.tipo === 'casa') return 'casa';
  if (lugar.tipo === 'sitio') return `sitio:${lugar.sitioId}`;
  return 'otro';
}

// `dorada` solo cuenta al crear: "Crear un plan" la empieza en false y "Crear Época Dorada" en true.
export function borradorDesdeEpoca(
  epoca: Epoca | null,
  perfil: Perfil | null,
  hoy: ClaveDia,
  dorada = true,
): BorradorEpoca {
  if (!epoca) {
    return {
      id: null,
      nombre: '',
      tipo: null,
      inicio: hoy,
      cuandoEmpezar: 'recomendado',
      fin: sumarDias(hoy, 14),
      dorada,
      levantarse: perfil?.horario.levantarse ?? '07:30',
      acostarse: perfil?.horario.acostarse ?? '23:30',
      lugar: 'casa',
      direccion: '',
      lugarGuardado: null,
      distintoPorDia: false,
      lugarPorDia: {},
      diasVas: perfil?.horario.diasTrabajo ?? [0, 1, 2, 3, 4],
      horasDia: 4,
      rindeMas: perfil?.rindeMas ?? null,
      descanso: '50-10',
      diaLibre: null,
      trayecto: '20',
      imprescindibles: [],
      hitos: [],
      avisos: AVISOS_POR_DEFECTO,
      ejemplo: false,
      resumenVisto: false,
    };
  }
  const { ritmo } = epoca;
  const lugarPorDia: Partial<Record<DiaSemana, EleccionLugar>> = {};
  for (const [dia, lugar] of Object.entries(ritmo.lugarPorDia)) {
    const eleccion = eleccionDesdeLugar(lugar);
    lugarPorDia[Number(dia) as DiaSemana] = eleccion === 'otro' ? 'epoca' : eleccion;
  }
  return {
    id: epoca.id,
    nombre: epoca.nombre,
    tipo: epoca.tipo,
    inicio: epoca.inicio,
    cuandoEmpezar: 'otro',
    fin: epoca.fin,
    dorada: epoca.dorada,
    levantarse: ritmo.levantarse,
    acostarse: ritmo.acostarse,
    lugar: eleccionDesdeLugar(ritmo.lugar),
    direccion: ritmo.lugar.tipo === 'otro' ? ritmo.lugar.direccion : '',
    lugarGuardado: ritmo.lugar,
    distintoPorDia: Object.keys(ritmo.lugarPorDia).length > 0,
    lugarPorDia,
    diasVas: ritmo.diasVas,
    horasDia: ritmo.horasDia,
    rindeMas: ritmo.rindeMas,
    descanso: ritmo.descanso,
    diaLibre: ritmo.diaLibre,
    trayecto: String(ritmo.trayectoMin) as Trayecto,
    imprescindibles: ritmo.imprescindibles,
    hitos: epoca.hitos,
    avisos: epoca.avisos,
    ejemplo: epoca.ejemplo,
    resumenVisto: epoca.resumenVisto,
  };
}

// Nombre que se pone solo si se deja vacío: "Exámenes de octubre" (el mes en que termina).
export function nombrePorDefecto(b: Pick<BorradorEpoca, 'tipo' | 'fin'>): string {
  const tipo = b.tipo ? NOMBRE_TIPO[b.tipo] : 'Época';
  return `${tipo} de ${nombreMes(fechaDesdeClave(b.fin)).toLocaleLowerCase('es-ES')}`;
}

// Vuelca en el borrador lo que ha entendido la IA ("Cuéntamelo y lo preparo").
// Solo cambia lo que ha dicho: lo demás se queda como estaba. Los hitos y las
// cosas que no quiere dejar se añaden a los que ya hubiera.
export function borradorConPropuesta(b: BorradorEpoca, p: PropuestaEpoca): BorradorEpoca {
  const nuevo: BorradorEpoca = { ...b };
  if (p.nombre) nuevo.nombre = p.nombre;
  if (p.tipo) nuevo.tipo = p.tipo;
  if (p.inicio) {
    nuevo.inicio = p.inicio;
    nuevo.cuandoEmpezar = 'otro';
  }
  if (p.fin) nuevo.fin = p.fin;
  if (p.levantarse) nuevo.levantarse = p.levantarse;
  if (p.acostarse) nuevo.acostarse = p.acostarse;
  if (p.horasDia !== null) nuevo.horasDia = p.horasDia;
  if (p.rindeMas) nuevo.rindeMas = p.rindeMas;
  if (p.descanso) nuevo.descanso = p.descanso;
  if (p.diasVas) nuevo.diasVas = p.diasVas;
  if (p.diaLibre !== null) nuevo.diaLibre = p.diaLibre === 'ninguno' ? null : p.diaLibre;
  if (p.lugar) {
    nuevo.lugar = p.lugar.tipo === 'casa' ? 'casa' : p.lugar.tipo === 'sitio' ? `sitio:${p.lugar.sitioId}` : 'otro';
    nuevo.direccion = p.lugar.tipo === 'otro' ? p.lugar.direccion : '';
    nuevo.lugarGuardado = null;
  }
  nuevo.imprescindibles = [
    ...b.imprescindibles,
    ...p.imprescindibles.map((i) => ({ ...i, id: nuevoIdEpoca() })),
  ];
  nuevo.hitos = [
    ...b.hitos,
    ...p.hitos.map((h) => ({ ...h, id: nuevoIdEpoca(), lugar: null, temas: [] })),
  ];
  // Si la época empezaba más tarde que algún hito, empieza antes (sin pasar de hoy).
  const primero = nuevo.hitos.map((h) => h.fecha).sort()[0];
  if (primero && primero < nuevo.inicio) nuevo.inicio = primero;
  return nuevo;
}

// El día que empieza de verdad, según lo elegido en "¿Cuándo empiezas?".
export function inicioElegido(b: BorradorEpoca, recomendado: ClaveDia | null, hoy: ClaveDia): ClaveDia {
  if (b.cuandoEmpezar === 'hoy') return hoy;
  if (b.cuandoEmpezar === 'recomendado') return recomendado ?? hoy;
  return b.inicio;
}

export function comprobarPaso1(b: BorradorEpoca, hoy: ClaveDia): Errores {
  const errores: Errores = {};
  if (!b.tipo) errores.tipo = 'Elige una.';
  if (b.fin < b.inicio) errores.fin = 'La fecha de fin tiene que ser igual o posterior a la de inicio.';
  else if (!b.id && b.fin < hoy) errores.fin = 'Esa época ya habría terminado. Elige una fecha de fin a partir de hoy.';
  return errores;
}

export function comprobarPaso2(b: BorradorEpoca): Errores {
  const errores: Errores = {};
  if (minutosDesdeHora(b.acostarse) === minutosDesdeHora(b.levantarse)) {
    errores.acostarse = 'La hora de acostarte no puede ser la misma que la de levantarte.';
  }
  if (b.lugar === 'otro' && !b.direccion.trim()) errores.direccion = 'Escribe la dirección o elige otro sitio.';
  if (!b.rindeMas) errores.rindeMas = 'Elige una.';
  if (!b.descanso) errores.descanso = 'Elige una.';
  return errores;
}

export function comprobarPaso3(b: BorradorEpoca): Errores {
  const fuera = b.hitos.filter((h) => h.fecha < b.inicio || h.fecha > b.fin);
  if (fuera.length === 0) return {};
  return {
    hitos: `${fuera.map((h) => h.nombre).join(', ')} ${fuera.length === 1 ? 'cae' : 'caen'} fuera de las fechas de la época. Cambia su fecha o las de la época.`,
  };
}

export function hayErrores(errores: Errores): boolean {
  return Object.keys(errores).length > 0;
}

// Convierte la elección de chips en un lugar. Para "otro" busca las coordenadas
// (salvo que la dirección no haya cambiado). Devuelve un texto si no la encuentra.
export async function lugarDesdeEleccion(
  eleccion: EleccionLugar,
  direccion: string,
  guardado: LugarEvento | null,
): Promise<LugarEvento | null | string> {
  if (eleccion === 'ninguno') return null;
  if (eleccion === 'casa') return { tipo: 'casa' };
  if (eleccion.startsWith('sitio:')) return { tipo: 'sitio', sitioId: eleccion.slice('sitio:'.length) };
  const texto = direccion.trim();
  if (guardado?.tipo === 'otro' && guardado.direccion === texto) return guardado;
  const resultado = await buscarCoordenadas(texto);
  if (resultado.estado === 'no-encontrado') return MENSAJE_NO_ENCONTRADO;
  return { tipo: 'otro', direccion: texto, coordenadas: resultado.estado === 'encontrado' ? resultado.coordenadas : null };
}

// Pasa el borrador a una época lista para guardar. Si no encuentra la dirección
// del sitio de estudio, devuelve el error.
export async function epocaDesdeBorrador(b: BorradorEpoca): Promise<Epoca | { error: string }> {
  const lugar = await lugarDesdeEleccion(b.lugar, b.direccion, b.lugarGuardado);
  if (typeof lugar === 'string') return { error: lugar };
  const principal: LugarEvento = lugar ?? { tipo: 'casa' };

  const lugarPorDia: Partial<Record<DiaSemana, LugarEvento>> = {};
  if (b.distintoPorDia) {
    for (const dia of b.diasVas) {
      const eleccion = b.lugarPorDia[dia];
      if (!eleccion || eleccion === 'epoca') continue;
      const deEseDia = await lugarDesdeEleccion(eleccion, '', null);
      if (deEseDia && typeof deEseDia !== 'string') lugarPorDia[dia] = deEseDia;
    }
  }

  return montarEpoca(b, principal, lugarPorDia);
}

// La época tal cual, sin buscar direcciones: sirve para calcular el plan (y el día
// recomendado para empezar) mientras se rellena el formulario.
export function epocaProvisional(b: BorradorEpoca): Epoca {
  return montarEpoca({ ...b, id: b.id ?? 'borrador' }, { tipo: 'casa' }, {});
}

function montarEpoca(
  b: BorradorEpoca,
  principal: LugarEvento,
  lugarPorDia: Partial<Record<DiaSemana, LugarEvento>>,
): Epoca {
  return {
    id: b.id ?? nuevoIdEpoca(),
    nombre: b.nombre.trim() || nombrePorDefecto(b),
    tipo: b.tipo ?? 'otro',
    inicio: b.inicio,
    fin: b.fin,
    ritmo: {
      levantarse: b.levantarse,
      acostarse: b.acostarse,
      lugar: principal,
      lugarPorDia,
      diasVas: b.diasVas,
      horasDia: b.horasDia,
      rindeMas: b.rindeMas ?? 'manana',
      descanso: b.descanso ?? '50-10',
      diaLibre: b.diaLibre,
      trayectoMin: Number(b.trayecto),
      imprescindibles: b.imprescindibles,
    },
    hitos: [...b.hitos].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.hora.localeCompare(y.hora)),
    avisos: b.avisos,
    dorada: b.dorada,
    ejemplo: b.ejemplo,
    resumenVisto: b.resumenVisto,
  };
}
