/*
 * Organizy · Ayudante de Gmail
 *
 * Este código vive en TU cuenta de Google (script.google.com), no en Organizy.
 * Cada 10 minutos mira los correos nuevos de tu bandeja de entrada (sin Promociones,
 * Social, Notificaciones ni Foros) y:
 *   - si tienen una fecha ("el plazo acaba el 5 de octubre", "cita el 11/11 a las 10"),
 *     avisa al móvil y Organizy lo apunta ese día (con hora, como cita);
 *   - si son importantes (lo dice la IA de Organizy) o de alguien de "Avisarme siempre
 *     de…", te manda un aviso corto;
 *   - si vienen de una dirección vetada en Organizy, no hace nada con ellos;
 *   - del resto no avisa: en Rusko sale quién lo manda, el asunto y un resumen corto.
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
/* global analizarCorreo, avisosDeCorreos, BUSQUEDA_GMAIL, cabecerasAutomaticas, direccionRemitente, leerSiempre, leerVetados, limpiarCuerpo, nombreRemitente, resultadoDeIA, siempreAvisar, vetado, ZONA_CORREO */

var AJUSTES = {
  cadaMinutos: 10,
  diasGuardados: 7,
  maxPorVuelta: 25,
  // Dónde está Organizy en la web: el QR abre aquí la pantalla de Resúmenes.
  web: 'https://mangel-creator.github.io/rusko/resumenes',
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
// Manda { token?, supabase?, siempre?, vetados? } y recibe { ok, correos, ultimaRevision }.
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
  // Direcciones vetadas: sus correos no se apuntan, no avisan y no se mandan a la app.
  var vetados = leerVetados(datos.vetados);
  if (vetados) PropertiesService.getScriptProperties().setProperty('vetados', JSON.stringify(vetados));
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
    correos: leerCorreos_().filter(function (c) {
      return !vetado(c.direccion || '', vetados || leerJson_('vetados', []));
    }),
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
    var consulta = BUSQUEDA_GMAIL + ' after:' + Math.floor(desde.getTime() / 1000);
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
    var vetados = leerJson_('vetados', []);
    nuevos.forEach(function (m) {
      var correo = {
        asunto: m.getSubject() || '',
        de: m.getFrom() || '',
        cuerpo: (m.getPlainBody() || '').slice(0, 20000),
        recibido: m.getDate(),
        // List-Unsubscribe, Precedence: bulk… = boletín o aviso automático.
        automatico: cabecerasAutomaticas(function (nombre) {
          return m.getHeader(nombre.replace(/(^|-)([a-z])/g, function (x) { return x.toUpperCase(); })) || '';
        }),
      };
      // De una dirección vetada: se da por visto y no se guarda ni avisa.
      if (vetado(correo.de, vetados)) {
        vistos.push(m.getId());
        return;
      }
      var analisis = analizarConIA_(correo) || analizarCorreo(correo);
      var guardado = {
        id: m.getId(),
        recibido: m.getDate().toISOString(),
        de: nombreRemitente(correo.de),
        direccion: direccionRemitente(correo.de),
        asunto: correo.asunto.slice(0, 200),
        titulo: analisis.titulo,
        resumen: analisis.resumen,
        fechaLimite: analisis.fechaLimite,
        hora: analisis.hora || null,
        tarea: analisis.tarea,
        importante: analisis.importante || siempreAvisar(correo.de, siempre),
        automatico: analisis.automatico === true,
        aviso: analisis.aviso || '',
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
