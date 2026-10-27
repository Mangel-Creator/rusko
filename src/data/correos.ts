import { useEffect, useSyncExternalStore } from 'react';

import type { ClaveDia } from '@/services/fechas';

import { guardarAjuste, leerAjuste } from './ajustes';

// Resúmenes de correo (fase 11). Llegan por dos vías:
//   - cuentas vinculadas con "Vincular con Gmail / Outlook": las revisa el servidor de
//     Organizy (función correo-cuentas); aquí se guarda la lista ("organizy:cuentasCorreo");
//   - el ayudante de Gmail del usuario (gmail/organizy-correo.js, en su cuenta de
//     Google): aquí se guarda su dirección ("organizy:correo").
// La app copia los resúmenes en el dispositivo ("organizy:correos") para verlos aunque
// no haya conexión.
//
//   - En pantallas: const { cargado, conexion, cuentas, proveedores, correos } = useCorreos();
//   - Fuera de pantallas: await leerCorreos(); suscribirseCorreos(...)
//   - Para cambiar: guardarConexion, guardarCuentas, guardarCorreos, guardarSiempre y
//     guardarVetados (services/correo hace el resto).

export type ProveedorCorreo = 'gmail' | 'outlook';

// Una cuenta vinculada en el servidor.
export type CuentaCorreo = {
  id: string;
  proveedor: ProveedorCorreo;
  email: string;
  estado: 'ok' | 'caducada'; // caducada: hay que volver a iniciar sesión
  ultimaRevision: string | null;
};

// Qué botones de "Vincular con…" están activados en el servidor.
export type ProveedoresCorreo = Record<ProveedorCorreo, boolean>;

// Lo que manda el ayudante de Gmail o el servidor.
export type CorreoRemoto = {
  id: string; // el del mensaje en Gmail
  recibido: string; // ISO
  de: string; // "Gestoría López"
  direccion?: string; // "info@gl.es" (los de antes del 27/10/2026 no la traen)
  asunto: string;
  titulo: string;
  // Desde el 26/10/2026 no hay resúmenes: solo la línea del aviso de un correo
  // importante ("Te pide que le confirmes hoy…"), o vacío. Los antiguos pueden traer uno.
  resumen: string;
  fechaLimite: ClaveDia | null; // el día que importa: un plazo, una cita, un cargo
  hora?: string | null; // "HH:MM" si es una cita con hora (desde el 27/10/2026)
  tarea: string | null; // lo que hay que hacer (o la cita), para el calendario
  importante?: boolean; // lo dice la IA, o es de "Avisarme siempre de…"
  via: 'reglas' | 'ia';
  enlace: string; // abre el correo en Gmail u Outlook
  origen?: ProveedorCorreo; // solo en los de las cuentas vinculadas
  cuenta?: string; // el correo de la cuenta vinculada de la que viene
};

export type CorreoResumido = CorreoRemoto & {
  // Solo en el dispositivo:
  visto: boolean;
  eventoId: string | null; // tarea o cita creada en el calendario (aunque luego se borre)
  noEsPlazo: boolean; // "¿Eliminar cita?" aceptado: se queda en la pestaña, sin tarea ni cita
};

export type ConexionCorreo = {
  enlace: string; // URL de la "Aplicación web" del ayudante
  conectadoEl: string; // ISO
  actualizadoEl: string | null; // última vez que la app trajo los correos
  ultimaRevision: string | null; // última vez que el ayudante miró el correo
  error: 'sin-conexion' | 'no-responde' | null;
};

type Estado = {
  cargado: boolean;
  conexion: ConexionCorreo | null;
  cuentas: CuentaCorreo[];
  proveedores: ProveedoresCorreo | null; // null hasta que conteste el servidor
  correos: CorreoResumido[];
  siempre: string[]; // "Avisarme siempre de…": remitentes tal como salen en la lista
  vetados: string[]; // direcciones vetadas: sus correos no salen nada en Rusko
};

const CLAVE_CONEXION = 'correo';
const CLAVE_CORREOS = 'correos';
const CLAVE_CUENTAS = 'cuentasCorreo';
const CLAVE_SIEMPRE = 'correoSiempre';
const CLAVE_VETADOS = 'correoVetados';

let estado: Estado = { cargado: false, conexion: null, cuentas: [], proveedores: null, correos: [], siempre: [], vetados: [] };
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function cambiar(cambios: Partial<Estado>) {
  estado = { ...estado, ...cambios, cargado: true };
  oyentes.forEach((avisar) => avisar());
}

export function cargarCorreos(): Promise<void> {
  if (!cargando) {
    cargando = Promise.all([
      leerAjuste<ConexionCorreo | null>(CLAVE_CONEXION, null),
      leerAjuste<CorreoResumido[]>(CLAVE_CORREOS, []),
      leerAjuste<CuentaCorreo[]>(CLAVE_CUENTAS, []),
      leerAjuste<string[]>(CLAVE_SIEMPRE, []),
      leerAjuste<string[]>(CLAVE_VETADOS, []),
    ]).then(([conexion, correos, cuentas, siempre, vetados]) =>
      cambiar({
        conexion,
        correos: Array.isArray(correos) ? correos : [],
        cuentas: Array.isArray(cuentas) ? cuentas : [],
        siempre: Array.isArray(siempre) ? siempre.filter((s) => typeof s === 'string') : [],
        vetados: Array.isArray(vetados) ? vetados.filter((s) => typeof s === 'string') : [],
      }),
    );
  }
  return cargando;
}

export async function leerCorreos(): Promise<Omit<Estado, 'cargado'>> {
  await cargarCorreos();
  const { cargado: _cargado, ...resto } = estado;
  return resto;
}

export async function guardarConexion(conexion: ConexionCorreo | null): Promise<void> {
  await cargarCorreos();
  cambiar({ conexion });
  await guardarAjuste(CLAVE_CONEXION, conexion);
}

export async function guardarCuentas(cuentas: CuentaCorreo[], proveedores?: ProveedoresCorreo): Promise<void> {
  await cargarCorreos();
  cambiar(proveedores ? { cuentas, proveedores } : { cuentas });
  await guardarAjuste(CLAVE_CUENTAS, cuentas);
}

export async function guardarCorreos(correos: CorreoResumido[]): Promise<void> {
  await cargarCorreos();
  cambiar({ correos });
  await guardarAjuste(CLAVE_CORREOS, correos);
}

export async function guardarSiempre(siempre: string[]): Promise<void> {
  await cargarCorreos();
  cambiar({ siempre });
  await guardarAjuste(CLAVE_SIEMPRE, siempre);
}

export async function guardarVetados(vetados: string[]): Promise<void> {
  await cargarCorreos();
  cambiar({ vetados });
  await guardarAjuste(CLAVE_VETADOS, vetados);
}

function suscribirse(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

export { suscribirse as suscribirseCorreos };

function leerEstado() {
  return estado;
}

export function useCorreos(): Estado {
  useEffect(() => {
    cargarCorreos();
  }, []);
  return useSyncExternalStore(suscribirse, leerEstado, leerEstado);
}
