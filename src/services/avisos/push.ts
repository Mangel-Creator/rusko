// Avisos web (Web Push): solo existen en la web (push.web.ts). En el móvil los avisos
// son locales (programar.ts), así que aquí no hay nada que hacer.

export type SoportePush = 'si' | 'instalar' | 'no';
export type EstadoPush = { permiso: 'default' | 'granted' | 'denied'; suscrito: boolean };
export type ResultadoActivar = 'ok' | 'denegado' | 'sin-servidor' | 'error';

export function soportePush(): SoportePush {
  return 'no';
}

export async function registrarServiceWorker(): Promise<null> {
  return null;
}

export async function prepararPush(): Promise<void> {}

export async function estadoPush(): Promise<EstadoPush> {
  return { permiso: 'denied', suscrito: false };
}

export async function activarPush(): Promise<ResultadoActivar> {
  return 'error';
}

export async function desactivarPush(): Promise<void> {}

export type AvisoServidor = { id: string; cuando: string; titulo: string; cuerpo: string; url: string };

export async function programarEnServidor(_avisos: AvisoServidor[]): Promise<number | null> {
  return null;
}

export async function pruebaEnServidor(_aviso?: Omit<AvisoServidor, 'id' | 'cuando'>): Promise<number> {
  return 0;
}
