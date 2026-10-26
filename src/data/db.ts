import * as SQLite from 'expo-sqlite';

// Base de datos local (SQLite) para datos con más volumen, como los eventos.
//
// Cómo añadir tablas en fases posteriores:
// añade una función al final de MIGRACIONES. Cada migración se ejecuta una sola
// vez y la versión aplicada se guarda en "PRAGMA user_version".

const NOMBRE_BD = 'organizy.db';

type Migracion = (bd: SQLite.SQLiteDatabase) => Promise<void>;

const MIGRACIONES: Migracion[] = [
  // 1. Fase 3: tabla de eventos (ver data/eventos/tipos.ts).
  async (bd) => {
    await bd.execAsync(`
      CREATE TABLE eventos (
        id TEXT PRIMARY KEY NOT NULL,
        titulo TEXT NOT NULL,
        fecha TEXT NOT NULL,
        hora_inicio TEXT,
        hora_fin TEXT,
        tipo TEXT NOT NULL,
        lugar_nombre TEXT,
        lugar_direccion TEXT,
        lugar_latitud REAL,
        lugar_longitud REAL,
        notas TEXT NOT NULL DEFAULT '',
        repeticion TEXT NOT NULL DEFAULT 'nunca',
        flexible INTEGER NOT NULL DEFAULT 0,
        duracion_min INTEGER,
        hecha INTEGER NOT NULL DEFAULT 0,
        foco INTEGER NOT NULL DEFAULT 0,
        ejemplo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX eventos_fecha ON eventos (fecha);
    `);
  },
  // 2. Lugar como referencia: "casa", "sitio" (con lugar_sitio_id) u "otro".
  //    Los lugares que ya había eran copias de la dirección: pasan a "otro".
  async (bd) => {
    await bd.execAsync(`
      ALTER TABLE eventos ADD COLUMN lugar_tipo TEXT;
      ALTER TABLE eventos ADD COLUMN lugar_sitio_id TEXT;
      UPDATE eventos SET lugar_tipo = 'otro' WHERE lugar_direccion IS NOT NULL;
    `);
  },
  // 3. Fase 4: antelación del aviso de cada evento (NULL = la del perfil, 0 = sin aviso).
  async (bd) => {
    await bd.execAsync('ALTER TABLE eventos ADD COLUMN aviso_min INTEGER;');
  },
  // 4. Fase 4b: Época dorada (ver data/epocas/tipos.ts). El ritmo, los avisos y los
  //    lugares van como JSON: son ajustes de la época, no se buscan por dentro.
  async (bd) => {
    await bd.execAsync(`
      CREATE TABLE epocas (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL,
        inicio TEXT NOT NULL,
        fin TEXT NOT NULL,
        ritmo TEXT NOT NULL,
        avisos TEXT NOT NULL,
        ejemplo INTEGER NOT NULL DEFAULT 0,
        resumen_visto INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE hitos (
        id TEXT PRIMARY KEY NOT NULL,
        epoca_id TEXT NOT NULL REFERENCES epocas (id) ON DELETE CASCADE,
        nombre TEXT NOT NULL,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        lugar TEXT,
        dificultad TEXT NOT NULL,
        horas_preparacion REAL NOT NULL
      );
      CREATE TABLE bloques_epoca (
        id TEXT PRIMARY KEY NOT NULL,
        epoca_id TEXT NOT NULL REFERENCES epocas (id) ON DELETE CASCADE,
        hito_id TEXT NOT NULL,
        dia TEXT NOT NULL,
        inicio INTEGER NOT NULL,
        fin INTEGER NOT NULL,
        estado TEXT NOT NULL
      );
      CREATE INDEX hitos_epoca ON hitos (epoca_id);
      CREATE INDEX bloques_epoca_dia ON bloques_epoca (epoca_id, dia);
    `);
  },
  // 5. Fase 10: datos del cliente de una cita (nombre, teléfono y si acepta
  //    recordatorios por WhatsApp), como JSON. NULL = sin datos de cliente.
  async (bd) => {
    await bd.execAsync('ALTER TABLE eventos ADD COLUMN cliente TEXT;');
  },
  // 6. Calendarios de fuera (Google, iCloud...): de dónde vino el evento, como JSON
  //    (OrigenEvento). NULL = creado en Organizy.
  async (bd) => {
    await bd.execAsync('ALTER TABLE eventos ADD COLUMN origen TEXT;');
  },
  // 7. Matriz de Eisenhower de las tareas flexibles: "hazlo", "planifica", "delega" o
  //    "elimina". NULL = sin clasificar.
  async (bd) => {
    await bd.execAsync('ALTER TABLE eventos ADD COLUMN cuadrante TEXT;');
  },
  // 8. Temas de cada hito de la Época dorada (TemaHito[] como JSON). NULL = sin temas.
  async (bd) => {
    await bd.execAsync('ALTER TABLE hitos ADD COLUMN temas TEXT;');
  },
  // 9. Fase 15 (Organizy grupal): copia de lo de la empresa para verlo sin conexión
  //    (data/empresa/repositorio.ts). Una fila con todo como JSON; se borra al salir.
  async (bd) => {
    await bd.execAsync(`
      CREATE TABLE empresa_copia (
        clave TEXT PRIMARY KEY NOT NULL,
        datos TEXT NOT NULL,
        guardada TEXT NOT NULL
      );
    `);
  },
  // 10. Época dorada o solo plan de estudio (1 = dorada, como las que ya había) y por
  //     qué no se hizo un bloque saltado.
  async (bd) => {
    await bd.execAsync(`
      ALTER TABLE epocas ADD COLUMN dorada INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE bloques_epoca ADD COLUMN motivo TEXT;
    `);
  },
];

let bdPromesa: Promise<SQLite.SQLiteDatabase> | null = null;

export function obtenerBD(): Promise<SQLite.SQLiteDatabase> {
  if (!bdPromesa) {
    bdPromesa = abrirYMigrar();
  }
  return bdPromesa;
}

async function abrirYMigrar(): Promise<SQLite.SQLiteDatabase> {
  const bd = await SQLite.openDatabaseAsync(NOMBRE_BD);
  await bd.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const fila = await bd.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = fila?.user_version ?? 0;

  while (version < MIGRACIONES.length) {
    await bd.withTransactionAsync(() => MIGRACIONES[version](bd));
    version += 1;
    await bd.execAsync(`PRAGMA user_version = ${version}`);
  }
  return bd;
}
