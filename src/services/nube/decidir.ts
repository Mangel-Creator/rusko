import type { CopiaSeguridad } from '@/services/copia/formato';

// Copia en la nube (27/10/2026): con una cuenta, la copia de seguridad entera se sube a
// Supabase y los otros dispositivos de esa cuenta la traen. Aquí, lo puro (con pruebas):
// la huella de una copia y qué toca hacer en cada momento.

// Lo que recuerda cada dispositivo (organizy:nube, no viaja en la copia).
export type EstadoNube = {
  // Huella de lo que este dispositivo subió o trajo por última vez. Si lo de ahora
  // tiene otra huella, hay cambios sin subir.
  base: string | null;
  // Hora (del servidor) de la copia de la nube que tiene este dispositivo.
  version: string | null;
  // Desde cuándo hay cambios sin subir (ISO); null = ninguno.
  cambioEl: string | null;
  // Recién traída una copia: al arrancar, lo que haya pasa a ser la base.
  rebase: boolean;
  // Última vez que se habló con la nube sin problemas (ISO), para enseñarlo.
  ultimaVez: string | null;
};

export const ESTADO_INICIAL: EstadoNube = { base: null, version: null, cambioEl: null, rebase: false, ultimaVez: null };

// Lo que hay en la nube, sin la copia (para decidir no hace falta bajarla).
export type CopiaRemota = { actualizada: string; huella: string; dispositivo: string };

export type Decision =
  | 'nada' // todo igual
  | 'subir' // lo de aquí es más nuevo
  | 'traer' // lo de la nube es más nuevo
  | 'adoptar' // ya son iguales: solo se apunta la versión
  | 'elegir'; // primera vez en este dispositivo con datos distintos: que lo diga la persona

// Huella de una copia: el mismo contenido da la misma huella, aunque las claves vengan en
// otro orden. No cuenta la hora de la copia. No es para seguridad: solo para comparar.
export function huellaCopia(copia: CopiaSeguridad): string {
  const { creadaEl: _hora, ...resto } = copia;
  return cyrb53(textoOrdenado(resto));
}

function textoOrdenado(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor) ?? 'null';
  if (Array.isArray(valor)) return `[${valor.map((v) => (v === undefined ? 'null' : textoOrdenado(v))).join(',')}]`;
  const partes = Object.keys(valor)
    .filter((clave) => (valor as Record<string, unknown>)[clave] !== undefined)
    .sort()
    .map((clave) => `${JSON.stringify(clave)}:${textoOrdenado((valor as Record<string, unknown>)[clave])}`);
  return `{${partes.join(',')}}`;
}

// Resumen de 53 bits (cyrb53), en hexadecimal.
function cyrb53(texto: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// Un dispositivo "vacío" (sin bienvenida ni eventos) trae lo de la cuenta sin preguntar.
export function copiaVacia(copia: CopiaSeguridad): boolean {
  return copia.ajustes.bienvenidaCompletada !== true && copia.eventos.length === 0 && copia.epocas.length === 0;
}

// Qué hacer con lo de aquí (su huella y si está vacío) y lo de la nube.
export function decidir(
  estado: EstadoNube,
  local: { huella: string; vacia: boolean },
  remota: CopiaRemota | null,
): Decision {
  const base = estado.rebase ? local.huella : estado.base;
  const cambiado = local.huella !== base;

  if (!remota) return local.vacia ? 'nada' : 'subir';
  if (remota.huella === local.huella) return remota.actualizada === estado.version && !cambiado ? 'nada' : 'adoptar';

  // Nunca ha hablado con la nube: no se pisa la copia de la cuenta sin preguntar.
  if (estado.version === null) return local.vacia ? 'traer' : 'elegir';

  if (remota.actualizada === estado.version) return cambiado ? 'subir' : 'nada';

  // Otro dispositivo ha subido algo después. Si aquí también hay cambios, gana lo último.
  if (cambiado && estado.cambioEl && Date.parse(estado.cambioEl) > Date.parse(remota.actualizada)) return 'subir';
  return 'traer';
}
