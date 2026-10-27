import type { CorreoRemoto, CorreoResumido, ProveedorCorreo } from '@/data/correos';
import type { Evento } from '@/data/eventos/tipos';
import {
  DIAS_SEMANA_CORTOS,
  diaSemanaDesdeLunes,
  fechaDesdeClave,
  horaDesdeMinutos,
  minutosDesdeHora,
  sumarDias,
  type ClaveDia,
} from '@/services/fechas';

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

// ¿Es una dirección de correo? ("ana@gl.es"). La misma regla que el servidor.
export function esDireccion(texto: string): boolean {
  return texto.length <= 320 && /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[a-z]{2,}$/i.test(texto.trim());
}

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
  const direccion = typeof d.direccion === 'string' && esDireccion(d.direccion) ? d.direccion.trim().toLowerCase() : undefined;
  const hora = fecha && typeof d.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(d.hora) ? d.hora : null;
  return {
    id: d.id,
    recibido: d.recibido,
    de: esTexto(d.de, 200) ? d.de : '',
    ...(direccion ? { direccion } : {}),
    asunto: esTexto(d.asunto, 300) ? d.asunto : '',
    titulo: d.titulo.trim(),
    resumen: esTexto(d.resumen, 600) ? d.resumen : '',
    fechaLimite: fecha,
    hora,
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

// --- Remitentes vetados (27/10/2026) ---
// La persona escribe una dirección y sus correos no salen nada en Rusko: ni en la
// pestaña, ni avisos, ni tareas ni citas. En Gmail siguen igual.

export const MAX_VETADOS = 100;

// ¿Viene este correo de una dirección vetada? Los de antes del 27/10/2026 no traen la
// dirección: valen si el remitente era la dirección tal cual.
export function deVetado(correo: Pick<CorreoRemoto, 'de' | 'direccion'>, vetados: string[]): boolean {
  if (vetados.length === 0) return false;
  const direccion = (correo.direccion || correo.de).trim().toLowerCase();
  return vetados.includes(direccion);
}

// Pone (o quita) una dirección de la lista. null si no es una dirección.
export function cambiarVetados(vetados: string[], direccion: string, vetar: boolean): string[] | null {
  const limpia = direccion.trim().toLowerCase();
  if (!esDireccion(limpia)) return null;
  const sin = vetados.filter((v) => v !== limpia);
  return vetar ? [...sin, limpia].slice(-MAX_VETADOS) : sin;
}

// Junta lo que ya había en el móvil con lo que manda el ayudante: los nuevos entran
// sin ver y los que ya estaban conservan lo del móvil (visto, tarea, "¿Eliminar
// cita?"). Se olvidan los de hace más de DIAS_EN_EL_MOVIL días y los de direcciones
// vetadas.
export function mezclarCorreos(
  locales: CorreoResumido[],
  remotos: CorreoRemoto[],
  ahora: Date,
  vetados: string[] = [],
): CorreoResumido[] {
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
  return [...porId.values()]
    .filter((c) => c.recibido >= limite && !deVetado(c, vetados))
    .sort((a, b) => b.recibido.localeCompare(a.recibido));
}

// Tiene fecha (y no se ha dicho "¿Eliminar cita?" → sí).
export function esPlazo(correo: CorreoResumido): correo is CorreoResumido & { fechaLimite: ClaveDia } {
  return correo.fechaLimite !== null && !correo.noEsPlazo;
}

// Los plazos que aún no tienen tarea en el calendario (solo los de hoy en adelante).
export function correosSinTarea(correos: CorreoResumido[], hoy: ClaveDia): CorreoResumido[] {
  return correos.filter((c) => esPlazo(c) && !c.eventoId && c.fechaLimite >= hoy);
}

// Lo que se apunta en el calendario de un correo con fecha, tipo "Yo": con hora, una
// cita de 1 h (hasta las 23:59 como mucho); sin hora, una tarea de 30 min ese día.
export function tareaDeCorreo(correo: CorreoResumido, id: string): Evento {
  const hora = correo.hora ?? null;
  const notas = [`Del correo de ${correo.de}: «${correo.asunto || correo.titulo}».`, correo.resumen, correo.enlace]
    .filter(Boolean)
    .join('\n\n');
  return {
    id,
    titulo: (correo.tarea ?? correo.titulo).slice(0, 80),
    fecha: correo.fechaLimite ?? '',
    horaInicio: hora,
    horaFin: hora ? horaDesdeMinutos(Math.min(minutosDesdeHora(hora) + 60, 23 * 60 + 59)) : null,
    tipo: 'yo',
    lugar: null,
    notas,
    repeticion: 'nunca',
    flexible: !hora,
    duracionMin: hora ? null : 30,
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

// "Para hoy", "Para mañana a las 10:00", "Para el lun 5 oct", "Era el vie 2 oct". Vale
// para un plazo, una cita o un cargo.
export function textoParaDia(dia: ClaveDia, hoy: ClaveDia, hora?: string | null): string {
  const a = hora ? ` a las ${hora}` : '';
  if (dia === hoy) return `Para hoy${a}`;
  if (dia === sumarDias(hoy, 1)) return `Para mañana${a}`;
  return `${dia < hoy ? 'Era' : 'Para'} el ${textoDiaCorto(dia)}${a}`;
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

// Las tres bandejas de la pestaña Correo (27/10/2026):
// - todos: TODOS los correos por día, del más nuevo al más viejo (también los que se
//   apuntaron en el calendario: no desaparecen por eso);
// - conFecha: los apuntados de hoy en adelante, el más cercano primero, y pasados: los
//   apuntados con fecha ya pasada, el más reciente primero;
// - resumenes: los importantes sin fecha (los decide la IA o "Avisarme siempre de…").
export type BandejasCorreo = {
  todos: GrupoCorreos[];
  conFecha: CorreoResumido[];
  pasados: CorreoResumido[];
  resumenes: CorreoResumido[];
};

export function bandejasCorreo(correos: CorreoResumido[], hoy: ClaveDia, diaDe: (iso: string) => ClaveDia): BandejasCorreo {
  const ordenados = [...correos].sort((a, b) => b.recibido.localeCompare(a.recibido));
  const todos: GrupoCorreos[] = [];
  for (const correo of ordenados) {
    const dia = diaDe(correo.recibido);
    const grupo = todos.find((g) => g.dia === dia);
    if (grupo) grupo.correos.push(correo);
    else todos.push({ dia, correos: [correo] });
  }
  const conFecha = ordenados.filter(esPlazo);
  return {
    todos,
    conFecha: conFecha
      .filter((c) => c.fechaLimite >= hoy)
      .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite) || (a.hora ?? '').localeCompare(b.hora ?? '')),
    pasados: conFecha.filter((c) => c.fechaLimite < hoy).sort((a, b) => b.fechaLimite.localeCompare(a.fechaLimite)),
    resumenes: ordenados.filter((c) => c.importante === true && c.fechaLimite === null),
  };
}

// ¿Ha llegado algún correo leído por la IA? Si no, la bandeja Resúmenes lo explica.
export function iaEncendida(correos: CorreoResumido[]): boolean {
  return correos.some((c) => c.via === 'ia');
}

export function contarNuevos(correos: CorreoResumido[]): number {
  return correos.filter((c) => !c.visto).length;
}
