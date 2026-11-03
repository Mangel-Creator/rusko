import { useSyncExternalStore } from 'react';

import type { TipoEvento } from '@/data/eventos/tipos';
import { colorBaldosa, colores, colorTipo } from '@/theme';

import { guardarAjuste, leerAjuste } from './ajustes';

// Color de cada tipo de evento a gusto de la persona (03/11/2026, lo pidió el usuario).
// Se elige en Perfil > "Cómo se ve" y se guarda en "organizy:coloresTipo" (viaja en la
// copia). Lo no elegido sale con el color del tema.
//
//   const { colorTipo, colorBaldosa } = useColoresTipo();   (se actualiza sola)

export type ColoresElegidos = Partial<Record<TipoEvento, string>>;

// Colores entre los que elegir: se leen bien sobre fondo oscuro y ninguno se confunde
// con el naranja de pulsar, el rojo de aviso ni el dorado de la Época.
export const PALETA_TIPOS: readonly { color: string; nombre: string }[] = [
  { color: '#9C8BFF', nombre: 'Violeta' },
  { color: '#D08CFF', nombre: 'Lila' },
  { color: '#FF6FB5', nombre: 'Rosa' },
  { color: '#FF9E80', nombre: 'Salmón' },
  { color: '#F2E25C', nombre: 'Amarillo' },
  { color: '#B5E655', nombre: 'Lima' },
  { color: '#2BC48A', nombre: 'Verde' },
  { color: '#7FE0C2', nombre: 'Menta' },
  { color: '#3FD0E0', nombre: 'Turquesa' },
  { color: '#8FD3FF', nombre: 'Celeste' },
  { color: '#5B9BFF', nombre: 'Azul' },
  { color: '#D9D1C7', nombre: 'Arena' },
];

type Baldosa = { fondo: string; icono: string };

// Fondo del icono redondo: el color al 14 % sobre la tarjeta, como los del tema.
export function baldosaDe(color: string): Baldosa {
  const canal = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mezcla = [0, 1, 2]
    .map((i) => Math.round(canal(colores.tarjeta, i) * 0.86 + canal(color, i) * 0.14))
    .map((n) => n.toString(16).padStart(2, '0').toUpperCase())
    .join('');
  return { fondo: `#${mezcla}`, icono: color };
}

export function combinarColores(elegidos: ColoresElegidos) {
  const tipos = { ...colorTipo } as Record<TipoEvento, string>;
  const baldosas = { ...colorBaldosa } as Record<keyof typeof colorBaldosa, Baldosa>;
  for (const tipo of Object.keys(colorTipo) as TipoEvento[]) {
    const color = elegidos[tipo];
    if (!color || !/^#[0-9A-F]{6}$/i.test(color) || color === colorTipo[tipo]) continue;
    tipos[tipo] = color;
    baldosas[tipo] = baldosaDe(color);
  }
  return { colorTipo: tipos, colorBaldosa: baldosas };
}

const CLAVE = 'coloresTipo';

let elegidos: ColoresElegidos = {};
let actuales = combinarColores(elegidos);
let cargados = false;
const oyentes = new Set<() => void>();

function cambiar(nuevos: ColoresElegidos) {
  elegidos = nuevos;
  actuales = combinarColores(nuevos);
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  if (!cargados) {
    cargados = true;
    leerAjuste<ColoresElegidos>(CLAVE, {}).then((guardados) => {
      if (guardados && typeof guardados === 'object') cambiar(guardados);
    });
  }
  return () => {
    oyentes.delete(avisar);
  };
}

export function useColoresTipo() {
  return useSyncExternalStore(suscribir, () => actuales, () => actuales);
}

export async function guardarColorTipo(tipo: TipoEvento, color: string): Promise<void> {
  const nuevos = { ...elegidos, [tipo]: color };
  cambiar(nuevos);
  await guardarAjuste(CLAVE, nuevos);
}
