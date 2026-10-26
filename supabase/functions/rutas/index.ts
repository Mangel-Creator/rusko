// Organizy · fase 6: rutas con tráfico en tiempo real.
//
// La app manda origen, destino y cómo viaja; esta función pregunta a TomTom (Routing
// API) con la clave guardada en los secretos de Supabase (TOMTOM_API_KEY) y devuelve
// las rutas ya resumidas: duración, retraso por el tráfico, distancia, la línea de la
// ruta y los tramos con tráfico denso o atasco. La clave nunca llega a la app.
//
// Acciones:
//   - "rutas": de 1 a 3 rutas (alternativas), saliendo ahora o para llegar a una hora.
//   - "muestras": cuánto se tarda en uno o dos trayectos saliendo a varias horas
//     (horas punta de la semana). Va en una sola llamada por lotes a TomTom.
//   - "parkings": parkings (cubiertos y al aire libre) a menos de 1 km del destino,
//     con la Search API de TomTom (26/10/2026).
//
// Gasto: TomTom da gratis 2.500 peticiones al día (sin tarjeta, así que nunca cobra).
// Aquí se limita por persona y en total para no pasar de ahí (tabla usos_diarios).

import { cabecerasCors, respuestaJson, respuestaPrevia } from '../_shared/cors.ts';
import { numeroDeEntorno, sumarUso } from '../_shared/limite.ts';
import { usuarioDeLaPeticion } from '../_shared/usuario.ts';

type Punto = [number, number];
type Modo = 'coche' | 'moto' | 'a-pie';

const MODO_TOMTOM: Record<Modo, string> = { coche: 'car', moto: 'motorcycle', 'a-pie': 'pedestrian' };
const API = 'https://api.tomtom.com/routing/1';

// --- Comprobar lo que llega ---

function esPunto(p: unknown): p is Punto {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number' &&
    Math.abs(p[0]) <= 90 &&
    Math.abs(p[1]) <= 180
  );
}

function esModo(m: unknown): m is Modo {
  return m === 'coche' || m === 'moto' || m === 'a-pie';
}

function esFecha(f: unknown): f is string {
  return typeof f === 'string' && f.length <= 40 && !Number.isNaN(Date.parse(f));
}

// TomTom quiere la hora sin milisegundos y con zona: 2026-09-25T08:00:00Z
function fechaTomTom(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function tramoRuta(origen: Punto, destino: Punto): string {
  return `${origen[0]},${origen[1]}:${destino[0]},${destino[1]}`;
}

// --- Resumir la respuesta de TomTom ---

type PuntoTomTom = { latitude: number; longitude: number };
type SeccionTomTom = {
  sectionType: string;
  startPointIndex: number;
  endPointIndex: number;
  simpleCategory?: string;
  magnitudeOfDelay?: number;
  effectiveSpeedInKmh?: number;
};
type RutaTomTom = {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds?: number;
    noTrafficTravelTimeInSeconds?: number;
    departureTime: string;
    arrivalTime: string;
  };
  legs?: { points?: PuntoTomTom[] }[];
  sections?: SeccionTomTom[];
};

type Tramo = { desde: number; hasta: number; nivel: 'denso' | 'atasco'; velocidadKmh: number | null };

// Atasco (rojo): retraso grande (magnitud 3), carretera cortada o sin datos de
// magnitud (4). Denso (amarillo): retraso pequeño o moderado (1 y 2) o desconocido (0).
function nivelDe(s: SeccionTomTom): 'denso' | 'atasco' {
  if (s.simpleCategory === 'ROAD_CLOSURE') return 'atasco';
  return (s.magnitudeOfDelay ?? 0) >= 3 ? 'atasco' : 'denso';
}

// Se quitan puntos muy juntos (menos de ~15 m) para que la respuesta pese poco,
// pero se conservan los que marcan el principio y el fin de cada tramo.
function aligerar(puntos: PuntoTomTom[], tramos: Tramo[]): { puntos: Punto[]; tramos: Tramo[] } {
  const obligatorios = new Set<number>([0, puntos.length - 1]);
  for (const t of tramos) {
    obligatorios.add(t.desde);
    obligatorios.add(t.hasta);
  }
  const nuevoIndice = new Map<number, number>();
  const salida: Punto[] = [];
  let ultimo: PuntoTomTom | null = null;
  puntos.forEach((p, i) => {
    const lejos =
      !ultimo || Math.abs(p.latitude - ultimo.latitude) > 0.00013 || Math.abs(p.longitude - ultimo.longitude) > 0.00018;
    if (lejos || obligatorios.has(i)) {
      nuevoIndice.set(i, salida.length);
      salida.push([Math.round(p.latitude * 1e5) / 1e5, Math.round(p.longitude * 1e5) / 1e5]);
      ultimo = p;
    }
  });
  return {
    puntos: salida,
    tramos: tramos.map((t) => ({ ...t, desde: nuevoIndice.get(t.desde) ?? 0, hasta: nuevoIndice.get(t.hasta) ?? 0 })),
  };
}

function resumirRuta(r: RutaTomTom) {
  const puntos = (r.legs ?? []).flatMap((l) => l.points ?? []);
  const tramos: Tramo[] = (r.sections ?? [])
    .filter((s) => s.sectionType === 'TRAFFIC' && s.endPointIndex > s.startPointIndex)
    .map((s) => ({
      desde: s.startPointIndex,
      hasta: s.endPointIndex,
      nivel: nivelDe(s),
      velocidadKmh: typeof s.effectiveSpeedInKmh === 'number' ? s.effectiveSpeedInKmh : null,
    }));
  const ligera = aligerar(puntos, tramos);
  const duracionSeg = r.summary.travelTimeInSeconds;
  const sinTraficoSeg = r.summary.noTrafficTravelTimeInSeconds ?? duracionSeg;
  return {
    duracionSeg,
    sinTraficoSeg,
    retrasoSeg: Math.max(r.summary.trafficDelayInSeconds ?? duracionSeg - sinTraficoSeg, 0),
    distanciaM: r.summary.lengthInMeters,
    salida: r.summary.departureTime,
    llegada: r.summary.arrivalTime,
    puntos: ligera.puntos,
    tramos: ligera.tramos,
  };
}

// --- Acciones ---

function parametrosComunes(modo: Modo): URLSearchParams {
  return new URLSearchParams({
    travelMode: MODO_TOMTOM[modo],
    traffic: 'true',
    computeTravelTimeFor: 'all',
    language: 'es-ES',
  });
}

async function calcularRutas(cuerpo: Record<string, unknown>, clave: string): Promise<unknown> {
  const { origen, destino, modo, llegada, salida } = cuerpo;
  if (!esPunto(origen) || !esPunto(destino) || !esModo(modo)) throw new ErrorPeticion('Faltan el origen o el destino.');
  const alternativas = Math.max(0, Math.min(2, Number(cuerpo.alternativas) || 0));
  const p = parametrosComunes(modo);
  p.set('maxAlternatives', String(alternativas));
  p.set('routeRepresentation', 'polyline');
  p.set('sectionType', 'traffic');
  if (esFecha(llegada)) p.set('arriveAt', fechaTomTom(llegada));
  else if (esFecha(salida) && Date.parse(salida) > Date.now()) p.set('departAt', fechaTomTom(salida));
  p.set('key', clave);

  const respuesta = await fetch(`${API}/calculateRoute/${tramoRuta(origen, destino)}/json?${p}`);
  if (respuesta.status === 400 || respuesta.status === 404) {
    // Por ejemplo, destino en otra isla o sin carretera: no hay ruta posible.
    return { rutas: [] };
  }
  if (!respuesta.ok) throw new Error(`TomTom respondió ${respuesta.status}`);
  const datos = (await respuesta.json()) as { routes?: RutaTomTom[] };
  return { rutas: (datos.routes ?? []).map(resumirRuta) };
}

async function calcularMuestras(cuerpo: Record<string, unknown>, clave: string): Promise<unknown> {
  const { modo, salidas, trayectos } = cuerpo;
  if (!esModo(modo) || !Array.isArray(salidas) || !Array.isArray(trayectos)) throw new ErrorPeticion('Petición incompleta.');
  const horas = salidas.filter(esFecha).slice(0, 40);
  const tramos = (trayectos as { origen?: unknown; destino?: unknown }[])
    .filter((t): t is { origen: Punto; destino: Punto } => esPunto(t?.origen) && esPunto(t?.destino))
    .slice(0, 2);
  if (horas.length === 0 || tramos.length === 0) throw new ErrorPeticion('Petición incompleta.');

  const p = parametrosComunes(modo);
  p.set('routeRepresentation', 'summaryOnly');
  const futuro = (iso: string) => Date.parse(iso) > Date.now();
  const consultas = tramos.flatMap((t) =>
    horas.map((h) => ({
      query: `/calculateRoute/${tramoRuta(t.origen, t.destino)}/json?${p}${futuro(h) ? `&departAt=${fechaTomTom(h)}` : ''}`,
    })),
  );
  const respuesta = await fetch(`${API}/batch/sync/json?key=${encodeURIComponent(clave)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchItems: consultas }),
  });
  if (!respuesta.ok) throw new Error(`TomTom respondió ${respuesta.status}`);
  const datos = (await respuesta.json()) as {
    batchItems?: { statusCode: number; response?: { routes?: RutaTomTom[] } }[];
  };
  const resultados = (datos.batchItems ?? []).map((item) =>
    item.statusCode === 200 ? (item.response?.routes?.[0]?.summary.travelTimeInSeconds ?? null) : null,
  );
  return {
    trayectos: tramos.map((_, i) =>
      horas.map((h, j) => ({ salida: h, duracionSeg: resultados[i * horas.length + j] ?? null })),
    ),
  };
}

// Parkings cubiertos (7313, "Parking Garage") y al aire libre (7369, "Open Parking Area").
const CATEGORIAS_PARKING = '7313,7369';
const RADIO_PARKINGS_M = 1000;

type ResultadoBusqueda = {
  id: string;
  poi?: { name?: string; categorySet?: { id: number }[] };
  address?: { freeformAddress?: string; streetName?: string };
  position?: { lat: number; lon: number };
};

async function buscarParkings(cuerpo: Record<string, unknown>, clave: string): Promise<unknown> {
  const { destino } = cuerpo;
  if (!esPunto(destino)) throw new ErrorPeticion('Falta el destino.');
  const p = new URLSearchParams({
    lat: String(destino[0]),
    lon: String(destino[1]),
    radius: String(RADIO_PARKINGS_M),
    limit: '15',
    categorySet: CATEGORIAS_PARKING,
    language: 'es-ES',
    key: clave,
  });
  const respuesta = await fetch(`https://api.tomtom.com/search/2/nearbySearch/.json?${p}`);
  if (!respuesta.ok) throw new Error(`TomTom respondió ${respuesta.status}`);
  const datos = (await respuesta.json()) as { results?: ResultadoBusqueda[] };
  return {
    parkings: (datos.results ?? [])
      .filter((r) => r.position && r.id)
      .map((r) => ({
        id: r.id,
        nombre: r.poi?.name || 'Parking',
        direccion: r.address?.freeformAddress ?? r.address?.streetName ?? '',
        punto: [r.position!.lat, r.position!.lon],
        tipo: r.poi?.categorySet?.some((c) => c.id === 7369) ? 'aire-libre' : 'garaje',
      })),
  };
}

class ErrorPeticion extends Error {}

const MENSAJE_LIMITE_USUARIO = 'Hoy ya has calculado muchas rutas. Mañana vuelve a funcionar.';
const MENSAJE_LIMITE_GLOBAL = 'Hoy se ha llegado al máximo de rutas gratis. Mañana vuelve a funcionar.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respuestaPrevia(req);
  if (req.method !== 'POST') return respuestaJson(req, { error: 'Solo POST' }, 405);

  // Vale con cualquiera de los dos nombres (el usuario la guardó como TOMTOM_KEY).
  const clave = Deno.env.get('TOMTOM_API_KEY') || Deno.env.get('TOMTOM_KEY');
  if (!clave) return respuestaJson(req, { error: 'Falta configurar el tráfico en el servidor.' }, 500);

  const usuario = await usuarioDeLaPeticion(req);
  if (!usuario) return respuestaJson(req, { error: 'Sesión no válida. Cierra y vuelve a abrir la app.' }, 401);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return respuestaJson(req, { error: 'Petición no válida.' }, 400);
  }
  const accion = cuerpo.accion === 'muestras' || cuerpo.accion === 'parkings' ? cuerpo.accion : 'rutas';

  try {
    // Límites de cada día (se pueden cambiar con secretos sin tocar el código).
    // Una consulta de "muestras" son 56 peticiones a TomTom: tiene su propio límite.
    const uso =
      accion === 'rutas'
        ? await sumarUso(
            usuario,
            'rutas',
            numeroDeEntorno('RUTAS_LIMITE_USUARIO', 150),
            numeroDeEntorno('RUTAS_LIMITE_GLOBAL', 2000),
          )
        : accion === 'parkings'
          ? await sumarUso(
              usuario,
              'parkings',
              numeroDeEntorno('PARKINGS_LIMITE_USUARIO', 30),
              numeroDeEntorno('PARKINGS_LIMITE_GLOBAL', 300),
            )
          : await sumarUso(
              usuario,
              'rutas-horas-punta',
              numeroDeEntorno('HORAS_PUNTA_LIMITE_USUARIO', 2),
              numeroDeEntorno('HORAS_PUNTA_LIMITE_GLOBAL', 8),
            );
    if (!uso.permitido) {
      const mensaje = uso.motivo === 'limite-usuario' ? MENSAJE_LIMITE_USUARIO : MENSAJE_LIMITE_GLOBAL;
      return respuestaJson(req, { error: mensaje }, 429);
    }
    const datos =
      accion === 'rutas'
        ? await calcularRutas(cuerpo, clave)
        : accion === 'parkings'
          ? await buscarParkings(cuerpo, clave)
          : await calcularMuestras(cuerpo, clave);
    return new Response(JSON.stringify(datos), {
      headers: { ...cabecerasCors(req), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof ErrorPeticion) return respuestaJson(req, { error: error.message }, 400);
    console.error(error);
    const que = accion === 'parkings' ? 'buscar parkings' : 'calcular la ruta';
    // "detalle" (por ejemplo, "TomTom respondió 403") ayuda a saber qué ha fallado; la app no lo enseña.
    const detalle = error instanceof Error ? error.message : String(error);
    return respuestaJson(req, { error: `No se ha podido ${que}. Prueba otra vez en un momento.`, detalle }, 502);
  }
});
