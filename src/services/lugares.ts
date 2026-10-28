import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { guardarPerfil, leerPerfil, type Coordenadas, type Lugar } from '@/data/perfil';
import { comunidadDesdeIso, type CodigoComunidad } from '@/services/festivos';

// Convierte texto ("Chamberí, Madrid") en coordenadas.
// - En el móvil (Android e iOS): con expo-location, que usa el buscador del teléfono.
// - En la web: con el buscador gratuito de OpenStreetMap (Nominatim). Solo se envía
//   el texto de la dirección; ningún otro dato del usuario.
// Si no hay conexión devuelve "no-disponible": se guarda el texto y las coordenadas
// se calculan la próxima vez que se abra la app (ver completarCoordenadasPendientes).

export type ResultadoBusqueda =
  | { estado: 'encontrado'; coordenadas: Coordenadas }
  | { estado: 'no-encontrado' }
  | { estado: 'no-disponible' };

export const usaOpenStreetMap = Platform.OS === 'web';

// Texto de atribución que exigen las normas de OpenStreetMap.
export const ATRIBUCION_OPENSTREETMAP =
  'Las direcciones se buscan con OpenStreetMap (© colaboradores de OpenStreetMap).';

export async function buscarCoordenadas(texto: string): Promise<ResultadoBusqueda> {
  return usaOpenStreetMap ? buscarEnOpenStreetMap(texto) : buscarEnElTelefono(texto);
}

async function buscarEnElTelefono(texto: string): Promise<ResultadoBusqueda> {
  try {
    const resultados = await Location.geocodeAsync(texto);
    const primero = resultados[0];
    if (!primero) {
      return { estado: 'no-encontrado' };
    }
    return {
      estado: 'encontrado',
      coordenadas: { latitud: primero.latitude, longitud: primero.longitude },
    };
  } catch {
    // iOS da error cuando no encuentra nada.
    return { estado: 'no-encontrado' };
  }
}

// Las normas de Nominatim piden como mucho una búsqueda por segundo.
const ESPERA_ENTRE_BUSQUEDAS_MS = 1100;
let ultimaBusqueda = 0;

async function esperarTurno() {
  const falta = ultimaBusqueda + ESPERA_ENTRE_BUSQUEDAS_MS - Date.now();
  ultimaBusqueda = Date.now() + Math.max(falta, 0);
  if (falta > 0) {
    await new Promise((resolver) => setTimeout(resolver, falta));
  }
}

async function buscarEnOpenStreetMap(texto: string): Promise<ResultadoBusqueda> {
  await esperarTurno();
  const parametros = new URLSearchParams({
    q: texto,
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'es',
  });
  try {
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${parametros}`);
    if (!respuesta.ok) {
      return { estado: 'no-disponible' };
    }
    const resultados = (await respuesta.json()) as { lat: string; lon: string }[];
    const primero = resultados[0];
    if (!primero) {
      return { estado: 'no-encontrado' };
    }
    return {
      estado: 'encontrado',
      coordenadas: { latitud: Number(primero.lat), longitud: Number(primero.lon) },
    };
  } catch {
    // Sin conexión o el servicio no responde.
    return { estado: 'no-disponible' };
  }
}

// Comunidad autónoma (y Valle de Arán) de un municipio, para sus festivos. Siempre con
// OpenStreetMap, también en el móvil: el buscador del teléfono no da la comunidad.
export type ResultadoComunidad =
  | { estado: 'encontrado'; comunidad: CodigoComunidad; municipio: string; subzona: string | null }
  | { estado: 'no-encontrado' }
  | { estado: 'no-disponible' };

export async function buscarComunidad(texto: string): Promise<ResultadoComunidad> {
  await esperarTurno();
  const parametros = new URLSearchParams({
    q: texto,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
    countrycodes: 'es',
    'accept-language': 'es',
  });
  try {
    const respuesta = await fetch(`https://nominatim.openstreetmap.org/search?${parametros}`);
    if (!respuesta.ok) return { estado: 'no-disponible' };
    const resultados = (await respuesta.json()) as { name?: string; address?: Record<string, string> }[];
    const direccion = resultados[0]?.address ?? {};
    const comunidad = comunidadDesdeIso(direccion['ISO3166-2-lvl4']);
    if (!comunidad) return { estado: 'no-encontrado' };
    return {
      estado: 'encontrado',
      comunidad,
      municipio: direccion.city ?? direccion.town ?? direccion.village ?? resultados[0]?.name ?? texto,
      subzona: direccion.county === 'Valle de Arán' ? 'aran' : null,
    };
  } catch {
    return { estado: 'no-disponible' };
  }
}

async function completarLugar<T extends Lugar>(lugar: T): Promise<T> {
  if (lugar.coordenadas) {
    return lugar;
  }
  const resultado = await buscarCoordenadas(lugar.direccion);
  return resultado.estado === 'encontrado' ? { ...lugar, coordenadas: resultado.coordenadas } : lugar;
}

// Si hay sitios guardados sin coordenadas, intenta calcularlas ahora.
// Se llama al arrancar la app. Va de uno en uno para no saturar el buscador.
export async function completarCoordenadasPendientes(): Promise<void> {
  const perfil = await leerPerfil();
  if (!perfil) {
    return;
  }
  const faltan = !perfil.vivienda.coordenadas || perfil.sitios.some((s) => !s.coordenadas);
  if (!faltan) {
    return;
  }
  const vivienda = await completarLugar(perfil.vivienda);
  const sitios = [];
  for (const sitio of perfil.sitios) {
    sitios.push(await completarLugar(sitio));
  }
  await guardarPerfil({ ...perfil, vivienda, sitios });
}
