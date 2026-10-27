import { AppState } from 'react-native';

import { guardarAlarma } from '@/data/alarmas';
import { cambiarEventos, leerEventos } from '@/data/eventos';
import { cargarPerfil } from '@/data/perfil';
import { anadirRecogidoSiri, cambiarSiri } from '@/data/siri';
import { asegurarSesion, obtenerSupabase } from '@/data/supabase';

import { procesarPendientes, type PendienteSiri } from './procesar';

export { ETIQUETA_SIRI, procesarPendientes, type PendienteSiri } from './procesar';
export { NOMBRE_ALARMA, NOMBRE_APUNTAR, PASOS_ALARMA, PASOS_APUNTAR } from './atajos';

// Siri con Atajos (27/10/2026). Lo que se dice a Siri espera en el servidor (función
// siri) y aquí se recoge al abrir Rusko y al volver a ella: se apunta (procesar.ts) y
// solo entonces se borra del buzón. Sin servidor o sin sesión no hace nada.

async function llamar<T>(cuerpo: Record<string, unknown>, crearSesion = true): Promise<T | null> {
  const supabase = obtenerSupabase();
  if (!supabase) return null;
  if (crearSesion) {
    await asegurarSesion(supabase);
  } else {
    // Recoger no crea un usuario anónimo nuevo: sin sesión no puede haber nada esperando.
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
  }
  const { data, error } = await supabase.functions.invoke('siri', { body: cuerpo, timeout: 20000 });
  if (error) throw error;
  return data as T;
}

// Crea el enlace personal (o lo cambia: el anterior deja de valer). null si no hay servidor.
export async function crearEnlaceSiri(): Promise<string | null> {
  const respuesta = await llamar<{ enlace: string }>({ accion: 'crear-enlace' });
  if (!respuesta?.enlace) return null;
  await cambiarSiri({ enlace: respuesta.enlace });
  return respuesta.enlace;
}

export async function quitarEnlaceSiri(): Promise<void> {
  await llamar({ accion: 'quitar' });
  await cambiarSiri({ enlace: null });
}

export type EstadoSiriServidor = { conectado: boolean; ultimoUso: string | null };

export async function estadoSiriServidor(): Promise<EstadoSiriServidor | null> {
  return llamar<EstadoSiriServidor>({ accion: 'estado' });
}

let enMarcha: Promise<number> | null = null;

// Trae lo pendiente, lo guarda y lo borra del buzón. Devuelve cuántas cosas ha apuntado.
export function recogerSiri(): Promise<number> {
  if (!enMarcha) {
    enMarcha = recoger().finally(() => {
      enMarcha = null;
    });
  }
  return enMarcha;
}

async function recoger(): Promise<number> {
  // Sin bienvenida no se apunta nada: el dispositivo aún puede traer la copia de la nube.
  const { perfil, bienvenidaCompletada } = await cargarPerfil();
  if (!bienvenidaCompletada) return 0;
  const respuesta = await llamar<{ pendientes: PendienteSiri[] }>({ accion: 'recoger' }, false);
  const pendientes = respuesta?.pendientes ?? [];
  if (pendientes.length === 0) return 0;

  const resultado = procesarPendientes(pendientes, { ahora: new Date(), perfil, eventos: await leerEventos() });
  await cambiarEventos(resultado.eventos, []);
  for (const alarma of resultado.alarmas) await guardarAlarma(alarma);
  await llamar({ accion: 'confirmar', ids: resultado.ids }, false);
  anadirRecogidoSiri(resultado.hechos);
  return resultado.hechos.length;
}

function intentar() {
  recogerSiri().catch(() => {});
}

// En _layout: al abrir la app y cada vez que se vuelve a ella.
export function iniciarSiri(): () => void {
  intentar();
  const app = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') intentar();
  });
  return () => app.remove();
}
