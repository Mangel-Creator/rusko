import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { nuevoIdEpoca, type Epoca, type Hito, type RegistroBloque } from '@/data/epocas';
import type { Perfil } from '@/data/perfil';
import { asegurarSesion, obtenerSupabase } from '@/data/supabase';
import { claveDia, type ClaveDia } from '@/services/fechas';
import { limiteDelError, mensajeLimite } from '@/services/ia';

import type { PdfLeido } from './apuntes';
import { diasEntre } from './estado';
import {
  examenGuardado,
  lineasAprendidas,
  temasMedidos,
  type PerfilEstudio,
  type TemaMedido,
} from './perfilEstudio';
import type { PlanEpoca } from './plan';
import {
  aplicarSupervision,
  datosRepaso,
  MAX_OTROS,
  MAX_TEXTO_EPOCA,
  MAX_TEXTO_TEMARIO,
  propuestaUtil,
  validarPreparacion,
  validarRepaso,
  validarTemas,
  type PropuestaEpoca,
  type PropuestaTemas,
  type Repaso,
  type RespuestasCuestionario,
  type TipoExamen,
} from './validarIA';

// La IA ayuda a planificar la Época dorada: manda lo necesario a la función
// "epoca" del servidor propio (supabase/functions/epoca), que pregunta a Claude.
// Aquí nunca se guarda nada: la pantalla enseña la propuesta y el usuario decide.
// No se exporta desde services/epoca/index.ts para que la lógica pura (y sus
// pruebas) no carguen la conexión con el servidor.

const ESPERA_MAX_MS = 30000;
// Revisar el plan es corto; buscar cómo es un examen o leer un PDF tarda más.
// Cubren el reintento del servidor.
const ESPERA_SUPERVISAR_MS = 60000;
const ESPERA_FICHA_MS = 90000;
const ESPERA_MEDIR_MS = 120000;
// De la ficha del examen basta el principio (partes, duración y nota): menos tokens.
const MAX_FICHA_SUPERVISAR = 600;

export type MotivoFalloIA =
  | 'sin-configurar'
  | 'sin-clave'
  | 'sin-conexion'
  | 'limite'
  | 'limite-ia'
  | 'no-entendido'
  | 'pdf'
  | 'error';

export type ResultadoIA<T> = { estado: 'ok'; datos: T } | { estado: 'fallo'; motivo: MotivoFalloIA; mensaje: string };

const MENSAJES: Record<MotivoFalloIA, string> = {
  'sin-configurar': 'La ayuda de la IA no está activada en esta versión. Puedes rellenarlo a mano.',
  'sin-clave': 'La ayuda de la IA aún no está encendida. Mientras tanto, puedes rellenarlo a mano.',
  'sin-conexion': 'Sin conexión. Prueba otra vez en un rato o rellénalo a mano.',
  limite: 'Has usado la IA muchas veces hoy. Mañana vuelve a funcionar.',
  'limite-ia': 'Has gastado la IA por ahora. Mientras, puedes rellenarlo a mano.',
  'no-entendido': 'No lo he pillado del todo. Cuéntamelo con otras palabras o rellénalo a mano.',
  pdf: 'No he podido leer ese PDF. Si es muy largo o está escaneado, pártelo y añade las partes de una en una.',
  error: 'No he podido hacerlo ahora. Prueba otra vez en un rato.',
};

function fallo<T>(motivo: MotivoFalloIA): ResultadoIA<T> {
  return { estado: 'fallo', motivo, mensaje: MENSAJES[motivo] };
}

async function llamar(cuerpo: Record<string, unknown>, espera = ESPERA_MAX_MS): Promise<ResultadoIA<unknown>> {
  const supabase = obtenerSupabase();
  if (!supabase) return fallo('sin-configurar');
  try {
    await asegurarSesion(supabase);
    const { data, error } = await supabase.functions.invoke('epoca', { body: cuerpo, timeout: espera });
    if (error) {
      // Se ha acabado la IA de las 5 horas o de la semana: se dice cuándo vuelve.
      const limite = await limiteDelError(error);
      if (limite) {
        const mensaje = `${mensajeLimite(limite, new Date())} Mientras, puedes rellenarlo a mano.`;
        return { estado: 'fallo', motivo: 'limite-ia', mensaje };
      }
      return fallo(await motivoDelError(error));
    }
    const resultado = (data as { resultado?: unknown } | null)?.resultado;
    return resultado ? { estado: 'ok', datos: resultado } : fallo('error');
  } catch (error) {
    return fallo(await motivoDelError(error));
  }
}

async function motivoDelError(error: unknown): Promise<MotivoFalloIA> {
  if (error instanceof FunctionsHttpError) {
    const respuesta = error.context as Response | undefined;
    if (respuesta?.status === 429) return 'limite';
    if (respuesta?.status === 422) return 'pdf';
    if (respuesta?.status === 503) {
      const cuerpo = await respuesta.clone().json().catch(() => null);
      if ((cuerpo as { error?: string } | null)?.error === 'sin-clave') return 'sin-clave';
    }
    return 'error';
  }
  if (error instanceof FunctionsFetchError || error instanceof TypeError) return 'sin-conexion';
  const mensaje = error instanceof Error ? error.message.toLowerCase() : '';
  if (mensaje.includes('network') || mensaje.includes('fetch') || mensaje.includes('timeout')) return 'sin-conexion';
  return 'error';
}

// 0. "Preparar mi plan": la app lo hace (services/epoca/planLocal.ts) y la IA lo
//    supervisa. Va un resumen: por examen, sus datos (sin el id), cómo es si lo ha
//    buscado y las piezas del plan con sus horas; su tiempo, cómo estudia, los
//    consejos, lo aprendido de otros planes y lo que escriba en "¿Algo más?".
export async function supervisarPlan(
  respuestas: RespuestasCuestionario,
  local: PropuestaEpoca,
  estudio: PerfilEstudio,
): Promise<ResultadoIA<PropuestaEpoca>> {
  const asignaturas = local.hitos.map((h) => {
    const a = respuestas.asignaturas.find((x) => x.nombre === h.nombre);
    return {
      nombre: h.nombre,
      fecha: h.fecha,
      hora: h.hora,
      tipoExamen: a?.tipoExamen,
      temas: a?.temas,
      avance: a?.avance,
      dificultad: h.dificultad,
      anteriores: a?.anteriores,
      ficha: (examenGuardado(estudio, h.nombre).ficha?.texto ?? '').slice(0, MAX_FICHA_SUPERVISAR),
      plan: h.temas,
    };
  });
  const { horasDia, rindeMas, diaLibre, habitos } = respuestas;
  const r = await llamar(
    {
      accion: 'supervisar',
      hoy: claveDia(new Date()),
      respuestas: { asignaturas, horasDia, rindeMas, diaLibre, habitos, otros: respuestas.otros.trim().slice(0, MAX_OTROS) },
      descanso: local.descanso,
      consejos: local.consejos,
      aprendido: lineasAprendidas(estudio),
    },
    ESPERA_SUPERVISAR_MS,
  );
  if (r.estado === 'fallo') return r;
  const plan = aplicarSupervision(respuestas, local, r.datos);
  return plan ? { estado: 'ok', datos: plan } : fallo('no-entendido');
}

// 0b. "Buscar cómo es este examen": solo el nombre, lo que añada para encontrarlo
//     (centro, nivel, convocatoria) y el tipo. Claude lo busca en internet.
export async function fichaConIA(examen: string, detalle: string, tipoExamen: TipoExamen): Promise<ResultadoIA<string>> {
  const r = await llamar(
    { accion: 'ficha', hoy: claveDia(new Date()), examen: examen.trim(), detalle: detalle.trim(), tipoExamen },
    ESPERA_FICHA_MS,
  );
  if (r.estado === 'fallo') return r;
  const texto = (r.datos as { texto?: unknown }).texto;
  return typeof texto === 'string' && texto.trim() ? { estado: 'ok', datos: texto.trim() } : fallo('error');
}

// 0c. "Medir mis apuntes": solo para saber cuánto ocupa cada tema. Va el mapa de
//     páginas leído en el dispositivo (services/epoca/apuntes.ts) o, si son fotos
//     escaneadas, el PDF entero.
export async function medirApuntesConIA(
  examen: string,
  apuntes: { mapa: string; leido: PdfLeido } | { pdf: string },
): Promise<ResultadoIA<TemaMedido[]>> {
  const contenido = 'pdf' in apuntes ? { pdf: apuntes.pdf } : { mapa: apuntes.mapa };
  const r = await llamar(
    { accion: 'medir', hoy: claveDia(new Date()), examen: examen.trim(), ...contenido },
    ESPERA_MEDIR_MS,
  );
  if (r.estado === 'fallo') return r;
  const temas = temasMedidos(r.datos, 'leido' in apuntes ? apuntes.leido : undefined);
  return temas ? { estado: 'ok', datos: temas } : fallo('pdf');
}

// 1. "Cuéntamelo y lo preparo": manda el texto, el día, el horario normal y los
//    nombres de los sitios habituales (sin direcciones).
export async function prepararEpocaConIA(texto: string, perfil: Perfil | null): Promise<ResultadoIA<PropuestaEpoca>> {
  const hoy = claveDia(new Date());
  const sitios = (perfil?.sitios ?? []).map((s) => ({ id: s.id, nombre: s.nombre }));
  const r = await llamar({
    accion: 'preparar',
    hoy,
    texto: texto.trim().slice(0, MAX_TEXTO_EPOCA),
    sitios,
    horario: perfil ? { levantarse: perfil.horario.levantarse, acostarse: perfil.horario.acostarse } : null,
  });
  if (r.estado === 'fallo') return r;
  const propuesta = validarPreparacion(r.datos, { hoy, sitiosIds: sitios.map((s) => s.id) });
  return propuesta && propuestaUtil(propuesta) ? { estado: 'ok', datos: propuesta } : fallo('no-entendido');
}

// 2. "Temario por temas": el hito (nombre, fecha, dificultad y horas) y el temario.
export async function temasConIA(hito: Hito, temario: string): Promise<ResultadoIA<PropuestaTemas>> {
  const hoy: ClaveDia = claveDia(new Date());
  const r = await llamar({
    accion: 'temario',
    hoy,
    temario: temario.trim().slice(0, MAX_TEXTO_TEMARIO),
    hito: {
      nombre: hito.nombre,
      fecha: hito.fecha,
      diasHasta: Math.max(0, diasEntre(hoy, hito.fecha)),
      dificultad: hito.dificultad,
      horasPreparacion: hito.horasPreparacion,
    },
  });
  if (r.estado === 'fallo') return r;
  const propuesta = validarTemas(r.datos, nuevoIdEpoca);
  return propuesta ? { estado: 'ok', datos: propuesta } : fallo('no-entendido');
}

// 3. "Repaso de cómo vas": solo números y los nombres de los hitos que quedan.
export async function repasoConIA(
  epoca: Epoca,
  registro: RegistroBloque[],
  plan: PlanEpoca,
): Promise<ResultadoIA<Repaso>> {
  const hoy = claveDia(new Date());
  const r = await llamar({ accion: 'repaso', hoy, estado: datosRepaso(epoca, registro, plan, hoy) });
  if (r.estado === 'fallo') return r;
  const repaso = validarRepaso(r.datos, epoca, hoy);
  return repaso ? { estado: 'ok', datos: repaso } : fallo('error');
}
