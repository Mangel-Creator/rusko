/*
 * Organizy · Reglas de los correos (sin IA)
 *
 * Dicen de qué va un correo: título y, si pide algo con plazo, la fecha límite. Desde el
 * 26/10/2026 no se resume nada (lo eligió el usuario): solo la fecha, qué es y, con la
 * IA, si es importante; solo se avisa de eso. Las usan a la vez:
 *   - el servidor de Organizy, para las cuentas vinculadas con "Vincular con Gmail" u
 *     "Outlook" (supabase/functions/correo-cuentas);
 *   - el ayudante de Gmail que se pega en script.google.com (gmail/organizy-correo.js),
 *     que se genera con `npm run ayudante-gmail` juntando gmail/ayudante.js y este archivo
 *     sin los "export".
 * No usan nada de Google ni de Deno. Pruebas en supabase/functions/_shared/__tests__.
 */
/* global Utilities */

// Hora de España para saber qué día llegó un correo.
export const ZONA_CORREO = 'Europe/Madrid';
// Con más correos importantes que estos en una vuelta, un solo aviso para todos.
export const MAX_AVISOS_SUELTOS = 3;
// Remitentes de "Avisarme siempre de…" que se guardan como mucho.
export const MAX_SIEMPRE = 30;

var MESES = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sept: 9, sep: 9, set: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};
var DIAS_SEMANA = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
var NOMBRES_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
var NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

// Palabras que anuncian una fecha límite. Las "fuertes" admiten también fechas como
// "mañana" o "el viernes"; con las "débiles" ("hasta el...") solo vale una fecha
// escrita (5 de octubre, 05/10), porque "hasta el lunes" suele ser una despedida.
var PLAZO_FUERTE =
  /(fecha limite|fecha tope|limite|plazo|vence|vencimiento|caduca|expira|a mas tardar|no mas tarde|ultimo dia|tienes hasta|tiene hasta|teneis hasta|tienen hasta|deadline|antes del?|entregar|entrega|presentar|enviar antes|renovar)/g;
var PLAZO_DEBIL = /(hasta el|hasta)/g;
// Palabras de cita (27/10/2026, lo pidió el usuario: lo que tenga fecha, al calendario).
// Valen como las fuertes de plazo; "el día" solo con una fecha escrita ("el día 11/11").
var CITA_FUERTE =
  /\b(cita|reunion|reunirnos|examen|consulta|quedamos|quedada|nos vemos|evento|cena|comida|almuerzo|entrevista|reserva|visita|clase|partido|cumpleanos|cumple|boda|viaje|vuelo|revision|sesion|celebracion|fiesta|tutoria|convocatoria)(s|es)?\b/g;
var CITA_DEBIL = /\bel dia\b/g;

// Direcciones vetadas que se guardan como mucho.
export const MAX_VETADOS = 100;

// "Gestoría López <info@gl.es>" -> "Gestoría López"
export function nombreRemitente(de) {
  var texto = String(de || '').trim();
  var m = texto.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return (m[1] || m[2]).trim() || m[2].trim();
  return texto;
}

// "Gestoría López <Info@GL.es>" -> "info@gl.es" (o "" si no lleva dirección).
export function direccionRemitente(de) {
  var texto = String(de || '');
  var m = texto.match(/<([^<>\s]+@[^<>\s]+)>/) || texto.match(/([^\s<>"',;:]+@[^\s<>"',;:]+\.[a-z]{2,})/i);
  return m ? m[1].trim().toLowerCase().slice(0, 320) : '';
}

// ¿Es una dirección de correo? ("ana@gl.es")
export function esDireccion(texto) {
  return typeof texto === 'string' && texto.length <= 320 && /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[a-z]{2,}$/i.test(texto.trim());
}

// La lista de direcciones vetadas que manda la app, limpia (o null si no vale).
export function leerVetados(valor) {
  if (!Array.isArray(valor)) return null;
  var lista = [];
  valor.forEach(function (v) {
    if (!esDireccion(v)) return;
    var d = v.trim().toLowerCase();
    if (lista.indexOf(d) === -1) lista.push(d);
  });
  return lista.slice(0, MAX_VETADOS);
}

// ¿Viene de una dirección vetada? Los vetados no salen en Rusko: ni en la pestaña Correo,
// ni avisos, ni tareas ni citas (en Gmail siguen igual).
export function vetado(de, lista) {
  if (!Array.isArray(lista) || !lista.length) return false;
  var direccion = direccionRemitente(de) || String(de || '').trim().toLowerCase();
  return !!direccion && lista.indexOf(direccion) !== -1;
}

// Quita "RE:", "RV:", "Fwd:", "[EXTERNO]"... del principio del asunto.
export function limpiarAsunto(asunto) {
  var limpio = String(asunto || '')
    .replace(/^(\s*((re|rv|fw|fwd|reenv|reenviar|tr|aw|wg|res)\s*:|\[[^\]]{1,30}\]))+\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return limpio || '(Sin asunto)';
}

// Sin tildes y en minúsculas (para buscar), con el mismo largo que el original.
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Quita las respuestas citadas, las firmas, los enlaces y los espacios de más.
export function limpiarCuerpo(cuerpo) {
  var texto = String(cuerpo || '').replace(/\r\n?/g, '\n');
  // Reenviado a mano: lo que importa va después de la cabecera del reenvío.
  var reenvio =
    texto.match(/^[-_ ]*(mensaje reenviado|forwarded message|mensaje original|original message)[-_ ]*$/im) ||
    texto.match(/^\s*(de|from)\s*:.+\n\s*(enviado|fecha|sent|date)\s*:/im);
  if (reenvio && reenvio.index !== undefined && texto.slice(0, reenvio.index).trim().length < 40) {
    var resto = texto.slice(reenvio.index);
    var finCabecera = resto.search(/^(asunto|subject)\s*:.*$/im);
    if (finCabecera !== -1) {
      resto = resto.slice(finCabecera).replace(/^.*\n/, '').replace(/^(\s*(para|to|cc|fecha|date)\s*:.*\n)+/i, '');
    }
    texto = resto;
  }
  var cortes = [
    /^\s*(el|on)\s.{4,200}(escribi[oó]|wrote)\s*:?\s*$/im,
    /^[-_ ]*(mensaje original|original message|mensaje reenviado|forwarded message)[-_ ]*$/im,
    /^_{8,}\s*$/m,
    /^\s*(de|from)\s*:.+\n\s*(enviado|fecha|sent|date)\s*:/im,
    /^--\s*$/m,
    /^\s*(enviado desde mi|sent from my|obtener outlook|get outlook)/im,
  ];
  cortes.forEach(function (patron) {
    var m = texto.match(patron);
    if (m && m.index !== undefined && m.index > 0) texto = texto.slice(0, m.index);
  });
  return texto
    .split('\n')
    .filter(function (linea) {
      return !/^\s*>/.test(linea);
    })
    .join('\n')
    .replace(/\[(image|imagen|cid):[^\]]*\]/gi, '')
    .replace(/<?(https?:\/\/|www\.)[^\s>)\]]+>?/gi, '')
    .replace(/<mailto:[^>]+>/gi, '')
    .replace(/[([]\s*[)\]]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ([.,;:])/g, '$1')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

// El saludo solo se quita si termina en coma, punto o dos puntos ("Hola Laura,") o
// si es la línea entera; si no, puede que la frase siga ("Hola te escribo para...").
var SALUDO = /^(hola|buenos dias|buenas tardes|buenas noches|buenas|estimad[oa]s?|querid[oa]s?|apreciad[oa]s?|hi|hello|dear)\b([^.\n!?,:]{0,40}[,:.!]|\s*$)\s*/;
var DESPEDIDA = /^\s*(un saludo|saludos|un abrazo|abrazos|atentamente|cordialmente|muchas gracias|gracias|quedo a (tu|su) disposicion|reciba un cordial saludo|best|regards|thanks)\b/;

// Dos o tres frases del principio del correo, sin saludo ni despedida.
export function resumir(cuerpo, largo) {
  var max = largo || 240;
  var lineas = limpiarCuerpo(cuerpo).split('\n');
  var utiles = [];
  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i].trim();
    if (!linea) continue;
    var norm = normalizar(linea);
    if (utiles.length > 0 && DESPEDIDA.test(norm)) break;
    if (utiles.length === 0) {
      var saludo = norm.match(SALUDO);
      if (saludo) linea = linea.slice(saludo[0].length).trim();
      if (!linea) continue;
    }
    utiles.push(linea);
    if (utiles.join(' ').length > max * 1.5) break;
  }
  var texto = utiles.join(' ').replace(/\s+/g, ' ').trim();
  if (texto.length <= max) return texto;
  var corte = texto.slice(0, max);
  var punto = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('? '), corte.lastIndexOf('! '));
  if (punto > max * 0.4) return corte.slice(0, punto + 1);
  return corte.slice(0, corte.lastIndexOf(' ') > 0 ? corte.lastIndexOf(' ') : max).replace(/[,;:\s]+$/, '') + '…';
}

// --- Fechas: "AAAA-MM-DD" (día de calendario, sin horas) ---

function dosCifras(n) {
  return (n < 10 ? '0' : '') + n;
}

function clave(a, m, d) {
  return a + '-' + dosCifras(m) + '-' + dosCifras(d);
}

// Día en que se recibió un correo, en la hora de España.
export function diaDe(fecha) {
  if (typeof Utilities !== 'undefined') return Utilities.formatDate(fecha, ZONA_CORREO, 'yyyy-MM-dd');
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CORREO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

export function sumarDias(dia, n) {
  var p = dia.split('-').map(Number);
  var f = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return clave(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
}

function diaValido(a, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  var f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCMonth() === m - 1;
}

function diaSemana(dia) {
  var p = dia.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
}

// Un día y un mes sin año: el de este año o, si ya pasó, el del que viene.
function conAnio(m, d, hoy) {
  var anio = Number(hoy.slice(0, 4));
  if (!diaValido(anio, m, d)) return null;
  var dia = clave(anio, m, d);
  // "5 de enero" escrito en diciembre es el del año que viene; "3 de septiembre"
  // escrito a finales de septiembre es una fecha pasada (y no un plazo).
  if (dia < sumarDias(hoy, -1) && diaValido(anio + 1, m, d) && clave(anio + 1, m, d) <= sumarDias(hoy, 120)) {
    dia = clave(anio + 1, m, d);
  }
  return dia;
}

// Todas las fechas de un texto (ya normalizado), con dónde empiezan y si están
// escritas (5 de octubre, 05/10) o son relativas (mañana, el viernes).
function fechasEnTexto(norm, hoy) {
  var fechas = [];
  var m;
  var numericas = /(^|[^\d])(\d{1,2})([/.-])(\d{1,2})(?:\3(\d{2,4}))?(?![\d])/g;
  while ((m = numericas.exec(norm))) {
    var d = Number(m[2]);
    var mes = Number(m[4]);
    // "10.30" es una hora y "3-4" un rango: con punto o guion, solo si lleva año.
    if (m[3] !== '/' && !m[5]) continue;
    var anio = m[5] ? Number(m[5].length === 2 ? '20' + m[5] : m[5]) : null;
    var dia = anio ? (diaValido(anio, mes, d) ? clave(anio, mes, d) : null) : conAnio(mes, d, hoy);
    if (dia) fechas.push({ dia: dia, pos: m.index + m[1].length, fin: m.index + m[0].length, escrita: true, anio: !!anio });
  }
  var nombresMes = Object.keys(MESES)
    .sort(function (a, b) {
      return b.length - a.length;
    })
    .join('|');
  var conMes = new RegExp('(^|[^\\d])(\\d{1,2})(?:\\s+de)?\\s+(' + nombresMes + ')\\.?(?![a-z])(?:\\s+(?:de|del)?\\s*(\\d{4}))?', 'g');
  while ((m = conMes.exec(norm))) {
    var d2 = Number(m[2]);
    var mes2 = MESES[m[3]];
    var anio2 = m[4] ? Number(m[4]) : null;
    var dia2 = anio2 ? (diaValido(anio2, mes2, d2) ? clave(anio2, mes2, d2) : null) : conAnio(mes2, d2, hoy);
    if (dia2) fechas.push({ dia: dia2, pos: m.index + m[1].length, fin: m.index + m[0].length, escrita: true, anio: !!anio2 });
  }
  var relativas = /(^|[^a-z])(pasado manana|manana|hoy)(?![a-z])/g;
  while ((m = relativas.exec(norm))) {
    var antes = norm.slice(Math.max(0, m.index - 8), m.index + m[1].length);
    // "por la mañana", "esta mañana": es la parte del día, no mañana.
    if (m[2] === 'manana' && /(la|esta|cada|de)\s*$/.test(antes)) continue;
    var n = m[2] === 'hoy' ? 0 : m[2] === 'manana' ? 1 : 2;
    fechas.push({ dia: sumarDias(hoy, n), pos: m.index + m[1].length, fin: m.index + m[0].length, escrita: false });
  }
  var semana = /(^|[^a-z])(el|este|esta|proximo|el proximo|el dia)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?![a-z])/g;
  while ((m = semana.exec(norm))) {
    var falta = (DIAS_SEMANA[m[3]] - diaSemana(hoy) + 7) % 7 || 7;
    fechas.push({ dia: sumarDias(hoy, falta), pos: m.index + m[1].length, fin: m.index + m[0].length, escrita: false });
  }
  var finMes = /(^|[^a-z])(a |al |antes de |antes del )?(fin|final|finales) de(l)? mes(?![a-z])/g;
  while ((m = finMes.exec(norm))) {
    var p = hoy.split('-').map(Number);
    var ultimo = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
    fechas.push({ dia: clave(p[0], p[1], ultimo), pos: m.index + m[1].length, fin: m.index + m[0].length, escrita: false });
  }
  return fechas;
}

function buscarPalabras(patron, norm, fuerte, lista) {
  var m;
  patron.lastIndex = 0;
  while ((m = patron.exec(norm))) lista.push({ ini: m.index, fin: m.index + m[0].length, fuerte: fuerte });
}

// La fecha que importa de un texto (ya normalizado) y dónde está, o null. Vale si:
//   - hay una palabra de plazo o de cita cerca: justo antes de la fecha (hasta 60
//     letras) o justo después (hasta 25), en la misma frase;
//   - o es una fecha escrita con año ("11/11/2026", "11 de noviembre de 2026") de
//     mañana en adelante, aunque no haya ninguna palabra (27/10/2026: lo que tenga fecha,
//     al calendario; si no le afecta, "¿Eliminar cita?" en la pestaña Correo).
function fechaElegida(norm, hoy) {
  var fechas = fechasEnTexto(norm, hoy).filter(function (f) {
    return f.dia >= hoy && f.dia <= sumarDias(hoy, 366);
  });
  if (!fechas.length) return null;
  var palabras = [];
  buscarPalabras(PLAZO_FUERTE, norm, true, palabras);
  buscarPalabras(PLAZO_DEBIL, norm, false, palabras);
  buscarPalabras(CITA_FUERTE, norm, true, palabras);
  buscarPalabras(CITA_DEBIL, norm, false, palabras);
  var elegidas = fechas.filter(function (f) {
    if (f.anio && f.dia > hoy) return true;
    return palabras.some(function (p) {
      if (!p.fuerte && !f.escrita) return false;
      var despues = f.pos >= p.fin && f.pos - p.fin <= 60;
      var antes = f.pos < p.ini && p.ini - f.pos <= 25;
      // Sin punto entre medias: la palabra y la fecha tienen que ir en la misma frase.
      var entre = despues ? norm.slice(p.fin, f.pos) : norm.slice(f.pos, p.ini);
      return (despues || antes) && !/[.!?\n]/.test(entre);
    });
  });
  if (!elegidas.length) return null;
  return elegidas.sort(function (a, b) {
    return a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.pos - b.pos;
  })[0];
}

// La fecha límite (o de la cita) de un texto, o null.
export function fechaLimiteEn(texto, hoy) {
  var f = fechaElegida(normalizar(texto), hoy);
  return f ? f.dia : null;
}

// La hora que va justo detrás de esa fecha ("11/11 a las 10", "el jueves a las 17:30",
// "5 de nov, 9:00"), como "HH:MM", o null. "A las 5" sin más es por la tarde (17:00).
export function horaEn(texto, hoy) {
  var norm = normalizar(texto);
  var f = fechaElegida(norm, hoy);
  if (!f) return null;
  var detras = norm.slice(f.fin, f.fin + 40).split(/[.!?\n]/)[0];
  var m =
    detras.match(/^[^\d]{0,25}?\b(?:a las|a la|sobre las|hacia las|desde las|de|,)\s*(\d{1,2})(?:[:.h](\d{2}))?\s*(h\b|horas?\b|de la manana|de la tarde|de la noche|am\b|pm\b)?/) ||
    detras.match(/^[^\d]{0,12}?(\d{1,2})[:h](\d{2})\s*(h\b|horas?\b|de la manana|de la tarde|de la noche|am\b|pm\b)?/);
  if (!m) return null;
  var h = Number(m[1]);
  var min = m[2] ? Number(m[2]) : 0;
  var parte = m[3] || '';
  // "de 5" sin minutos ni "h" podría ser cualquier cosa ("de 2 personas"): solo con "a las".
  if (!m[2] && !parte && !/(a las|a la|sobre las|hacia las|desde las)\s*\d+$/.test(m[0])) return null;
  if (h > 23 || min > 59) return null;
  if ((/tarde|noche|pm/.test(parte) && h < 12) || (!parte && h >= 1 && h <= 7)) h += 12;
  if (h > 23) return null;
  return dosCifras(h) + ':' + dosCifras(min);
}

// Qué es un correo sin IA: el asunto y, si tiene un plazo o una cita, el día (y la hora,
// si va justo detrás). Sin resumen y sin saber si es importante (eso solo lo sabe la IA
// o "Avisarme siempre").
export function analizarCorreo(correo) {
  var hoy = diaDe(correo.recibido);
  var titulo = limpiarAsunto(correo.asunto);
  var cuerpo = limpiarCuerpo(correo.cuerpo).slice(0, 4000);
  var asunto = correo.asunto || '';
  var enAsunto = fechaLimiteEn(asunto, hoy);
  var fecha = enAsunto || fechaLimiteEn(cuerpo, hoy);
  var hora = fecha ? (enAsunto ? horaEn(asunto, hoy) : horaEn(cuerpo, hoy)) : null;
  // Si la hora está en el cuerpo y el día en el asunto ("Reunión 11/11" / "a las 10").
  if (fecha && !hora && enAsunto && fechaLimiteEn(cuerpo, hoy) === fecha) hora = horaEn(cuerpo, hoy);
  return {
    titulo: titulo.slice(0, 120),
    resumen: '',
    fechaLimite: fecha,
    hora: hora,
    tarea: fecha ? titulo.slice(0, 80) : null,
    importante: false,
    via: 'reglas',
  };
}

// Lo que contesta la IA (función "correo"), comprobado: fecha real entre hoy y un año,
// textos recortados y la línea del aviso solo si es importante.
export function resultadoDeIA(a, correo) {
  var hoy = diaDe(correo.recibido);
  var fecha = typeof a.fechaLimite === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.fechaLimite) ? a.fechaLimite : null;
  if (fecha && (fecha < hoy || fecha > sumarDias(hoy, 366))) fecha = null;
  var titulo = String(a.titulo || '').trim().slice(0, 120) || limpiarAsunto(correo.asunto);
  var importante = a.importante === true;
  return {
    titulo: titulo,
    resumen: importante ? String(a.resumen || '').trim().slice(0, 160) : '',
    fechaLimite: fecha,
    hora: null, // la IA no dice la hora (todavía)
    tarea: fecha ? String(a.tarea || titulo).trim().slice(0, 80) : null,
    importante: importante,
    via: 'ia',
  };
}

// ¿Es de alguien de "Avisarme siempre de…"? Vale el nombre tal como sale en la lista
// ("Gestoría López") o, si lleva @ o punto, una dirección o un dominio ("@gl.es").
export function siempreAvisar(de, lista) {
  if (!Array.isArray(lista) || !lista.length) return false;
  var nombre = normalizar(nombreRemitente(de)).trim();
  var completo = normalizar(de);
  return lista.some(function (entrada) {
    var x = normalizar(entrada).trim();
    if (!x) return false;
    if (x === nombre) return true;
    return /[@.]/.test(x) && x.length >= 4 && completo.indexOf(x) !== -1;
  });
}

// La lista de "Avisarme siempre de…" que manda la app, limpia (o null si no vale).
export function leerSiempre(valor) {
  if (!Array.isArray(valor)) return null;
  return valor
    .filter(function (v) {
      return typeof v === 'string' && v.trim() && v.length <= 120;
    })
    .map(function (v) {
      return v.trim();
    })
    .slice(0, MAX_SIEMPRE);
}

// "lun 5 oct"
export function textoDia(dia) {
  var p = dia.split('-').map(Number);
  return NOMBRES_DIA[diaSemana(dia)] + ' ' + p[2] + ' ' + NOMBRES_MES[p[1] - 1];
}

export function recortar(texto, max) {
  return texto.length <= max ? texto : texto.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

// "Hoy", "Mañana" o "El lun 5 oct".
export function textoCuando(dia, hoy) {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  return 'El ' + textoDia(dia);
}

// Los avisos de una vuelta: uno por cada correo con fecha (ya es una tarea) y uno por
// cada importante (o uno solo para todos si son muchos). Del resto, nada.
export function avisosDeCorreos(correos, ahora) {
  var hoy = diaDe(ahora);
  var avisos = [];
  var importantes = [];
  correos.forEach(function (c) {
    if (c.fechaLimite) {
      avisos.push({
        titulo: recortar(textoCuando(c.fechaLimite, hoy) + (c.hora ? ' a las ' + c.hora : '') + ': ' + (c.tarea || c.titulo), 90),
        cuerpo: (c.hora ? 'Te lo he apuntado en el calendario.' : 'Te lo he apuntado en las tareas.') + ' Correo de ' + c.de + '.',
      });
    } else if (c.importante) {
      importantes.push(c);
    }
  });
  if (importantes.length > MAX_AVISOS_SUELTOS) {
    avisos.push({
      titulo: importantes.length + ' correos importantes',
      cuerpo: recortar(
        importantes
          .map(function (c) {
            return c.de + ': ' + c.titulo;
          })
          .join(' · '),
        180,
      ),
    });
  } else {
    importantes.forEach(function (c) {
      avisos.push({
        titulo: recortar(c.de + ': ' + c.titulo, 90),
        cuerpo: recortar(c.resumen || 'Correo importante en Principal.', 180),
      });
    });
  }
  return avisos;
}

// Para las pruebas de Organizy (en Google no existe "module" y esto no hace nada).
