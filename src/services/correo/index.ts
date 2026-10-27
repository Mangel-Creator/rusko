import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

import {
  cargarCorreos,
  guardarConexion,
  guardarCorreos,
  guardarCuentas,
  guardarSiempre,
  guardarVetados,
  leerCorreos,
  type CorreoRemoto,
  type CorreoResumido,
  type CuentaCorreo,
  type ProveedorCorreo,
} from '@/data/correos';
import { borrarEvento, guardarEvento, leerEventos, nuevoId } from '@/data/eventos';
import { datosPublicosSupabase } from '@/data/supabase';
import { claveDia } from '@/services/fechas';
import { escucharPush, tokenDeAvisos } from '@/services/planes/push';

import {
  cambiarSiempre,
  cambiarVetados,
  correosSinTarea,
  deVetado,
  leerEnlace,
  mezclarCorreos,
  sinCuenta,
  tareaDeCorreo,
  validarRemoto,
} from './correos';
import { empezarEnServidor, estadoEnServidor, quitarEnServidor, type FalloServidor } from './servidor';

// Resúmenes de correo (fase 11). Dos vías, que se juntan en la misma lista:
//
// - Cuentas vinculadas ("Vincular con Gmail / Outlook"): el usuario solo inicia
//   sesión; el servidor (función correo-cuentas) guarda la llave cifrada, mira el correo
//   cada 5 minutos, avisa al móvil y guarda 7 días de resúmenes. La app se los pide.
// - Ayudante de Gmail (en la cuenta de Google del usuario, gmail/organizy-correo.js):
//   mira el correo cada 10 minutos, avisa y guarda sus resúmenes en Google. Al pedirlos,
//   la app le pasa su dirección de avisos y la dirección y clave pública del servidor
//   (para la IA, si algún día está la clave de Anthropic).
//
// La app los pide al abrirse, al volver a ella y al llegar un aviso de correo, y
// apunta los plazos como tareas.

export * from './correos';

type Respuesta =
  | { ok: true; correos: ReturnType<typeof validarRemoto>[]; ultimaRevision: string | null }
  | { ok: false; motivo: 'sin-conexion' | 'no-responde' };

// "Avisarme siempre de…" y los vetados: se mandan con cada petición, al ayudante y al
// servidor, que los guardan para la revisión siguiente.
const listas = ({ siempre, vetados }: { siempre: string[]; vetados: string[] }) => ({ siempre, vetados });

async function pedirAlAyudante(enlace: string): Promise<Respuesta> {
  const token = await tokenDeAvisos().catch(() => null);
  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), 25000);
  try {
    // text/plain: así el navegador no hace la pregunta previa de CORS, que Google
    // no contesta. Google responde con una redirección que fetch sigue sola.
    const respuesta = await fetch(enlace, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, supabase: datosPublicosSupabase, ...listas(await leerCorreos()) }),
      signal: control.signal,
    });
    const datos = (await respuesta.json().catch(() => null)) as {
      ok?: boolean;
      correos?: unknown[];
      ultimaRevision?: string | null;
    } | null;
    if (!respuesta.ok || !datos?.ok || !Array.isArray(datos.correos)) return { ok: false, motivo: 'no-responde' };
    return {
      ok: true,
      correos: datos.correos.map(validarRemoto),
      ultimaRevision: typeof datos.ultimaRevision === 'string' ? datos.ultimaRevision : null,
    };
  } catch {
    return { ok: false, motivo: control.signal.aborted ? 'no-responde' : 'sin-conexion' };
  } finally {
    clearTimeout(espera);
  }
}

// Apunta como tarea cada plazo nuevo. Si luego se borra la tarea, no se vuelve a crear.
async function crearTareas(correos: CorreoResumido[]): Promise<CorreoResumido[]> {
  const pendientes = new Set(correosSinTarea(correos, claveDia(new Date())).map((c) => c.id));
  if (pendientes.size === 0) return correos;
  const resultado: CorreoResumido[] = [];
  for (const correo of correos) {
    if (!pendientes.has(correo.id)) {
      resultado.push(correo);
      continue;
    }
    const tarea = tareaDeCorreo(correo, nuevoId());
    await guardarEvento(tarea);
    resultado.push({ ...correo, eventoId: tarea.id });
  }
  return resultado;
}

// Lo del ayudante de Gmail, si está conectado.
async function traerDelAyudante(): Promise<CorreoRemoto[]> {
  const { conexion } = await leerCorreos();
  if (!conexion) return [];
  const respuesta = await pedirAlAyudante(conexion.enlace);
  const actual = (await leerCorreos()).conexion;
  if (!actual || actual.enlace !== conexion.enlace) return []; // se desconectó mientras tanto
  if (!respuesta.ok) {
    await guardarConexion({ ...actual, error: respuesta.motivo });
    return [];
  }
  await guardarConexion({
    ...actual,
    actualizadoEl: new Date().toISOString(),
    ultimaRevision: respuesta.ultimaRevision,
    error: null,
  });
  return respuesta.correos.filter((c): c is NonNullable<typeof c> => c !== null);
}

// Lo de las cuentas vinculadas. Solo pregunta al servidor si hay alguna cuenta o si se
// pide (al entrar en Resúmenes, para saber qué botones están activados).
async function traerDelServidor(siempre: boolean): Promise<CorreoRemoto[]> {
  const { cuentas } = await leerCorreos();
  if (!siempre && cuentas.length === 0) return [];
  const respuesta = await estadoEnServidor(await tokenDeAvisos().catch(() => null), listas(await leerCorreos()));
  if (!respuesta.ok) return [];
  await guardarCuentas(respuesta.datos.cuentas, respuesta.datos.proveedores);
  return respuesta.datos.correos;
}

let trayendo: Promise<void> | null = null;

// Trae los correos de las dos vías. Si ya se está haciendo, espera a que termine.
// "servidor: true" pregunta al servidor aunque no haya cuentas vinculadas.
export function actualizarCorreos(opciones: { servidor?: boolean } = {}): Promise<void> {
  if (!trayendo) {
    trayendo = (async () => {
      const [delAyudante, delServidor] = await Promise.all([
        traerDelAyudante(),
        traerDelServidor(opciones.servidor === true),
      ]);
      const remotos = [...delServidor, ...delAyudante];
      if (remotos.length === 0) return;
      const { correos, vetados } = await leerCorreos();
      const mezclados = await crearTareas(mezclarCorreos(correos, remotos, new Date(), vetados));
      await guardarCorreos(mezclados);
    })().finally(() => {
      trayendo = null;
    });
  }
  return trayendo;
}

// --- Vincular con Gmail / Outlook ---

// En el móvil, la ventana de inicio de sesión del sistema se cierra sola al volver a
// esta dirección (vale también en Expo Go: no hace falta que la app la reconozca).
const VUELTA_APP = 'organizy://correo-vinculado';

export type ResultadoVincular =
  | { ok: true; email: string | null }
  | { ok: false; motivo: FalloServidor | 'cancelado' | 'demasiadas' }
  | { ok: 'redirigiendo' }; // en la web: la página se va a Google o Microsoft

export async function vincularCuenta(proveedor: ProveedorCorreo): Promise<ResultadoVincular> {
  const web = Platform.OS === 'web';
  // En la web se vuelve a la misma pantalla (github.io/rusko/resumenes o localhost).
  const vuelta = web ? `${window.location.origin}${window.location.pathname}` : VUELTA_APP;
  const inicio = await empezarEnServidor(proveedor, vuelta, await tokenDeAvisos().catch(() => null));
  if (!inicio.ok) return inicio;
  if (web) {
    window.location.assign(inicio.datos);
    return { ok: 'redirigiendo' };
  }
  const resultado = await WebBrowser.openAuthSessionAsync(inicio.datos, VUELTA_APP);
  if (resultado.type !== 'success') return { ok: false, motivo: 'cancelado' };
  const datos = new URL(resultado.url).searchParams;
  await actualizarCorreos({ servidor: true });
  if (datos.get('correo') === 'ok') return { ok: true, email: datos.get('cuenta') };
  if (datos.get('correo') === 'cancelado') return { ok: false, motivo: 'cancelado' };
  return { ok: false, motivo: datos.get('motivo') === 'demasiadas' ? 'demasiadas' : 'error' };
}

// Desvincula la cuenta en el servidor (se borra allí todo lo suyo) y quita sus
// resúmenes del móvil. Las tareas creadas se quedan.
export async function quitarCuenta(cuenta: CuentaCorreo): Promise<boolean> {
  const r = await quitarEnServidor(cuenta.id);
  if (!r.ok) return false;
  const { cuentas, correos } = await leerCorreos();
  await guardarCuentas(cuentas.filter((c) => c.id !== cuenta.id));
  await guardarCorreos(sinCuenta(correos, cuenta.email));
  return true;
}

export type ResultadoConectar = { ok: true } | { ok: false; motivo: 'enlace' | 'sin-conexion' | 'no-responde' };

// Pega el enlace del ayudante: comprueba que responde y trae los correos.
export async function conectarCorreo(texto: string): Promise<ResultadoConectar> {
  const enlace = leerEnlace(texto);
  if (!enlace) return { ok: false, motivo: 'enlace' };
  const respuesta = await pedirAlAyudante(enlace);
  if (!respuesta.ok) return respuesta;
  await guardarConexion({
    enlace,
    conectadoEl: new Date().toISOString(),
    actualizadoEl: null,
    ultimaRevision: null,
    error: null,
  });
  await actualizarCorreos();
  return { ok: true };
}

// Desconecta el ayudante de Gmail y olvida sus resúmenes (los de las cuentas
// vinculadas se quedan). Las tareas creadas se quedan.
export async function desconectarCorreo(): Promise<void> {
  const { correos } = await leerCorreos();
  await guardarConexion(null);
  await guardarCorreos(correos.filter((c) => c.cuenta !== undefined));
}

// "Avisarme siempre de…": pone o quita al remitente y se lo dice al servidor y al
// ayudante (se manda con cada petición).
export async function alternarSiempre(de: string): Promise<void> {
  const { siempre, cuentas } = await leerCorreos();
  await guardarSiempre(cambiarSiempre(siempre, de));
  await actualizarCorreos({ servidor: cuentas.length > 0 }).catch(() => {});
}

export async function marcarCorreosVistos(): Promise<void> {
  const { correos } = await leerCorreos();
  if (correos.some((c) => !c.visto)) await guardarCorreos(correos.map((c) => (c.visto ? c : { ...c, visto: true })));
}

// Borra la tarea o cita que se creó de un correo, si sigue en el calendario sin hacer.
async function borrarLoApuntado(correo: CorreoResumido): Promise<void> {
  if (!correo.eventoId) return;
  const tarea = (await leerEventos()).find((e) => e.id === correo.eventoId);
  if (tarea && !tarea.hecha) await borrarEvento(tarea.id);
}

// "¿Eliminar cita?" → sí (antes "Quitar de las tareas"): borra la tarea o cita (si
// sigue sin hacer) y no se vuelve a crear. El correo se queda en la pestaña.
export async function quitarPlazo(id: string): Promise<void> {
  const { correos } = await leerCorreos();
  const correo = correos.find((c) => c.id === id);
  if (!correo) return;
  await borrarLoApuntado(correo);
  await guardarCorreos(correos.map((c) => (c.id === id ? { ...c, noEsPlazo: true } : c)));
}

// Deshace "¿Eliminar cita?": la vuelve a apuntar (si su día no ha pasado).
export async function volverAApuntar(id: string): Promise<void> {
  const { correos } = await leerCorreos();
  const cambiados = correos.map((c) => (c.id === id ? { ...c, noEsPlazo: false, eventoId: null } : c));
  await guardarCorreos(await crearTareas(cambiados));
}

// Vetar una dirección: sus correos dejan de salir (también lo ya guardado, y se borran
// las tareas y citas sin hacer que crearon) y se avisa al servidor y al ayudante para
// que no los guarden ni avisen. Devuelve false si no es una dirección.
export async function vetarDireccion(direccion: string): Promise<boolean> {
  const { vetados, correos, cuentas } = await leerCorreos();
  const nuevos = cambiarVetados(vetados, direccion, true);
  if (!nuevos) return false;
  await guardarVetados(nuevos);
  const fuera = correos.filter((c) => deVetado(c, nuevos));
  for (const correo of fuera) await borrarLoApuntado(correo);
  if (fuera.length) await guardarCorreos(correos.filter((c) => !fuera.includes(c)));
  await actualizarCorreos({ servidor: cuentas.length > 0 }).catch(() => {});
  return true;
}

// Quita el veto: sus correos vuelven a salir desde la próxima vez que se traigan (los
// que el servidor o el ayudante ya dieron por vistos mientras estaba vetada, no).
export async function quitarVeto(direccion: string): Promise<void> {
  const { vetados, cuentas } = await leerCorreos();
  const nuevos = cambiarVetados(vetados, direccion, false) ?? vetados.filter((v) => v !== direccion);
  await guardarVetados(nuevos);
  await actualizarCorreos({ servidor: cuentas.length > 0 }).catch(() => {});
}

// Se llama una vez al arrancar la app: trae los correos al abrirla, al volver a ella
// y cuando llega un aviso de correo con la app abierta.
export function iniciarCorreo(): () => void {
  cargarCorreos().then(() => actualizarCorreos().catch(() => {}));
  const app = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') actualizarCorreos().catch(() => {});
  });
  const quitarPush = escucharPush('correo', () => actualizarCorreos().catch(() => {}));
  return () => {
    app.remove();
    quitarPush();
  };
}
