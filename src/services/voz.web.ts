// Voz de la app en la web: la del navegador (Web Speech API), en español de España.
// Si el navegador no tiene voz, no dice nada (la respuesta sigue escrita en pantalla).

function sintesis(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
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
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = 'es-ES';
  const espanola = voz.getVoices().find((v) => v.lang === 'es-ES') ?? voz.getVoices().find((v) => v.lang.startsWith('es'));
  if (espanola) frase.voice = espanola;
  frase.onend = () => alTerminar?.();
  frase.onerror = () => alTerminar?.();
  voz.speak(frase);
}

export function callar(): void {
  sintesis()?.cancel();
}
