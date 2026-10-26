import { sumarDias, type ClaveDia } from '@/services/fechas';

import type { Epoca, RegistroBloque } from './tipos';

// Época dorada de ejemplo para probar la fase 4b: empezó hace 3 días, dura dos
// semanas más y tiene tres exámenes. Lleva ejemplo = true para poder borrarla
// desde Perfil. Incluye algunos bloques ya hechos para que se vea el progreso.

export function crearEpocaEjemplo(hoy: ClaveDia): { epoca: Epoca; registro: RegistroBloque[] } {
  const id = `ejemplo-epoca-${Math.random().toString(36).slice(2, 8)}`;
  const dia = (n: number) => sumarDias(hoy, n);
  const epoca: Epoca = {
    id,
    nombre: 'Exámenes de ejemplo',
    tipo: 'examenes',
    inicio: dia(-3),
    fin: dia(14),
    ritmo: {
      levantarse: '07:30',
      acostarse: '23:30',
      lugar: { tipo: 'otro', direccion: 'Biblioteca, Calle Mayor 5, Madrid', coordenadas: null },
      lugarPorDia: {},
      diasVas: [0, 1, 2, 3, 4],
      horasDia: 4,
      rindeMas: 'manana',
      descanso: '50-10',
      diaLibre: 6, // domingo
      trayectoMin: 20,
      imprescindibles: [
        { id: 'gimnasio', nombre: 'Gimnasio', dias: [0, 2, 4], horaInicio: '19:00', horaFin: '20:00' },
        { id: 'familia', nombre: 'Comer con la familia', dias: [5], horaInicio: '14:00', horaFin: '15:30' },
      ],
    },
    hitos: [
      {
        id: 'estadistica',
        nombre: 'Estadística',
        fecha: dia(4),
        hora: '09:00',
        lugar: { tipo: 'otro', direccion: 'Facultad de Económicas, Madrid', coordenadas: null },
        dificultad: 'dificil',
        horasPreparacion: 12,
      },
      {
        id: 'mercantil',
        nombre: 'Derecho mercantil',
        fecha: dia(8),
        hora: '10:00',
        lugar: null,
        dificultad: 'media',
        horasPreparacion: 8,
      },
      {
        id: 'ingles',
        nombre: 'Inglés',
        fecha: dia(13),
        hora: '16:00',
        lugar: null,
        dificultad: 'facil',
        horasPreparacion: 4,
      },
    ],
    avisos: { salir: true, inicioBloque: true, finDescanso: true, dormir: true },
    ejemplo: true,
    dorada: true,
    resumenVisto: false,
  };
  // Dos bloques hechos cada uno de los días anteriores (8:00 y 9:00).
  const registro: RegistroBloque[] = [-3, -2, -1].flatMap((n) =>
    [480, 540].map((inicio) => ({
      id: `${id}:${dia(n)}:${inicio}`,
      epocaId: id,
      hitoId: n === -1 && inicio === 540 ? 'mercantil' : 'estadistica',
      dia: dia(n),
      inicio,
      fin: inicio + 50,
      estado: 'hecho' as const,
    })),
  );
  return { epoca, registro };
}
