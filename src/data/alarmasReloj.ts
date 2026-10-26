import { useSyncExternalStore } from 'react';

import { guardarAjuste, leerAjuste } from './ajustes';

// Alarmas al Reloj del iPhone (26/10/2026): el enlace personal que lee el Atajo y
// lo último que se subió al servidor. Se guarda en este dispositivo
// ("organizy:alarmasReloj") y no viaja en la copia de seguridad: el enlace es una
// llave y va con la sesión de este dispositivo en el servidor.
//
//   - En pantallas: const reloj = useAlarmasReloj();
//   - Fuera de pantallas: await leerAlarmasReloj();

export type EstadoReloj = {
  enlace: string | null; // null = no se pasan al Reloj
  firma: string; // lo último subido, para no subir dos veces lo mismo
  subidoEl: string | null; // ISO
};

const CLAVE = 'alarmasReloj';
const VACIO: EstadoReloj = { enlace: null, firma: '', subidoEl: null };

let actual: EstadoReloj = VACIO;
let cargando: Promise<EstadoReloj> | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((o) => o());
}

export function leerAlarmasReloj(): Promise<EstadoReloj> {
  if (!cargando) {
    cargando = leerAjuste<Partial<EstadoReloj>>(CLAVE, {}).then((guardado) => {
      actual = { ...VACIO, ...guardado };
      avisar();
      return actual;
    });
  }
  return cargando.then(() => actual);
}

export async function cambiarAlarmasReloj(cambios: Partial<EstadoReloj>): Promise<void> {
  await leerAlarmasReloj();
  actual = { ...actual, ...cambios };
  avisar();
  await guardarAjuste(CLAVE, actual);
}

export function suscribirseAlarmasReloj(oyente: () => void): () => void {
  oyentes.add(oyente);
  leerAlarmasReloj();
  return () => {
    oyentes.delete(oyente);
  };
}

export function useAlarmasReloj(): EstadoReloj {
  return useSyncExternalStore(suscribirseAlarmasReloj, () => actual, () => actual);
}
