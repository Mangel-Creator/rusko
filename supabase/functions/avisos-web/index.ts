// Organizy · Avisos con sonido en la web instalada (Web Push, 26/10/2026).
//
// En el iPhone, con la web añadida a la pantalla de inicio (iOS 16.4 o más), el
// navegador puede recibir avisos aunque la web esté cerrada, pero alguien tiene que
// mandarlos a su hora: esta función. Acciones:
//
//   Con la sesión (anónima) de la app:
//   - "clave": la clave pública VAPID, para suscribirse.
//   - "suscribir" { suscripcion }: guarda a qué navegador mandar los avisos.
//   - "quitar" { endpoint }: deja de mandárselos.
//   - "programar" { avisos }: sustituye los avisos pendientes de esta persona por estos
//     (los de los próximos 7 días; la app los recalcula al abrirla y al cambiar algo).
//   - "prueba" { aviso? }: manda uno ahora mismo.
//   Desde pg_cron (cabecera x-organizy-cron), cada minuto si hay algo que mandar:
//   - "enviar": manda los que ya toquen y los marca como enviados.
//
// Secretos: VAPID_CLAVES (JSON con las claves en JWK; lo crea scripts/crear-claves-vapid.mjs
// sin enseñarlas) y CORREO_CRON_SECRETO (la contraseña del cron, compartida con el correo).

import { respuestaJson, respuestaPrevia } from '../_shared/cors.ts';
import { numeroDeEntorno, sumarUso } from '../_shared/limite.ts';
import { clienteAdmin, usuarioDeLaPeticion } from '../_shared/usuario.ts';
import {
  clavePublicaVapid,
  endpointValido,
  enviarPush,
  type ClavesVapid,
  type SuscripcionPush,
} from '../_shared/webPush.ts';

const CONTACTO = 'https://mangel-creator.github.io/rusko/';
const MAX_AVISOS = 120;
const MAX_SUSCRIPCIONES = 5;
// Un aviso que llega más de 30 min tarde ya no sirve ("Sal ya", "En 10 min…"): no se manda.
const RETRASO_MAXIMO_MS = 30 * 60 * 1000;

type Aviso = { id: string; cuando: string; titulo: string; cuerpo: string; url: string };

function clavesVapid(): ClavesVapid | null {
  try {
    const claves = JSON.parse(Deno.env.get('VAPID_CLAVES') ?? '') as ClavesVapid;
    return claves.publica && claves.privada ? claves : null;
  } catch {
    return null;
  }
}

function textoCorto(valor: unknown, maximo: number): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor.slice(0, maximo) : null;
}

// Comprueba un aviso que manda la app. null si no vale.
function avisoValido(valor: unknown, ahora: number): Aviso | null {
  if (!valor || typeof valor !== 'object') return null;
  const a = valor as Record<string, unknown>;
  const id = textoCorto(a.id, 200);
  const titulo = textoCorto(a.titulo, 200);
  const cuerpo = typeof a.cuerpo === 'string' ? a.cuerpo.slice(0, 500) : '';
  const url = textoCorto(a.url, 300);
  const cuando = typeof a.cuando === 'string' ? Date.parse(a.cuando) : NaN;
  if (!id || !titulo || !url || !url.startsWith('/') || url.startsWith('//')) return null;
  if (!Number.isFinite(cuando) || cuando < ahora - 3600_000 || cuando > ahora + 9 * 86400_000) return null;
  return { id, titulo, cuerpo, url, cuando: new Date(cuando).toISOString() };
}

function suscripcionValida(valor: unknown): SuscripcionPush | null {
  if (!valor || typeof valor !== 'object') return null;
  const s = valor as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof s.endpoint !== 'string' || s.endpoint.length > 1000 || !endpointValido(s.endpoint)) return null;
  const p256dh = textoCorto(s.keys?.p256dh, 200);
  const auth = textoCorto(s.keys?.auth, 100);
  if (!p256dh || !auth) return null;
  return { endpoint: s.endpoint, keys: { p256dh, auth } };
}

type Fila = { endpoint: string; p256dh: string; auth: string };

// Manda un aviso a todos los navegadores de una persona. Borra los que ya no existen.
async function mandarA(usuario: string, contenido: Record<string, unknown>, claves: ClavesVapid, tema?: string) {
  const admin = clienteAdmin();
  const { data, error } = await admin
    .from('avisos_web_suscripciones')
    .select('endpoint, p256dh, auth')
    .eq('usuario', usuario);
  if (error) throw new Error(error.message);
  let enviados = 0;
  for (const fila of (data ?? []) as Fila[]) {
    const suscripcion = { endpoint: fila.endpoint, keys: { p256dh: fila.p256dh, auth: fila.auth } };
    try {
      const { resultado, estado } = await enviarPush(suscripcion, JSON.stringify(contenido), claves, {
        contacto: CONTACTO,
        ttlSeg: RETRASO_MAXIMO_MS / 1000,
        tema,
      });
      if (resultado === 'ok') {
        enviados++;
        await admin
          .from('avisos_web_suscripciones')
          .update({ ultimo_envio: new Date().toISOString() })
          .eq('endpoint', fila.endpoint);
      } else if (resultado === 'caducada') {
        await admin.from('avisos_web_suscripciones').delete().eq('endpoint', fila.endpoint);
      } else {
        console.error(`push ${estado} a ${new URL(fila.endpoint).hostname}`);
      }
    } catch (e) {
      console.error('push', e);
    }
  }
  return enviados;
}

// "Topic" solo admite letras, números, "-" y "_" (32 como mucho).
function tema(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_').slice(-32);
}

async function enviarPendientes(claves: ClavesVapid) {
  const admin = clienteAdmin();
  const ahora = Date.now();
  // Se marcan como enviados antes de mandarlos: si el cron se solapa, no salen dos veces.
  const { data, error } = await admin
    .from('avisos_web')
    .update({ enviado: new Date(ahora).toISOString() })
    .is('enviado', null)
    .lte('cuando', new Date(ahora).toISOString())
    .select('usuario, id, cuando, titulo, cuerpo, url');
  if (error) throw new Error(error.message);
  let enviados = 0;
  for (const a of (data ?? []) as (Aviso & { usuario: string })[]) {
    if (ahora - Date.parse(a.cuando) > RETRASO_MAXIMO_MS) continue;
    enviados += await mandarA(a.usuario, { id: a.id, titulo: a.titulo, cuerpo: a.cuerpo, url: a.url }, claves, tema(a.id));
  }
  return { avisos: data?.length ?? 0, enviados };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respuestaPrevia(req);
  if (req.method !== 'POST') return respuestaJson(req, { error: 'metodo' }, 405);

  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const accion = cuerpo?.accion;
  const claves = clavesVapid();
  if (!claves) return respuestaJson(req, { error: 'sin-claves' }, 503);

  try {
    if (accion === 'enviar') {
      const secreto = Deno.env.get('CORREO_CRON_SECRETO');
      if (!secreto || req.headers.get('x-organizy-cron') !== secreto) return respuestaJson(req, { error: 'no' }, 401);
      return respuestaJson(req, await enviarPendientes(claves));
    }

    const usuario = await usuarioDeLaPeticion(req);
    if (!usuario) return respuestaJson(req, { error: 'sin-sesion' }, 401);
    const admin = clienteAdmin();

    if (accion === 'clave') return respuestaJson(req, { clave: clavePublicaVapid(claves) });

    if (accion === 'suscribir') {
      const s = suscripcionValida(cuerpo?.suscripcion);
      if (!s) return respuestaJson(req, { error: 'suscripcion' }, 400);
      const { count } = await admin
        .from('avisos_web_suscripciones')
        .select('endpoint', { count: 'exact', head: true })
        .eq('usuario', usuario)
        .neq('endpoint', s.endpoint);
      if ((count ?? 0) >= MAX_SUSCRIPCIONES) return respuestaJson(req, { error: 'demasiadas' }, 400);
      const { error } = await admin
        .from('avisos_web_suscripciones')
        .upsert({ endpoint: s.endpoint, usuario, p256dh: s.keys.p256dh, auth: s.keys.auth });
      if (error) throw new Error(error.message);
      return respuestaJson(req, { ok: true });
    }

    if (accion === 'quitar') {
      if (typeof cuerpo?.endpoint !== 'string') return respuestaJson(req, { error: 'peticion' }, 400);
      await admin.from('avisos_web_suscripciones').delete().eq('usuario', usuario).eq('endpoint', cuerpo.endpoint);
      // Sin ningún navegador, los avisos guardados ya no sirven.
      const { count } = await admin
        .from('avisos_web_suscripciones')
        .select('endpoint', { count: 'exact', head: true })
        .eq('usuario', usuario);
      if (!count) await admin.from('avisos_web').delete().eq('usuario', usuario);
      return respuestaJson(req, { ok: true });
    }

    if (accion === 'programar') {
      if (!Array.isArray(cuerpo?.avisos)) return respuestaJson(req, { error: 'peticion' }, 400);
      const ahora = Date.now();
      const avisos = cuerpo.avisos
        .slice(0, MAX_AVISOS)
        .map((a) => avisoValido(a, ahora))
        .filter((a): a is Aviso => a !== null);
      // Los pendientes se sustituyen; los ya enviados se quedan para no repetirlos.
      const borrar = await admin.from('avisos_web').delete().eq('usuario', usuario).is('enviado', null);
      if (borrar.error) throw new Error(borrar.error.message);
      if (avisos.length > 0) {
        const { error } = await admin
          .from('avisos_web')
          .upsert(
            avisos.map((a) => ({ ...a, usuario })),
            { onConflict: 'usuario,id', ignoreDuplicates: true },
          );
        if (error) throw new Error(error.message);
      }
      return respuestaJson(req, { programados: avisos.length });
    }

    if (accion === 'prueba') {
      const uso = await sumarUso(
        usuario,
        'avisos-prueba',
        numeroDeEntorno('AVISOS_PRUEBA_LIMITE_USUARIO', 40),
        numeroDeEntorno('AVISOS_PRUEBA_LIMITE_GLOBAL', 500),
      );
      if (!uso.permitido) return respuestaJson(req, { error: 'limite' }, 429);
      const a = (cuerpo?.aviso ?? {}) as Record<string, unknown>;
      const url = typeof a.url === 'string' && a.url.startsWith('/') && !a.url.startsWith('//') ? a.url : '/';
      const contenido = {
        id: `prueba:${Date.now()}`,
        titulo: textoCorto(a.titulo, 200) ?? 'Aviso de prueba',
        cuerpo: typeof a.cuerpo === 'string' ? a.cuerpo.slice(0, 500) : 'Si ves esto, los avisos de Organizy funcionan.',
        url,
      };
      return respuestaJson(req, { enviados: await mandarA(usuario, contenido, claves) });
    }

    return respuestaJson(req, { error: 'peticion' }, 400);
  } catch (error) {
    console.error(error);
    return respuestaJson(req, { error: 'servidor' }, 500);
  }
});
