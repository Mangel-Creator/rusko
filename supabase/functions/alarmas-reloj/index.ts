// Organizy · Alarmas al Reloj del iPhone con un Atajo (26/10/2026).
//
// Sin app propia, Organizy no puede poner alarmas en el iPhone, pero la app Atajos sí
// ("Crear alarma"). Cada noche, una automatización del usuario lee aquí las alarmas de
// las próximas 24 horas con su enlace personal y las crea en el Reloj (las del Reloj
// suenan aunque el móvil esté en silencio). Partes:
//
//   - GET ?t=<llave>: lo que lee el Atajo. Texto, una línea por alarma, sin nada más que
//     la hora y el nombre. La primera línea es siempre "Organizy": si no llega (sin
//     conexión, error), el Atajo no toca las alarmas que ya tenga.
//         Organizy
//         07:30|Organizy · Despertador
//         08:40|Organizy · Sal ya: Dentista
//   - POST con la sesión (anónima) de la app:
//     - "estado": si hay enlace, cuándo se subieron las alarmas y cuándo las leyó el Atajo.
//     - "crear-enlace": crea (o cambia) la llave y devuelve el enlace. La llave solo se
//       enseña esa vez: aquí se guarda su resumen (SHA-256). Solo deja leer alarmas.
//     - "subir" { alarmas }: las de los próximos 14 días ({ cuando, hora, etiqueta }).
//     - "quitar": borra el enlace y las alarmas.

import { respuestaJson, respuestaPrevia } from '../_shared/cors.ts';
import { clienteAdmin, usuarioDeLaPeticion } from '../_shared/usuario.ts';

const VENTANA_MS = 24 * 3600 * 1000;
const MAX_ALARMAS = 200;

type AlarmaReloj = { cuando: string; hora: string; etiqueta: string };

async function resumen(llave: string): Promise<string> {
  const datos = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(llave));
  return Array.from(new Uint8Array(datos), (b) => b.toString(16).padStart(2, '0')).join('');
}

function nuevaLlave(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Lo que se pasa al Reloj: sin "|" ni saltos de línea, que el Atajo usa para separar.
function limpiar(etiqueta: string): string {
  return etiqueta.replace(/\s*[|\r\n]+\s*/g, ' ').trim().slice(0, 60);
}

function alarmaValida(valor: unknown, ahora: number): AlarmaReloj | null {
  if (!valor || typeof valor !== 'object') return null;
  const a = valor as Record<string, unknown>;
  const cuando = typeof a.cuando === 'string' ? Date.parse(a.cuando) : NaN;
  if (!Number.isFinite(cuando) || cuando < ahora - 86400_000 || cuando > ahora + 16 * 86400_000) return null;
  if (typeof a.hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.hora)) return null;
  const etiqueta = typeof a.etiqueta === 'string' ? limpiar(a.etiqueta) : '';
  return { cuando: new Date(cuando).toISOString(), hora: a.hora, etiqueta: etiqueta || 'Alarma' };
}

// Las líneas para el Atajo: las de las próximas 24 h, en orden y sin dos a la misma hora.
function textoParaAtajo(alarmas: AlarmaReloj[], ahora: number): string {
  const vistas = new Set<string>();
  const lineas = ['Organizy'];
  for (const a of [...alarmas].sort((x, y) => x.cuando.localeCompare(y.cuando))) {
    const t = Date.parse(a.cuando);
    if (t <= ahora || t > ahora + VENTANA_MS || vistas.has(a.hora)) continue;
    vistas.add(a.hora);
    lineas.push(`${a.hora}|Organizy · ${limpiar(a.etiqueta)}`);
  }
  return lineas.join('\n');
}

async function paraElAtajo(req: Request): Promise<Response> {
  const texto = (cuerpo: string, estado = 200) =>
    new Response(cuerpo, { status: estado, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const llave = new URL(req.url).searchParams.get('t') ?? '';
  if (llave.length < 20 || llave.length > 100) return texto('Enlace no válido', 404);
  const admin = clienteAdmin();
  const { data, error } = await admin
    .from('alarmas_reloj')
    .select('usuario, alarmas')
    .eq('llave', await resumen(llave))
    .maybeSingle();
  if (error) {
    console.error(error);
    return texto('Error', 500);
  }
  if (!data) return texto('Enlace no válido', 404);
  await admin.from('alarmas_reloj').update({ ultima_lectura: new Date().toISOString() }).eq('usuario', data.usuario);
  return texto(textoParaAtajo((data.alarmas ?? []) as AlarmaReloj[], Date.now()));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respuestaPrevia(req);
  if (req.method === 'GET') return paraElAtajo(req);
  if (req.method !== 'POST') return respuestaJson(req, { error: 'metodo' }, 405);

  const usuario = await usuarioDeLaPeticion(req);
  if (!usuario) return respuestaJson(req, { error: 'sin-sesion' }, 401);
  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const admin = clienteAdmin();

  try {
    switch (cuerpo?.accion) {
      case 'estado': {
        const { data } = await admin
          .from('alarmas_reloj')
          .select('llave, actualizado, ultima_lectura')
          .eq('usuario', usuario)
          .maybeSingle();
        return respuestaJson(req, {
          conectado: Boolean(data?.llave),
          actualizado: data?.actualizado ?? null,
          ultimaLectura: data?.ultima_lectura ?? null,
        });
      }
      case 'crear-enlace': {
        const llave = nuevaLlave();
        const { error } = await admin
          .from('alarmas_reloj')
          .upsert({ usuario, llave: await resumen(llave), ultima_lectura: null }, { onConflict: 'usuario' });
        if (error) throw new Error(error.message);
        const base = Deno.env.get('SUPABASE_URL') ?? '';
        return respuestaJson(req, { enlace: `${base}/functions/v1/alarmas-reloj?t=${llave}` });
      }
      case 'subir': {
        if (!Array.isArray(cuerpo.alarmas)) return respuestaJson(req, { error: 'peticion' }, 400);
        const ahora = Date.now();
        const alarmas = cuerpo.alarmas
          .slice(0, MAX_ALARMAS)
          .map((a) => alarmaValida(a, ahora))
          .filter((a): a is AlarmaReloj => a !== null);
        // Solo si ya hay enlace: sin él, no se guarda nada.
        const { data, error } = await admin
          .from('alarmas_reloj')
          .update({ alarmas, actualizado: new Date().toISOString() })
          .eq('usuario', usuario)
          .not('llave', 'is', null)
          .select('usuario');
        if (error) throw new Error(error.message);
        return respuestaJson(req, { guardadas: data?.length ? alarmas.length : 0, conectado: Boolean(data?.length) });
      }
      case 'quitar': {
        await admin.from('alarmas_reloj').delete().eq('usuario', usuario);
        return respuestaJson(req, { ok: true });
      }
      default:
        return respuestaJson(req, { error: 'peticion' }, 400);
    }
  } catch (error) {
    console.error(error);
    return respuestaJson(req, { error: 'servidor' }, 500);
  }
});
