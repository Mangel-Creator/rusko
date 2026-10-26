import { useSyncExternalStore } from 'react';

import { esNavegador, NAVEGADOR_POR_DEFECTO, type Navegador } from '@/services/rutas/navegador';

import { guardarAjuste, leerAjuste } from './ajustes';

// Con qué app abres las rutas: Waze (por defecto), Google Maps o Mapas. Se elige en
// el Mapa ("Abrir siempre con") y se guarda en el dispositivo ("organizy:navegador").
//
//   - En pantallas: const navegador = useNavegador();
//   - Fuera de pantallas: await leerNavegador();

const CLAVE = 'navegador';

let actual: Navegador = NAVEGADOR_POR_DEFECTO;
let cargando: Promise<Navegador> | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((o) => o());
}

export function leerNavegador(): Promise<Navegador> {
  if (!cargando) {
    cargando = leerAjuste<string>(CLAVE, NAVEGADOR_POR_DEFECTO).then((guardado) => {
      if (esNavegador(guardado) && guardado !== actual) {
        actual = guardado;
        avisar();
      }
      return actual;
    });
  }
  return cargando.then(() => actual);
}

export async function guardarNavegador(nuevo: Navegador): Promise<void> {
  await leerNavegador();
  actual = nuevo;
  avisar();
  await guardarAjuste(CLAVE, nuevo);
}

export function suscribirseNavegador(oyente: () => void): () => void {
  oyentes.add(oyente);
  leerNavegador();
  return () => {
    oyentes.delete(oyente);
  };
}

export function useNavegador(): Navegador {
  return useSyncExternalStore(suscribirseNavegador, () => actual, () => actual);
}
