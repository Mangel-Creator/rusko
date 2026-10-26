import { asegurarSesion, obtenerSupabase } from '@/data/supabase';
import { esWebDeIphone } from '@/services/alarmas/atajo';

// Avisos con sonido en la web (Web Push, 26/10/2026).
//
// Con la web añadida a la pantalla de inicio (en iPhone, iOS 16.4 o más), el navegador
// puede recibir avisos con la web cerrada. Cómo:
//   1. Un service worker (public/sw.js) recibe el aviso y lo enseña con el sonido normal.
//   2. Al tocar "Activar avisos" se pide el permiso y el navegador da una "suscripción"
//      (a qué dirección de Apple o Google mandar los avisos), que se guarda en Supabase.
//   3. programar.web.ts sube los avisos de los próximos 7 días y la función avisos-web
//      los manda a su hora (pg_cron, cada minuto).
// En el móvil (app) no se usa: push.ts.

export type SoportePush =
  | 'si'
  | 'instalar' // iPhone en Safari: solo funciona con la web en la pantalla de inicio
  | 'no'; // este navegador no puede

export function soportePush(): SoportePush {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'no';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'si';
  return esWebDeIphone() ? 'instalar' : 'no';
}

// "/organizy/" en la web publicada y "/" en el ordenador (localhost).
function raiz(): string {
  return location.pathname.startsWith('/organizy') ? '/organizy/' : '/';
}

let registro: Promise<ServiceWorkerRegistration | null> | null = null;

// Se registra al arrancar. El service worker no guarda nada en caché: solo atiende avisos.
export function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!registro) {
    registro =
      soportePush() === 'si'
        ? navigator.serviceWorker.register(`${raiz()}sw.js`, { scope: raiz() }).catch(() => null)
        : Promise.resolve(null);
  }
  return registro;
}

async function servidor() {
  const supabase = obtenerSupabase();
  if (!supabase) return null;
  await asegurarSesion(supabase);
  return supabase;
}

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T | null> {
  const supabase = await servidor();
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke('avisos-web', { body: cuerpo, timeout: 20000 });
  if (error) throw error;
  return data as T;
}

let clave: string | null = null;

// Se pide la clave pública antes de tocar el botón: en el iPhone, el permiso y la
// suscripción tienen que ir justo después del toque, sin esperas por medio.
export async function prepararPush(): Promise<void> {
  if (clave || soportePush() !== 'si') return;
  await registrarServiceWorker();
  clave = (await llamar<{ clave: string }>({ accion: 'clave' }).catch(() => null))?.clave ?? null;
}

function bytesDeClave(valor: string): Uint8Array<ArrayBuffer> {
  const normal = valor.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export type EstadoPush = { permiso: NotificationPermission; suscrito: boolean };

export async function estadoPush(): Promise<EstadoPush> {
  if (soportePush() !== 'si') return { permiso: 'denied', suscrito: false };
  const reg = await registrarServiceWorker();
  const suscripcion = await reg?.pushManager.getSubscription().catch(() => null);
  return { permiso: Notification.permission, suscrito: Boolean(suscripcion) };
}

export type ResultadoActivar = 'ok' | 'denegado' | 'sin-servidor' | 'error';

// Lo llama el botón "Activar avisos". El permiso se pide lo primero, sin esperar a
// nada antes: Safari solo lo deja justo después de un toque.
export async function activarPush(): Promise<ResultadoActivar> {
  if (soportePush() !== 'si') return 'error';
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return 'denegado';
  try {
    const reg = await registrarServiceWorker();
    if (!reg) return 'error';
    await navigator.serviceWorker.ready;
    if (!clave) await prepararPush();
    if (!clave) return 'sin-servidor';
    let suscripcion = await reg.pushManager.getSubscription();
    if (!suscripcion) {
      suscripcion = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytesDeClave(clave),
      });
    }
    const respuesta = await llamar<{ ok: boolean }>({ accion: 'suscribir', suscripcion: suscripcion.toJSON() });
    return respuesta?.ok ? 'ok' : 'sin-servidor';
  } catch {
    return 'error';
  }
}

// Deja de mandar avisos a este navegador.
export async function desactivarPush(): Promise<void> {
  const reg = await registrarServiceWorker();
  const suscripcion = await reg?.pushManager.getSubscription().catch(() => null);
  if (!suscripcion) return;
  await llamar({ accion: 'quitar', endpoint: suscripcion.endpoint }).catch(() => null);
  await suscripcion.unsubscribe().catch(() => false);
}

export type AvisoServidor = { id: string; cuando: string; titulo: string; cuerpo: string; url: string };

export async function programarEnServidor(avisos: AvisoServidor[]): Promise<number | null> {
  const respuesta = await llamar<{ programados: number }>({ accion: 'programar', avisos });
  return respuesta?.programados ?? null;
}

// Manda un aviso ahora mismo, para probar que llegan. Devuelve a cuántos navegadores.
export async function pruebaEnServidor(aviso?: Omit<AvisoServidor, 'id' | 'cuando'>): Promise<number> {
  const respuesta = await llamar<{ enviados: number }>({ accion: 'prueba', aviso });
  return respuesta?.enviados ?? 0;
}
