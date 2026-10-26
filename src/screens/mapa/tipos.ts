import type { StyleProp, ViewStyle } from 'react-native';

import type { Parking, Punto, Ruta } from '@/services/rutas';

// Lo que recibe el mapa, igual en el móvil (MapaRuta.tsx, react-native-maps) y en
// la web (MapaRuta.web.tsx, Leaflet).
export type PropsMapa = {
  ubicacion: Punto | null; // dónde estás (punto azul)
  destino: Punto | null;
  rutas: Ruta[];
  elegida: number; // índice de la ruta elegida en "rutas"
  alElegir: (indice: number) => void; // al tocar una ruta alternativa
  parkings: Parking[]; // los de cerca del destino, si los has pedido
  parkingElegido?: string | null; // id del parking al que vas
  centroInicial?: Punto | null; // si aún no se sabe dónde estás (por ejemplo, tu casa)
  style?: StyleProp<ViewStyle>;
};

// Centro de España, para cuando todavía no se sabe dónde estás.
export const CENTRO_POR_DEFECTO: Punto = [40.4168, -3.7038];

// Los tramos de la ruta elegida, cada uno con sus puntos, para pintarlos encima.
export function puntosDeTramo(ruta: Ruta, desde: number, hasta: number): Punto[] {
  return ruta.puntos.slice(desde, hasta + 1);
}

// Todos los puntos que tienen que caber en pantalla.
export function puntosVisibles({
  ubicacion,
  destino,
  rutas,
  parkings,
}: Pick<PropsMapa, 'ubicacion' | 'destino' | 'rutas' | 'parkings'>): Punto[] {
  const puntos: Punto[] = rutas.flatMap((r) => r.puntos);
  if (ubicacion) puntos.push(ubicacion);
  if (destino) puntos.push(destino);
  puntos.push(...parkings.map((p) => p.punto));
  return puntos;
}
