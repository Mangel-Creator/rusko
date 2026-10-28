// Organizy · "Vincular con Gmail" y "Vincular con Outlook" (fase 11).
//
// El usuario solo inicia sesión en Google o Microsoft; esta función hace el resto:
//   - POST { accion: 'empezar', proveedor, vuelta, tokenPush } (con sesión anónima):
//     devuelve la dirección para iniciar sesión.
//   - GET ?code=&state= : vuelta del inicio de sesión. Canjea el código por la llave
//     (refresh token), la guarda CIFRADA, recoge el último día sin avisar y vuelve a la
//     app con ?correo=ok (o cancelado / error).
//   - POST { accion: 'estado', tokenPush?, siempre?, vetados? } (con sesión): cuentas
//     vinculadas y correos de los últimos 7 días (sin los de direcciones vetadas). Apunta
//     el móvil para los avisos y guarda las listas de "Avisarme siempre de…" y de vetados.
//   - POST { accion: 'quitar', id } (con sesión): desvincula y borra todo lo de la cuenta.
//   - POST { accion: 'revisar' } con la cabecera x-organizy-cron: lo lanza pg_cron cada
//     5 minutos (supabase/migrations/20260927000000_correo_cuentas.sql). Mira los correos
//     nuevos de cada cuenta, los analiza con las reglas (o con Claude si está la clave)
//     y avisa al móvil por el servicio de Expo.
//
// Solo lee el correo (permiso gmail.readonly / Mail.Read). Nunca ve la contraseña.
// Secretos: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID y
// MICROSOFT_CLIENT_SECRET (sin ellos, ese botón dice que aún no está activado),
// CORREO_CLAVE_CIFRADO y CORREO_CRON_SECRETO.

import { respuestaJson, respuestaPrevia } from '../_shared/cors.ts';
import { cifrar, descifrar } from '../_shared/cifrado.ts';
import { analizarConClaude, iaDisponible } from '../_shared/iaCorreo.ts';
import { numeroDeEntorno, sumarUso } from '../_shared/limite.ts';
import { enviarPush, type ClavesVapid } from '../_shared/webPush.ts';
import {
  conResultado,
  emailDeCuenta,
  mensajeDeGmail,
  mensajeDeOutlook,
  OAUTH,
  PROVEEDORES,
  urlAutorizacion,
  vueltaValida,
  type MensajeLeido,
  type Proveedor,
} from '../_shared/proveedoresCorreo.ts';
import {
  analizarCorreo,
  avisosDeCorreos,
  BUSQUEDA_GMAIL,
  diaDe,
  direccionRemitente,
  leerSiempre,
  leerVetados,
  limpiarCuerpo,
  nombreRemitente,
  resultadoDeIA,
  siempreAvisar,
  vetado,
} from '../_shared/reglasCorreo.js';
import { clienteAdmin, usuarioDeLaPeticion } from '../_shared/usuario.ts';

const REDIRECCION = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/correo-cuentas`;
const CLAVE_CIFRADO = Deno.env.get('CORREO_CLAVE_CIFRADO') ?? '';
const SECRETO_CRON = Deno.env.get('CORREO_CRON_SECRETO') ?? '';
const CLIENTES: Record<Proveedor, { id: string; secreto: string }> = {
  gmail: { id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '', secreto: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '' },
  outlook: { id: Deno.env.get('MICROSOFT_CLIENT_ID') ?? '', secreto: Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? '' },
};
// Correos al día con IA por persona (no gastan de los límites de 5 horas y semana).
const LIMITE_IA_USUARIO = numeroDeEntorno('CORREO_LIMITE_USUARIO', 100);
const LIMITE_IA_GLOBAL = numeroDeEntorno('CORREO_LIMITE_GLOBAL', 3000);
const MAX_POR_VUELTA = 25;
const MAX_TOKENS_PUSH = 5;

const configurado = (p: Proveedor) => !!(CLIENTES[p].id && CLIENTES[p].secreto && CLAVE_CIFRADO);

type Cuenta = {
  id: string;
  usuario: string;
  proveedor: Proveedor;
  email: string;
  llave: string;
  tokens_push: string[];
  estado: 'ok' | 'caducada';
  ultima_revision: string | null;
  vistos: string[];
  siempre_avisar: string[]; // "Avisarme siempre de…" (nombres, direcciones o dominios)
  vetados: string[]; // direcciones vetadas: sus correos no salen nada en Rusko
};

class LlaveCaducada extends Error {}

// --- Hablar con Google y Microsoft ---

async function pedirTokens(proveedor: Proveedor, datos: Record<string, string>) {
  const cuerpo = new URLSearchParams({ client_id: CLIENTES[proveedor].id, client_secret: CLIENTES[proveedor].secreto, ...datos });
  if (proveedor === 'outlook') cuerpo.set('scope', OAUTH.outlook.alcance);
  const respuesta = await fetch(OAUTH[proveedor].token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  });
  const json = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!respuesta.ok) {
    if (json.error === 'invalid_grant') throw new LlaveCaducada(String(json.error));
    throw new Error(`token ${proveedor} ${respuesta.status} ${String(json.error ?? '')}`);
  }
  return json as { access_token: string; refresh_token?: string };
}

async function pedir(url: string, acceso: string, cabeceras: Record<string, string> = {}) {
  const respuesta = await fetch(url, { headers: { Authorization: `Bearer ${acceso}`, ...cabeceras } });
  if (respuesta.status === 401) throw new LlaveCaducada('401');
  if (!respuesta.ok) throw new Error(`${new URL(url).hostname} ${respuesta.status}`);
  return (await respuesta.json()) as Record<string, unknown>;
}

async function emailDe(proveedor: Proveedor, acceso: string): Promise<string | null> {
  const perfil =
    proveedor === 'gmail'
      ? await pedir('https://gmail.googleapis.com/gmail/v1/users/me/profile', acceso)
      : await pedir('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', acceso);
  return emailDeCuenta(proveedor, perfil);
}

async function resumenCorto(texto: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Los mensajes nuevos de la bandeja de entrada desde "desde", sin los ya vistos.
async function mensajesNuevos(cuenta: Cuenta, acceso: string, desde: Date): Promise<MensajeLeido[]> {
  const vistos = new Set(cuenta.vistos);
  const yo = cuenta.email.toLowerCase();
  let mensajes: MensajeLeido[] = [];
  if (cuenta.proveedor === 'gmail') {
    const q = `${BUSQUEDA_GMAIL} after:${Math.floor(desde.getTime() / 1000)}`;
    const lista = await pedir(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${MAX_POR_VUELTA}`,
      acceso,
    );
    const ids = ((lista.messages as { id: string }[] | undefined) ?? []).map((m) => m.id).filter((id) => !vistos.has(id));
    for (const id of ids) {
      const msg = await pedir(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, acceso);
      mensajes.push(mensajeDeGmail(msg as Parameters<typeof mensajeDeGmail>[0], cuenta.email));
    }
  } else {
    const campos = 'id,subject,from,receivedDateTime,body,webLink,inferenceClassification';
    const filtro = `receivedDateTime ge ${desde.toISOString()}`;
    const lista = await pedir(
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(filtro)}&$orderby=receivedDateTime desc&$top=${MAX_POR_VUELTA}&$select=${campos}`,
      acceso,
      { Prefer: 'outlook.body-content-type="text"' },
    );
    for (const msg of (lista.value as ({ id: string } & Parameters<typeof mensajeDeOutlook>[0])[] | undefined) ?? []) {
      const id = `o:${await resumenCorto(msg.id)}`;
      if (!vistos.has(id)) mensajes.push(mensajeDeOutlook(msg, id));
    }
  }
  mensajes = mensajes.filter((m) => m.principal && m.recibido >= desde && !m.de.toLowerCase().includes(yo));
  return mensajes.sort((a, b) => a.recibido.getTime() - b.recibido.getTime());
}

// --- Analizar y guardar ---

type Resumen = {
  id: string;
  recibido: string;
  de: string;
  direccion: string;
  asunto: string;
  titulo: string;
  resumen: string;
  fechaLimite: string | null;
  hora: string | null;
  tarea: string | null;
  importante: boolean;
  automatico: boolean;
  aviso?: string;
  via: 'reglas' | 'ia';
  enlace: string;
};

async function analizar(cuenta: Cuenta, m: MensajeLeido): Promise<Resumen> {
  const base = {
    id: m.id,
    recibido: m.recibido.toISOString(),
    de: nombreRemitente(m.de),
    direccion: direccionRemitente(m.de),
    asunto: m.asunto.slice(0, 200),
    enlace: m.enlace,
  };
  const siempre = siempreAvisar(m.de, cuenta.siempre_avisar ?? []);
  // Sin clave o pasado el máximo de correos del día, se usan las reglas.
  if (iaDisponible) {
    const uso = await sumarUso(cuenta.usuario, 'correo', LIMITE_IA_USUARIO, LIMITE_IA_GLOBAL).catch(() => null);
    if (uso?.permitido) {
      const correo = { asunto: m.asunto, recibido: m.recibido, de: m.de, cuerpo: m.cuerpo, automatico: m.automatico };
      const a = await analizarConClaude({ asunto: base.asunto, de: base.de, cuerpo: limpiarCuerpo(m.cuerpo).slice(0, 4000), hoy: diaDe(m.recibido) });
      if (a) {
        const r = resultadoDeIA(a, correo);
        return { ...base, ...r, importante: r.importante || siempre, via: 'ia' };
      }
    }
  }
  const r = analizarCorreo({ asunto: m.asunto, de: m.de, cuerpo: m.cuerpo, recibido: m.recibido, automatico: m.automatico });
  return {
    ...base,
    titulo: r.titulo,
    resumen: r.resumen,
    fechaLimite: r.fechaLimite,
    hora: r.hora,
    tarea: r.tarea,
    importante: siempre,
    automatico: r.automatico,
    via: 'reglas',
  };
}

// Avisos en la web instalada (Web Push, 28/10/2026): los importantes y muy importantes
// (con fecha, importantes o "Avisarme siempre de…") llegan también a los navegadores
// donde la persona activó los avisos en Perfil > Avisos. Mismas claves VAPID y misma
// tabla de suscripciones que la función avisos-web; se mandan al momento.
function clavesVapid(): ClavesVapid | null {
  try {
    const claves = JSON.parse(Deno.env.get('VAPID_CLAVES') ?? '') as ClavesVapid;
    return claves.publica && claves.privada ? claves : null;
  } catch {
    return null;
  }
}

async function mandarAvisosWeb(cuenta: Cuenta, avisos: { titulo: string; cuerpo: string }[]) {
  const claves = clavesVapid();
  if (!claves || !avisos.length) return;
  const admin = clienteAdmin();
  const { data } = await admin
    .from('avisos_web_suscripciones')
    .select('endpoint, p256dh, auth')
    .eq('usuario', cuenta.usuario);
  const momento = Date.now();
  for (const fila of (data ?? []) as { endpoint: string; p256dh: string; auth: string }[]) {
    const suscripcion = { endpoint: fila.endpoint, keys: { p256dh: fila.p256dh, auth: fila.auth } };
    for (const [i, a] of avisos.slice(0, 10).entries()) {
      const contenido = { id: `correo-${momento}-${i}`, titulo: a.titulo, cuerpo: a.cuerpo, url: '/resumenes' };
      try {
        const { resultado, estado } = await enviarPush(suscripcion, JSON.stringify(contenido), claves, {
          contacto: 'https://mangel-creator.github.io/rusko/',
          ttlSeg: 6 * 3600,
        });
        if (resultado === 'caducada') {
          await admin.from('avisos_web_suscripciones').delete().eq('endpoint', fila.endpoint);
          break;
        }
        if (resultado === 'error') console.error(`push web ${estado} a ${new URL(fila.endpoint).hostname}`);
      } catch (error) {
        console.error('push web', error);
      }
    }
  }
}

async function mandarAvisos(cuenta: Cuenta, avisos: { titulo: string; cuerpo: string }[]) {
  await mandarAvisosWeb(cuenta, avisos);
  if (!cuenta.tokens_push.length || !avisos.length) return;
  const dia = new Date().toISOString().slice(0, 10);
  const mensajes = cuenta.tokens_push.flatMap((to) =>
    avisos.map((a) => ({
      to,
      title: a.titulo,
      body: a.cuerpo,
      sound: 'default',
      channelId: 'avisos',
      data: { tipo: 'correo', dia, destino: { pantalla: 'resumenes' } },
    })),
  );
  try {
    const respuesta = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensajes.slice(0, 100)),
    });
    const resultado = (await respuesta.json().catch(() => null)) as { data?: { details?: { error?: string } }[] } | null;
    const malos = new Set<string>();
    (resultado?.data ?? []).forEach((r, i) => {
      if (r?.details?.error === 'DeviceNotRegistered' && mensajes[i]) malos.add(mensajes[i].to);
    });
    if (malos.size) {
      await clienteAdmin()
        .from('correo_cuentas')
        .update({ tokens_push: cuenta.tokens_push.filter((t) => !malos.has(t)) })
        .eq('id', cuenta.id);
    }
  } catch (error) {
    console.error('push', error);
  }
}

// Mira una cuenta: correos nuevos, sus resúmenes y, si toca, los avisos.
async function revisarCuenta(cuenta: Cuenta, acceso: string, desde: Date, avisar: boolean): Promise<number> {
  const inicio = new Date();
  const nuevos = await mensajesNuevos(cuenta, acceso, desde);
  const resumenes: Resumen[] = [];
  // Los de direcciones vetadas se dan por vistos, sin guardarlos ni avisar.
  for (const m of nuevos) if (!vetado(m.de, cuenta.vetados ?? [])) resumenes.push(await analizar(cuenta, m));
  const db = clienteAdmin();
  if (resumenes.length) {
    await db.from('correo_resumenes').upsert(
      resumenes.map((r) => ({
        cuenta: cuenta.id,
        id: r.id,
        recibido: r.recibido,
        de: r.de,
        de_email: r.direccion,
        asunto: r.asunto,
        titulo: r.titulo,
        resumen: r.resumen,
        fecha_limite: r.fechaLimite,
        hora: r.hora,
        tarea: r.tarea,
        importante: r.importante,
        automatico: r.automatico,
        via: r.via,
        enlace: r.enlace,
      })),
      { onConflict: 'cuenta,id', ignoreDuplicates: true },
    );
  }
  await db
    .from('correo_cuentas')
    .update({ vistos: [...cuenta.vistos, ...nuevos.map((m) => m.id)].slice(-150), ultima_revision: inicio.toISOString() })
    .eq('id', cuenta.id);
  if (avisar && resumenes.length) await mandarAvisos(cuenta, avisosDeCorreos(resumenes, new Date()));
  return resumenes.length;
}

// Llave de acceso de un rato a partir de la guardada. Microsoft da otra llave nueva
// cada vez: se guarda.
async function acceder(cuenta: Cuenta): Promise<string> {
  const tokens = await pedirTokens(cuenta.proveedor, {
    grant_type: 'refresh_token',
    refresh_token: await descifrar(cuenta.llave, CLAVE_CIFRADO),
  });
  if (tokens.refresh_token) {
    await clienteAdmin().from('correo_cuentas').update({ llave: await cifrar(tokens.refresh_token, CLAVE_CIFRADO) }).eq('id', cuenta.id);
  }
  return tokens.access_token;
}

async function revisarTodas(): Promise<{ revisadas: number; nuevos: number; caducadas: number }> {
  const { data } = await clienteAdmin().from('correo_cuentas').select('*').eq('estado', 'ok');
  const cuentas = (data ?? []) as Cuenta[];
  let nuevos = 0;
  let caducadas = 0;
  const limite = Date.now() + 50_000;
  for (const cuenta of cuentas) {
    if (Date.now() > limite) break; // el resto, en la próxima vuelta
    if (!configurado(cuenta.proveedor)) continue;
    try {
      const acceso = await acceder(cuenta);
      // Una cuenta que aún no ha recogido nada (por ejemplo, porque la búsqueda no
      // encontraba sus correos) recoge el último día sin avisar, como al vincularla.
      if (!cuenta.vistos?.length) {
        nuevos += await revisarCuenta(cuenta, acceso, new Date(Date.now() - 24 * 3600_000), false);
        continue;
      }
      const ultima = cuenta.ultima_revision ? new Date(cuenta.ultima_revision).getTime() : Date.now() - 3600_000;
      // Margen hacia atrás: a veces un correo tarda en aparecer en la búsqueda.
      nuevos += await revisarCuenta(cuenta, acceso, new Date(ultima - 20 * 60_000), true);
    } catch (error) {
      if (error instanceof LlaveCaducada) {
        caducadas++;
        await clienteAdmin().from('correo_cuentas').update({ estado: 'caducada' }).eq('id', cuenta.id);
        const nombre = cuenta.proveedor === 'gmail' ? 'Gmail' : 'Outlook';
        await mandarAvisos(cuenta, [
          { titulo: `Vuelve a entrar en ${nombre}`, cuerpo: `${cuenta.email} se ha desvinculado. Toca aquí y pulsa «Volver a entrar».` },
        ]);
      } else {
        console.error(`revisar ${cuenta.proveedor}`, error instanceof Error ? error.message : error);
      }
    }
  }
  return { revisadas: cuentas.length, nuevos, caducadas };
}

// --- Vuelta del inicio de sesión (GET) ---

function pagina(texto: string, estado = 400): Response {
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Organizy</title><body style="font-family:system-ui,sans-serif;background:#F4F1EA;color:#1A1C24;padding:32px 16px;text-align:center"><p>${texto}</p></body></html>`;
  return new Response(html, { status: estado, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function vuelta(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const estado = url.searchParams.get('state');
  if (!estado) return pagina('Esta dirección es para volver a Organizy después de iniciar sesión.');
  const db = clienteAdmin();
  const { data: fila } = await db.from('correo_estados').select('*').eq('estado', estado).maybeSingle();
  await db.from('correo_estados').delete().eq('estado', estado);
  if (!fila || new Date(fila.caduca).getTime() < Date.now() || !vueltaValida(fila.vuelta)) {
    return pagina('Este inicio de sesión ha caducado. Vuelve a Organizy y pulsa otra vez «Vincular».');
  }
  const proveedor = fila.proveedor as Proveedor;
  const ir = (datos: Record<string, string>) =>
    new Response(null, { status: 302, headers: { Location: conResultado(fila.vuelta, datos) } });
  const codigo = url.searchParams.get('code');
  if (url.searchParams.get('error') || !codigo) return ir({ correo: 'cancelado' });
  try {
    const tokens = await pedirTokens(proveedor, { grant_type: 'authorization_code', code: codigo, redirect_uri: REDIRECCION });
    if (!tokens.refresh_token) return ir({ correo: 'error', motivo: 'sin-llave' });
    const email = await emailDe(proveedor, tokens.access_token);
    if (!email) return ir({ correo: 'error', motivo: 'sin-email' });
    const llave = await cifrar(tokens.refresh_token, CLAVE_CIFRADO);
    const { data: existente } = await db
      .from('correo_cuentas')
      .select('*')
      .eq('usuario', fila.usuario)
      .eq('proveedor', proveedor)
      .eq('email', email)
      .maybeSingle();
    const tokensPush = [...new Set([...((existente?.tokens_push as string[]) ?? []), ...(fila.token_push ? [fila.token_push] : [])])].slice(
      -MAX_TOKENS_PUSH,
    );
    let cuenta: Cuenta;
    if (existente) {
      const { data } = await db
        .from('correo_cuentas')
        .update({ llave, estado: 'ok', tokens_push: tokensPush })
        .eq('id', existente.id)
        .select('*')
        .single();
      cuenta = data as Cuenta;
    } else {
      const { data, error } = await db
        .from('correo_cuentas')
        .insert({ usuario: fila.usuario, proveedor, email, llave, tokens_push: tokensPush })
        .select('*')
        .single();
      if (error) return ir({ correo: 'error', motivo: 'demasiadas' });
      cuenta = data as Cuenta;
    }
    // Lo del último día, sin avisar, para que Resúmenes no empiece vacío.
    await revisarCuenta(cuenta, tokens.access_token, new Date(Date.now() - 24 * 3600_000), false).catch((e) =>
      console.error('primera revisión', e instanceof Error ? e.message : e),
    );
    return ir({ correo: 'ok', cuenta: email });
  } catch (error) {
    console.error(`vuelta ${proveedor}`, error instanceof Error ? error.message : error);
    return ir({ correo: 'error' });
  }
}

// --- Peticiones de la app (POST) ---

const tokenPushValido = (t: unknown): t is string => typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t) && t.length < 200;

async function estadoDelUsuario(usuario: string, tokenPush: unknown, siempre: unknown, vetadosApp: unknown) {
  const db = clienteAdmin();
  const { data } = await db
    .from('correo_cuentas')
    .select('id, proveedor, email, estado, ultima_revision, tokens_push')
    .eq('usuario', usuario)
    .order('creada');
  const cuentas = (data ?? []) as Pick<Cuenta, 'id' | 'proveedor' | 'email' | 'estado' | 'ultima_revision' | 'tokens_push'>[];
  // "Avisarme siempre de…": la lista es de la persona, la misma en todas sus cuentas.
  const lista = leerSiempre(siempre);
  if (lista && cuentas.length) await db.from('correo_cuentas').update({ siempre_avisar: lista }).eq('usuario', usuario);
  // Las direcciones vetadas, igual. Lo ya guardado de ellas no se devuelve.
  const vetados = leerVetados(vetadosApp);
  if (vetados && cuentas.length) await db.from('correo_cuentas').update({ vetados }).eq('usuario', usuario);
  const fuera = new Set(vetados ?? []);
  if (tokenPushValido(tokenPush)) {
    for (const c of cuentas) {
      if (c.tokens_push.includes(tokenPush)) continue;
      await db
        .from('correo_cuentas')
        .update({ tokens_push: [...c.tokens_push, tokenPush].slice(-MAX_TOKENS_PUSH) })
        .eq('id', c.id);
    }
  }
  const cuentaDe = new Map(cuentas.map((c) => [c.id, c]));
  const { data: filas } = cuentas.length
    ? await db
        .from('correo_resumenes')
        .select('*')
        .in(
          'cuenta',
          cuentas.map((c) => c.id),
        )
        .order('recibido', { ascending: false })
        .limit(300)
    : { data: [] };
  return {
    proveedores: Object.fromEntries(PROVEEDORES.map((p) => [p, configurado(p)])),
    cuentas: cuentas.map((c) => ({
      id: c.id,
      proveedor: c.proveedor,
      email: c.email,
      estado: c.estado,
      ultimaRevision: c.ultima_revision,
    })),
    correos: (filas ?? [])
      .filter((f) => !fuera.has(String(f.de_email ?? '')))
      .map((f) => ({
        id: f.id,
        recibido: new Date(f.recibido).toISOString(),
        de: f.de,
        direccion: f.de_email ?? '',
        asunto: f.asunto,
        titulo: f.titulo,
        resumen: f.resumen,
        fechaLimite: f.fecha_limite,
        hora: f.hora ?? null,
        tarea: f.tarea,
        importante: f.importante === true,
        automatico: f.automatico === true,
        via: f.via,
        enlace: f.enlace,
        origen: cuentaDe.get(f.cuenta)?.proveedor,
        cuenta: cuentaDe.get(f.cuenta)?.email,
      })),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respuestaPrevia(req);
  if (req.method === 'GET') return vuelta(req);
  if (req.method !== 'POST') return respuestaJson(req, { error: 'metodo' }, 405);

  const datos = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

  if (datos.accion === 'revisar') {
    if (!SECRETO_CRON || req.headers.get('x-organizy-cron') !== SECRETO_CRON) {
      return respuestaJson(req, { error: 'sin-permiso' }, 401);
    }
    return respuestaJson(req, await revisarTodas());
  }

  const usuario = await usuarioDeLaPeticion(req);
  if (!usuario) return respuestaJson(req, { error: 'sin-sesion' }, 401);

  try {
    if (datos.accion === 'estado') return respuestaJson(req, await estadoDelUsuario(usuario, datos.tokenPush, datos.siempre, datos.vetados));

    if (datos.accion === 'empezar') {
      const proveedor = datos.proveedor as Proveedor;
      if (!PROVEEDORES.includes(proveedor)) return respuestaJson(req, { error: 'peticion' }, 400);
      if (!configurado(proveedor)) return respuestaJson(req, { error: 'sin-configurar' }, 503);
      if (!vueltaValida(datos.vuelta)) return respuestaJson(req, { error: 'vuelta' }, 400);
      const uso = await sumarUso(usuario, 'correo-vincular', 20, 1000);
      if (!uso.permitido) return respuestaJson(req, { error: uso.motivo }, 429);
      const estado = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const { error } = await clienteAdmin()
        .from('correo_estados')
        .insert({
          estado,
          usuario,
          proveedor,
          vuelta: datos.vuelta,
          token_push: tokenPushValido(datos.tokenPush) ? datos.tokenPush : null,
          caduca: new Date(Date.now() + 15 * 60_000).toISOString(),
        });
      if (error) throw new Error(error.message);
      return respuestaJson(req, { url: urlAutorizacion(proveedor, CLIENTES[proveedor].id, REDIRECCION, estado) });
    }

    if (datos.accion === 'quitar' && typeof datos.id === 'string') {
      const db = clienteAdmin();
      const { data: cuenta } = await db.from('correo_cuentas').select('*').eq('id', datos.id).eq('usuario', usuario).maybeSingle();
      if (!cuenta) return respuestaJson(req, { ok: true });
      // Google deja retirar el permiso desde aquí; en Microsoft se hace en su cuenta.
      if (cuenta.proveedor === 'gmail' && CLAVE_CIFRADO) {
        const llave = await descifrar(cuenta.llave, CLAVE_CIFRADO).catch(() => null);
        if (llave) {
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: llave }),
          }).catch(() => {});
        }
      }
      await db.from('correo_cuentas').delete().eq('id', cuenta.id);
      return respuestaJson(req, { ok: true });
    }

    return respuestaJson(req, { error: 'peticion' }, 400);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return respuestaJson(req, { error: 'servidor' }, 500);
  }
});
