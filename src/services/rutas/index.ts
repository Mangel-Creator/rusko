import { prepararParkings, type Parking } from './parkings';
import { pedirAlServidor } from './servidor';
import type { PeticionRutas, Punto, ResultadoRutas, Ruta } from './tipos';

// Rutas con tráfico (fase 6). Las calcula TomTom a través de nuestro servidor
// (Supabase Edge Function "rutas"), que guarda la clave en secreto.
//
//   - calcularRutas(peticion): 1 a 3 rutas con duración, retraso por tráfico y tramos.
//   - buscarParkings(destino): parkings cerca de donde vas (se guardan un día).
//   - Se guardan 5 minutos en memoria: si se vuelve a pedir lo mismo, no se llama
//     otra vez al servidor (cada llamada gasta del uso gratuito de TomTom).

export * from './horasPunta';
export * from './distancia';
export * from './navegador';
export * from './parkings';
export * from './textos';
export * from './tipos';

export const DURACION_CACHE_MS = 5 * 60 * 1000;

// 4 decimales son unos 11 metros: moverse un poco no gasta otra llamada.
function redondear(n: number): string {
  return n.toFixed(4);
}

// La hora pedida se redondea a 5 minutos por el mismo motivo.
function redondearHora(iso: string | undefined): string {
  if (!iso) return '';
  const cinco = 5 * 60 * 1000;
  return String(Math.round(new Date(iso).getTime() / cinco));
}

export function claveCache(p: PeticionRutas): string {
  return [
    redondear(p.origen[0]),
    redondear(p.origen[1]),
    redondear(p.destino[0]),
    redondear(p.destino[1]),
    p.modo,
    p.alternativas,
    `l${redondearHora(p.llegada)}`,
    `s${redondearHora(p.salida)}`,
  ].join('|');
}

const cache = new Map<string, { hasta: number; resultado: Promise<ResultadoRutas> }>();

export function calcularRutas(peticion: PeticionRutas): Promise<ResultadoRutas> {
  const ahora = Date.now();
  for (const [clave, entrada] of cache) if (entrada.hasta < ahora) cache.delete(clave);

  const clave = claveCache(peticion);
  const guardada = cache.get(clave);
  if (guardada) return guardada.resultado;

  const resultado = pedirAlServidor<{ rutas: Ruta[] }>({ accion: 'rutas', ...peticion }).then(
    (respuesta): ResultadoRutas => {
      // Los errores no se guardan: al reintentar, se vuelve a preguntar.
      if (respuesta.estado !== 'ok') cache.delete(clave);
      if (respuesta.estado === 'ok') return { estado: 'ok', rutas: respuesta.datos.rutas ?? [] };
      return respuesta;
    },
  );
  cache.set(clave, { hasta: ahora + DURACION_CACHE_MS, resultado });
  return resultado;
}

// --- Parkings cerca del destino ---

export type ResultadoParkings =
  | { estado: 'ok'; parkings: Parking[] }
  | { estado: 'sin-servidor' }
  | { estado: 'error'; mensaje: string };

// Los parkings no cambian: se guardan un día en memoria (por destino, a ~110 m).
const DURACION_PARKINGS_MS = 24 * 3600 * 1000;
const cacheParkings = new Map<string, { hasta: number; resultado: Promise<ResultadoParkings> }>();

export function buscarParkings(destino: Punto): Promise<ResultadoParkings> {
  const ahora = Date.now();
  const clave = `${destino[0].toFixed(3)}|${destino[1].toFixed(3)}`;
  const guardada = cacheParkings.get(clave);
  if (guardada && guardada.hasta > ahora) return guardada.resultado;

  const resultado = pedirAlServidor<{ parkings: Omit<Parking, 'distanciaM'>[] }>({ accion: 'parkings', destino }).then(
    (respuesta): ResultadoParkings => {
      if (respuesta.estado !== 'ok') {
        cacheParkings.delete(clave);
        return respuesta;
      }
      return { estado: 'ok', parkings: prepararParkings(respuesta.datos.parkings ?? [], destino) };
    },
  );
  cacheParkings.set(clave, { hasta: ahora + DURACION_PARKINGS_MS, resultado });
  return resultado;
}
