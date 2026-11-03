import type { Densidad, TemaMedido } from './perfilEstudio';

// Medir apuntes en PDF sin mandar el PDF (03/11/2026). El navegador lee el texto
// de cada página (services/epoca/leerPdf.ts) y:
// 1. Si el PDF trae índice (marcadores), los temas salen de ahí, sin IA.
// 2. Si no, a la IA solo le llega un "mapa": cómo empieza cada página y cuánto
//    texto tiene. Cuesta unas 100 veces menos que el PDF entero.
// 3. Solo un PDF escaneado (fotos, sin texto) va entero, y corto.
// La densidad sale de los caracteres por página, no de la IA. Funciones puras.

export type PaginaLeida = { inicio: string; caracteres: number };
export type EntradaIndice = { titulo: string; pagina: number; hijos: EntradaIndice[] };
export type PdfLeido = { paginas: PaginaLeida[]; indice: EntradaIndice[] };

// Un escaneado entero son unos 4000 tokens por página. Con 20 se queda por debajo de
// 100.000 tokens (unos 0,01 $); más gastaría de golpe lo de varias horas.
export const MAX_PAGINAS_ESCANEADO = 20;
// Tope del mapa para que quede bien por debajo de 100.000 tokens (Haiku cobra el
// quíntuple por encima).
export const MAX_MAPA = 80000;
// Más páginas no caben en el mapa ni en lo que la IA puede leer de una vez.
export const MAX_PAGINAS = 1500;
const MAX_TEMAS = 40;

// Lo que no se estudia: fuera del índice.
const NO_SE_ESTUDIA =
  /^(portada|[ií]ndice|contenidos?|sumario|tabla de contenidos|bibliograf|referencias|webgraf|anexos?|ap[eé]ndices?|pr[oó]logo|agradecimientos|cr[eé]ditos)\b/i;

// Por debajo de 100 caracteres por página de media, son fotos: no hay texto que leer.
export const esEscaneado = (pdf: PdfLeido) =>
  pdf.paginas.length === 0 || caracteres(pdf.paginas) / pdf.paginas.length < 100;

const caracteres = (paginas: PaginaLeida[]) => paginas.reduce((t, p) => t + p.caracteres, 0);

// Diapositivas o esquemas: poco texto por página. Libro de letra pequeña: mucho.
export function densidadDe(paginas: PaginaLeida[]): Densidad {
  const media = paginas.length > 0 ? caracteres(paginas) / paginas.length : 0;
  return media < 1500 ? 'baja' : media > 3500 ? 'alta' : 'media';
}

// Temas a partir del índice del PDF. Si todo cuelga de una sola entrada ("Apuntes"),
// se usan sus capítulos. null si no da para al menos 2 temas en orden.
export function temasDelIndice(pdf: PdfLeido): TemaMedido[] | null {
  let entradas = pdf.indice;
  while (entradas.filter((e) => !NO_SE_ESTUDIA.test(e.titulo)).length === 1) {
    const unica = entradas.find((e) => !NO_SE_ESTUDIA.test(e.titulo));
    if (!unica || unica.hijos.length === 0) break;
    entradas = unica.hijos;
  }
  const total = pdf.paginas.length;
  const ordenadas = entradas.filter((e) => e.pagina >= 1 && e.pagina <= total);
  if (ordenadas.some((e, i) => i > 0 && e.pagina < ordenadas[i - 1].pagina)) return null;
  // Cada tema acaba donde empieza la entrada siguiente, aunque sea la bibliografía.
  const temas = ordenadas
    .map((e, i) => ({ e, fin: (ordenadas[i + 1]?.pagina ?? total + 1) - 1 }))
    .filter(({ e, fin }) => !NO_SE_ESTUDIA.test(e.titulo) && fin >= e.pagina)
    .map(({ e, fin }) => tema(e.titulo, e.pagina, fin, pdf.paginas));
  return temas.length >= 2 && temas.length <= MAX_TEMAS ? temas : null;
}

function tema(nombre: string, inicio: number, fin: number, paginas: PaginaLeida[]): TemaMedido {
  const suyas = paginas.slice(inicio - 1, fin);
  return { nombre: nombre.trim().slice(0, 60), paginas: Math.min(500, fin - inicio + 1), densidad: densidadDe(suyas) };
}

// Una línea por página: "12 · 3400 · Tema 3: Regresión lineal simple...". Delante, el
// índice si lo hay. Cada línea se acorta para que el total quepa en MAX_MAPA.
export function mapaDePaginas(pdf: PdfLeido): string {
  const indice = aplanar(pdf.indice)
    .slice(0, 80)
    .map((e) => `${e.pagina} · ${e.titulo.slice(0, 80)}`);
  const cabecera = indice.length > 0 ? `Índice del PDF:\n${indice.join('\n')}\n\n` : '';
  const largo = Math.max(30, Math.min(120, Math.floor((MAX_MAPA - cabecera.length) / Math.max(1, pdf.paginas.length)) - 16));
  const lineas = pdf.paginas.map((p, i) => `${i + 1} · ${p.caracteres} · ${p.inicio.slice(0, largo)}`);
  return `${cabecera}Páginas (número · caracteres · cómo empieza):\n${lineas.join('\n')}`.slice(0, MAX_MAPA);
}

const aplanar = (entradas: EntradaIndice[]): EntradaIndice[] => entradas.flatMap((e) => [e, ...aplanar(e.hijos)]);
