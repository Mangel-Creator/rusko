// Utilidades de fechas y horas en español de España.
// - Semana empezando en lunes.
// - Horas en formato 24 h.
// - Siempre en la zona horaria del dispositivo (la que usa Date por defecto).

const LOCALE = 'es-ES';

const formatoFechaLarga = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const formatoFechaCorta = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const formatoHora = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// "martes, 23 de septiembre"
export function formatearFechaLarga(fecha: Date): string {
  return formatoFechaLarga.format(fecha);
}

// Pone en mayúscula solo la primera letra: "miércoles, 23..." -> "Miércoles, 23..."
export function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase(LOCALE) + texto.slice(1);
}

// "23/09/2026"
export function formatearFechaCorta(fecha: Date): string {
  return formatoFechaCorta.format(fecha);
}

// "18:05"
export function formatearHora(fecha: Date): string {
  return formatoHora.format(fecha);
}

// Día de la semana con lunes = 0 y domingo = 6.
export function diaSemanaDesdeLunes(fecha: Date): number {
  return (fecha.getDay() + 6) % 7;
}

// Lunes de la semana de "fecha", a las 00:00.
export function inicioDeSemana(fecha: Date): Date {
  const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  lunes.setDate(lunes.getDate() - diaSemanaDesdeLunes(lunes));
  return lunes;
}

export const DIAS_SEMANA_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

// Letras de los días para selectores, empezando en lunes (X = miércoles).
export const DIAS_SEMANA_LETRA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

// "Buenos días" de 6:00 a 13:59, "Buenas tardes" de 14:00 a 20:59 y
// "Buenas noches" el resto, como se dice en España.
// Saludo cercano según la hora: "¿Qué toca hoy, Miguel?" hasta las 13:59, "¿Qué queda hoy…?"
// por la tarde (14:00-20:59) y "¿Qué tal el día…?" por la noche (21:00-23:59).
export function saludoSegunHora(fecha: Date, nombre = ''): string {
  const hora = fecha.getHours();
  const base = hora < 14 ? '¿Qué toca hoy' : hora < 21 ? '¿Qué queda hoy' : '¿Qué tal el día';
  return `${base}${nombre ? `, ${nombre}` : ''}?`;
}

// "07:30" -> 450 (minutos desde medianoche).
export function minutosDesdeHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// 450 -> "07:30". Da la vuelta al pasar de medianoche.
export function horaDesdeMinutos(minutos: number): string {
  const total = ((minutos % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// --- Días como texto "AAAA-MM-DD" (fase 3) ---
// Los eventos guardan su fecha así, en la hora local del dispositivo. Se pueden
// comparar como texto: "2026-09-23" < "2026-09-24".

export type ClaveDia = string;

// Fecha -> "2026-09-24"
export function claveDia(fecha: Date): ClaveDia {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

// "2026-09-24" -> Date a las 00:00 (hora local)
export function fechaDesdeClave(clave: ClaveDia): Date {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function sumarDias(clave: ClaveDia, dias: number): ClaveDia {
  const fecha = fechaDesdeClave(clave);
  fecha.setDate(fecha.getDate() + dias);
  return claveDia(fecha);
}

// Minutos desde medianoche de una fecha: 18:05 -> 1085.
export function minutosDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

const formatoDiaSemana = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const formatoMesCorto = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const formatoMes = new Intl.DateTimeFormat(LOCALE, { month: 'long' });

// "Jueves 24 sept"
export function formatearDiaCorto(fecha: Date): string {
  const mes = formatoMesCorto.format(fecha).replace('.', '');
  return capitalizar(`${formatoDiaSemana.format(fecha)} ${fecha.getDate()} ${mes}`);
}

// "Septiembre"
export function nombreMes(fecha: Date): string {
  return capitalizar(formatoMes.format(fecha));
}

// Número de semana según la norma europea (ISO 8601): la semana 1 es la que
// contiene el primer jueves del año.
export function numeroSemana(fecha: Date): number {
  const jueves = inicioDeSemana(fecha);
  jueves.setDate(jueves.getDate() + 3);
  const primeroDeEnero = new Date(jueves.getFullYear(), 0, 1);
  const dias = Math.round((jueves.getTime() - primeroDeEnero.getTime()) / 86400000);
  return Math.floor(dias / 7) + 1;
}

// 120 -> "2 h", 90 -> "1 h 30 min", 45 -> "45 min"
export function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// "hoy a las 11:02", "ayer a las 11:02" o "el lunes 21 sept a las 09:00".
export function cuandoFue(fecha: Date, ahora: Date): string {
  const dia = claveDia(fecha);
  const hoy = claveDia(ahora);
  const hora = formatearHora(fecha);
  if (dia === hoy) return `hoy a las ${hora}`;
  if (dia === sumarDias(hoy, -1)) return `ayer a las ${hora}`;
  return `el ${formatearDiaCorto(fecha).toLocaleLowerCase('es-ES')} a las ${hora}`;
}
