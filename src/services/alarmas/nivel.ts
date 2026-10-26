import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { AlarmScheduler } from 'react-native-alarm-scheduler';

// Qué alarmas puede poner la app aquí (fase 7). Una misma pestaña, tres niveles:
//   - "nativo": app propia (build de EAS) con alarmas de verdad: AlarmKit en iPhone con
//     iOS 26 o más, y AlarmManager con pantalla completa en Android. Suenan con el
//     móvil bloqueado y en silencio.
//   - "avisos": Expo Go, un iPhone con iOS anterior al 26 o sin permiso de alarmas.
//     Son avisos con sonido (services/avisos): con el móvil en silencio no suenan.
//   - "web": ni alarmas ni avisos (nivel.web.ts). Un Atajo las pasa cada noche al Reloj del
//     iPhone (services/alarmas/atajo.ts y reloj.ts).

export type NivelAlarmas = 'nativo' | 'avisos' | 'web';

export type ModuloAlarmas = typeof AlarmScheduler;

let modulo: ModuloAlarmas | null | undefined;

// El módulo nativo de react-native-alarm-scheduler. En Expo Go no existe: null.
// No se importa la librería directamente porque al importarla falla si no está.
export function moduloAlarmas(): ModuloAlarmas | null {
  if (modulo === undefined) {
    try {
      modulo = requireOptionalNativeModule<ModuloAlarmas>('AlarmScheduler');
    } catch {
      modulo = null;
    }
  }
  return modulo;
}

function versionIos(): number {
  const v = Platform.Version;
  return typeof v === 'string' ? parseFloat(v) : v;
}

// Lo que permite el móvil, sin contar el permiso (ver nativo.ts > nivelEfectivo).
export function nivelPosible(): NivelAlarmas {
  if (!moduloAlarmas()) return 'avisos';
  if (Platform.OS === 'ios' && versionIos() < 26) return 'avisos';
  return 'nativo';
}
