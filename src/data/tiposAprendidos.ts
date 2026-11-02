import type { TipoEvento } from '@/data/eventos/tipos';
import { aprenderTipo, type TiposAprendidos } from '@/services/captura/aprendido';

import { guardarAjuste, leerAjuste } from './ajustes';

// "organizy:tiposAprendidos": título de la captura -> tipo que elegiste al corregirlo
// (services/captura/aprendido.ts). Viaja en la copia de seguridad.
const CLAVE = 'tiposAprendidos';

export async function leerTiposAprendidos(): Promise<TiposAprendidos> {
  const mapa = await leerAjuste<TiposAprendidos>(CLAVE, {});
  return mapa && typeof mapa === 'object' && !Array.isArray(mapa) ? mapa : {};
}

export async function apuntarTipoAprendido(titulo: string, tipo: TipoEvento): Promise<void> {
  await guardarAjuste(CLAVE, aprenderTipo(await leerTiposAprendidos(), titulo, tipo));
}
