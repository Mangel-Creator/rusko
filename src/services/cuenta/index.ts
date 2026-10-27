import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { asegurarSesion, obtenerSupabase, supabaseConfigurado } from '@/data/supabase';

// Tu cuenta de Rusko (27/10/2026): correo y contraseña para entrar desde cualquier
// dispositivo y tener lo mismo en todos (la copia en la nube, services/nube).
//
// Crear la cuenta convierte la sesión anónima de este dispositivo en la cuenta: el
// usuario de Supabase es el mismo, así que los planes, los avisos de la web, el Atajo del
// Reloj y los límites de IA siguen igual. Supabase pide confirmar el correo antes de
// poner la contraseña, así que va en dos pasos: correo (llega un enlace) y contraseña.

export type Cuenta =
  | { tipo: 'sin-servidor' }
  | { tipo: 'cargando' }
  | { tipo: 'sin-cuenta' } // sesión anónima (o ninguna)
  | { tipo: 'confirmando'; email: string } // ha pedido la cuenta y falta tocar el enlace
  | { tipo: 'sin-contrasena'; email: string } // correo confirmado, falta la contraseña
  | { tipo: 'dentro'; email: string; id: string };

export type FalloCuenta =
  | 'ya-existe'
  | 'credenciales'
  | 'sin-confirmar'
  | 'demasiados'
  | 'debil'
  | 'misma'
  | 'correo-malo'
  | 'no-autorizado'
  | 'codigo' // hace falta el código que llega por correo para cambiar la contraseña
  | 'codigo-malo'
  | 'sin-conexion'
  | 'error';

export type Resultado = { ok: true } | { ok: false; motivo: FalloCuenta };

export const TEXTO_FALLO: Record<FalloCuenta, string> = {
  'ya-existe': 'Ese correo ya tiene cuenta. Entra con él en «Entrar».',
  credenciales: 'El correo o la contraseña no son correctos.',
  'sin-confirmar': 'Aún no has confirmado el correo. Toca el enlace que te llegó.',
  demasiados: 'Has pedido demasiados correos o intentos seguidos. Espera un rato y vuelve a probar.',
  debil: 'Esa contraseña es muy fácil. Usa al menos 8 letras o números.',
  misma: 'Esa ya es tu contraseña. Elige otra distinta.',
  'correo-malo': 'Ese correo no parece bien escrito.',
  'no-autorizado': 'El servidor aún no puede mandar correos a esa dirección. Usa el correo con el que entras en Supabase.',
  codigo: 'Te he mandado un código al correo para poder poner la contraseña. Escríbelo aquí.',
  'codigo-malo': 'Ese código no vale o ha caducado. Pide otro.',
  'sin-conexion': 'No hay conexión. Vuelve a probar en un momento.',
  error: 'Algo ha fallado en el servidor. Vuelve a probar.',
};

export const LARGO_MINIMO = 8;

export function correoValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// Adonde lleva el enlace de los correos: la página /cuenta de la web publicada (o la de
// este navegador, en desarrollo). Tiene que estar en Supabase > Authentication > URL
// Configuration > Redirect URLs.
const WEB_PUBLICADA = 'https://mangel-creator.github.io/organizy/cuenta';
function paginaCuenta(): string {
  if (Platform.OS !== 'web') return WEB_PUBLICADA;
  return new URL('cuenta', window.location.href).href;
}

function motivo(error: AuthError | Error | null | undefined): FalloCuenta {
  if (!error) return 'error';
  const codigo = 'code' in error ? error.code : undefined;
  const estado = 'status' in error ? error.status : undefined;
  switch (codigo) {
    case 'email_exists':
    case 'user_already_exists':
    case 'identity_already_exists':
      return 'ya-existe';
    case 'invalid_credentials':
      return 'credenciales';
    case 'email_not_confirmed':
      return 'sin-confirmar';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'demasiados';
    case 'weak_password':
      return 'debil';
    case 'same_password':
      return 'misma';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'correo-malo';
    case 'email_address_not_authorized':
      return 'no-autorizado';
    case 'reauthentication_needed':
      return 'codigo';
    case 'reauthentication_not_valid':
      return 'codigo-malo';
  }
  if (estado === 0 || error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message)) {
    return 'sin-conexion';
  }
  return 'error';
}

export function cuentaDeSesion(session: Session | null): Cuenta {
  const usuario = session?.user;
  if (!usuario) return { tipo: 'sin-cuenta' };
  if (usuario.is_anonymous) {
    return usuario.new_email ? { tipo: 'confirmando', email: usuario.new_email } : { tipo: 'sin-cuenta' };
  }
  const email = usuario.email ?? '';
  // La contraseña se apunta en sus datos al ponerla (Supabase no dice si hay una).
  if (usuario.user_metadata?.contrasena !== true) return { tipo: 'sin-contrasena', email };
  return { tipo: 'dentro', email, id: usuario.id };
}

// Estado compartido por las pantallas.
let actual: Cuenta = supabaseConfigurado ? { tipo: 'cargando' } : { tipo: 'sin-servidor' };
const oyentes = new Set<(cuenta: Cuenta) => void>();
let escuchando = false;

function poner(cuenta: Cuenta) {
  actual = cuenta;
  oyentes.forEach((avisar) => avisar(cuenta));
}

function escuchar(supabase: SupabaseClient) {
  if (escuchando) return;
  escuchando = true;
  supabase.auth.getSession().then(({ data }) => poner(cuentaDeSesion(data.session)));
  supabase.auth.onAuthStateChange((_evento, session) => poner(cuentaDeSesion(session)));
}

export function cuentaActual(): Cuenta {
  return actual;
}

export function suscribirseCuenta(oyente: (cuenta: Cuenta) => void): () => void {
  const supabase = obtenerSupabase();
  if (supabase) escuchar(supabase);
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function useCuenta(): Cuenta {
  return useSyncExternalStore(suscribirseCuenta, cuentaActual, cuentaActual);
}

async function conServidor(hacer: (supabase: SupabaseClient) => Promise<AuthError | null>): Promise<Resultado> {
  const supabase = obtenerSupabase();
  if (!supabase) return { ok: false, motivo: 'error' };
  escuchar(supabase);
  try {
    const error = await hacer(supabase);
    if (error) console.warn('Cuenta:', error.code ?? error.name, error.message);
    return error ? { ok: false, motivo: motivo(error) } : { ok: true };
  } catch (e) {
    console.warn('Cuenta: fallo al hablar con el servidor', e);
    return { ok: false, motivo: motivo(e instanceof Error ? e : null) };
  }
}

// La contraseña elegida al crear la cuenta se guarda solo en memoria hasta confirmar el
// correo (Supabase no deja ponerla antes). Si la app se reinicia, se vuelve a pedir.
let contrasenaPendiente: string | null = null;

// Paso 1 de crear la cuenta: el correo (llega un enlace para confirmarlo) y la contraseña
// que se pondrá al confirmarlo.
export async function crearCuenta(email: string, contrasena: string): Promise<Resultado> {
  contrasenaPendiente = contrasena;
  const resultado = await conServidor(async (supabase) => {
    await asegurarSesion(supabase);
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: paginaCuenta() });
    return error;
  });
  if (!resultado.ok) contrasenaPendiente = null;
  return resultado;
}

export function reenviarConfirmacion(email: string): Promise<Resultado> {
  return conServidor(async (supabase) => {
    const { error } = await supabase.auth.resend({
      type: 'email_change',
      email,
      options: { emailRedirectTo: paginaCuenta() },
    });
    return error;
  });
}

// Tras tocar el enlace (aquí o en otro sitio), la sesión se renueva para enterarse. Si
// la contraseña sigue en memoria, se pone ya y la cuenta queda lista.
export async function comprobarConfirmacion(): Promise<Cuenta> {
  const supabase = obtenerSupabase();
  if (!supabase) return actual;
  escuchar(supabase);
  try {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) poner(cuentaDeSesion(data.session));
  } catch (e) {
    console.warn('Cuenta: no se pudo renovar la sesión', e);
  }
  if (actual.tipo === 'sin-contrasena' && contrasenaPendiente) {
    const resultado = await ponerContrasena(contrasenaPendiente);
    if (resultado.ok) contrasenaPendiente = null;
  }
  return actual;
}

// Paso 2 (o al recuperar la contraseña): la contraseña. Si Supabase pide el código del
// correo, lo manda y contesta "codigo"; se vuelve a llamar con él.
export function ponerContrasena(contrasena: string, codigo?: string): Promise<Resultado> {
  return conServidor(async (supabase) => {
    const { error } = await supabase.auth.updateUser({
      password: contrasena,
      nonce: codigo?.trim() || undefined,
      data: { contrasena: true },
    });
    if (error?.code === 'reauthentication_needed') {
      const { error: errorCodigo } = await supabase.auth.reauthenticate();
      return errorCodigo ?? error;
    }
    return error;
  });
}

// Entrar en otro dispositivo. La sesión anónima que tuviera se cambia por la cuenta.
export function entrar(email: string, contrasena: string): Promise<Resultado> {
  return conServidor(async (supabase) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: contrasena });
    return error;
  });
}

export function olvideContrasena(email: string): Promise<Resultado> {
  return conServidor(async (supabase) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: paginaCuenta() });
    return error;
  });
}

// Sale de la cuenta solo en este dispositivo. Lo guardado aquí se queda.
export function cerrarSesion(): Promise<Resultado> {
  return conServidor(async (supabase) => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return error;
  });
}

// Enlaces de los correos (solo en la web): la página /cuenta llega con los datos tras "#".
export type Enlace = 'nueva-contrasena' | 'confirmado' | 'caducado' | null;

export async function atenderEnlace(): Promise<Enlace> {
  if (Platform.OS !== 'web' || !window.location.hash) return null;
  const datos = new URLSearchParams(window.location.hash.slice(1));
  // Que no se quede en la dirección (lleva la llave de la sesión). Con el estado del
  // navegador de rutas: sin él, expo-router vuelve a poner la dirección con el "#".
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  if (datos.get('error') || datos.get('error_code')) return 'caducado';
  const tipo = datos.get('type');
  if (tipo === 'recovery') {
    const supabase = obtenerSupabase();
    const access_token = datos.get('access_token');
    const refresh_token = datos.get('refresh_token');
    if (!supabase || !access_token || !refresh_token) return 'caducado';
    escuchar(supabase);
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return error ? 'caducado' : 'nueva-contrasena';
  }
  // Confirmar el correo ya se ha hecho al tocar el enlace: aquí no se entra en la cuenta
  // (puede ser otro navegador), solo se dice que vuelva adonde estaba.
  if (tipo === 'email_change' || tipo === 'signup' || datos.get('message')) return 'confirmado';
  return null;
}
