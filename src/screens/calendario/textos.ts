import type Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import type { Opcion } from '@/components';
import type { Evento, Repeticion, TipoEvento } from '@/data/eventos';
import type { Energia } from '@/services/agenda';
import { PREFIJO_EPOCA } from '@/services/epoca';
import type { ClaveDia } from '@/services/fechas';

// Textos y atajos compartidos por Hoy, Semana y la ficha de evento.

// Icono de cada tipo: el mismo en las casillas de Hoy, las filas y la ficha.
export const ICONO_TIPO: Record<TipoEvento, ComponentProps<typeof Ionicons>['name']> = {
  cliente: 'briefcase-outline',
  amigos: 'people-outline',
  yo: 'person-outline',
};

export const OPCIONES_TIPO: Opcion<TipoEvento>[] = [
  { valor: 'cliente', etiqueta: 'Cliente' },
  { valor: 'amigos', etiqueta: 'Amigos' },
  { valor: 'yo', etiqueta: 'Yo' },
];

export const OPCIONES_REPETICION: Opcion<Repeticion>[] = [
  { valor: 'nunca', etiqueta: 'No se repite' },
  { valor: 'diaria', etiqueta: 'Cada día' },
  { valor: 'semanal', etiqueta: 'Cada semana' },
  { valor: 'mensual', etiqueta: 'Cada mes' },
];

export const OPCIONES_DURACION: Opcion<'15' | '30' | '60' | '120'>[] = [
  { valor: '15', etiqueta: '15 min' },
  { valor: '30', etiqueta: '30 min' },
  { valor: '60', etiqueta: '1 h' },
  { valor: '120', etiqueta: '2 h' },
];

// Antelación del aviso de un evento. "0" = sin aviso.
export const OPCIONES_AVISO: Opcion<'10' | '30' | '60' | '0'>[] = [
  { valor: '10', etiqueta: '10 min' },
  { valor: '30', etiqueta: '30 min' },
  { valor: '60', etiqueta: '1 hora' },
  { valor: '0', etiqueta: 'Sin aviso' },
];

export const OPCIONES_ENERGIA: Opcion<Energia>[] = [
  { valor: 'a-tope', etiqueta: 'A tope' },
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'tranqui', etiqueta: 'Tranqui' },
];

// "09:30 – 10:30"
export function rangoHoras(evento: Evento): string {
  return `${evento.horaInicio ?? ''} – ${evento.horaFin ?? ''}`;
}

export function abrirEvento(id: string) {
  // Lo que viene de la Época dorada (bloques y cosas que no quiere dejar de
  // hacer) no son eventos guardados: se abre la sección de la época.
  if (id.startsWith(PREFIJO_EPOCA)) {
    router.push('/epoca');
    return;
  }
  router.push({ pathname: '/evento', params: { id } });
}

export function nuevoEvento(fecha: ClaveDia) {
  router.push({ pathname: '/evento', params: { fecha } });
}
