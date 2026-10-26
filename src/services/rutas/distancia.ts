import type { Punto } from './tipos';

const RADIO_TIERRA_M = 6371000;
const A_RADIANES = Math.PI / 180;

// Distancia en metros entre dos puntos, en línea recta.
export function distanciaM(a: Punto, b: Punto): number {
  const dLat = (b[0] - a[0]) * A_RADIANES;
  const dLon = (b[1] - a[1]) * A_RADIANES;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * A_RADIANES) * Math.cos(b[0] * A_RADIANES) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
