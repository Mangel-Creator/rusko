import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { guardarAjuste, leerAjuste, suscribirseAjustes } from '@/data/ajustes';
import { recuperarCopia, reunirDatos } from '@/data/copia';
import { suscribirseEpocas } from '@/data/epocas';
import { suscribirseEventos } from '@/data/eventos';
import { obtenerSupabase } from '@/data/supabase';
import { cuentaActual, suscribirseCuenta } from '@/services/cuenta';
import { reiniciarApp } from '@/services/copia/archivo';
import { leerCopia, montarCopia, resumenCopia, viajaEnLaCopia, type CopiaSeguridad, type ResumenCopia } from '@/services/copia/formato';

import { copiaVacia, decidir, ESTADO_INICIAL, huellaCopia, type CopiaRemota, type EstadoNube } from './decidir';

// Copia en la nube (27/10/2026, elegido por el usuario): con la cuenta puesta, la copia de
// seguridad entera (services/copia) se sube a Supabase (tabla copias_nube) unos segundos
// después de cada cambio, y al abrir la app, al volver a ella y cada 5 minutos se mira si
// otro dispositivo ha subido algo más nuevo; si es así, se trae (cambia todo lo de aquí)
// y la app se reinicia. Si se cambia lo mismo en dos sitios a la vez, gana lo último.

const CLAVE = 'nube';
const CLAVE_DISPOSITIVO = 'dispositivo';
const ESPERA_CAMBIOS_MS = 4000;
const CADA_MS = 5 * 60 * 1000;

export type Situacion = 'apagada' | 'mirando' | 'al-dia' | 'subiendo' | 'trayendo' | 'elegir' | 'sin-conexion' | 'error';
export type EstadoVisible = { situacion: Situacion; ultimaVez: string | null; error: string | null };

let visible: EstadoVisible = { situacion: 'apagada', ultimaVez: null, error: null };
const oyentes = new Set<(estado: EstadoVisible) => void>();

function mostrar(cambios: Partial<EstadoVisible>) {
  visible = { ...visible, ...cambios };
  oyentes.forEach((avisar) => avisar(visible));
}

function suscribirse(oyente: (estado: EstadoVisible) => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

const leerVisible = () => visible;

export function useNube(): EstadoVisible {
  return useSyncExternalStore(suscribirse, leerVisible, leerVisible);
}

async function leerEstado(): Promise<EstadoNube> {
  return { ...ESTADO_INICIAL, ...(await leerAjuste<Partial<EstadoNube>>(CLAVE, {})) };
}

async function nombreDispositivo(): Promise<string> {
  const guardado = await leerAjuste<string | null>(CLAVE_DISPOSITIVO, null);
  if (guardado) return guardado;
  const nuevo = `${Platform.OS}-${Math.random().toString(36).slice(2, 10)}`;
  await guardarAjuste(CLAVE_DISPOSITIVO, nuevo);
  return nuevo;
}

function usuarioConCuenta(): string | null {
  const cuenta = cuentaActual();
  return cuenta.tipo === 'dentro' ? cuenta.id : null;
}

async function copiaLocal(): Promise<{ copia: CopiaSeguridad; huella: string }> {
  const copia = montarCopia(await reunirDatos(), new Date());
  return { copia, huella: huellaCopia(copia) };
}

async function leerRemota(usuario: string): Promise<CopiaRemota | null> {
  const supabase = obtenerSupabase();
  if (!supabase) throw new Error('sin servidor');
  const { data, error } = await supabase
    .from('copias_nube')
    .select('actualizada, huella, dispositivo')
    .eq('usuario', usuario)
    .maybeSingle();
  if (error) throw error;
  return data as CopiaRemota | null;
}

async function subir(usuario: string, copia: CopiaSeguridad, huella: string): Promise<string> {
  const supabase = obtenerSupabase();
  if (!supabase) throw new Error('sin servidor');
  const { data, error } = await supabase
    .from('copias_nube')
    .upsert({ usuario, copia, huella, dispositivo: await nombreDispositivo() }, { onConflict: 'usuario' })
    .select('actualizada')
    .single();
  if (error) throw error;
  return (data as { actualizada: string }).actualizada;
}

async function bajar(usuario: string): Promise<{ copia: CopiaSeguridad; actualizada: string }> {
  const supabase = obtenerSupabase();
  if (!supabase) throw new Error('sin servidor');
  const { data, error } = await supabase
    .from('copias_nube')
    .select('copia, actualizada')
    .eq('usuario', usuario)
    .single();
  if (error) throw error;
  const fila = data as { copia: unknown; actualizada: string };
  const lectura = leerCopia(JSON.stringify(fila.copia));
  if (!lectura.ok) throw new CopiaIlegible(lectura.error);
  return { copia: lectura.copia, actualizada: fila.actualizada };
}

class CopiaIlegible extends Error {}

function falloDe(e: unknown): Partial<EstadoVisible> {
  if (e instanceof CopiaIlegible) return { situacion: 'error', error: e.message };
  const texto = e instanceof Error ? e.message : String(e);
  if (/fetch|network|conexi/i.test(texto)) return { situacion: 'sin-conexion', error: null };
  return { situacion: 'error', error: 'No he podido hablar con tu cuenta. Lo vuelvo a probar en un rato.' };
}

// Cambia todo lo de aquí por lo de la nube y reinicia la app (cada parte tiene sus datos
// en memoria). En la web, si estaba en /cuenta, vuelve a Hoy.
async function aplicar(copia: CopiaSeguridad, actualizada: string): Promise<void> {
  mostrar({ situacion: 'trayendo', error: null });
  await recuperarCopia(copia);
  await guardarAjuste<EstadoNube>(CLAVE, {
    base: null,
    version: actualizada,
    cambioEl: null,
    rebase: true,
    ultimaVez: new Date().toISOString(),
  });
  if (Platform.OS === 'web' && /\/cuenta\/?$/.test(window.location.pathname)) {
    window.location.replace(new URL('./', window.location.href).href);
    return;
  }
  await reiniciarApp();
}

async function unaVuelta(): Promise<void> {
  const usuario = usuarioConCuenta();
  if (!usuario || !obtenerSupabase()) {
    mostrar({ situacion: 'apagada', error: null });
    return;
  }
  const estado = await leerEstado();
  const { copia, huella } = await copiaLocal();
  let remota: CopiaRemota | null;
  try {
    remota = await leerRemota(usuario);
  } catch (e) {
    mostrar(falloDe(e));
    return;
  }

  // Un cambio que se ve por primera vez cuenta desde ahora (antes de decidir, para que
  // no lo pise una copia de la nube más antigua que él).
  const ahora = new Date().toISOString();
  const nuevo: EstadoNube = { ...estado, rebase: false };
  if (estado.rebase) nuevo.base = huella;
  if (huella !== nuevo.base && !nuevo.cambioEl) nuevo.cambioEl = ahora;
  const decision = decidir(nuevo, { huella, vacia: copiaVacia(copia) }, remota);

  try {
    if (decision === 'subir') {
      mostrar({ situacion: 'subiendo', error: null });
      nuevo.version = await subir(usuario, copia, huella);
      nuevo.base = huella;
      nuevo.cambioEl = null;
    } else if (decision === 'adoptar' && remota) {
      nuevo.version = remota.actualizada;
      nuevo.base = huella;
      nuevo.cambioEl = null;
    } else if (decision === 'traer') {
      const nube = await bajar(usuario);
      await aplicar(nube.copia, nube.actualizada);
      return;
    } else if (decision === 'elegir') {
      await guardarAjuste(CLAVE, nuevo);
      mostrar({ situacion: 'elegir', error: null });
      return;
    }
  } catch (e) {
    await guardarAjuste(CLAVE, nuevo);
    mostrar(falloDe(e));
    return;
  }
  nuevo.ultimaVez = ahora;
  await guardarAjuste(CLAVE, nuevo);
  mostrar({ situacion: 'al-dia', ultimaVez: ahora, error: null });
}

// Una vuelta cada vez; si se pide otra mientras tanto, se hace después.
let enCurso: Promise<void> | null = null;
let otraVez = false;

export function sincronizar(): Promise<void> {
  if (enCurso) {
    otraVez = true;
    return enCurso;
  }
  enCurso = (async () => {
    do {
      otraVez = false;
      try {
        await unaVuelta();
      } catch (e) {
        console.warn('Nube: fallo al sincronizar', e);
        mostrar(falloDe(e));
      }
    } while (otraVez);
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

// "Tu cuenta ya tiene cosas": qué hay en la nube, para enseñarlo antes de elegir.
export async function resumenDeLaNube(): Promise<ResumenCopia | null> {
  const usuario = usuarioConCuenta();
  if (!usuario) return null;
  try {
    return resumenCopia((await bajar(usuario)).copia);
  } catch (e) {
    console.warn('Nube: no se pudo leer la copia', e);
    return null;
  }
}

// Elegido "Traer lo de mi cuenta": cambia lo de aquí por lo de la nube.
export async function traerDeLaNube(): Promise<boolean> {
  const usuario = usuarioConCuenta();
  if (!usuario) return false;
  try {
    const nube = await bajar(usuario);
    await aplicar(nube.copia, nube.actualizada);
    return true;
  } catch (e) {
    mostrar(falloDe(e));
    return false;
  }
}

// Elegido "Subir lo de aquí": lo de este dispositivo pasa a ser lo de la cuenta.
export async function subirLoDeAqui(): Promise<boolean> {
  const usuario = usuarioConCuenta();
  if (!usuario) return false;
  try {
    mostrar({ situacion: 'subiendo', error: null });
    const { copia, huella } = await copiaLocal();
    const version = await subir(usuario, copia, huella);
    const ahora = new Date().toISOString();
    await guardarAjuste<EstadoNube>(CLAVE, { base: huella, version, cambioEl: null, rebase: false, ultimaVez: ahora });
    mostrar({ situacion: 'al-dia', ultimaVez: ahora, error: null });
    return true;
  } catch (e) {
    mostrar(falloDe(e));
    return false;
  }
}

// Al cerrar sesión: este dispositivo olvida la nube (si vuelve a entrar, se pregunta).
export async function olvidarNube(): Promise<void> {
  await guardarAjuste<EstadoNube>(CLAVE, ESTADO_INICIAL);
  mostrar({ situacion: 'apagada', ultimaVez: null, error: null });
}

// En _layout: arranca la copia en la nube y la mantiene al día.
export function iniciarNube(): () => void {
  let espera: ReturnType<typeof setTimeout> | null = null;
  const pronto = () => {
    if (!usuarioConCuenta()) return;
    if (espera) clearTimeout(espera);
    espera = setTimeout(() => {
      espera = null;
      sincronizar();
    }, ESPERA_CAMBIOS_MS);
  };

  leerEstado().then((estado) => mostrar({ ultimaVez: estado.ultimaVez }));
  let tipoAnterior = cuentaActual().tipo;
  const quitarCuenta = suscribirseCuenta((cuenta) => {
    // Al entrar (o al cargar la sesión al arrancar), se mira la nube.
    if (cuenta.tipo === 'dentro' && tipoAnterior !== 'dentro') sincronizar();
    if (cuenta.tipo !== 'dentro') mostrar({ situacion: 'apagada', error: null });
    tipoAnterior = cuenta.tipo;
  });
  const quitarEventos = suscribirseEventos(pronto);
  const quitarEpocas = suscribirseEpocas(pronto);
  const quitarAjustes = suscribirseAjustes((clave) => {
    if (viajaEnLaCopia(clave)) pronto();
  });
  // Al volver se mira si hay algo nuevo; al irse, se sube lo pendiente.
  const app = AppState.addEventListener('change', () => {
    if (!usuarioConCuenta()) return;
    if (espera) clearTimeout(espera);
    espera = null;
    sincronizar();
  });
  const reloj = setInterval(() => {
    if (AppState.currentState === 'active' && usuarioConCuenta()) sincronizar();
  }, CADA_MS);

  return () => {
    quitarCuenta();
    quitarEventos();
    quitarEpocas();
    quitarAjustes();
    app.remove();
    clearInterval(reloj);
    if (espera) clearTimeout(espera);
  };
}
