import type { Transporte } from '@/data/perfil';

// Tipos de las rutas con tráfico (fase 6). Sin nada de pantallas ni del servidor:
// así la lógica se puede probar con Jest.

// Punto en el mapa como [latitud, longitud]. Más ligero que { latitud, longitud }
// para las rutas, que traen cientos de puntos.
export type Punto = [number, number];

// Tráfico de un tramo de la ruta: "denso" (amarillo) o "atasco" (rojo).
// Lo que no está en ningún tramo va fluido.
export type NivelTrafico = 'denso' | 'atasco';

export type TramoTrafico = {
  desde: number; // índice del primer punto del tramo en Ruta.puntos
  hasta: number; // índice del último punto
  nivel: NivelTrafico;
  velocidadKmh: number | null; // velocidad real en el tramo, si viene
};

export type Ruta = {
  duracionSeg: number; // con el tráfico (real si sales ahora; previsto si es otra hora)
  sinTraficoSeg: number; // con las carreteras vacías
  retrasoSeg: number; // lo que añade el tráfico ("+6 min")
  distanciaM: number;
  salida: string; // fecha y hora ISO
  llegada: string;
  puntos: Punto[];
  tramos: TramoTrafico[];
};

// Cómo se viaja. El transporte público no tiene tráfico que calcular: TomTom no lo
// hace y se abre Google Maps.
export type ModoViaje = 'coche' | 'moto' | 'a-pie';

export function modoDeViaje(transporte: Transporte | null | undefined): ModoViaje | null {
  if (transporte === 'transporte-publico') return null;
  return transporte ?? 'coche';
}

export type PeticionRutas = {
  origen: Punto;
  destino: Punto;
  modo: ModoViaje;
  alternativas: number; // 0 = solo la mejor; 2 = hasta 3 rutas
  llegada?: string; // ISO: para llegar a esa hora (tráfico previsto)
  salida?: string; // ISO: saliendo a esa hora (tráfico previsto)
};

// Qué ha pasado al pedir rutas.
export type ResultadoRutas =
  | { estado: 'ok'; rutas: Ruta[] }
  | { estado: 'sin-servidor' } // la app aún no tiene servidor (Supabase) configurado
  | { estado: 'error'; mensaje: string };
