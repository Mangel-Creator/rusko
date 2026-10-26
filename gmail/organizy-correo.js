/*
 * Organizy · Ayudante de Gmail
 *
 * Este código vive en TU cuenta de Google (script.google.com), no en Organizy.
 * Cada 10 minutos mira los correos nuevos de la pestaña "Principal" de tu Gmail y:
 *   - si piden algo con fecha ("el plazo acaba el 5 de octubre"), avisa al móvil y
 *     Organizy lo apunta como tarea ese día;
 *   - si son importantes (lo dice la IA de Organizy) o de alguien de "Avisarme siempre
 *     de…", te manda un aviso corto;
 *   - del resto no avisa: en Organizy sale solo quién lo manda y el asunto.
 * Organizy recoge los resultados al abrirse, desde el enlace de "Aplicación web".
 *
 * Tus correos no se guardan en ningún servidor de Organizy: se leen aquí, dentro de
 * tu cuenta. Aquí solo se guardan 7 días los asuntos y las fechas, para la app.
 * Si algún día activas la IA de Organizy, el texto del correo se manda a su servidor
 * para entenderlo mejor y no se guarda allí.
 *
 * Es la vía "sin guardar nada en el servidor". La otra es "Vincular con Gmail" dentro
 * de Organizy, que solo pide iniciar sesión.
 *
 * Cómo se instala: guía "Fase 11 - Correo.md" (en la carpeta de Organizy).
 *   1. Pega todo este archivo en Código.gs y guarda.
 *   2. Elige la función "instalar" y pulsa Ejecutar (acepta los permisos).
 *   3. Implementar > Nueva implementación > Aplicación web
 *      (Ejecutar como: yo; Quién tiene acceso: cualquier usuario).
 *   4. Abre la URL de la aplicación web en el ordenador: sale un QR. Escanéalo con el
 *      iPhone y Organizy se vincula sola (o copia la URL y pégala en Hoy > Resúmenes).
 *
 * Programadores: este archivo se GENERA con `npm run ayudante-gmail` a partir de
 * gmail/ayudante.js (lo de Google) y supabase/functions/_shared/reglasCorreo.js (las
 * reglas, que comparte con el servidor). No lo edites a mano.
 */
/* global GmailApp, PropertiesService, ScriptApp, UrlFetchApp, ContentService, HtmlService, Utilities, Session, LockService, Logger */
/* global analizarCorreo, avisosDeCorreos, leerSiempre, limpiarCuerpo, nombreRemitente, resultadoDeIA, siempreAvisar, ZONA_CORREO */

var AJUSTES = {
  // Qué correos mira: los de "Principal" de la bandeja de entrada que no mandas tú.
  busqueda: 'in:inbox category:primary -from:me',
  cadaMinutos: 10,
  diasGuardados: 7,
  maxPorVuelta: 25,
  // Dónde está Organizy en la web: el QR abre aquí la pantalla de Resúmenes.
  web: 'https://mangel-creator.github.io/organizy/resumenes',
};

// ---------------------------------------------------------------------------
// Lo que ejecutas tú desde el editor
// ---------------------------------------------------------------------------

// Lo preparas una vez: crea la revisión cada 10 minutos y recoge los correos del
// último día, sin avisar, para que la app no empiece vacía.
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'revisarCorreo') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('revisarCorreo').timeBased().everyMinutes(AJUSTES.cadaMinutos).create();
  var desde = new Date(Date.now() - 24 * 3600 * 1000);
  var n = revisar_(desde, false);
  Logger.log(
    'Listo. He recogido ' + n + ' correos del último día y revisaré los nuevos cada ' + AJUSTES.cadaMinutos + ' minutos.\n' +
      'Ahora: Implementar > Nueva implementación > Aplicación web (Ejecutar como: yo; Acceso: cualquier usuario), ' +
      'abre la URL que te da y escanea el QR con el iPhone.',
  );
}

// Para pararlo todo: quita la revisión automática, los móviles y lo guardado.
function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log('Hecho. El ayudante ya no mira tu correo. Puedes borrar el proyecto si quieres.');
}

// Manda un aviso de prueba a los móviles conectados.
function probarAviso() {
  var tokens = leerJson_('tokens', []);
  if (!tokens.length) {
    Logger.log('Aún no hay ningún móvil conectado. Abre Organizy en Expo Go y ve a Hoy > Resúmenes.');
    return;
  }
  mandarAvisos_([{ titulo: 'Prueba del ayudante de Gmail', cuerpo: 'Si ves esto, los avisos de correo funcionan.' }]);
  Logger.log('Aviso enviado a ' + tokens.length + ' móvil(es).');
}

// Olvida los móviles conectados (vuelven a apuntarse solos al abrir Organizy).
function olvidarMoviles() {
  PropertiesService.getScriptProperties().deleteProperty('tokens');
  Logger.log('Hecho.');
}

// ---------------------------------------------------------------------------
// Lo que se ejecuta solo
// ---------------------------------------------------------------------------

// Cada 10 minutos (lo pone "instalar").
function revisarCorreo() {
  var ultima = Number(PropertiesService.getScriptProperties().getProperty('ultimaRevision')) || Date.now() - 3600 * 1000;
  // Un poco de margen hacia atrás: Gmail a veces tarda en indexar un correo.
  revisar_(new Date(ultima - 20 * 60 * 1000), true);
}

// Organizy pide aquí los resúmenes (con un POST desde la app).
// Manda { token?, supabase?, siempre? } y recibe { ok, correos, ultimaRevision }.
function doPost(e) {
  var datos = {};
  try {
    datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    datos = {};
  }
  if (typeof datos.token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(datos.token)) guardarToken_(datos.token);
  // "Avisarme siempre de…" (lo elige la persona en Organizy).
  var siempre = leerSiempre(datos.siempre);
  if (siempre) PropertiesService.getScriptProperties().setProperty('siempre', JSON.stringify(siempre));
  var supabase = datos.supabase;
  if (
    supabase &&
    typeof supabase.url === 'string' &&
    /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabase.url) &&
    typeof supabase.clave === 'string' &&
    supabase.clave.length < 200
  ) {
    PropertiesService.getScriptProperties().setProperty('supabase', JSON.stringify({ url: supabase.url, clave: supabase.clave }));
  }
  var ultima = Number(PropertiesService.getScriptProperties().getProperty('ultimaRevision')) || null;
  return respuestaJson_({
    ok: true,
    version: 1,
    ultimaRevision: ultima ? new Date(ultima).toISOString() : null,
    correos: leerCorreos_(),
  });
}

// Al abrir el enlace en el navegador: una página con el QR que vincula Organizy.
// El enlace va detrás de "#" para que no quede en los registros de ningún servidor.
function doGet() {
  var url = ScriptApp.getService().getUrl();
  var destino = AJUSTES.web + '#ayudante=' + encodeURIComponent(url);
  var html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Organizy · Vincular</title>' +
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>' +
    '<style>body{font-family:system-ui,sans-serif;background:#F4F1EA;color:#1A1C24;margin:0;padding:32px 16px;text-align:center}' +
    '.caja{background:#fff;max-width:420px;margin:0 auto;padding:24px;border-radius:10px}#qr{display:inline-block;padding:12px;background:#fff}' +
    'a{color:#2B4BD8;font-weight:600}p{line-height:1.5}small{color:#5E5A52}</style></head><body><div class="caja">' +
    '<h1>Vincula Organizy con tu Gmail</h1>' +
    '<p>Abre la cámara del iPhone y apunta a este código. Se abre Organizy y se vincula sola.</p>' +
    '<div id="qr"></div>' +
    '<p>¿Estás en el móvil? <a href="' + destino + '" target="_top">Ábrelo aquí</a>.</p>' +
    '<p><small>No compartas este código ni este enlace: quien los tenga puede leer tus resúmenes.</small></p>' +
    '</div><script>new QRCode(document.getElementById("qr"),{text:' + JSON.stringify(destino) + ',width:240,height:240});</script></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Organizy · Vincular');
}

// ---------------------------------------------------------------------------
// Revisión
// ---------------------------------------------------------------------------

function revisar_(desde, avisar) {
  var cerrojo = LockService.getScriptLock();
  if (!cerrojo.tryLock(5000)) return 0;
  try {
    var props = PropertiesService.getScriptProperties();
    var inicio = Date.now();
    var yo = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
    var vistos = leerJson_('vistos', []);
    var consulta = AJUSTES.busqueda + ' after:' + Math.floor(desde.getTime() / 1000);
    var hilos = GmailApp.search(consulta, 0, AJUSTES.maxPorVuelta);
    var nuevos = [];
    hilos.forEach(function (hilo) {
      hilo.getMessages().forEach(function (m) {
        if (m.getDate().getTime() < desde.getTime()) return;
        if (vistos.indexOf(m.getId()) !== -1) return;
        if (m.isInTrash() || m.isDraft()) return;
        if (yo && m.getFrom().toLowerCase().indexOf(yo) !== -1) return;
        nuevos.push(m);
      });
    });
    nuevos.sort(function (a, b) {
      return a.getDate().getTime() - b.getDate().getTime();
    });

    var guardados = [];
    var siempre = leerJson_('siempre', []);
    nuevos.forEach(function (m) {
      var correo = {
        asunto: m.getSubject() || '',
        de: m.getFrom() || '',
        cuerpo: (m.getPlainBody() || '').slice(0, 20000),
        recibido: m.getDate(),
      };
      var analisis = analizarConIA_(correo) || analizarCorreo(correo);
      var guardado = {
        id: m.getId(),
        recibido: m.getDate().toISOString(),
        de: nombreRemitente(correo.de),
        asunto: correo.asunto.slice(0, 200),
        titulo: analisis.titulo,
        resumen: analisis.resumen,
        fechaLimite: analisis.fechaLimite,
        tarea: analisis.tarea,
        importante: analisis.importante || siempreAvisar(correo.de, siempre),
        via: analisis.via,
        enlace: 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(yo) + '#all/' + m.getThread().getId(),
      };
      props.setProperty('c:' + guardado.id, JSON.stringify(guardado));
      guardados.push(guardado);
      vistos.push(guardado.id);
    });

    // Solo los últimos (la búsqueda ya no llega más atrás).
    props.setProperty('vistos', JSON.stringify(vistos.slice(-150)));
    props.setProperty('ultimaRevision', String(inicio));
    borrarViejos_();
    if (avisar && guardados.length) mandarAvisos_(avisosDeCorreos(guardados, new Date()));
    return guardados.length;
  } finally {
    cerrojo.releaseLock();
  }
}

function leerCorreos_() {
  var todas = PropertiesService.getScriptProperties().getProperties();
  var lista = [];
  Object.keys(todas).forEach(function (clave) {
    if (clave.indexOf('c:') !== 0) return;
    try {
      lista.push(JSON.parse(todas[clave]));
    } catch (error) {
      // Se ignora.
    }
  });
  return lista.sort(function (a, b) {
    return a.recibido < b.recibido ? 1 : -1;
  });
}

function borrarViejos_() {
  var props = PropertiesService.getScriptProperties();
  var limite = new Date(Date.now() - AJUSTES.diasGuardados * 24 * 3600 * 1000).toISOString();
  // Google deja guardar unos 500 KB: como mucho 200 correos (los más nuevos).
  leerCorreos_().forEach(function (c, i) {
    if (c.recibido < limite || i >= 200) props.deleteProperty('c:' + c.id);
  });
}

// ---------------------------------------------------------------------------
// Avisos al móvil (servicio de avisos de Expo, gratis y sin clave)
// ---------------------------------------------------------------------------

function guardarToken_(token) {
  var tokens = leerJson_('tokens', []).filter(function (t) {
    return t !== token;
  });
  tokens.push(token);
  PropertiesService.getScriptProperties().setProperty('tokens', JSON.stringify(tokens.slice(-5)));
}

function mandarAvisos_(avisos) {
  var tokens = leerJson_('tokens', []);
  if (!tokens.length || !avisos.length) return;
  var dia = Utilities.formatDate(new Date(), ZONA_CORREO, 'yyyy-MM-dd');
  var mensajes = [];
  tokens.forEach(function (token) {
    avisos.forEach(function (aviso) {
      mensajes.push({
        to: token,
        title: aviso.titulo,
        body: aviso.cuerpo,
        sound: 'default',
        channelId: 'avisos',
        // Al tocarlo, Organizy abre Resúmenes.
        data: { tipo: 'correo', dia: dia, destino: { pantalla: 'resumenes' } },
      });
    });
  });
  var respuesta = UrlFetchApp.fetch('https://exp.host/--/api/v2/push/send', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(mensajes.slice(0, 100)),
    muteHttpExceptions: true,
  });
  // Si un móvil ya no existe (app borrada), se deja de avisar a ese.
  try {
    var resultado = JSON.parse(respuesta.getContentText());
    var malos = [];
    (resultado.data || []).forEach(function (r, i) {
      if (r && r.details && r.details.error === 'DeviceNotRegistered') malos.push(mensajes[i].to);
    });
    if (malos.length) {
      PropertiesService.getScriptProperties().setProperty(
        'tokens',
        JSON.stringify(
          tokens.filter(function (t) {
            return malos.indexOf(t) === -1;
          }),
        ),
      );
    }
  } catch (error) {
    // Sin respuesta legible: se intenta otra vez en la próxima vuelta.
  }
}

// ---------------------------------------------------------------------------
// IA (opcional): la función "correo" del servidor de Organizy, con Claude.
// Sin la clave de Anthropic puesta en Supabase contesta "sin-clave" y se usan las
// reglas de abajo; se vuelve a probar cada 6 horas, así se enciende sola.
// ---------------------------------------------------------------------------

function analizarConIA_(correo) {
  var props = PropertiesService.getScriptProperties();
  var supabase = leerJson_('supabase', null);
  if (!supabase) return null;
  if (Date.now() < (Number(props.getProperty('iaPausadaHasta')) || 0)) return null;
  var pausar = function (minutos) {
    props.setProperty('iaPausadaHasta', String(Date.now() + minutos * 60 * 1000));
    return null;
  };
  try {
    var token = sesionSupabase_(supabase);
    if (!token) return pausar(60);
    var respuesta = UrlFetchApp.fetch(supabase.url + '/functions/v1/correo', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: supabase.clave, Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        asunto: correo.asunto.slice(0, 200),
        de: nombreRemitente(correo.de),
        cuerpo: limpiarCuerpo(correo.cuerpo).slice(0, 4000),
        hoy: Utilities.formatDate(correo.recibido, ZONA_CORREO, 'yyyy-MM-dd'),
      }),
      muteHttpExceptions: true,
    });
    var datos = JSON.parse(respuesta.getContentText() || '{}');
    if (respuesta.getResponseCode() !== 200 || !datos.analisis) {
      return pausar(datos.error === 'sin-clave' ? 6 * 60 : 30);
    }
    return resultadoDeIA(datos.analisis, correo);
  } catch (error) {
    return pausar(30);
  }
}

// Sesión anónima de Supabase (como la de la app), guardada aquí.
function sesionSupabase_(supabase) {
  var props = PropertiesService.getScriptProperties();
  var sesion = leerJson_('sesion', null);
  if (sesion && sesion.caduca > Date.now() + 60 * 1000) return sesion.acceso;
  var ruta = sesion && sesion.renovar ? '/auth/v1/token?grant_type=refresh_token' : '/auth/v1/signup';
  var cuerpo = sesion && sesion.renovar ? { refresh_token: sesion.renovar } : { data: {} };
  var respuesta = UrlFetchApp.fetch(supabase.url + ruta, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: supabase.clave },
    payload: JSON.stringify(cuerpo),
    muteHttpExceptions: true,
  });
  var datos = JSON.parse(respuesta.getContentText() || '{}');
  if (respuesta.getResponseCode() !== 200 || !datos.access_token) {
    // Si la renovación falla, la próxima vez se crea una sesión nueva.
    props.deleteProperty('sesion');
    return null;
  }
  props.setProperty(
    'sesion',
    JSON.stringify({
      acceso: datos.access_token,
      renovar: datos.refresh_token,
      caduca: Date.now() + (Number(datos.expires_in) || 3600) * 1000,
    }),
  );
  return datos.access_token;
}

// ---------------------------------------------------------------------------
// Utilidades de Google
// ---------------------------------------------------------------------------

function leerJson_(clave, porDefecto) {
  try {
    var valor = PropertiesService.getScriptProperties().getProperty(clave);
    return valor ? JSON.parse(valor) : porDefecto;
  } catch (error) {
    return porDefecto;
  }
}

function respuestaJson_(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}

// ===========================================================================
// Reglas (sin IA): copia de supabase/functions/_shared/reglasCorreo.js
// ===========================================================================

// Hora de España para saber qué día llegó un correo.
var ZONA_CORREO = 'Europe/Madrid';
// Con más correos importantes que estos en una vuelta, un solo aviso para todos.
var MAX_AVISOS_SUELTOS = 3;
// Remitentes de "Avisarme siempre de…" que se guardan como mucho.
var MAX_SIEMPRE = 30;

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

// "Gestoría López <info@gl.es>" -> "Gestoría López"
function nombreRemitente(de) {
  var texto = String(de || '').trim();
  var m = texto.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return (m[1] || m[2]).trim() || m[2].trim();
  return texto;
}

// Quita "RE:", "RV:", "Fwd:", "[EXTERNO]"... del principio del asunto.
function limpiarAsunto(asunto) {
  var limpio = String(asunto || '')
    .replace(/^(\s*((re|rv|fw|fwd|reenv|reenviar|tr|aw|wg|res)\s*:|\[[^\]]{1,30}\]))+\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return limpio || '(Sin asunto)';
}

// Sin tildes y en minúsculas (para buscar), con el mismo largo que el original.
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Quita las respuestas citadas, las firmas, los enlaces y los espacios de más.
function limpiarCuerpo(cuerpo) {
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
function resumir(cuerpo, largo) {
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
function diaDe(fecha) {
  if (typeof Utilities !== 'undefined') return Utilities.formatDate(fecha, ZONA_CORREO, 'yyyy-MM-dd');
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CORREO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

function sumarDias(dia, n) {
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
    if (dia) fechas.push({ dia: dia, pos: m.index + m[1].length, escrita: true });
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
    if (dia2) fechas.push({ dia: dia2, pos: m.index + m[1].length, escrita: true });
  }
  var relativas = /(^|[^a-z])(pasado manana|manana|hoy)(?![a-z])/g;
  while ((m = relativas.exec(norm))) {
    var antes = norm.slice(Math.max(0, m.index - 8), m.index + m[1].length);
    // "por la mañana", "esta mañana": es la parte del día, no mañana.
    if (m[2] === 'manana' && /(la|esta|cada|de)\s*$/.test(antes)) continue;
    var n = m[2] === 'hoy' ? 0 : m[2] === 'manana' ? 1 : 2;
    fechas.push({ dia: sumarDias(hoy, n), pos: m.index + m[1].length, escrita: false });
  }
  var semana = /(^|[^a-z])(el|este|esta|proximo|el proximo|el dia)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?![a-z])/g;
  while ((m = semana.exec(norm))) {
    var falta = (DIAS_SEMANA[m[3]] - diaSemana(hoy) + 7) % 7 || 7;
    fechas.push({ dia: sumarDias(hoy, falta), pos: m.index + m[1].length, escrita: false });
  }
  var finMes = /(^|[^a-z])(a |al |antes de |antes del )?(fin|final|finales) de(l)? mes(?![a-z])/g;
  while ((m = finMes.exec(norm))) {
    var p = hoy.split('-').map(Number);
    var ultimo = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
    fechas.push({ dia: clave(p[0], p[1], ultimo), pos: m.index + m[1].length, escrita: false });
  }
  return fechas;
}

// La fecha límite de un texto, o null. Tiene que haber una palabra de plazo cerca:
// justo antes de la fecha (hasta 60 letras) o justo después (hasta 25).
function fechaLimiteEn(texto, hoy) {
  var norm = normalizar(texto);
  var fechas = fechasEnTexto(norm, hoy).filter(function (f) {
    return f.dia >= hoy && f.dia <= sumarDias(hoy, 366);
  });
  if (!fechas.length) return null;
  var palabras = [];
  var m;
  PLAZO_FUERTE.lastIndex = 0;
  while ((m = PLAZO_FUERTE.exec(norm))) palabras.push({ ini: m.index, fin: m.index + m[0].length, fuerte: true });
  PLAZO_DEBIL.lastIndex = 0;
  while ((m = PLAZO_DEBIL.exec(norm))) palabras.push({ ini: m.index, fin: m.index + m[0].length, fuerte: false });
  var elegidas = fechas.filter(function (f) {
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
  return elegidas
    .map(function (f) {
      return f.dia;
    })
    .sort()[0];
}

// Qué es un correo sin IA: el asunto y, si pide algo con plazo, la fecha límite. Sin
// resumen y sin saber si es importante (eso solo lo sabe la IA o "Avisarme siempre").
function analizarCorreo(correo) {
  var hoy = diaDe(correo.recibido);
  var titulo = limpiarAsunto(correo.asunto);
  var cuerpo = limpiarCuerpo(correo.cuerpo).slice(0, 4000);
  var fecha = fechaLimiteEn(correo.asunto || '', hoy) || fechaLimiteEn(cuerpo, hoy);
  return {
    titulo: titulo.slice(0, 120),
    resumen: '',
    fechaLimite: fecha,
    tarea: fecha ? titulo.slice(0, 80) : null,
    importante: false,
    via: 'reglas',
  };
}

// Lo que contesta la IA (función "correo"), comprobado: fecha real entre hoy y un año,
// textos recortados y la línea del aviso solo si es importante.
function resultadoDeIA(a, correo) {
  var hoy = diaDe(correo.recibido);
  var fecha = typeof a.fechaLimite === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.fechaLimite) ? a.fechaLimite : null;
  if (fecha && (fecha < hoy || fecha > sumarDias(hoy, 366))) fecha = null;
  var titulo = String(a.titulo || '').trim().slice(0, 120) || limpiarAsunto(correo.asunto);
  var importante = a.importante === true;
  return {
    titulo: titulo,
    resumen: importante ? String(a.resumen || '').trim().slice(0, 160) : '',
    fechaLimite: fecha,
    tarea: fecha ? String(a.tarea || titulo).trim().slice(0, 80) : null,
    importante: importante,
    via: 'ia',
  };
}

// ¿Es de alguien de "Avisarme siempre de…"? Vale el nombre tal como sale en la lista
// ("Gestoría López") o, si lleva @ o punto, una dirección o un dominio ("@gl.es").
function siempreAvisar(de, lista) {
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
function leerSiempre(valor) {
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
function textoDia(dia) {
  var p = dia.split('-').map(Number);
  return NOMBRES_DIA[diaSemana(dia)] + ' ' + p[2] + ' ' + NOMBRES_MES[p[1] - 1];
}

function recortar(texto, max) {
  return texto.length <= max ? texto : texto.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

// "Hoy", "Mañana" o "El lun 5 oct".
function textoCuando(dia, hoy) {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  return 'El ' + textoDia(dia);
}

// Los avisos de una vuelta: uno por cada correo con fecha (ya es una tarea) y uno por
// cada importante (o uno solo para todos si son muchos). Del resto, nada.
function avisosDeCorreos(correos, ahora) {
  var hoy = diaDe(ahora);
  var avisos = [];
  var importantes = [];
  correos.forEach(function (c) {
    if (c.fechaLimite) {
      avisos.push({
        titulo: recortar(textoCuando(c.fechaLimite, hoy) + ': ' + (c.tarea || c.titulo), 90),
        cuerpo: 'Te lo he apuntado en las tareas. Correo de ' + c.de + '.',
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
