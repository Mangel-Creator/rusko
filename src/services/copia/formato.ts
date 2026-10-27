import type { Epoca, RegistroBloque } from '@/data/epocas/tipos';
import { normalizarCuadrante, normalizarLugar, type Evento } from '@/data/eventos/tipos';
import { claveDia, formatearFechaLarga, formatearHora } from '@/services/fechas';

// Copia de seguridad: todo lo de la persona en un archivo JSON que guarda ella
// (Archivos, iCloud, su ordenador...). Sirve para cambiar de móvil o pasar de la web
// a la app. Nada pasa por el servidor. Funciones puras, con pruebas.

export const FORMATO_COPIA = 1;

export type CopiaSeguridad = {
  app: 'organizy';
  formato: number; // sube si cambia la forma del archivo
  creadaEl: string; // ISO
  eventos: Evento[];
  epocas: Epoca[];
  registroBloques: RegistroBloque[];
  // El resto de lo guardado con leerAjuste/guardarAjuste, por su clave sin "organizy:"
  // (perfil, alarmas, planes, avisos, energía de cada día...).
  ajustes: Record<string, unknown>;
};

// Ajustes que no viajan en la copia:
//   - los que ya van aparte (eventos y épocas en la web),
//   - lo que se calcula solo (salidas, horas punta, adelantos de la inteligente),
//   - lo que es de este dispositivo (alarmas ya programadas en el sistema, la fecha
//     de la última copia, explicaciones de permisos ya vistas).
// Todo lo demás viaja: así, lo que se guarde en fases nuevas entra solo.
const NO_VIAJAN = new Set([
  'eventos',
  'epocas',
  'bloquesEpoca',
  'salidas',
  'horasPunta',
  'adelantos',
  'alarmasNativas',
  'ultimaCopia',
  'dictadoExplicado',
  'avisoPantallaInicioCerrado',
  'recargaPorVersion',
  // Lo que el plan de estudio tenía previsto cada día en este dispositivo (26/10/2026).
  'planesDelDia',
  // A qué parking vas ahora mismo (26/10/2026): solo vale en este momento.
  'aparcando',
  // Resúmenes de correo (fase 11): el enlace del ayudante de Gmail deja leer los
  // resúmenes a quien lo tenga, y los resúmenes son el contenido de los correos. No
  // van en un archivo: en el móvil nuevo se vuelve a pegar el enlace y se traen solos.
  'correo',
  'correos',
  // Las cuentas vinculadas son de la sesión de cada dispositivo en el servidor: en otro
  // móvil se vuelven a vincular.
  'cuentasCorreo',
  // Enlaces de otros calendarios: también son una llave. Los eventos traídos sí viajan.
  'calendarios',
  // Enlace del Atajo que pasa las alarmas al Reloj (26/10/2026): otra llave, atada a la
  // sesión de este dispositivo. En otro móvil se crea uno nuevo.
  'alarmasReloj',
  // Enlace de los Atajos de Siri (27/10/2026): también es una llave de este dispositivo.
  'siri',
  // Plan empresa (fase 15): lo de la empresa es de la sesión de empresa de cada
  // dispositivo (y está en el servidor). En otro móvil se vuelve a entrar.
  'empresaModo',
  'empresaCopia',
  'empresaInvitacion',
  'empresaOcupado',
  // Copia en la nube (27/10/2026): lo que este dispositivo sabe de la nube y su nombre.
  'nube',
  'dispositivo',
]);

// Cachés que se borran al recuperar una copia (se vuelven a calcular solas).
export const SE_RECALCULAN = ['salidas', 'horasPunta', 'adelantos', 'planesDelDia'];

export function viajaEnLaCopia(clave: string): boolean {
  return !NO_VIAJAN.has(clave);
}

export function montarCopia(
  datos: Pick<CopiaSeguridad, 'eventos' | 'epocas' | 'registroBloques' | 'ajustes'>,
  ahora: Date,
): CopiaSeguridad {
  const ajustes: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(datos.ajustes)) {
    if (viajaEnLaCopia(clave)) ajustes[clave] = valor;
  }
  return {
    app: 'organizy',
    formato: FORMATO_COPIA,
    creadaEl: ahora.toISOString(),
    // Los ejemplos no se guardan: se crean desde Perfil cuando se quiera.
    eventos: datos.eventos.filter((e) => !e.ejemplo),
    epocas: datos.epocas.filter((e) => !e.ejemplo),
    registroBloques: datos.registroBloques.filter((r) =>
      datos.epocas.some((e) => e.id === r.epocaId && !e.ejemplo),
    ),
    ajustes,
  };
}

// "organizy-copia-2026-09-27.json"
export function nombreArchivoCopia(ahora: Date): string {
  return `organizy-copia-${claveDia(ahora)}.json`;
}

export type LecturaCopia = { ok: true; copia: CopiaSeguridad } | { ok: false; error: string };

const DANADO = 'Este archivo no es una copia de Rusko o está dañado. Elige el archivo «organizy-copia-…».';

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const conId = (v: unknown): v is Record<string, unknown> & { id: string } =>
  esObjeto(v) && typeof v.id === 'string';
const esDia = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function eventoValido(v: unknown): v is Evento {
  return (
    conId(v) &&
    typeof v.titulo === 'string' &&
    esDia(v.fecha) &&
    (v.tipo === 'cliente' || v.tipo === 'amigos' || v.tipo === 'yo')
  );
}

function epocaValida(v: unknown): v is Epoca {
  return conId(v) && esDia(v.inicio) && esDia(v.fin) && esObjeto(v.ritmo) && Array.isArray(v.hitos);
}

function registroValido(v: unknown): v is RegistroBloque {
  return conId(v) && typeof v.epocaId === 'string' && esDia(v.dia);
}

// Lee el texto de un archivo y comprueba que es una copia que esta versión entiende.
// Si algo no cuadra, no se recupera nada (mejor avisar que recuperar a medias).
export function leerCopia(texto: string): LecturaCopia {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, error: DANADO };
  }
  if (!esObjeto(datos) || datos.app !== 'organizy' || typeof datos.formato !== 'number') {
    return { ok: false, error: DANADO };
  }
  if (datos.formato > FORMATO_COPIA) {
    return {
      ok: false,
      error: 'Esta copia es de una versión más nueva de Rusko. Actualiza la app (o recarga la web) y vuelve a probar.',
    };
  }
  const { eventos, epocas, registroBloques, ajustes, creadaEl } = datos;
  if (
    typeof creadaEl !== 'string' ||
    Number.isNaN(Date.parse(creadaEl)) ||
    !Array.isArray(eventos) ||
    !eventos.every(eventoValido) ||
    !Array.isArray(epocas) ||
    !epocas.every(epocaValida) ||
    !Array.isArray(registroBloques) ||
    !registroBloques.every(registroValido) ||
    !esObjeto(ajustes)
  ) {
    return { ok: false, error: DANADO };
  }
  return {
    ok: true,
    copia: {
      app: 'organizy',
      formato: datos.formato,
      creadaEl,
      // Mismos arreglos que al leer de la web: lugares con el formato antiguo y
      // campos que no existían en eventos anteriores.
      eventos: eventos.map((e) => ({
        ...e,
        lugar: normalizarLugar(e.lugar),
        avisoMin: e.avisoMin ?? null,
        cliente: e.cliente ?? null,
        cuadrante: normalizarCuadrante(e.cuadrante),
      })),
      // Las copias de antes del plan de estudio (26/10/2026) solo tienen épocas doradas.
      epocas: epocas.map((e) => ({ ...e, dorada: e.dorada ?? true })),
      // Solo el registro de épocas que vienen en la copia.
      registroBloques: registroBloques.filter((r) => epocas.some((e) => e.id === r.epocaId)),
      ajustes: Object.fromEntries(Object.entries(ajustes).filter(([clave]) => viajaEnLaCopia(clave))),
    },
  };
}

export type ResumenCopia = {
  creada: string; // "sábado, 27 de septiembre de 2026 a las 18:05"
  nombre: string | null; // el del perfil
  lineas: string[]; // ["45 eventos y tareas", "1 época dorada", ...]
  planesAbiertos: number;
};

const contar = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function resumenCopia(copia: CopiaSeguridad): ResumenCopia {
  const fecha = new Date(copia.creadaEl);
  const perfil = copia.ajustes.perfil;
  const alarmas = copia.ajustes.alarmas;
  const planes = copia.ajustes.planes;
  const listaAlarmas = esObjeto(alarmas) && Array.isArray(alarmas.alarmas) ? alarmas.alarmas : [];
  const listaPlanes = Array.isArray(planes) ? planes : [];
  // Solo lo que lleva: "0 alarmas" no dice nada.
  const lineas = [
    contar(copia.eventos.length, 'evento o tarea', 'eventos y tareas'),
    contar(copia.epocas.length, 'época dorada', 'épocas doradas'),
    contar(listaAlarmas.length, 'alarma', 'alarmas'),
    contar(listaPlanes.length, 'plan', 'planes'),
  ].filter((linea) => !linea.startsWith('0 '));
  if (lineas.length === 0) lineas.push('Tu perfil y tus ajustes (no hay eventos, alarmas ni planes)');
  return {
    creada: `${formatearFechaLarga(fecha)} de ${fecha.getFullYear()} a las ${formatearHora(fecha)}`,
    nombre: esObjeto(perfil) && typeof perfil.nombre === 'string' && perfil.nombre ? perfil.nombre : null,
    lineas,
    planesAbiertos: listaPlanes.filter((p) => esObjeto(p) && p.estado === 'abierto').length,
  };
}

// "Hoy a las 18:05", "Ayer a las 9:30", "Hace 12 días" o "El 3 de agosto".
export function cuandoFueLaCopia(iso: string, ahora: Date): string {
  const fecha = new Date(iso);
  const dias = Math.round(
    (Date.parse(claveDia(ahora)) - Date.parse(claveDia(fecha))) / (24 * 60 * 60 * 1000),
  );
  if (dias <= 0) return `Hoy a las ${formatearHora(fecha)}`;
  if (dias === 1) return `Ayer a las ${formatearHora(fecha)}`;
  if (dias < 30) return `Hace ${dias} días`;
  return `El ${formatearFechaLarga(fecha).replace(/^\S+, /, '')}`;
}

// Pasado un mes sin copia, Perfil lo recuerda.
export function copiaAntigua(iso: string | null, ahora: Date): boolean {
  if (!iso) return true;
  return ahora.getTime() - Date.parse(iso) > 30 * 24 * 60 * 60 * 1000;
}
