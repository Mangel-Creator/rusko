import type { Coordenadas, Hora } from '@/data/perfil';
import type { ClaveDia } from '@/services/fechas';

// Qué es un evento en Organizy. Lo usan el guardado (SQLite o navegador),
// las pantallas y la lógica de services/agenda.

export type TipoEvento = 'cliente' | 'amigos' | 'yo';
export type Repeticion = 'nunca' | 'diaria' | 'semanal' | 'mensual';

// Lugar de un evento:
// - "casa": la vivienda del perfil.
// - "sitio": un sitio habitual del perfil (Trabajo, Gimnasio...), por su id.
//   Casa y los sitios guardan solo la referencia: si el usuario cambia la
//   dirección en Perfil, sus eventos apuntan solos a la nueva (ver resolverLugar).
// - "otro": una dirección escrita a mano, que sí se guarda tal cual.
export type LugarEvento =
  | { tipo: 'casa' }
  | { tipo: 'sitio'; sitioId: string }
  | { tipo: 'otro'; direccion: string; coordenadas: Coordenadas | null };

// Los eventos guardados antes de este cambio tenían { nombre, direccion,
// coordenadas }: se leen como "otro sitio" con esa dirección.
export function normalizarLugar(lugar: unknown): LugarEvento | null {
  if (!lugar || typeof lugar !== 'object') return null;
  const l = lugar as Record<string, unknown>;
  if (l.tipo === 'casa') return { tipo: 'casa' };
  if (l.tipo === 'sitio' && typeof l.sitioId === 'string') return { tipo: 'sitio', sitioId: l.sitioId };
  if (typeof l.direccion === 'string') {
    return {
      tipo: 'otro',
      direccion: l.direccion,
      coordenadas: (l.coordenadas as Coordenadas | null | undefined) ?? null,
    };
  }
  return null;
}

// Datos del cliente de una cita de tipo "cliente" (fase 10). Solo se guardan en el
// dispositivo. Sin "acepta" no se le recuerda nada; el teléfono va tal cual lo
// escribió la persona (services/clientes lo pasa al formato de WhatsApp).
// Matriz de Eisenhower de una tarea flexible: importante y urgente ("hazlo"),
// importante sin prisa ("planifica"), con prisa pero poco importante ("delega") o ni
// lo uno ni lo otro ("elimina"). null = sin clasificar. Ver services/agenda/prioridad.ts.
export type Cuadrante = 'hazlo' | 'planifica' | 'delega' | 'elimina';

const CUADRANTES_VALIDOS: readonly string[] = ['hazlo', 'planifica', 'delega', 'elimina'];

// Lo guardado que no sea un cuadrante conocido se lee como "sin clasificar".
export function normalizarCuadrante(valor: unknown): Cuadrante | null {
  return typeof valor === 'string' && CUADRANTES_VALIDOS.includes(valor) ? (valor as Cuadrante) : null;
}

export type DatosCliente = {
  nombre: string;
  telefono: string;
  acepta: boolean; // "Acepta recordatorios por WhatsApp"
};

export type Evento = {
  id: string;
  titulo: string;
  // Día del evento. Si se repite, es el primer día de la serie.
  // En las tareas flexibles, el día para el que están previstas.
  fecha: ClaveDia;
  // Horas "HH:MM". Las tareas flexibles no tienen hora fija: van a null.
  horaInicio: Hora | null;
  horaFin: Hora | null;
  tipo: TipoEvento;
  lugar: LugarEvento | null;
  notas: string;
  repeticion: Repeticion; // las tareas flexibles no se repiten
  flexible: boolean;
  duracionMin: number | null; // solo en tareas flexibles
  hecha: boolean; // solo en tareas flexibles
  // Cuándo se marcó como hecha (ISO). A las 24 h la tarea se borra sola. Opcional, como "cliente".
  hechaEn?: string | null;
  foco: boolean; // bloque de foco: tiempo protegido
  // Minutos de antelación del aviso (fase 4). null = la del perfil; 0 = sin aviso.
  // Las tareas flexibles no tienen aviso (no tienen hora).
  avisoMin: number | null;
  ejemplo: boolean; // creado como ejemplo (se puede borrar desde Perfil)
  // De los recordatorios a clientes (fase 10, ya quitados): se conserva lo que hubiera.
  cliente?: DatosCliente | null;
  // Si se trajo de otro calendario (Google, iCloud...). Opcional, como "cliente".
  origen?: OrigenEvento | null;
  // Solo en tareas flexibles: su sitio en la matriz de Eisenhower. Opcional, como "cliente".
  cuadrante?: Cuadrante | null;
};

// De dónde viene un evento traído de otro calendario (services/calendarios).
// "huella" resume cómo llegó: si el evento ya no coincide con ella, se ha cambiado
// en Organizy y el calendario de fuera deja de tocarlo.
export type OrigenEvento = {
  fuente: string; // id del calendario (data/calendarios)
  uid: string; // el del evento en ese calendario
  huella: string;
};

// Lo que tiene que saber hacer el guardado, sea SQLite (móvil) o el
// navegador (web). Las pantallas no lo usan directamente: usan data/eventos.
export type RepositorioEventos = {
  leerTodos(): Promise<Evento[]>;
  guardar(evento: Evento): Promise<void>; // crea o sustituye
  borrar(id: string): Promise<void>;
  borrarEjemplos(): Promise<void>;
  reemplazarTodos(eventos: Evento[]): Promise<void>; // al recuperar una copia
  // Muchos de golpe (al traer otro calendario): crea o sustituye y borra por id.
  cambiarVarios(guardar: Evento[], borrar: string[]): Promise<void>;
};
