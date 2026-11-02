import * as DocumentPicker from 'expo-document-picker';

// Elegir los apuntes en PDF para medirlos con la IA (services/epoca/ia.ts >
// medirApuntesConIA). Se leen en base64 para mandarlos tal cual.

export const MAX_PDF_MB = 10;

export type PdfElegido = { nombre: string; base64: string } | 'grande' | null;

export async function elegirPdf(): Promise<PdfElegido> {
  const resultado = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', base64: false });
  if (resultado.canceled) return null;
  const elegido = resultado.assets[0];
  if ((elegido.size ?? elegido.file?.size ?? 0) > MAX_PDF_MB * 1024 * 1024) return 'grande';
  const archivo = elegido.file ?? (await (await fetch(elegido.uri)).blob());
  const base64 = await new Promise<string>((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(archivo);
  });
  return { nombre: elegido.name, base64 };
}
