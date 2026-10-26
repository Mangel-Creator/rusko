-- Organizy · Avisos con sonido en la web instalada y alarmas al Reloj del iPhone (26/10/2026).
--
-- Decisión del usuario (26/10/2026): para que le suenen los avisos sin Expo Go y sin la
-- cuenta de Apple, acepta que la hora y el texto de cada aviso y de cada alarma se
-- guarden aquí hasta mandarlos. Es una excepción más a "los datos solo en el dispositivo".
--
--   - avisos_web_suscripciones: a qué navegador mandar los avisos (lo que da el
--     navegador al dar permiso). Si el navegador dice que ya no existe, se borra.
--   - avisos_web: los avisos de los próximos 7 días (hora, título, texto y adónde lleva
--     al tocarlo). La app los sustituye cada vez que los vuelve a calcular; cada minuto
--     pg_cron manda los que toquen (función avisos-web). Se borran a los 2 días.
--   - alarmas_reloj: las alarmas de los próximos 14 días (hora y nombre) y el resumen de
--     la llave personal con la que el Atajo del iPhone las lee (función alarmas-reloj).
--
-- Sin políticas de RLS: solo las funciones (con la clave secreta) leen y escriben.

create table public.avisos_web_suscripciones (
  endpoint text primary key,
  usuario uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creada timestamptz not null default now(),
  ultimo_envio timestamptz
);
create index avisos_web_suscripciones_usuario on public.avisos_web_suscripciones (usuario);
alter table public.avisos_web_suscripciones enable row level security;

create table public.avisos_web (
  usuario uuid not null references auth.users (id) on delete cascade,
  id text not null,
  cuando timestamptz not null,
  titulo text not null,
  cuerpo text not null,
  url text not null,
  enviado timestamptz,
  primary key (usuario, id)
);
create index avisos_web_pendientes on public.avisos_web (cuando) where enviado is null;
alter table public.avisos_web enable row level security;

create table public.alarmas_reloj (
  usuario uuid primary key references auth.users (id) on delete cascade,
  llave text unique, -- SHA-256 de la llave personal (la llave en sí no se guarda)
  alarmas jsonb not null default '[]'::jsonb,
  actualizado timestamptz not null default now(),
  ultima_lectura timestamptz
);
alter table public.alarmas_reloj enable row level security;

-- Cada minuto: si hay algún aviso que mandar, llama a la función avisos-web. Usa la
-- misma contraseña que la revisión del correo (vault "correo_cron" y el secreto
-- CORREO_CRON_SECRETO de las funciones), que no está en git.
create function public.lanzar_avisos_web() returns void
language plpgsql security definer set search_path = '' as $$
declare
  secreto text;
begin
  if not exists (select 1 from public.avisos_web where enviado is null and cuando <= now()) then
    return;
  end if;
  select decrypted_secret into secreto from vault.decrypted_secrets where name = 'correo_cron';
  if secreto is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://hwemrpexabisyueyizjz.supabase.co/functions/v1/avisos-web',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-organizy-cron', secreto),
    body := jsonb_build_object('accion', 'enviar'),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.lanzar_avisos_web() from public, anon, authenticated;

select cron.schedule('avisos-web-enviar', '* * * * *', $$ select public.lanzar_avisos_web(); $$);

select cron.schedule(
  'avisos-web-limpiar',
  '45 3 * * *',
  $$ delete from public.avisos_web where cuando < now() - interval '2 days'; $$
);
