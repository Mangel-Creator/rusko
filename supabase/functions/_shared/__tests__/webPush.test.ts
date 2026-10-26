/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { webcrypto } from 'node:crypto';

import {
  base64url,
  cabeceraVapid,
  cifrar,
  clavePublicaVapid,
  desdeBase64url,
  endpointValido,
  jwkDesdePublica,
  publicaDesdeJwk,
  type ClavesVapid,
} from '../webPush';

// En Node 24 ya existe, pero así no depende del entorno de pruebas.
if (!globalThis.crypto?.subtle) Object.assign(globalThis, { crypto: webcrypto });

const texto = new TextDecoder();

// Ejemplo oficial del RFC 8291 (apéndice A).
const RFC = {
  mensaje: 'When I grow up, I want to be a watermelon',
  asPublica: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublica: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivada: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  sal: 'DGv6ra1nlYgDCS1FRnbzlw',
  cuerpo:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

async function hmac(clave: Uint8Array, datos: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, datos));
}

// Lo que hace el navegador al recibirlo: descifrar con su clave privada.
async function descifrar(cuerpo: Uint8Array, uaPublica: Uint8Array, uaPrivada: CryptoKey, auth: Uint8Array) {
  const enc = new TextEncoder();
  const sal = cuerpo.slice(0, 16);
  const largo = cuerpo[20];
  const asPublica = cuerpo.slice(21, 21 + largo);
  const cifrado = cuerpo.slice(21 + largo);
  const claveAs = await crypto.subtle.importKey('raw', asPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: claveAs }, uaPrivada, 256));
  const prkClave = await hmac(auth, ecdh);
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublica, ...asPublica, 1]);
  const ikm = await hmac(prkClave, info);
  const prk = await hmac(sal, ikm);
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const clave = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, clave, cifrado));
  expect(claro[claro.length - 1]).toBe(2);
  return texto.decode(claro.slice(0, -1));
}

describe('cifrar (RFC 8291)', () => {
  it('da exactamente el cuerpo del ejemplo oficial', async () => {
    const cuerpo = await cifrar({ endpoint: 'https://x', keys: { p256dh: RFC.uaPublica, auth: RFC.auth } }, RFC.mensaje, {
      par: { publica: desdeBase64url(RFC.asPublica), privadaD: desdeBase64url(RFC.asPrivada) },
      sal: desdeBase64url(RFC.sal),
    });
    expect(base64url(cuerpo)).toBe(RFC.cuerpo);
  });

  it('el navegador lo descifra con claves al azar', async () => {
    const par = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair;
    const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const mensaje = JSON.stringify({ titulo: 'En 30 min: Dentista', cuerpo: 'A las 10:00 · Ñ y tildes' });
    const cuerpo = await cifrar(
      { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: base64url(publica), auth: base64url(auth) } },
      mensaje,
    );
    expect(await descifrar(cuerpo, publica, par.privateKey, auth)).toBe(mensaje);
  });
});

describe('VAPID', () => {
  it('firma un JWT que se comprueba con la clave pública', async () => {
    const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const claves: ClavesVapid = {
      publica: await crypto.subtle.exportKey('jwk', par.publicKey),
      privada: await crypto.subtle.exportKey('jwk', par.privateKey),
    };
    const cabecera = await cabeceraVapid('https://web.push.apple.com/abc', claves, 'mailto:organizy@example.com');
    const [, jwt, k] = cabecera.match(/^vapid t=([^,]+), k=(.+)$/) ?? [];
    expect(k).toBe(clavePublicaVapid(claves));
    const [cab, datos, firma] = jwt.split('.');
    expect(JSON.parse(texto.decode(desdeBase64url(datos)))).toMatchObject({
      aud: 'https://web.push.apple.com',
      sub: 'mailto:organizy@example.com',
    });
    const valida = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      par.publicKey,
      desdeBase64url(firma),
      new TextEncoder().encode(`${cab}.${datos}`),
    );
    expect(valida).toBe(true);
  });

  it('pasa la clave pública de bruto a JWK y vuelta', () => {
    const publica = desdeBase64url(RFC.uaPublica);
    expect(base64url(publicaDesdeJwk(jwkDesdePublica(publica)))).toBe(RFC.uaPublica);
  });
});

describe('endpointValido', () => {
  it('solo acepta los servicios de avisos de los navegadores', () => {
    expect(endpointValido('https://web.push.apple.com/QK1x')).toBe(true);
    expect(endpointValido('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(endpointValido('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(endpointValido('http://web.push.apple.com/x')).toBe(false);
    expect(endpointValido('https://malo.com/web.push.apple.com')).toBe(false);
    expect(endpointValido('https://push.apple.com.malo.com/x')).toBe(false);
    expect(endpointValido('no es una url')).toBe(false);
  });
});
