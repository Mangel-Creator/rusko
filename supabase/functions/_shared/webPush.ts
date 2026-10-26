// Web Push sin librerías (avisos con sonido en la web instalada, 26/10/2026).
//
// Para mandar un aviso a un navegador hay que hacer dos cosas, las dos con el cifrado
// estándar del navegador (WebCrypto), que también tienen Deno y Node:
//   1. Cifrar el contenido para ese navegador (RFC 8291, "aes128gcm"): solo él puede
//      leerlo; el servicio de Apple o Google que lo entrega no ve el texto.
//   2. Firmar una cabecera VAPID (RFC 8292) con la clave privada de Organizy: así el
//      servicio sabe que el aviso viene de quien creó la suscripción.
//
// No importa nada de Deno: tiene pruebas con Jest (__tests__/webPush.test.ts), entre
// ellas el ejemplo oficial del RFC 8291.

export type SuscripcionPush = {
  endpoint: string;
  keys: { p256dh: string; auth: string }; // base64url, como las da el navegador
};

// Claves VAPID en formato JWK (lo que se guarda en el secreto VAPID_CLAVES).
export type ClavesVapid = { publica: JsonWebKey; privada: JsonWebKey };

const texto = new TextEncoder();

export function base64url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function desdeBase64url(valor: string): Uint8Array {
  const normal = valor.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function juntar(...partes: Uint8Array[]): Uint8Array {
  const total = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    total.set(p, i);
    i += p.length;
  }
  return total;
}

async function hmac(clave: Uint8Array, datos: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos));
}

// Clave pública "en bruto" (65 bytes: 0x04, x e y) <-> JWK.
export function jwkDesdePublica(publica: Uint8Array, privadaD?: Uint8Array): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: base64url(publica.slice(1, 33)),
    y: base64url(publica.slice(33, 65)),
    ...(privadaD ? { d: base64url(privadaD) } : {}),
    ext: true,
  };
}

export function publicaDesdeJwk(jwk: JsonWebKey): Uint8Array {
  return juntar(new Uint8Array([4]), desdeBase64url(jwk.x ?? ''), desdeBase64url(jwk.y ?? ''));
}

// La clave pública de Organizy tal como la pide el navegador al suscribirse
// (applicationServerKey) y la cabecera VAPID.
export function clavePublicaVapid(claves: ClavesVapid): string {
  return base64url(publicaDesdeJwk(claves.publica));
}

type ParDeClaves = { publica: Uint8Array; privada: CryptoKey };

async function nuevoPar(): Promise<ParDeClaves> {
  const par = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  return { publica: new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)), privada: par.privateKey };
}

// Para las pruebas: el par de claves y la sal del ejemplo del RFC en vez de al azar.
export type Fijos = { par?: { publica: Uint8Array; privadaD: Uint8Array }; sal?: Uint8Array };

// Cifra el texto para una suscripción (RFC 8291). Devuelve el cuerpo de la petición.
export async function cifrar(suscripcion: SuscripcionPush, mensaje: string, fijos: Fijos = {}): Promise<Uint8Array> {
  const uaPublica = desdeBase64url(suscripcion.keys.p256dh);
  const secretoAuth = desdeBase64url(suscripcion.keys.auth);
  const par: ParDeClaves = fijos.par
    ? {
        publica: fijos.par.publica,
        privada: await crypto.subtle.importKey(
          'jwk',
          jwkDesdePublica(fijos.par.publica, fijos.par.privadaD),
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          ['deriveBits'],
        ),
      }
    : await nuevoPar();
  const sal = fijos.sal ?? crypto.getRandomValues(new Uint8Array(16));

  const claveUa = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secretoEcdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: claveUa }, par.privada, 256),
  );

  // HKDF con SHA-256 (una sola vuelta basta: todo lo que sale mide 32 bytes o menos).
  const prkClave = await hmac(secretoAuth, secretoEcdh);
  const infoClave = juntar(texto.encode('WebPush: info\0'), uaPublica, par.publica, new Uint8Array([1]));
  const ikm = await hmac(prkClave, infoClave);
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, texto.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, texto.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);

  // Un solo registro: el texto y el byte 2 (último registro), sin relleno.
  const claro = juntar(texto.encode(mensaje), new Uint8Array([2]));
  const claveAes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, claveAes, claro));

  // Cabecera: sal, tamaño de registro (4096), largo de la clave y la clave pública.
  const cabecera = new Uint8Array(16 + 4 + 1);
  cabecera.set(sal, 0);
  new DataView(cabecera.buffer).setUint32(16, 4096);
  cabecera[20] = par.publica.length;
  return juntar(cabecera, par.publica, cifrado);
}

// Cabecera Authorization con VAPID: un JWT firmado con ES256 que caduca en 12 h.
export async function cabeceraVapid(endpoint: string, claves: ClavesVapid, contacto: string): Promise<string> {
  const json = (valor: unknown) => base64url(texto.encode(JSON.stringify(valor)));
  const sinFirmar = `${json({ typ: 'JWT', alg: 'ES256' })}.${json({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: contacto,
  })}`;
  const { kty, crv, x, y, d } = claves.privada;
  const privada = await crypto.subtle.importKey(
    'jwk',
    { kty, crv, x, y, d },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const firma = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privada, texto.encode(sinFirmar)),
  );
  return `vapid t=${sinFirmar}.${base64url(firma)}, k=${clavePublicaVapid(claves)}`;
}

export type ResultadoEnvio = 'ok' | 'caducada' | 'error';

// Manda un aviso. "caducada" (404 o 410): el navegador ya no la quiere; hay que borrarla.
export async function enviarPush(
  suscripcion: SuscripcionPush,
  mensaje: string,
  claves: ClavesVapid,
  opciones: { contacto: string; ttlSeg: number; tema?: string },
): Promise<{ resultado: ResultadoEnvio; estado: number }> {
  const cuerpo = await cifrar(suscripcion, mensaje);
  const cabeceras: Record<string, string> = {
    Authorization: await cabeceraVapid(suscripcion.endpoint, claves, opciones.contacto),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opciones.ttlSeg),
    Urgency: 'high',
  };
  // "Topic": si llega otro con el mismo tema antes de entregarse, sustituye al anterior.
  if (opciones.tema) cabeceras.Topic = opciones.tema;
  const respuesta = await fetch(suscripcion.endpoint, { method: 'POST', headers: cabeceras, body: cuerpo });
  await respuesta.body?.cancel();
  if (respuesta.ok) return { resultado: 'ok', estado: respuesta.status };
  if (respuesta.status === 404 || respuesta.status === 410) return { resultado: 'caducada', estado: respuesta.status };
  return { resultado: 'error', estado: respuesta.status };
}

// Solo los servicios de avisos de los navegadores (Apple, Google, Mozilla, Microsoft):
// así nadie puede usar la función para mandar peticiones a otro sitio.
export function endpointValido(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    return /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/.test(
      url.hostname,
    );
  } catch {
    return false;
  }
}
