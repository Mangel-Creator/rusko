import type { EntradaIndice, PdfLeido } from './apuntes';

// Lee el texto de cada página y el índice de un PDF en el navegador, con pdf.js.
// El PDF no sale del dispositivo. pdf.js (1,4 MB) se carga de cdnjs solo al medir
// unos apuntes, versión fija y comprobada con su huella (si no coincide, no se usa).
// Si algo falla devuelve null y la app manda el PDF entero, como antes.

const VERSION = '3.11.174';
const CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION}`;
const HUELLA_LIBRERIA = 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';
const HUELLA_TRABAJADOR = 'SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2';

// Lo poco que se usa de pdf.js.
type Destino = string | unknown[] | null;
type NodoIndice = { title: string; dest: Destino; items: NodoIndice[] };
type DocumentoPdf = {
  numPages: number;
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string }[] }> }>;
  getOutline: () => Promise<NodoIndice[] | null>;
  getDestination: (nombre: string) => Promise<unknown[] | null>;
  getPageIndex: (ref: unknown) => Promise<number>;
  destroy: () => Promise<void>;
};
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (datos: { data: ArrayBuffer }) => { promise: Promise<DocumentoPdf> };
};

let cargando: Promise<PdfJs> | null = null;

function cargarPdfJs(): Promise<PdfJs> {
  cargando ??= (async () => {
    const ventana = window as unknown as { pdfjsLib?: PdfJs };
    if (!ventana.pdfjsLib) {
      await new Promise<void>((ok, mal) => {
        const script = document.createElement('script');
        script.src = `${CDN}/pdf.min.js`;
        script.integrity = HUELLA_LIBRERIA;
        script.crossOrigin = 'anonymous';
        script.onload = () => ok();
        script.onerror = () => mal(new Error('pdf.js'));
        document.head.appendChild(script);
      });
    }
    const pdfjs = ventana.pdfjsLib;
    if (!pdfjs) throw new Error('pdf.js');
    // El trabajador también se comprueba antes de usarlo, y se sirve desde aquí.
    const trabajador = await (await fetch(`${CDN}/pdf.worker.min.js`)).arrayBuffer();
    const huella = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-384', trabajador))));
    if (huella !== HUELLA_TRABAJADOR) throw new Error('pdf.js: huella');
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([trabajador], { type: 'text/javascript' }));
    return pdfjs;
  })().catch((error) => {
    cargando = null;
    throw error;
  });
  return cargando;
}

export async function leerPdf(archivo: Blob): Promise<PdfLeido | null> {
  if (typeof document === 'undefined') return null;
  try {
    const pdfjs = await cargarPdfJs();
    const pdf = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
    try {
      const paginas = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const contenido = await (await pdf.getPage(n)).getTextContent();
        const texto = contenido.items
          .map((i) => i.str ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        paginas.push({ inicio: texto.slice(0, 120), caracteres: texto.length });
      }
      const indice = await indiceDe(pdf, (await pdf.getOutline().catch(() => null)) ?? [], 0);
      return { paginas, indice };
    } finally {
      void pdf.destroy();
    }
  } catch (error) {
    console.warn('No se ha podido leer el PDF en el navegador', error);
    return null;
  }
}

// Dos niveles bastan (temas y apartados). Una entrada sin página se queda fuera.
async function indiceDe(pdf: DocumentoPdf, nodos: NodoIndice[], nivel: number): Promise<EntradaIndice[]> {
  const entradas: EntradaIndice[] = [];
  for (const nodo of nodos.slice(0, 200)) {
    const pagina = await paginaDe(pdf, nodo.dest).catch(() => null);
    if (pagina === null) continue;
    const hijos = nivel < 1 ? await indiceDe(pdf, nodo.items ?? [], nivel + 1) : [];
    entradas.push({ titulo: nodo.title.replace(/\s+/g, ' ').trim(), pagina, hijos });
  }
  return entradas;
}

async function paginaDe(pdf: DocumentoPdf, destino: Destino): Promise<number | null> {
  const explicito = typeof destino === 'string' ? await pdf.getDestination(destino) : destino;
  if (!Array.isArray(explicito) || explicito.length === 0) return null;
  return (await pdf.getPageIndex(explicito[0])) + 1;
}
