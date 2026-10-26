import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import type { CorreoRemoto, CuentaCorreo, ProveedorCorreo, ProveedoresCorreo } from '@/data/correos';
import { asegurarSesion, obtenerSupabase } from '@/data/supabase';

import { validarRemoto } from './correos';

// "Vincular con Gmail / Outlook" (fase 11): lo que la app pide a la función
// correo-cuentas del servidor, con la sesión anónima de este dispositivo.

export type FalloServidor = 'sin-servidor' | 'sin-conexion' | 'sin-configurar' | 'limite' | 'error';
type Resultado<T> = { ok: true; datos: T } | { ok: false; motivo: FalloServidor };

async function motivoDelError(error: unknown): Promise<FalloServidor> {
  if (error instanceof FunctionsHttpError) {
    const respuesta = error.context as Response | undefined;
    if (respuesta?.status === 429) return 'limite';
    const cuerpo = (await respuesta?.json().catch(() => null)) as { error?: string } | null;
    return cuerpo?.error === 'sin-configurar' ? 'sin-configurar' : 'error';
  }
  if (error instanceof FunctionsFetchError || error instanceof TypeError) return 'sin-conexion';
  return 'error';
}

async function pedir<T>(cuerpo: Record<string, unknown>): Promise<Resultado<T>> {
  const supabase = obtenerSupabase();
  if (!supabase) return { ok: false, motivo: 'sin-servidor' };
  try {
    await asegurarSesion(supabase);
    const { data, error } = await supabase.functions.invoke('correo-cuentas', { body: cuerpo, timeout: 30000 });
    if (error) return { ok: false, motivo: await motivoDelError(error) };
    return { ok: true, datos: data as T };
  } catch (error) {
    return { ok: false, motivo: await motivoDelError(error) };
  }
}

const esCuenta = (c: unknown): c is CuentaCorreo => {
  if (!c || typeof c !== 'object') return false;
  const d = c as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    (d.proveedor === 'gmail' || d.proveedor === 'outlook') &&
    typeof d.email === 'string' &&
    (d.estado === 'ok' || d.estado === 'caducada')
  );
};

export type EstadoServidor = { proveedores: ProveedoresCorreo; cuentas: CuentaCorreo[]; correos: CorreoRemoto[] };

// Cuentas vinculadas y correos de los últimos 7 días. De paso apunta este móvil
// para los avisos (tokenPush) y la lista de "Avisarme siempre de…".
export async function estadoEnServidor(tokenPush: string | null, siempre: string[]): Promise<Resultado<EstadoServidor>> {
  const r = await pedir<{ proveedores?: Partial<ProveedoresCorreo>; cuentas?: unknown[]; correos?: unknown[] }>({
    accion: 'estado',
    tokenPush,
    siempre,
  });
  if (!r.ok) return r;
  return {
    ok: true,
    datos: {
      proveedores: { gmail: r.datos.proveedores?.gmail === true, outlook: r.datos.proveedores?.outlook === true },
      cuentas: (r.datos.cuentas ?? []).filter(esCuenta).map((c) => ({
        id: c.id,
        proveedor: c.proveedor,
        email: c.email,
        estado: c.estado,
        ultimaRevision: typeof c.ultimaRevision === 'string' ? c.ultimaRevision : null,
      })),
      correos: (r.datos.correos ?? []).map(validarRemoto).filter((c): c is CorreoRemoto => c !== null),
    },
  };
}

// La dirección de Google o Microsoft para iniciar sesión.
export async function empezarEnServidor(
  proveedor: ProveedorCorreo,
  vuelta: string,
  tokenPush: string | null,
): Promise<Resultado<string>> {
  const r = await pedir<{ url?: string }>({ accion: 'empezar', proveedor, vuelta, tokenPush });
  if (!r.ok) return r;
  const url = r.datos.url;
  const valida =
    typeof url === 'string' &&
    (url.startsWith('https://accounts.google.com/') || url.startsWith('https://login.microsoftonline.com/'));
  return valida ? { ok: true, datos: url } : { ok: false, motivo: 'error' };
}

export async function quitarEnServidor(id: string): Promise<Resultado<null>> {
  const r = await pedir<unknown>({ accion: 'quitar', id });
  return r.ok ? { ok: true, datos: null } : r;
}
