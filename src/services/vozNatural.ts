// Elige la voz que suena más a persona entre las que tiene el navegador (28/10/2026, lo
// pidió el usuario: la respuesta a "¿qué tengo el miércoles?" sonaba a robot).
//
// Cada navegador trae las suyas: en el iPhone, Mónica (y, si se descargan en Ajustes,
// las "mejoradas" o "Premium"); en Edge, Elvira y Álvaro "Online (Natural)", que son
// voces neuronales; en Chrome, "Google español". Se puntúa cada una y gana la mejor.
// Las de juguete del iPhone (Abuela, Rocko, Eddy...) quedan al final.

export type VozDisponible = {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
};

const NATURAL = /natural|neural|premium|enhanced|mejorad/i;
const DE_JUGUETE = /\b(eddy|flo|grandma|grandpa|abuel[ao]|reed|rocko|sandy|shelley)\b|espeak/i;

function puntos(voz: VozDisponible): number {
  const idioma = voz.lang.replace('_', '-').toLowerCase();
  if (!idioma.startsWith('es')) return -Infinity;
  const nombre = `${voz.name} ${voz.voiceURI}`;
  let total = idioma === 'es-es' ? 100 : 40;
  if (NATURAL.test(nombre)) total += 60;
  if (/google/i.test(nombre)) total += 25;
  if (/online/i.test(nombre)) total += 10;
  if (DE_JUGUETE.test(nombre)) total -= 50;
  return total;
}

export function elegirVoz<V extends VozDisponible>(voces: readonly V[]): V | null {
  let mejor: V | null = null;
  let mejores = -Infinity;
  for (const voz of voces) {
    const p = puntos(voz);
    if (p > mejores) {
      mejor = voz;
      mejores = p;
    }
  }
  return mejor;
}

// Frase a frase: deja una pausa natural entre ellas y evita que Chrome corte las voces
// "Google" a los 15 segundos.
export function trocearEnFrases(texto: string): string[] {
  return (texto.match(/[^.]+(\.+|$)/g) ?? []).map((f) => f.trim()).filter(Boolean);
}
