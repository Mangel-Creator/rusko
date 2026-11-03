// Buscar por palabras sueltas, sin mayúsculas ni tildes: «donde tengo la clase de inglés»
// encuentra «Clase de Inglés». Lo usan el buscador del Mapa y la captura rápida.

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es-ES')
    .trim();
}

// Palabras que no ayudan a buscar: "donde tengo la clase de inglés" busca "clase" e "ingles".
const RELLENO = new Set(
  'donde adonde tengo tiene tenemos hay la el lo los las un una de del mi mis tu al en con voy vamos ir llevame lleva quiero me para que hoy manana es esta este'.split(
    ' ',
  ),
);

export function palabrasClave(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 1 && !RELLENO.has(p));
}

export function coincide(texto: string, palabras: string[]): boolean {
  const t = normalizar(texto);
  return palabras.every((p) => t.includes(p));
}
