import { useSyncExternalStore } from 'react';

import type { ZonaFestivos } from '@/services/festivos';

import { guardarAjuste, leerAjuste } from './ajustes';

// Perfil del usuario: lo rellena el formulario de bienvenida y se edita en "Perfil".
// Se guarda en el dispositivo con AsyncStorage (claves "organizy:perfil" y
// "organizy:bienvenidaCompletada").
//
// Para leerlo desde cualquier pantalla:
//   - En un componente: const { perfil } = usePerfil();   (se actualiza solo)
//   - Fuera de componentes: const perfil = await leerPerfil();

export type Coordenadas = {
  latitud: number;
  longitud: number;
};

// Un sitio escrito por el usuario. "coordenadas" es null si aún no se han podido
// calcular (por ejemplo, si se rellenó desde el navegador del ordenador).
export type Lugar = {
  direccion: string;
  coordenadas: Coordenadas | null;
};

export type SitioHabitual = Lugar & {
  id: string;
  nombre: string; // "Trabajo", "Gimnasio"...
};

export type Transporte = 'coche' | 'moto' | 'transporte-publico' | 'a-pie';
export type Uso = 'personal' | 'clientes' | 'ambos';
export type MomentoDelDia = 'manana' | 'tarde' | 'noche';
export type AntelacionAviso = 10 | 30 | 60; // minutos

// Hora del día en formato "HH:MM" (24 h), por ejemplo "07:30".
export type Hora = string;

// Día de la semana con lunes = 0 y domingo = 6 (igual que services/fechas.ts).
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Perfil = {
  nombre: string;
  vivienda: Lugar; // municipio o barrio
  sitios: SitioHabitual[];
  transporte: Transporte;
  uso: Uso;
  horario: {
    levantarse: Hora;
    acostarse: Hora;
    empiezoTrabajo: Hora;
    terminoTrabajo: Hora;
    diasTrabajo: DiaSemana[];
  };
  rindeMas: MomentoDelDia;
  antelacionAvisoMin: AntelacionAviso;
  // Dónde trabaja o estudia, para saber sus festivos (services/festivos). Opcional:
  // los perfiles de antes no lo tienen.
  festivos?: ZonaFestivos | null;
};

export type EstadoPerfil = {
  cargado: boolean; // false mientras se lee del dispositivo al arrancar
  perfil: Perfil | null;
  bienvenidaCompletada: boolean;
};

const CLAVE_PERFIL = 'perfil';
const CLAVE_BIENVENIDA = 'bienvenidaCompletada';

// Copia en memoria para que todas las pantallas vean el mismo perfil al momento.
let estado: EstadoPerfil = { cargado: false, perfil: null, bienvenidaCompletada: false };
let cargando: Promise<EstadoPerfil> | null = null;
const oyentes = new Set<() => void>();

function cambiarEstado(nuevo: EstadoPerfil) {
  estado = nuevo;
  oyentes.forEach((avisar) => avisar());
}

// Lee el perfil del dispositivo (solo la primera vez; después usa la copia en memoria).
export function cargarPerfil(): Promise<EstadoPerfil> {
  if (!cargando) {
    cargando = (async () => {
      const [perfil, bienvenidaCompletada] = await Promise.all([
        leerAjuste<Perfil | null>(CLAVE_PERFIL, null),
        leerAjuste<boolean>(CLAVE_BIENVENIDA, false),
      ]);
      cambiarEstado({ cargado: true, perfil, bienvenidaCompletada });
      return estado;
    })();
  }
  // Siempre el estado actual (no el del momento de la primera lectura).
  return cargando.then(() => estado);
}

export async function leerPerfil(): Promise<Perfil | null> {
  return (await cargarPerfil()).perfil;
}

export async function guardarPerfil(perfil: Perfil): Promise<void> {
  await guardarAjuste(CLAVE_PERFIL, perfil);
  cambiarEstado({ ...estado, perfil });
}

// Guarda el perfil y marca la bienvenida como hecha: ya no vuelve a salir.
export async function completarBienvenida(perfil: Perfil): Promise<void> {
  await guardarAjuste(CLAVE_PERFIL, perfil);
  await guardarAjuste(CLAVE_BIENVENIDA, true);
  cambiarEstado({ ...estado, perfil, bienvenidaCompletada: true });
}

// Vuelve a mostrar la bienvenida (para probarla). Conserva los datos para
// que el formulario salga relleno.
export async function repetirBienvenida(): Promise<void> {
  await guardarAjuste(CLAVE_BIENVENIDA, false);
  cambiarEstado({ ...estado, bienvenidaCompletada: false });
}

function suscribirse(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

// Para la lógica sin pantallas (por ejemplo, reprogramar los avisos al cambiar el perfil).
export { suscribirse as suscribirsePerfil };

function leerEstado() {
  return estado;
}


// Hook para usar el perfil en pantallas. Se vuelve a pintar cuando cambia.
export function usePerfil(): EstadoPerfil {
  return useSyncExternalStore(suscribirse, leerEstado, leerEstado);
}
