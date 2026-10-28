import { elegirVoz, trocearEnFrases } from './vozNatural';

// Voz de la app en la web: la del navegador (Web Speech API), en español de España y con
// la voz más natural que haya (vozNatural.ts). Si el navegador no tiene voz, no dice nada
// (la respuesta sigue escrita en pantalla).

// Un pelín más despacio que lo normal: suena más a alguien hablándote que a un lector.
const VELOCIDAD = 0.95;

function sintesis(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

// Chrome carga las voces tarde: la primera vez la lista llega vacía. Se espera un poco
// solo entonces; Safari las da al momento, así que no pierde el toque que le deja hablar.
function esperarVoces(sintesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolver) => {
    const listo = () => {
      sintesis.removeEventListener('voiceschanged', listo);
      resolver(sintesis.getVoices());
    };
    sintesis.addEventListener('voiceschanged', listo);
    setTimeout(listo, 800);
  });
}

// Dice el texto, cortando lo que estuviera diciendo. "alTerminar" se llama al acabar
// o al callarla.
export async function hablar(texto: string, alTerminar?: () => void): Promise<void> {
  const voz = sintesis();
  if (!voz) {
    alTerminar?.();
    return;
  }
  voz.cancel();
  const ya = voz.getVoices();
  const elegida = elegirVoz(ya.length > 0 ? ya : await esperarVoces(voz));
  const frases = trocearEnFrases(texto);
  let terminado = false;
  const acabar = () => {
    if (terminado) return;
    terminado = true;
    alTerminar?.();
  };
  if (frases.length === 0) {
    acabar();
    return;
  }
  frases.forEach((texto, i) => {
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = elegida?.lang ?? 'es-ES';
    if (elegida) frase.voice = elegida;
    frase.rate = VELOCIDAD;
    if (i === frases.length - 1) frase.onend = acabar;
    frase.onerror = acabar;
    voz.speak(frase);
  });
}

export function callar(): void {
  sintesis()?.cancel();
}
