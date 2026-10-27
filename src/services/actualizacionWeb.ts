import { Platform } from 'react-native';

// La web se actualiza sola.
// GitHub Pages deja que el navegador guarde la página 10 minutos, así que al abrir
// la web se podría ver una versión vieja. Para evitarlo, al abrirla (y al volver
// a ella tras un rato fuera) se pide la página de inicio sin caché y se compara el
// nombre del archivo principal de la app, que cambia con cada versión publicada.
// Si es distinto, se recarga. En el móvil (app) y en desarrollo no hace nada.

const MIN_FUERA_MS = 30_000; // al volver tras 30 s fuera, se vuelve a comprobar
const CLAVE_INTENTO = 'organizy:recargaPorVersion'; // evita recargar en bucle

// Nombre del archivo principal que está usando esta página, por ejemplo
// "/rusko/_expo/static/js/web/entry-209db….js". null en desarrollo.
function archivoActual(): string | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'));
  const principal = scripts.find((s) => /\/_expo\/static\/js\/web\/entry-[^/]+\.js$/.test(s.src));
  return principal ? new URL(principal.src).pathname : null;
}

async function comprobar(actual: string) {
  const raiz = actual.slice(0, actual.indexOf('_expo/')); // "/rusko/"
  try {
    const respuesta = await fetch(raiz, { cache: 'no-store' });
    if (!respuesta.ok) return;
    const html = await respuesta.text();
    const nuevo = html.match(/src="([^"]*\/_expo\/static\/js\/web\/entry-[^"]+\.js)"/)?.[1];
    if (!nuevo || new URL(nuevo, location.href).pathname === actual) return;

    // Solo un intento por versión: si tras recargar sigue la vieja, no se insiste.
    if (sessionStorage.getItem(CLAVE_INTENTO) === nuevo) return;
    sessionStorage.setItem(CLAVE_INTENTO, nuevo);
    location.reload();
  } catch {
    // Sin conexión o sessionStorage bloqueado: se sigue con la versión que hay.
  }
}

export function vigilarActualizacionesWeb(): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {};
  const actual = archivoActual();
  if (!actual) return () => {};

  comprobar(actual);

  let ocultaDesde = 0;
  const alCambiarVisibilidad = () => {
    if (document.visibilityState === 'hidden') {
      ocultaDesde = Date.now();
    } else if (ocultaDesde && Date.now() - ocultaDesde > MIN_FUERA_MS) {
      comprobar(actual);
    }
  };
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  return () => document.removeEventListener('visibilitychange', alCambiarVisibilidad);
}
