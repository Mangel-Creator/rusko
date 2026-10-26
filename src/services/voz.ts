import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

// Voz de la app (lee la respuesta a "¿qué tengo el miércoles?"). En el móvil usa la voz
// del sistema (expo-speech, incluida en Expo Go) y en la web la del navegador
// (voz.web.ts). En español de España.
//
// En el iPhone se pide sonar aunque el interruptor de silencio esté puesto y bajar un
// poco la música mientras habla.

let preparada: Promise<void> | null = null;

function preparar(): Promise<void> {
  if (!preparada) {
    preparada = setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
  }
  return preparada;
}

// Dice el texto, cortando lo que estuviera diciendo. "alTerminar" se llama al acabar
// o al callarla.
export async function hablar(texto: string, alTerminar?: () => void): Promise<void> {
  await preparar();
  Speech.stop();
  Speech.speak(texto, { language: 'es-ES', onDone: alTerminar, onStopped: alTerminar, onError: alTerminar });
}

export function callar(): void {
  Speech.stop();
}
