import { useSyncExternalStore } from 'react';

import { guardarAjuste, leerAjuste } from './ajustes';

// Siri con Atajos (27/10/2026): el enlace personal que usan los Atajos "Apunta en Rusko"
// y "Alarma en Rusko". Se guarda en este dispositivo ("organizy:siri") y no viaja en la
// copia de seguridad: es una llave y va con la sesión de este dispositivo en el servidor.
//
// Lo recogido en esta vuelta (para la tarjeta de Hoy) solo vive en memoria.
//
//   - En pantallas: const siri = useSiri(); const hechos = useRecogidoSiri();
//   - Fuera de pantallas: await leerSiri();

export type EstadoSiri = { enlace: string | null };

const CLAVE = 'siri';
const VACIO: EstadoSiri = { enlace: null };

let actual: EstadoSiri = VACIO;
let cargando: Promise<EstadoSiri> | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((o) => o());
}

export function leerSiri(): Promise<EstadoSiri> {
  if (!cargando) {
    cargando = leerAjuste<Partial<EstadoSiri>>(CLAVE, {}).then((guardado) => {
      actual = { ...VACIO, ...guardado };
      avisar();
      return actual;
    });
  }
  return cargando.then(() => actual);
}

export async function cambiarSiri(cambios: Partial<EstadoSiri>): Promise<void> {
  await leerSiri();
  actual = { ...actual, ...cambios };
  avisar();
  await guardarAjuste(CLAVE, actual);
}

function suscribirse(oyente: () => void): () => void {
  oyentes.add(oyente);
  leerSiri();
  return () => {
    oyentes.delete(oyente);
  };
}

export function useSiri(): EstadoSiri {
  return useSyncExternalStore(suscribirse, () => actual, () => actual);
}

// --- Lo recogido ahora (tarjeta "Desde Siri" de Hoy) ---

let recogido: string[] = [];
const oyentesRecogido = new Set<() => void>();

export function anadirRecogidoSiri(hechos: string[]): void {
  if (hechos.length === 0) return;
  recogido = [...recogido, ...hechos];
  oyentesRecogido.forEach((o) => o());
}

export function olvidarRecogidoSiri(): void {
  recogido = [];
  oyentesRecogido.forEach((o) => o());
}

function suscribirseRecogido(oyente: () => void): () => void {
  oyentesRecogido.add(oyente);
  return () => {
    oyentesRecogido.delete(oyente);
  };
}

export function useRecogidoSiri(): string[] {
  return useSyncExternalStore(suscribirseRecogido, () => recogido, () => recogido);
}
