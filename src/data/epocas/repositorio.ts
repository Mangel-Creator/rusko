import type { SQLiteDatabase } from 'expo-sqlite';

import { obtenerBD } from '@/data/db';
import { normalizarLugar } from '@/data/eventos/tipos';

import { normalizarTemas, type Epoca, type Hito, type RegistroBloque, type RepositorioEpocas } from './tipos';

// Guardado de las épocas doradas en el móvil (Android e iOS) con SQLite.
// En la web se usa repositorio.web.ts, que tiene las mismas funciones.

type FilaEpoca = {
  id: string;
  nombre: string;
  tipo: Epoca['tipo'];
  inicio: string;
  fin: string;
  ritmo: string;
  avisos: string;
  ejemplo: number;
  resumen_visto: number;
  dorada: number; // migración 10
};

type FilaHito = {
  id: string;
  epoca_id: string;
  nombre: string;
  fecha: string;
  hora: string;
  lugar: string | null;
  dificultad: Hito['dificultad'];
  horas_preparacion: number;
  temas: string | null; // migración 8
};

type FilaBloque = {
  id: string;
  epoca_id: string;
  hito_id: string;
  dia: string;
  inicio: number;
  fin: number;
  estado: RegistroBloque['estado'];
  motivo: string | null; // migración 10
};

// Escribe la época y sus hitos. Va siempre dentro de una transacción.
async function insertarEpoca(bd: SQLiteDatabase, e: Epoca) {
  await bd.runAsync(
    `INSERT OR REPLACE INTO epocas (id, nombre, tipo, inicio, fin, ritmo, avisos, ejemplo, resumen_visto, dorada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.id,
    e.nombre,
    e.tipo,
    e.inicio,
    e.fin,
    JSON.stringify(e.ritmo),
    JSON.stringify(e.avisos),
    e.ejemplo ? 1 : 0,
    e.resumenVisto ? 1 : 0,
    e.dorada ? 1 : 0,
  );
  // Los hitos se sustituyen todos: así se reflejan los añadidos, cambios y quitados.
  await bd.runAsync('DELETE FROM hitos WHERE epoca_id = ?', e.id);
  for (const h of e.hitos) {
    await bd.runAsync(
      `INSERT INTO hitos (id, epoca_id, nombre, fecha, hora, lugar, dificultad, horas_preparacion, temas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      h.id,
      e.id,
      h.nombre,
      h.fecha,
      h.hora,
      h.lugar ? JSON.stringify(h.lugar) : null,
      h.dificultad,
      h.horasPreparacion,
      h.temas?.length ? JSON.stringify(h.temas) : null,
    );
  }
}

async function insertarRegistro(bd: SQLiteDatabase, r: RegistroBloque) {
  await bd.runAsync(
    `INSERT OR REPLACE INTO bloques_epoca (id, epoca_id, hito_id, dia, inicio, fin, estado, motivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    r.id,
    r.epocaId,
    r.hitoId,
    r.dia,
    r.inicio,
    r.fin,
    r.estado,
    r.motivo ?? null,
  );
}

export const repositorio: RepositorioEpocas = {
  async leerEpocas() {
    const bd = await obtenerBD();
    const [epocas, hitos] = await Promise.all([
      bd.getAllAsync<FilaEpoca>('SELECT * FROM epocas ORDER BY inicio'),
      bd.getAllAsync<FilaHito>('SELECT * FROM hitos ORDER BY fecha, hora'),
    ]);
    return epocas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      tipo: f.tipo,
      inicio: f.inicio,
      fin: f.fin,
      ritmo: JSON.parse(f.ritmo),
      avisos: JSON.parse(f.avisos),
      ejemplo: f.ejemplo === 1,
      resumenVisto: f.resumen_visto === 1,
      dorada: f.dorada !== 0,
      hitos: hitos
        .filter((h) => h.epoca_id === f.id)
        .map((h) => ({
          id: h.id,
          nombre: h.nombre,
          fecha: h.fecha,
          hora: h.hora,
          lugar: h.lugar ? normalizarLugar(JSON.parse(h.lugar)) : null,
          dificultad: h.dificultad,
          horasPreparacion: h.horas_preparacion,
          temas: h.temas ? normalizarTemas(JSON.parse(h.temas)) : [],
        })),
    }));
  },

  async guardarEpoca(e) {
    const bd = await obtenerBD();
    await bd.withTransactionAsync(() => insertarEpoca(bd, e));
  },

  async borrarEpoca(id) {
    const bd = await obtenerBD();
    // Sus hitos y su registro de bloques se borran solos (ON DELETE CASCADE).
    await bd.runAsync('DELETE FROM epocas WHERE id = ?', id);
  },

  async leerRegistro() {
    const bd = await obtenerBD();
    const filas = await bd.getAllAsync<FilaBloque>('SELECT * FROM bloques_epoca ORDER BY dia, inicio');
    return filas.map((f) => ({
      id: f.id,
      epocaId: f.epoca_id,
      hitoId: f.hito_id,
      dia: f.dia,
      inicio: f.inicio,
      fin: f.fin,
      estado: f.estado,
      motivo: f.motivo ?? null,
    }));
  },

  async guardarRegistro(r) {
    const bd = await obtenerBD();
    await insertarRegistro(bd, r);
  },

  async borrarRegistro(id) {
    const bd = await obtenerBD();
    await bd.runAsync('DELETE FROM bloques_epoca WHERE id = ?', id);
  },

  async reemplazarTodo(epocas, registro) {
    const bd = await obtenerBD();
    // Todo o nada. Borrar las épocas borra también sus hitos y su registro.
    await bd.withTransactionAsync(async () => {
      await bd.runAsync('DELETE FROM epocas');
      for (const e of epocas) await insertarEpoca(bd, e);
      for (const r of registro) await insertarRegistro(bd, r);
    });
  },
};
