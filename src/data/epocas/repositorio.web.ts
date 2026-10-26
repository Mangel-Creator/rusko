import { guardarAjuste, leerAjuste } from '@/data/ajustes';

import { normalizarTemas, type Epoca, type RegistroBloque, type RepositorioEpocas } from './tipos';

// Guardado de las épocas doradas en la versión web: igual que los eventos
// (data/eventos/repositorio.web.ts), en el almacenamiento del navegador, porque
// GitHub Pages no permite SQLite. Claves "organizy:epocas" y "organizy:bloquesEpoca".

const CLAVE_EPOCAS = 'epocas';
const CLAVE_REGISTRO = 'bloquesEpoca';

// Los hitos guardados antes de tener temas no traen el campo: se leen sin temas.
// Las épocas de antes del plan de estudio (26/10/2026) son todas doradas.
const leerEpocas = async () =>
  (await leerAjuste<Epoca[]>(CLAVE_EPOCAS, [])).map((e) => ({
    ...e,
    dorada: e.dorada ?? true,
    hitos: e.hitos.map((h) => ({ ...h, temas: normalizarTemas(h.temas) })),
  }));
const leerRegistro = () => leerAjuste<RegistroBloque[]>(CLAVE_REGISTRO, []);

export const repositorio: RepositorioEpocas = {
  leerEpocas,
  leerRegistro,

  async guardarEpoca(epoca) {
    const epocas = await leerEpocas();
    await guardarAjuste(CLAVE_EPOCAS, [...epocas.filter((e) => e.id !== epoca.id), epoca]);
  },

  async borrarEpoca(id) {
    const [epocas, registro] = await Promise.all([leerEpocas(), leerRegistro()]);
    await guardarAjuste(CLAVE_EPOCAS, epocas.filter((e) => e.id !== id));
    await guardarAjuste(CLAVE_REGISTRO, registro.filter((r) => r.epocaId !== id));
  },

  async guardarRegistro(bloque) {
    const registro = await leerRegistro();
    await guardarAjuste(CLAVE_REGISTRO, [...registro.filter((r) => r.id !== bloque.id), bloque]);
  },

  async borrarRegistro(id) {
    const registro = await leerRegistro();
    await guardarAjuste(CLAVE_REGISTRO, registro.filter((r) => r.id !== id));
  },

  async reemplazarTodo(epocas, registro) {
    await guardarAjuste(CLAVE_EPOCAS, epocas);
    await guardarAjuste(CLAVE_REGISTRO, registro);
  },
};
