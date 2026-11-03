import type { Opcion, OpcionVisual } from '@/components';
import type { Descanso, Dificultad, TipoEpoca } from '@/data/epocas';
import type { MomentoDelDia } from '@/data/perfil';

// Textos y opciones de la Época dorada.

export const OPCIONES_TIPO_EPOCA: Opcion<TipoEpoca>[] = [
  { valor: 'examenes', etiqueta: 'Exámenes' },
  { valor: 'entregas', etiqueta: 'Entregas' },
  { valor: 'trabajo', etiqueta: 'Trabajo intenso' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const OPCIONES_DESCANSO: Opcion<Descanso>[] = [
  { valor: '25-5', etiqueta: '25 + 5 min' },
  { valor: '50-10', etiqueta: '50 + 10 min' },
  { valor: '90-15', etiqueta: '90 + 15 min' },
];

export const OPCIONES_DIFICULTAD: Opcion<Dificultad>[] = [
  { valor: 'facil', etiqueta: 'Fácil' },
  { valor: 'media', etiqueta: 'Media' },
  { valor: 'dificil', etiqueta: 'Difícil' },
];

export const OPCIONES_MOMENTO_EPOCA: Opcion<MomentoDelDia>[] = [
  { valor: 'manana', etiqueta: 'Mañana' },
  { valor: 'tarde', etiqueta: 'Tarde' },
  { valor: 'noche', etiqueta: 'Noche' },
];

export const OPCIONES_TRAYECTO: Opcion<'10' | '20' | '30' | '45' | '60'>[] = [
  { valor: '10', etiqueta: '10 min' },
  { valor: '20', etiqueta: '20 min' },
  { valor: '30', etiqueta: '30 min' },
  { valor: '45', etiqueta: '45 min' },
  { valor: '60', etiqueta: '1 hora' },
];

// Versiones con icono para el formulario corto (casillas grandes, sin leer).
export const OPCIONES_TIPO_VISUAL: OpcionVisual<TipoEpoca>[] = [
  { valor: 'examenes', etiqueta: 'Exámenes', icono: 'school-outline' },
  { valor: 'entregas', etiqueta: 'Entregas', icono: 'document-text-outline' },
  { valor: 'trabajo', etiqueta: 'Trabajo intenso', icono: 'briefcase-outline' },
  { valor: 'otro', etiqueta: 'Otra cosa', icono: 'sparkles-outline' },
];

export const OPCIONES_MOMENTO_VISUAL: OpcionVisual<MomentoDelDia>[] = [
  { valor: 'manana', etiqueta: 'Mañana', icono: 'sunny-outline' },
  { valor: 'tarde', etiqueta: 'Tarde', icono: 'partly-sunny-outline' },
  { valor: 'noche', etiqueta: 'Noche', icono: 'moon-outline' },
];

// Con el examen aún lejos: a qué hora y cuánto (lo mismo que pregunta el cuestionario).
export const OPCIONES_LEJOS: Opcion<'igual' | MomentoDelDia>[] = [
  { valor: 'igual', etiqueta: 'A la misma' },
  ...OPCIONES_MOMENTO_VISUAL.map(({ valor, etiqueta }) => ({ valor, etiqueta })),
];

export const OPCIONES_CARGA_LEJOS: Opcion<'todo' | '0.75' | '0.6'>[] = [
  { valor: 'todo', etiqueta: 'Todo' },
  { valor: '0.75', etiqueta: 'Un poco menos' },
  { valor: '0.6', etiqueta: 'Bastante menos' },
];

export const OPCIONES_COMIDA: Opcion<'90' | '120'>[] = [
  { valor: '90', etiqueta: '1 h 30' },
  { valor: '120', etiqueta: '2 h' },
];

export const OPCIONES_DIFICULTAD_VISUAL: OpcionVisual<Dificultad>[] = [
  { valor: 'facil', etiqueta: 'Fácil', icono: 'flame-outline', veces: 1 },
  { valor: 'media', etiqueta: 'Media', icono: 'flame-outline', veces: 2 },
  { valor: 'dificil', etiqueta: 'Difícil', icono: 'flame-outline', veces: 3 },
];

export const NOMBRE_TIPO: Record<TipoEpoca, string> = {
  examenes: 'Exámenes',
  entregas: 'Entregas',
  trabajo: 'Trabajo intenso',
  otro: 'Otro',
};

export const DESCANSO_TEXTO: Record<Descanso, string> = {
  '25-5': 'bloques de 25 min + 5 de descanso',
  '50-10': 'bloques de 50 min + 10 de descanso',
  '90-15': 'bloques de 90 min + 15 de descanso',
};

export const NOMBRE_DIFICULTAD: Record<Dificultad, string> = {
  facil: 'fácil',
  media: 'media',
  dificil: 'difícil',
};

export const NOMBRES_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

// 4 -> "4 h", 1.5 -> "1,5 h"
export function formatoHoras(horas: number): string {
  return `${String(horas).replace('.', ',')} h`;
}
