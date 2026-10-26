import { useSyncExternalStore } from 'react';

import { anadirLleno, siguienteParking, type MarcaLleno, type Parking } from '@/services/rutas/parkings';
import type { Punto } from '@/services/rutas/tipos';

import { borrarAjuste, guardarAjuste, leerAjuste } from './ajustes';

// Parkings (26/10/2026). Dos cosas guardadas en el dispositivo:
//   - "organizy:parkingsLlenos": cada vez que encontraste un parking lleno (día y
//     hora). Con eso la app aprende lo lleno que suele estar cada uno. Viaja en la
//     copia de seguridad.
//   - "organizy:aparcando": a qué parking vas ahora y los demás de la lista, para que
//     "Está lleno, llévame a otro" funcione aunque vuelvas a la app desde Waze. Es de
//     este momento: no viaja en la copia.
//
//   En pantallas: useParkingsLlenos() y useAparcando().

export type Aparcando = {
  destinoNombre: string;
  destino: Punto;
  parkings: Parking[]; // en el orden en que se proponen
  actual: string; // id del parking al que vas
  probados: string[]; // ids de los que ya has probado (llenos) más el actual
  empezado: string; // ISO
};

// Pasadas 3 horas se da por terminado: ya habrás aparcado.
const HORAS_APARCANDO = 3;

const CLAVE_LLENOS = 'parkingsLlenos';
const CLAVE_APARCANDO = 'aparcando';

let llenos: MarcaLleno[] = [];
let aparcando: Aparcando | null = null;
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((o) => o());
}

function cargar(): Promise<void> {
  if (!cargando) {
    cargando = Promise.all([
      leerAjuste<MarcaLleno[]>(CLAVE_LLENOS, []),
      leerAjuste<Aparcando | null>(CLAVE_APARCANDO, null),
    ]).then(([l, a]) => {
      llenos = Array.isArray(l) ? l : [];
      aparcando = a && Date.now() - new Date(a.empezado).getTime() < HORAS_APARCANDO * 3600 * 1000 ? a : null;
      avisar();
    });
  }
  return cargando;
}

function suscribirse(oyente: () => void): () => void {
  oyentes.add(oyente);
  cargar();
  return () => {
    oyentes.delete(oyente);
  };
}

export function useParkingsLlenos(): MarcaLleno[] {
  return useSyncExternalStore(suscribirse, () => llenos, () => llenos);
}

export function useAparcando(): Aparcando | null {
  return useSyncExternalStore(suscribirse, () => aparcando, () => aparcando);
}

async function guardarAparcando(nuevo: Aparcando | null): Promise<void> {
  aparcando = nuevo;
  avisar();
  if (nuevo) await guardarAjuste(CLAVE_APARCANDO, nuevo);
  else await borrarAjuste(CLAVE_APARCANDO);
}

// Vas a este parking (los demás quedan de reserva por si está lleno).
export async function empezarAparcar(datos: Omit<Aparcando, 'probados' | 'empezado'>): Promise<void> {
  await cargar();
  await guardarAparcando({ ...datos, probados: [datos.actual], empezado: new Date().toISOString() });
}

// El parking al que ibas está lleno: lo apunta y pasa al siguiente que no hayas
// probado. Devuelve ese siguiente (o null si ya no quedan).
export async function parkingLleno(): Promise<Parking | null> {
  await cargar();
  if (!aparcando) return null;
  const siguiente = siguienteParking(aparcando.parkings, aparcando.probados);
  llenos = anadirLleno(llenos, aparcando.actual, new Date());
  avisar();
  await guardarAjuste(CLAVE_LLENOS, llenos);
  await guardarAparcando(
    siguiente ? { ...aparcando, actual: siguiente.id, probados: [...aparcando.probados, siguiente.id] } : null,
  );
  return siguiente;
}

export async function terminarAparcar(): Promise<void> {
  await cargar();
  await guardarAparcando(null);
}

