import type { CorreoRemoto, CorreoResumido, ProveedorCorreo } from '@/data/correos';
import type { Evento } from '@/data/eventos/tipos';
import { DIAS_SEMANA_CORTOS, diaSemanaDesdeLunes, fechaDesdeClave, sumarDias, type ClaveDia } from '@/services/fechas';

// Resúmenes de correo (fase 11): funciones puras, con pruebas en __tests__.

// Días que la app guarda los correos (el ayudante, solo 7).
export const DIAS_EN_EL_MOVIL = 30;

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

// La URL de la "Aplicación web" del ayudante, limpia, o null si no lo parece.
// Es como "https://script.google.com/macros/s/AKfycb.../exec".
export function leerEnlace(texto: string): string | null {
  const limpio = texto.trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  const valido = /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/.test(limpio);
  return valido ? limpio : null;
}

const esTexto = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

// Solo se abren enlaces de Gmail u Outlook.
const ENLACES_VALIDOS = /^https:\/\/(mail\.google\.com|outlook\.live\.com|outlook\.office(365)?\.com)\//;

// Comprueba un correo que llega del ayudante. Devuelve null si algo no cuadra.
export function validarRemoto(dato: unknown): CorreoRemoto | null {
  if (!dato || typeof dato !== 'object') return null;
  const d = dato as Record<string, unknown>;
  if (!esTexto(d.id, 64) || !d.id || !esTexto(d.recibido, 40) || Number.isNaN(Date.parse(d.recibido))) return null;
  if (!esTexto(d.titulo, 200) || !d.titulo.trim()) return null;
  const fecha = typeof d.fechaLimite === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.fechaLimite) ? d.fechaLimite : null;
  const enlace = esTexto(d.enlace, 600) && ENLACES_VALIDOS.test(d.enlace) ? d.enlace : '';
  const origen: ProveedorCorreo | undefined = d.origen === 'gmail' || d.origen === 'outlook' ? d.origen : undefined;
  const cuenta = esTexto(d.cuenta, 320) && d.cuenta.includes('@') ? d.cuenta : undefined;
  return {
    id: d.id,
    recibido: d.recibido,
    de: esTexto(d.de, 200) ? d.de : '',
    asunto: esTexto(d.asunto, 300) ? d.asunto : '',
    titulo: d.titulo.trim(),
    resumen: esTexto(d.resumen, 600) ? d.resumen : '',
    fechaLimite: fecha,
    tarea: fecha && esTexto(d.tarea, 200) && d.tarea.trim() ? d.tarea.trim() : null,
    importante: d.importante === true,
    via: d.via === 'ia' ? 'ia' : 'reglas',
    enlace,
    ...(origen ? { origen } : {}),
    ...(cuenta ? { cuenta } : {}),
  };
}

// Al desvincular una cuenta, sus resúmenes se van del móvil (las tareas se quedan).
export function sinCuenta(correos: CorreoResumido[], email: string): CorreoResumido[] {
  return correos.filter((c) => c.cuenta !== email);
}

export const NOMBRE_PROVEEDOR: Record<ProveedorCorreo, string> = { gmail: 'Gmail', outlook: 'Outlook' };

// Qué decir al volver de iniciar sesión (?correo=ok&cuenta=… en la dirección).
export function textoVuelta(datos: {
  correo?: string;
  cuenta?: string;
  motivo?: string;
}): { bien: boolean; texto: string } | null {
  if (datos.correo === 'ok') {
    return { bien: true, texto: `Listo: ${datos.cuenta ?? 'tu correo'} ya está vinculado. Te aviso de lo que importe.` };
  }
  if (datos.correo === 'cancelado') return { bien: false, texto: 'No se ha vinculado: cancelaste el inicio de sesión.' };
  if (datos.correo === 'error') {
    if (datos.motivo === 'demasiadas') return { bien: false, texto: 'Ya tienes 5 cuentas vinculadas. Quita una para añadir otra.' };
    return { bien: false, texto: 'No se ha podido vincular. Prueba otra vez en un rato.' };
  }
  return null;
}

// Junta lo que ya había en el móvil con lo que manda el ayudante: los nuevos entran
// sin ver y los que ya estaban conservan lo del móvil (visto, tarea, "no es un
// plazo"). Se olvidan los de hace más de DIAS_EN_EL_MOVIL días.
export function mezclarCorreos(locales: CorreoResumido[], remotos: CorreoRemoto[], ahora: Date): CorreoResumido[] {
  const porId = new Map(locales.map((c) => [c.id, c]));
  for (const remoto of remotos) {
    const local = porId.get(remoto.id);
    porId.set(
      remoto.id,
      local
        ? { ...local, ...remoto, visto: local.visto, eventoId: local.eventoId, noEsPlazo: local.noEsPlazo }
        : { ...remoto, visto: false, eventoId: null, noEsPlazo: false },
    );
  }
  const limite = new Date(ahora.getTime() - DIAS_EN_EL_MOVIL * 86400000).toISOString();
  return [...porId.values()].filter((c) => c.recibido >= limite).sort((a, b) => b.recibido.localeCompare(a.recibido));
}

// Es un plazo (y no se ha dicho que no lo es).
export function esPlazo(correo: CorreoResumido): correo is CorreoResumido & { fechaLimite: ClaveDia } {
  return correo.fechaLimite !== null && !correo.noEsPlazo;
}

// Los plazos que aún no tienen tarea en el calendario (solo los de hoy en adelante).
export function correosSinTarea(correos: CorreoResumido[], hoy: ClaveDia): CorreoResumido[] {
  return correos.filter((c) => esPlazo(c) && !c.eventoId && c.fechaLimite >= hoy);
}

// La tarea del calendario de un correo con plazo: ese día, de 30 min, tipo "Yo".
export function tareaDeCorreo(correo: CorreoResumido, id: string): Evento {
  const notas = [`Del correo de ${correo.de}: «${correo.asunto || correo.titulo}».`, correo.resumen, correo.enlace]
    .filter(Boolean)
    .join('\n\n');
  return {
    id,
    titulo: (correo.tarea ?? correo.titulo).slice(0, 80),
    fecha: correo.fechaLimite ?? '',
    horaInicio: null,
    horaFin: null,
    tipo: 'yo',
    lugar: null,
    notas,
    repeticion: 'nunca',
    flexible: true,
    duracionMin: 30,
    hecha: false,
    foco: false,
    avisoMin: null,
    ejemplo: false,
  };
}

// "lun 5 oct"
export function textoDiaCorto(dia: ClaveDia): string {
  const fecha = fechaDesdeClave(dia);
  return `${DIAS_SEMANA_CORTOS[diaSemanaDesdeLunes(fecha)]} ${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}

// "Para hoy", "Para mañana", "Para el lun 5 oct", "Era el vie 2 oct". Vale para un
// plazo, una cita o un cargo.
export function textoParaDia(dia: ClaveDia, hoy: ClaveDia): string {
  if (dia === hoy) return 'Para hoy';
  if (dia === sumarDias(hoy, 1)) return 'Para mañana';
  return `${dia < hoy ? 'Era' : 'Para'} el ${textoDiaCorto(dia)}`;
}

// Máximo de remitentes en "Avisarme siempre de…" (el servidor guarda 30).
export const MAX_SIEMPRE = 30;

const mismoNombre = (a: string, b: string) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

export function avisaSiempre(siempre: string[], de: string): boolean {
  return siempre.some((s) => mismoNombre(s, de));
}

// Pone o quita a un remitente de "Avisarme siempre de…".
export function cambiarSiempre(siempre: string[], de: string): string[] {
  if (!de.trim()) return siempre;
  if (avisaSiempre(siempre, de)) return siempre.filter((s) => !mismoNombre(s, de));
  return [...siempre, de.trim()].slice(-MAX_SIEMPRE);
}

// "Hoy", "Ayer" o "lun 5 oct", para agrupar los resúmenes por día.
export function textoGrupo(dia: ClaveDia, hoy: ClaveDia): string {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, -1)) return 'Ayer';
  return textoDiaCorto(dia);
}

export type GrupoCorreos = { dia: ClaveDia; correos: CorreoResumido[] };

// Plazos (los que vencen de hoy en adelante, el más cercano primero) y el resto de
// correos por día, del más nuevo al más viejo. Los plazos pasados van con el resto.
export function ordenarCorreos(
  correos: CorreoResumido[],
  hoy: ClaveDia,
  diaDe: (iso: string) => ClaveDia,
): { plazos: CorreoResumido[]; grupos: GrupoCorreos[] } {
  const plazos = correos
    .filter((c) => esPlazo(c) && c.fechaLimite >= hoy)
    .sort((a, b) => (a.fechaLimite ?? '').localeCompare(b.fechaLimite ?? ''));
  const enPlazos = new Set(plazos.map((c) => c.id));
  const grupos: GrupoCorreos[] = [];
  for (const correo of [...correos].sort((a, b) => b.recibido.localeCompare(a.recibido))) {
    if (enPlazos.has(correo.id)) continue;
    const dia = diaDe(correo.recibido);
    const grupo = grupos.find((g) => g.dia === dia);
    if (grupo) grupo.correos.push(correo);
    else grupos.push({ dia, correos: [correo] });
  }
  return { plazos, grupos };
}

export function contarNuevos(correos: CorreoResumido[]): number {
  return correos.filter((c) => !c.visto).length;
}
