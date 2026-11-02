import type { TipoEvento } from '@/data/eventos/tipos';

import type { Interpretacion } from './validar';

// Lo que Rusko aprende de tus correcciones (02/11/2026, lo pidió el usuario): si en la
// tarjeta de la captura cambias el tipo («Pádel» de Amigos a Entreno), la próxima vez que
// apuntes algo con ese mismo título ya sale con el tipo que elegiste. Sin IA: se guarda
// en el dispositivo (data/tiposAprendidos.ts) y viaja en la copia.

export type TiposAprendidos = Record<string, TipoEvento>;

// Como mucho tantos títulos: se olvidan los más antiguos.
export const MAX_APRENDIDOS = 200;

// «Pádel con Juan» y «padel con juan» son lo mismo.
export function claveTitulo(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function aprenderTipo(mapa: TiposAprendidos, titulo: string, tipo: TipoEvento): TiposAprendidos {
  const clave = claveTitulo(titulo);
  if (!clave) return mapa;
  const { [clave]: _anterior, ...resto } = mapa;
  // El último aprendido va al final; si se pasa del máximo, fuera los primeros.
  const entradas = [...Object.entries(resto), [clave, tipo] as const];
  return Object.fromEntries(entradas.slice(-MAX_APRENDIDOS));
}

export function aplicarAprendido(leido: Interpretacion, mapa: TiposAprendidos): Interpretacion {
  if (leido.accion !== 'apuntar') return leido;
  const tipo = mapa[claveTitulo(leido.propuesta.titulo)];
  return tipo ? { ...leido, propuesta: { ...leido.propuesta, tipo } } : leido;
}
