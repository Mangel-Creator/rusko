// Organizy · Votación de planes (fase 8).
//
// La usa la página de votación (mangel-creator.github.io/rusko/votar#código), que
// abren los invitados sin cuenta ni app. Por eso no pide sesión: lo que deja entrar
// es el código del enlace (32 letras y números al azar). Dos acciones:
//   - "ver": el plan, sus horas y los votos que lleva cada una.
//   - "votar": guarda el voto (nombre + horas) y avisa al organizador con un push
//     ("Laura ha votado. Ganan las 21:00 con 3 de 3. ¿La cerramos?").
//
// Si alguien vuelve a votar con el mismo nombre, se cambia su voto (no cuenta dos veces).
// Límite: 60 votos al día por plan y 5000 en total, para que nadie lo sature.
// Los push van por el servicio de Expo, que no necesita clave.

import { respuestaJson, respuestaPrevia } from '../_shared/cors.ts';
import { numeroDeEntorno, sumarUso } from '../_shared/limite.ts';
import { avisoVotoNuevo, claveNombre, ordenarHoras, type HoraVotable, type VotoInvitado } from '../_shared/recuento.ts';
import { clienteAdmin } from '../_shared/usuario.ts';

const LIMITE_POR_PLAN = numeroDeEntorno('VOTAR_LIMITE_PLAN', 60);
const LIMITE_GLOBAL = numeroDeEntorno('VOTAR_LIMITE_GLOBAL', 5000);
const MAX_INVITADOS = 50;
const MAX_NOMBRE = 40;

type Plan = {
  id: string;
  titulo: string;
  tipo: string;
  organizador: string;
  personas: number;
  estado: string;
  hora_elegida: string | null;
  aviso_token: string | null;
};

type Peticion =
  | { accion: 'ver'; codigo: string }
  | { accion: 'votar'; codigo: string; nombre: string; horas: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function leerPeticion(datos: unknown): Peticion | null {
  if (!datos || typeof datos !== 'object') return null;
  const d = datos as Record<string, unknown>;
  if (typeof d.codigo !== 'string' || !/^[0-9a-f]{32}$/.test(d.codigo)) return null;
  if (d.accion === 'ver') return { accion: 'ver', codigo: d.codigo };
  if (d.accion !== 'votar') return null;
  const nombre = typeof d.nombre === 'string' ? d.nombre.replace(/\s+/g, ' ').trim() : '';
  if (!nombre || nombre.length > MAX_NOMBRE) return null;
  if (!Array.isArray(d.horas) || d.horas.length < 1 || d.horas.length > 4) return null;
  const horas = [...new Set(d.horas)].filter((h): h is string => typeof h === 'string' && UUID.test(h));
  if (horas.length !== d.horas.length) return null;
  return { accion: 'votar', codigo: d.codigo, nombre, horas };
}

async function leerPlan(codigo: string): Promise<Plan | null> {
  const { data, error } = await clienteAdmin()
    .from('planes')
    .select('id, titulo, tipo, organizador, personas, estado, hora_elegida, aviso_token')
    .eq('codigo', codigo)
    .gt('borrar_el', new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`leer plan: ${error.message}`);
  return data as Plan | null;
}

async function leerVotacion(planId: string): Promise<{ horas: HoraVotable[]; votos: VotoInvitado[] }> {
  const admin = clienteAdmin();
  const [horas, invitados] = await Promise.all([
    admin.from('horas').select('id, dia, hora').eq('plan_id', planId),
    admin.from('invitados').select('nombre, votado_el, votos(hora_id)').eq('plan_id', planId).order('votado_el'),
  ]);
  if (horas.error) throw new Error(`leer horas: ${horas.error.message}`);
  if (invitados.error) throw new Error(`leer invitados: ${invitados.error.message}`);
  const votos = (invitados.data as { nombre: string; votos: { hora_id: string }[] }[]).map((i) => ({
    nombre: i.nombre,
    horas: i.votos.map((v) => v.hora_id),
  }));
  return { horas: ordenarHoras(horas.data as HoraVotable[]), votos };
}

// Lo que ve la página: sin el token de avisos ni ids internos que no necesite.
function respuestaPlan(plan: Plan, horas: HoraVotable[], votos: VotoInvitado[]) {
  return {
    plan: {
      titulo: plan.titulo,
      tipo: plan.tipo,
      organizador: plan.organizador,
      personas: plan.personas,
      estado: plan.estado,
      horaElegida: plan.hora_elegida,
    },
    horas,
    votos,
  };
}

async function avisarOrganizador(plan: Plan, nombre: string, horas: HoraVotable[], votos: VotoInvitado[]) {
  const token = plan.aviso_token;
  if (!token || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) return;
  const { titulo, cuerpo } = avisoVotoNuevo(nombre, horas, votos, plan.personas);
  try {
    const respuesta = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: titulo,
        body: cuerpo,
        sound: 'default',
        // Al tocarlo, la app abre el plan (ver services/avisos en la app).
        data: {
          tipo: 'plan-voto',
          dia: new Date().toISOString().slice(0, 10),
          destino: { pantalla: 'plan', id: plan.id },
        },
      }),
    });
    const resultado = await respuesta.json().catch(() => null);
    // Si el móvil ya no existe (app borrada), se deja de intentar.
    if (resultado?.data?.details?.error === 'DeviceNotRegistered') {
      await clienteAdmin().from('planes').update({ aviso_token: null }).eq('id', plan.id);
    }
  } catch (error) {
    console.error('push', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respuestaPrevia(req);
  if (req.method !== 'POST') return respuestaJson(req, { error: 'metodo' }, 405);

  const peticion = leerPeticion(await req.json().catch(() => null));
  if (!peticion) return respuestaJson(req, { error: 'peticion' }, 400);

  try {
    const plan = await leerPlan(peticion.codigo);
    if (!plan) return respuestaJson(req, { error: 'no-existe' }, 404);

    if (peticion.accion === 'ver') {
      const { horas, votos } = await leerVotacion(plan.id);
      return respuestaJson(req, respuestaPlan(plan, horas, votos));
    }

    if (plan.estado !== 'abierto') return respuestaJson(req, { error: 'cerrado' }, 409);
    const antes = await leerVotacion(plan.id);
    const idsHoras = new Set(antes.horas.map((h) => h.id));
    if (!peticion.horas.every((h) => idsHoras.has(h))) return respuestaJson(req, { error: 'peticion' }, 400);

    const clave = claveNombre(peticion.nombre);
    const yaHabiaVotado = antes.votos.some((v) => claveNombre(v.nombre) === clave);
    if (!yaHabiaVotado && antes.votos.length >= MAX_INVITADOS) return respuestaJson(req, { error: 'lleno' }, 409);

    const uso = await sumarUso(plan.id, 'votar', LIMITE_POR_PLAN, LIMITE_GLOBAL);
    if (!uso.permitido) return respuestaJson(req, { error: uso.motivo }, 429);

    const admin = clienteAdmin();
    const invitado = await admin
      .from('invitados')
      .upsert(
        { plan_id: plan.id, nombre: peticion.nombre, clave, votado_el: new Date().toISOString() },
        { onConflict: 'plan_id,clave' },
      )
      .select('id')
      .single();
    if (invitado.error) throw new Error(`guardar invitado: ${invitado.error.message}`);
    const invitadoId = (invitado.data as { id: string }).id;
    const borrados = await admin.from('votos').delete().eq('invitado_id', invitadoId);
    if (borrados.error) throw new Error(`borrar votos: ${borrados.error.message}`);
    const nuevos = await admin
      .from('votos')
      .insert(peticion.horas.map((hora_id) => ({ invitado_id: invitadoId, hora_id })));
    if (nuevos.error) throw new Error(`guardar votos: ${nuevos.error.message}`);

    const despues = await leerVotacion(plan.id);
    await avisarOrganizador(plan, peticion.nombre, despues.horas, despues.votos);
    // En los registros no queda el nombre, solo que se votó.
    console.log('voto ok');
    return respuestaJson(req, { ...respuestaPlan(plan, despues.horas, despues.votos), cambiado: yaHabiaVotado });
  } catch (error) {
    console.error(error);
    return respuestaJson(req, { error: 'servidor' }, 500);
  }
});
