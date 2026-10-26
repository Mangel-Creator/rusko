import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

// Permisos que pide la app en la bienvenida: ubicación y notificaciones.
// Si el usuario dice que no, la app sigue funcionando y se pueden activar
// más tarde desde Perfil. El micrófono y los contactos se pedirán en su fase.

export type EstadoPermiso =
  | 'concedido'
  | 'denegado' // se puede volver a preguntar
  | 'bloqueado' // hay que activarlo en los Ajustes del teléfono
  | 'sin-preguntar'
  | 'no-disponible'; // por ejemplo, notificaciones en el navegador

export type Permiso = 'ubicacion' | 'notificaciones';

type Respuesta = { granted: boolean; status: string; canAskAgain: boolean };

function traducir(respuesta: Respuesta): EstadoPermiso {
  if (respuesta.granted) return 'concedido';
  if (respuesta.status === 'undetermined') return 'sin-preguntar';
  return respuesta.canAskAgain ? 'denegado' : 'bloqueado';
}

export const esWeb = Platform.OS === 'web';

// En la web, las notificaciones van con Web Push (26/10/2026) y se activan solo desde
// Perfil > Avisos, con su propio botón (services/avisos/push.web.ts): no salen en la
// bienvenida ni en Permisos.
const notificacionesDisponibles = !esWeb;

// Permisos que tiene sentido pedir o mostrar en este dispositivo.
export const PERMISOS_DISPONIBLES: Permiso[] = notificacionesDisponibles
  ? ['ubicacion', 'notificaciones']
  : ['ubicacion'];

// El permiso de avisos del navegador, si este navegador puede recibirlos.
function permisoNavegador(): EstadoPermiso {
  if (typeof window === 'undefined' || !('Notification' in window) || !('PushManager' in window)) {
    return 'no-disponible';
  }
  const permiso = window.Notification.permission;
  return permiso === 'granted' ? 'concedido' : permiso === 'denied' ? 'bloqueado' : 'sin-preguntar';
}

export async function consultarPermiso(permiso: Permiso): Promise<EstadoPermiso> {
  try {
    if (permiso === 'ubicacion') {
      return traducir(await Location.getForegroundPermissionsAsync());
    }
    if (!notificacionesDisponibles) return permisoNavegador();
    return traducir(await Notifications.getPermissionsAsync());
  } catch {
    return 'no-disponible';
  }
}

export async function pedirPermiso(permiso: Permiso): Promise<EstadoPermiso> {
  try {
    if (permiso === 'ubicacion') {
      return traducir(await Location.requestForegroundPermissionsAsync());
    }
    if (!notificacionesDisponibles) return 'no-disponible';
    return traducir(await Notifications.requestPermissionsAsync());
  } catch {
    return 'no-disponible';
  }
}

// Abre los Ajustes del teléfono en la página de la app (para permisos bloqueados).
export function abrirAjustesDelTelefono(): Promise<void> {
  return Linking.openSettings();
}
