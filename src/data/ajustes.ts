import AsyncStorage from '@react-native-async-storage/async-storage';

// Guardado de ajustes sencillos (valores pequeños) con AsyncStorage.
// Cada ajuste se guarda como JSON bajo una clave con el prefijo "organizy:".

const PREFIJO = 'organizy:';

// Quien quiera enterarse de que algo ha cambiado (la copia en la nube, para subirlo).
const oyentes = new Set<(clave: string) => void>();

export function suscribirseAjustes(oyente: (clave: string) => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export async function leerAjuste<T>(clave: string, porDefecto: T): Promise<T> {
  try {
    const texto = await AsyncStorage.getItem(PREFIJO + clave);
    return texto === null ? porDefecto : (JSON.parse(texto) as T);
  } catch {
    return porDefecto;
  }
}

export async function guardarAjuste<T>(clave: string, valor: T): Promise<void> {
  await AsyncStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  oyentes.forEach((avisar) => avisar(clave));
}

export async function borrarAjuste(clave: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIJO + clave);
  oyentes.forEach((avisar) => avisar(clave));
}
