// Crea las claves VAPID de los avisos web (26/10/2026) y las guarda como secreto
// VAPID_CLAVES de Supabase, sin enseñarlas ni dejarlas en ningún archivo.
//
//   node scripts/crear-claves-vapid.mjs [--cambiar]
//
// Necesita la sesión de la CLI de Supabase (npx supabase login). Si el secreto ya
// existe no hace nada: cambiarlo (--cambiar) obliga a volver a activar los avisos en
// cada móvil, porque las suscripciones van atadas a la clave pública.

import { execSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROYECTO = 'hwemrpexabisyueyizjz';
const cambiar = process.argv.includes('--cambiar');

const lista = execSync(`npx supabase secrets list --project-ref ${PROYECTO} -o json`, { encoding: 'utf8' });
if (lista.includes('"VAPID_CLAVES"') && !cambiar) {
  console.log('VAPID_CLAVES ya existe: no se cambia (usa --cambiar si de verdad hace falta).');
  process.exit(0);
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const valor = JSON.stringify({
  publica: publicKey.export({ format: 'jwk' }),
  privada: privateKey.export({ format: 'jwk' }),
});

const carpeta = mkdtempSync(join(tmpdir(), 'vapid-'));
const archivo = join(carpeta, 'secretos.env');
try {
  writeFileSync(archivo, `VAPID_CLAVES='${valor}'\n`, { mode: 0o600 });
  execSync(`npx supabase secrets set --env-file "${archivo}" --project-ref ${PROYECTO}`, { stdio: 'ignore' });
  console.log('Hecho: VAPID_CLAVES guardado en los secretos de Supabase.');
} finally {
  rmSync(carpeta, { recursive: true, force: true });
}
