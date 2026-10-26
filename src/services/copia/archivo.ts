import { reloadAppAsync } from 'expo';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// El archivo de la copia en el móvil: se escribe en la caché de la app y se abre el
// menú de compartir del sistema ("Guardar en Archivos", iCloud Drive, correo...).
// En la web se usa archivo.web.ts, con las mismas funciones.

export type ResultadoGuardar = 'compartido' | 'descargado' | 'cancelado' | 'no-disponible';

export async function guardarArchivo(nombre: string, texto: string): Promise<ResultadoGuardar> {
  if (!(await Sharing.isAvailableAsync())) return 'no-disponible';
  const archivo = new File(Paths.cache, nombre);
  archivo.create({ overwrite: true });
  await archivo.write(texto);
  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Guardar la copia',
  });
  return 'compartido';
}

// Abre el selector de archivos y devuelve el texto del elegido (null si se cancela).
export async function elegirArchivo(): Promise<string | null> {
  // Cualquier tipo: si la copia llegó por correo o WhatsApp puede no venir como JSON.
  // Lo que no sea una copia lo rechaza leerCopia.
  const resultado = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (resultado.canceled) return null;
  return new File(resultado.assets[0].uri).text();
}

export async function reiniciarApp(): Promise<void> {
  await reloadAppAsync('Copia recuperada');
}
