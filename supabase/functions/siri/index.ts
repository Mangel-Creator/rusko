// Rusko · Siri con Atajos (27/10/2026).
//
// Sin app propia, Siri no puede hablar con Rusko, pero sí ejecutar un Atajo por su
// nombre. Los Atajos "Apunta en Rusko" y "Alarma en Rusko" mandan aquí lo dicho con el
// enlace personal, y aquí espera hasta que Rusko lo recoge al abrirse (un Atajo no puede
// abrir la web de la pantalla de inicio con un dato dentro). Partes:
//
//   - POST ?t=<llave> (el Atajo), JSON (o formulario) con uno de estos campos:
//       { texto: "mañana pádel por la tarde" }        -> se apunta al abrir Rusko
//       { cuando: "2026-10-28 07:30 +01:00" }          -> alarma (el Atajo ya la puso en el Reloj)
//     Contesta SIEMPRE 200 y texto plano: lo que Siri dice en voz alta.
//   - POST con la sesión (anónima) de la app, { accion }:
//     - "estado": si hay enlace y cuándo se usó por última vez.
//     - "crear-enlace": crea (o cambia) la llave y devuelve el enlace. La llave solo se
//       enseña esa vez: aquí se guarda su resumen (SHA-256).
//     - "quitar": borra el enlace y lo que hubiera sin recoger.
//     - "recoger": lo que espera en el buzón (no lo borra).
//     - "confirmar" { ids }: Rusko ya lo ha guardado; se borra del buzón.

import { respuestaJson, respuestaPrevia } from '../_shared/cors.ts';
import { numeroDeEntorno, sumarUso } from '../_shared/limite.ts';
import { leerCuando } from '../_shared/siriHora.ts';
import { clienteAdmin, usuarioDeLaPeticion } from '../_shared/usuario.ts';

const MAX_TEXTO = 300;
const MAX_PENDIENTES = 50;

async function resumen(llave: string): Promise<string> {
  const datos = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(llave));
  return Array.from(new Uint8Array(datos), (b) => b.toString(16).padStart(2, '0')).join('');
}

function nuevaLlave(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function leerCuerpo(req: Request): Promise<Record<string, unknown>> {
  const texto = await req.text().catch(() => '');
  try {
    const datos = JSON.parse(texto);
    if (datos && typeof datos === 'object') return datos as Record<string, unknown>;
  } catch {
    // No es JSON: puede ser un formulario.
  }
  return Object.fromEntries(new URLSearchParams(texto));
}

async function desdeElAtajo(req: Request, llave: string): Promise<Response> {
  // Siempre 200: Atajos lee en voz alta lo que llegue, y así Siri dice qué ha pasado.
  const decir = (frase: string) =>
    new Response(frase, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (llave.length < 20 || llave.length > 100) return decir('Este enlace no vale. Cópialo otra vez desde Rusko.');

  const admin = clienteAdmin();
  const { data: enlace, error } = await admin
    .from('siri_enlaces')
    .select('usuario')
    .eq('llave', await resumen(llave))
    .maybeSingle();
  if (error) {
    console.error(error);
    return decir('No he podido hablar con Rusko. Prueba otra vez en un rato.');
  }
  if (!enlace) return decir('Este enlace ya no vale. Copia el nuevo desde Rusko, en Perfil, Siri.');
  const usuario = enlace.usuario as string;

  const cuerpo = await leerCuerpo(req);
  const ahora = Date.now();
  const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO) : '';
  const alarma = typeof cuerpo.cuando === 'string' ? leerCuando(cuerpo.cuando, ahora) : null;
  if (!texto && !alarma) {
    return decir(
      typeof cuerpo.cuando === 'string' ? 'No he entendido la hora. Prueba otra vez.' : 'No te he oído bien. Prueba otra vez.',
    );
  }

  const uso = await sumarUso(
    usuario,
    'siri',
    numeroDeEntorno('SIRI_LIMITE_USUARIO', 60),
    numeroDeEntorno('SIRI_LIMITE_GLOBAL', 5000),
  );
  if (!uso.permitido) return decir('Por hoy ya me has dicho muchas cosas. Apúntalo en Rusko, porfa.');
  const { count } = await admin
    .from('siri_buzon')
    .select('id', { count: 'exact', head: true })
    .eq('usuario', usuario);
  if ((count ?? 0) >= MAX_PENDIENTES) return decir('Tengo muchas cosas sin pasar. Abre Rusko y vuelve a probar.');

  const fila = alarma
    ? { usuario, tipo: 'alarma', dia: alarma.dia, hora: alarma.hora, cuando: alarma.cuando }
    : { usuario, tipo: 'apuntar', texto };
  const { error: errorGuardar } = await admin.from('siri_buzon').insert(fila);
  if (errorGuardar) {
    console.error(errorGuardar);
    return decir('No he podido apuntarlo. Prueba otra vez en un rato.');
  }
  await admin.from('siri_enlaces').update({ ultimo_uso: new Date().toISOString() }).eq('usuario', usuario);

  if (alarma) {
    return decir(`Hecho: alarma ${alarma.manana ? 'mañana' : 'hoy'} a las ${alarma.hora}. También la tienes en Rusko.`);
  }
  return decir(`Apuntado: «${texto}». Lo verás en Rusko al abrirla.`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respuestaPrevia(req);
  if (req.method !== 'POST') return respuestaJson(req, { error: 'metodo' }, 405);

  const llave = new URL(req.url).searchParams.get('t');
  if (llave !== null) {
    try {
      return await desdeElAtajo(req, llave);
    } catch (error) {
      console.error(error);
      return new Response('No he podido apuntarlo. Prueba otra vez en un rato.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  const usuario = await usuarioDeLaPeticion(req);
  if (!usuario) return respuestaJson(req, { error: 'sin-sesion' }, 401);
  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const admin = clienteAdmin();

  try {
    switch (cuerpo?.accion) {
      case 'estado': {
        const { data } = await admin
          .from('siri_enlaces')
          .select('ultimo_uso')
          .eq('usuario', usuario)
          .maybeSingle();
        return respuestaJson(req, { conectado: Boolean(data), ultimoUso: data?.ultimo_uso ?? null });
      }
      case 'crear-enlace': {
        const llave = nuevaLlave();
        const { error } = await admin
          .from('siri_enlaces')
          .upsert({ usuario, llave: await resumen(llave), creado: new Date().toISOString(), ultimo_uso: null }, {
            onConflict: 'usuario',
          });
        if (error) throw new Error(error.message);
        const base = Deno.env.get('SUPABASE_URL') ?? '';
        return respuestaJson(req, { enlace: `${base}/functions/v1/siri?t=${llave}` });
      }
      case 'quitar': {
        await admin.from('siri_buzon').delete().eq('usuario', usuario);
        await admin.from('siri_enlaces').delete().eq('usuario', usuario);
        return respuestaJson(req, { ok: true });
      }
      case 'recoger': {
        const { data, error } = await admin
          .from('siri_buzon')
          .select('id, tipo, texto, dia, hora, cuando, creado')
          .eq('usuario', usuario)
          .order('creado')
          .limit(MAX_PENDIENTES);
        if (error) throw new Error(error.message);
        return respuestaJson(req, { pendientes: data ?? [] });
      }
      case 'confirmar': {
        const ids = Array.isArray(cuerpo.ids)
          ? cuerpo.ids.filter((id): id is string => typeof id === 'string').slice(0, MAX_PENDIENTES)
          : [];
        if (ids.length) {
          const { error } = await admin.from('siri_buzon').delete().eq('usuario', usuario).in('id', ids);
          if (error) throw new Error(error.message);
        }
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
