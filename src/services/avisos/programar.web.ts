import { urlDeDestino } from './destinos';
import { estadoPush, programarEnServidor, pruebaEnServidor, registrarServiceWorker, soportePush } from './push';
import type { AvisoPlanificado, DatosAviso } from './tipos';

// Versión web de programar.ts (26/10/2026). El navegador no puede programar avisos que
// lleguen con la web cerrada, así que se suben a Supabase y la función avisos-web los
// manda a su hora con Web Push (ver push.web.ts). Solo si este navegador lo admite y se
// han activado en Perfil > Avisos. En la web los avisos no llevan botones: al tocarlos
// se abre la pantalla que toque.

// Se calcula al cargar en el navegador. Al compilar la web (sin navegador) sale false,
// pero Perfil > Avisos solo se pinta al abrirlo.
export const avisosDisponibles = soportePush() === 'si';

export async function prepararAvisos(): Promise<void> {
  await registrarServiceWorker();
}

let ultimaFirma = '';
let ultimaVez = 0;
let programados = 0;

// Los mismos avisos no se vuelven a subir hasta pasados 10 minutos.
const REPETIR_MS = 10 * 60 * 1000;

export async function programarAvisos(avisos: AvisoPlanificado[]): Promise<number> {
  if (!(await estadoPush()).suscrito) return 0;
  const paraServidor = avisos.map((a) => ({
    id: a.id,
    cuando: a.cuando.toISOString(),
    titulo: a.titulo,
    cuerpo: a.cuerpo,
    url: urlDeDestino(a.destino),
  }));
  const firma = JSON.stringify(paraServidor);
  if (firma === ultimaFirma && Date.now() - ultimaVez < REPETIR_MS) return programados;
  const n = await programarEnServidor(paraServidor);
  if (n === null) return 0;
  ultimaFirma = firma;
  ultimaVez = Date.now();
  programados = n;
  return n;
}

export async function contarAvisosProgramados(): Promise<number> {
  return programados;
}

// Llega en unos segundos: lo manda el servidor por el mismo camino que los de verdad.
export async function enviarAvisoDePrueba(aviso?: AvisoPlanificado): Promise<void> {
  await pruebaEnServidor(
    aviso ? { titulo: aviso.titulo, cuerpo: aviso.cuerpo, url: urlDeDestino(aviso.destino) } : undefined,
  );
}

export async function posponerAviso(
  _titulo: string,
  _cuerpo: string,
  _datos: DatosAviso,
  _categoria: string | null,
): Promise<Date> {
  return new Date();
}

export type AccionAviso = 'tocar' | 'a-manana' | 'abrir' | 'retraso' | 'posponer' | 'parar' | 'como-llegar' | 'whatsapp';

export type RespuestaAviso = {
  accion: AccionAviso;
  datos: DatosAviso;
  titulo: string;
  cuerpo: string;
  categoria: string | null;
};

// Al tocar un aviso web lo atiende el service worker abriendo su dirección: aquí no
// hay nada que escuchar.
export function escucharRespuestas(_alResponder: (respuesta: RespuestaAviso) => void): () => void {
  return () => {};
}
