// Organizy · IA de los correos para el ayudante de Gmail (fase 11).
//
// La llama el ayudante de Gmail del usuario (gmail/organizy-correo.js, en su cuenta
// de Google) con un correo ya limpio: asunto, remitente y hasta 4000 letras. Devuelve
// qué es, la fecha que importa (con su tarea) y si es importante; sin resumen. No
// guarda nada: ni el correo ni el resultado (en los registros solo quedan los tokens).
//
// - Sin la clave de Anthropic (ANTHROPIC_API_KEY) contesta "sin-clave" y el ayudante
//   usa sus reglas; cuando se ponga la clave, empieza a usarla solo.
// - Solo con sesión (anónima) de Supabase, como la app. No gasta de los límites de IA
//   de 5 horas y semana: tiene su propio máximo de correos al día; al llegar, contesta
//   429 y el ayudante usa sus reglas un rato.

import { respuestaJson, respuestaPrevia } from '../_shared/cors.ts';
import { analizarConClaude, iaDisponible, leerPeticionIA } from '../_shared/iaCorreo.ts';
import { numeroDeEntorno, sumarUso } from '../_shared/limite.ts';
import { esDueno, SIN_LIMITE } from '../_shared/limiteIA.ts';
import { usuarioDeLaPeticion } from '../_shared/usuario.ts';

const LIMITE_POR_USUARIO = numeroDeEntorno('CORREO_LIMITE_USUARIO', 100);
const LIMITE_GLOBAL = numeroDeEntorno('CORREO_LIMITE_GLOBAL', 3000);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return respuestaPrevia(req);
  if (req.method !== 'POST') return respuestaJson(req, { error: 'metodo' }, 405);

  // Primero, sin gastar nada: si no hay clave, el ayudante usa sus reglas.
  if (!iaDisponible) return respuestaJson(req, { error: 'sin-clave' }, 503);

  const usuario = await usuarioDeLaPeticion(req);
  if (!usuario) return respuestaJson(req, { error: 'sin-sesion' }, 401);

  const peticion = leerPeticionIA(await req.json().catch(() => null));
  if (!peticion) return respuestaJson(req, { error: 'peticion' }, 400);

  try {
    const limite = (await esDueno(usuario)) ? SIN_LIMITE : LIMITE_POR_USUARIO;
    const uso = await sumarUso(usuario, 'correo', limite, LIMITE_GLOBAL);
    if (!uso.permitido) return respuestaJson(req, { error: uso.motivo }, 429);
  } catch (error) {
    console.error(error);
    return respuestaJson(req, { error: 'servidor' }, 500);
  }

  const analisis = await analizarConClaude(peticion);
  if (!analisis) return respuestaJson(req, { error: 'ia' }, 502);
  return respuestaJson(req, { analisis });
});
