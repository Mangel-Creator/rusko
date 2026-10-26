import type { Transporte } from '@/data/perfil';

import type { Punto } from './tipos';

// Con qué app se navega: Organizy no guía, te manda a Waze, Google Maps o Mapas de
// Apple con el destino puesto (26/10/2026). Funciones puras, con pruebas.

export type Navegador = 'waze' | 'google' | 'apple';

export const NAVEGADOR_POR_DEFECTO: Navegador = 'waze';

export const NOMBRE_NAVEGADOR: Record<Navegador, string> = {
  waze: 'Waze',
  google: 'Google Maps',
  apple: 'Mapas',
};

export function esNavegador(valor: unknown): valor is Navegador {
  return valor === 'waze' || valor === 'google' || valor === 'apple';
}

function coordenadas([lat, lon]: Punto): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

// Abre Waze navegando hasta el destino (si no está instalado, abre su web).
export function enlaceWaze(destino: Punto): string {
  return `https://waze.com/ul?ll=${coordenadas(destino)}&navigate=yes`;
}

const MODO_GOOGLE: Record<Transporte, string> = {
  coche: 'driving',
  moto: 'two-wheeler',
  'transporte-publico': 'transit',
  'a-pie': 'walking',
};

// Abre Google Maps con las indicaciones hasta el destino, desde donde estés.
export function enlaceGoogleMaps(destino: Punto, transporte: Transporte = 'coche'): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coordenadas(destino)}&travelmode=${MODO_GOOGLE[transporte]}`;
}

const MODO_APPLE: Record<Transporte, string> = { coche: 'd', moto: 'd', 'transporte-publico': 'r', 'a-pie': 'w' };

// Abre Mapas de Apple con la ruta hasta el destino (en Android y en el ordenador,
// su web).
export function enlaceAppleMaps(destino: Punto, transporte: Transporte = 'coche'): string {
  return `https://maps.apple.com/?daddr=${coordenadas(destino)}&dirflg=${MODO_APPLE[transporte]}`;
}

// Waze solo sirve en coche o en moto: a pie o en transporte público se usa Google Maps.
export function navegadorPara(elegido: Navegador, transporte: Transporte = 'coche'): Navegador {
  if (elegido === 'waze' && (transporte === 'a-pie' || transporte === 'transporte-publico')) return 'google';
  return elegido;
}

export function enlaceNavegador(elegido: Navegador, destino: Punto, transporte: Transporte = 'coche'): string {
  const app = navegadorPara(elegido, transporte);
  if (app === 'waze') return enlaceWaze(destino);
  if (app === 'apple') return enlaceAppleMaps(destino, transporte);
  return enlaceGoogleMaps(destino, transporte);
}
