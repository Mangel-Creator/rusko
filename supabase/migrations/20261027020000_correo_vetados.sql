-- Rusko · Correo: remitentes vetados y citas con hora (27/10/2026, lo pidió el usuario).
--
-- - "Vetar remitentes": la persona escribe una dirección y sus correos no salen nada en
--   Rusko (ni en la pestaña Correo, ni avisos, ni tareas ni citas). En Gmail siguen
--   igual. La lista es de la persona, la misma en todas sus cuentas (como siempre_avisar).
-- - Se guarda la dirección del remitente de cada correo (para vetar y para quitar lo ya
--   guardado) y la hora de la cita si las reglas la ven ("el 11/11 a las 10").
-- No borra nada: solo añade columnas.

alter table public.correo_cuentas
  add column if not exists vetados text[] not null default '{}';

alter table public.correo_resumenes
  add column if not exists de_email text not null default '',
  add column if not exists hora text check (hora is null or hora ~ '^\d{2}:\d{2}$');
