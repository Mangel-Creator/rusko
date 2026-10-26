import type { LugarEvento } from '@/data/eventos/tipos';
import type { DiaSemana, Hora, MomentoDelDia } from '@/data/perfil';
import type { ClaveDia } from '@/services/fechas';

// Época dorada (fase 4b): un modo para épocas de exámenes o de trabajo intenso.
// Mientras dura, la app usa el ritmo de la época en vez del ritmo del perfil.
// La lógica (plan, progreso, cuenta atrás) está en services/epoca.

export type TipoEpoca = 'examenes' | 'entregas' | 'trabajo' | 'otro';

// Cómo le gusta descansar: minutos de trabajo + minutos de descanso.
export type Descanso = '25-5' | '50-10' | '90-15';

export type Dificultad = 'facil' | 'media' | 'dificil';

// Algo que no quiere dejar de hacer (deporte, comer con la familia...).
// Se respeta como un evento con hora fija esos días.
export type Imprescindible = {
  id: string;
  nombre: string;
  dias: DiaSemana[]; // lunes = 0
  horaInicio: Hora;
  horaFin: Hora;
};

export type RitmoEpoca = {
  levantarse: Hora;
  acostarse: Hora;
  lugar: LugarEvento; // dónde estudia o trabaja los días que "va"
  // Un sitio distinto para algún día de la semana (clave: lunes = 0).
  lugarPorDia: Partial<Record<DiaSemana, LugarEvento>>;
  diasVas: DiaSemana[]; // días que va al sitio; los demás estudia en casa
  horasDia: number; // horas de estudio o trabajo que quiere hacer al día
  rindeMas: MomentoDelDia;
  descanso: Descanso;
  diaLibre: DiaSemana | null; // ese día no hay plan
  trayectoMin: number; // lo que tarda en llegar al sitio (para el aviso de salir)
  imprescindibles: Imprescindible[];
};

// Una parte del temario de un hito ("Tema 3: Regresión"), con las horas que
// se le dedican. Los bloques del plan van pasando por los temas en orden
// (services/epoca/temas.ts). Los propone la IA a partir del temario.
export type TemaHito = {
  id: string;
  nombre: string;
  horas: number;
};

// Un examen o una entrega.
export type Hito = {
  id: string;
  nombre: string;
  fecha: ClaveDia;
  hora: Hora;
  lugar: LugarEvento | null;
  dificultad: Dificultad;
  horasPreparacion: number;
  temas?: TemaHito[]; // sin temas (o vacío): los bloques solo dicen el hito
};

// Lee los temas guardados (SQLite, navegador o copia de seguridad) y descarta
// lo que no tenga forma de tema.
export function normalizarTemas(valor: unknown): TemaHito[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (t): t is TemaHito =>
      !!t &&
      typeof t === 'object' &&
      typeof (t as TemaHito).id === 'string' &&
      typeof (t as TemaHito).nombre === 'string' &&
      typeof (t as TemaHito).horas === 'number' &&
      (t as TemaHito).horas > 0,
  );
}

// Qué avisos de la época quiere (solo llegan en la app del móvil).
export type AvisosEpoca = {
  salir: boolean; // hora de salir hacia el sitio de estudio
  inicioBloque: boolean;
  finDescanso: boolean;
  dormir: boolean; // "Hora de ir a dormir" a la hora de acostarse de la época
};

export type Epoca = {
  id: string;
  nombre: string;
  tipo: TipoEpoca;
  inicio: ClaveDia;
  fin: ClaveDia; // incluido
  ritmo: RitmoEpoca;
  hitos: Hito[];
  avisos: AvisosEpoca;
  // true = Época dorada: mientras dura, Hoy, Semana y los avisos usan su ritmo.
  // false = solo plan de estudio: los bloques van en tu día normal (26/10/2026).
  dorada: boolean;
  ejemplo: boolean;
  resumenVisto: boolean; // ya se enseñó el resumen final en Hoy
};

// Lo que el usuario ha hecho con un bloque del plan. Los bloques pendientes no
// se guardan: el plan se calcula cada vez (services/epoca/plan.ts).
export type EstadoBloque = 'hecho' | 'saltado';

export type RegistroBloque = {
  id: string; // el mismo que el bloque del plan: "<epoca>:<día>:<minuto de inicio>"
  epocaId: string;
  hitoId: string;
  dia: ClaveDia;
  inicio: number; // minutos desde medianoche
  fin: number;
  estado: EstadoBloque;
  // Por qué no se hizo ("Me fui a Valencia"), si lo quiso apuntar. Solo en saltados.
  motivo?: string | null;
};

// Lo que el plan de un día tenía previsto (bloques pendientes), guardado en el
// dispositivo. Sirve para dos cosas: que los bloques de hoy que ya empezaron no
// cambien de hora aunque se apunte algo nuevo, y saber después qué se quedó sin
// marcar. Clave: "<época>:<día>". No viaja en la copia de seguridad.
export type BloqueGuardado = {
  id: string;
  hitoId: string;
  inicio: number;
  fin: number;
  descansoFin: number;
};

export type PlanesDelDia = Record<string, BloqueGuardado[]>;

// Guardado: SQLite en el móvil (repositorio.ts) y el navegador en la web
// (repositorio.web.ts). Los dos cumplen este tipo.
export type RepositorioEpocas = {
  leerEpocas(): Promise<Epoca[]>;
  guardarEpoca(epoca: Epoca): Promise<void>; // crea o sustituye (con sus hitos)
  borrarEpoca(id: string): Promise<void>; // y su registro de bloques
  leerRegistro(): Promise<RegistroBloque[]>;
  guardarRegistro(registro: RegistroBloque): Promise<void>;
  borrarRegistro(id: string): Promise<void>;
  // Al recuperar una copia: quita todo y pone lo de la copia.
  reemplazarTodo(epocas: Epoca[], registro: RegistroBloque[]): Promise<void>;
};
