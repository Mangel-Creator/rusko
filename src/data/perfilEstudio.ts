import type { Epoca, RegistroBloque } from '@/data/epocas/tipos';
import { conRecuentos, normalizarPerfilEstudio, type PerfilEstudio } from '@/services/epoca/perfilEstudio';

import { guardarAjuste, leerAjuste } from './ajustes';

// "organizy:perfilEstudio": cómo estudia la persona y lo que Rusko ha aprendido de sus
// planes (services/epoca/perfilEstudio.ts). Viaja en la copia de seguridad.
const CLAVE = 'perfilEstudio';

export async function leerPerfilEstudio(): Promise<PerfilEstudio> {
  return normalizarPerfilEstudio(await leerAjuste<unknown>(CLAVE, null));
}

export async function guardarPerfilEstudio(perfil: PerfilEstudio): Promise<void> {
  await guardarAjuste(CLAVE, perfil);
}

// Antes de borrar una época se apunta lo que se hizo en ella, para no perderlo.
export async function apuntarRecuentos(epocas: Epoca[], registro: RegistroBloque[]): Promise<void> {
  await guardarPerfilEstudio(conRecuentos(await leerPerfilEstudio(), epocas, registro));
}
