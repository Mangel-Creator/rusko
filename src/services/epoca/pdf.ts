import * as DocumentPicker from 'expo-document-picker';

// Elegir los apuntes en PDF para medirlos. Primero se leen en el dispositivo
// (leerPdf.ts); solo si son fotos escaneadas se mandan enteros en base64.

// Para leerlo aquí; para mandarlo entero a la IA, MAX_PDF_MB.
export const MAX_LEER_MB = 60;
export const MAX_PDF_MB = 10;

export type PdfElegido = { nombre: string; archivo: Blob } | 'grande' | null;

export async function elegirPdf(): Promise<PdfElegido> {
  const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', base64: false });
  if (resultado.canceled) return null;
  const elegido = resultado.assets[0];
  if ((elegido.size ?? elegido.file?.size ?? 0) > MAX_LEER_MB * 1024 * 1024) return 'grande';
  const archivo = elegido.file ?? (await (await fetch(elegido.uri)).blob());
  return { nombre: elegido.name, archivo };
}

export function aBase64(archivo: Blob): Promise<string> {
  return new Promise<string>((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(archivo);
  });
}
