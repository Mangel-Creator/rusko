import { sumarDias, type ClaveDia } from '@/services/fechas';

import type { Evento } from './tipos';

// Eventos de ejemplo para probar Hoy y Semana. Se crean alrededor de "hoy"
// y llevan ejemplo = true para poder borrarlos todos desde Perfil.

type Datos = Pick<Evento, 'titulo' | 'tipo'> & Partial<Evento>;

export function crearEjemplos(hoy: ClaveDia): Evento[] {
  const dia = (n: number) => sumarDias(hoy, n);
  const base = (n: number, datos: Datos): Evento => ({
    id: `ejemplo-${n}-${Math.random().toString(36).slice(2, 8)}`,
    fecha: hoy,
    horaInicio: null,
    horaFin: null,
    lugar: null,
    notas: '',
    repeticion: 'nunca',
    flexible: false,
    duracionMin: null,
    hecha: false,
    foco: false,
    avisoMin: null,
    ejemplo: true,
    ...datos,
  });
  const fijo = (n: number, fecha: ClaveDia, inicio: string, fin: string, datos: Datos) =>
    base(n, { ...datos, fecha, horaInicio: inicio, horaFin: fin });
  const tarea = (n: number, titulo: string, duracionMin: number, fecha = hoy) =>
    base(n, { titulo, tipo: 'yo', flexible: true, duracionMin, fecha });

  return [
    // Hoy
    fijo(1, hoy, '09:30', '10:30', {
      titulo: 'Reunión con Laura',
      tipo: 'cliente',
      lugar: { tipo: 'otro', direccion: 'Calle Mayor 12, Madrid', coordenadas: null },
    }),
    fijo(2, hoy, '11:00', '13:00', { titulo: 'Preparar la propuesta', tipo: 'yo', foco: true }),
    fijo(3, hoy, '15:00', '16:00', { titulo: 'Visita a obra con Andrés', tipo: 'cliente' }),
    fijo(4, hoy, '21:00', '23:00', {
      titulo: 'Cena con Marta y Jorge',
      tipo: 'amigos',
      lugar: { tipo: 'casa' },
      notas: 'Cenamos en casa. Traen el postre.',
    }),
    // Mañana: día bastante lleno
    fijo(5, dia(1), '08:30', '10:30', { titulo: 'Bloque de foco: facturas', tipo: 'yo', foco: true }),
    fijo(6, dia(1), '10:30', '13:30', { titulo: 'Taller con cliente', tipo: 'cliente' }),
    fijo(7, dia(1), '15:00', '18:30', { titulo: 'Revisión del proyecto', tipo: 'cliente' }),
    // Pasado mañana: tranquilo
    fijo(8, dia(2), '19:00', '20:30', { titulo: 'Pádel con los del barrio', tipo: 'amigos' }),
    // Cada semana, a partir de hoy
    fijo(9, hoy, '07:30', '08:30', { titulo: 'Gimnasio', tipo: 'entreno', repeticion: 'semanal' }),
    // Tareas flexibles
    tarea(10, 'Llamar al taller', 15),
    tarea(11, 'Pagar el recibo de la luz', 15),
    tarea(12, 'Preparar presupuesto de la reforma', 60),
    tarea(13, 'Comprar el regalo de Lucía', 30),
    tarea(14, 'Pedir cita en el dentista', 15, dia(1)),
  ];
}
