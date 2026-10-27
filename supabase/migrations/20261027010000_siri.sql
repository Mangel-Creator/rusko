-- Rusko · Siri con Atajos (27/10/2026). Octava excepción a "los datos solo en el
-- dispositivo", aceptada por el usuario: lo que se le dice a Siri espera aquí hasta que
-- Rusko lo recoge (un Atajo no puede abrir la web de la pantalla de inicio con un dato
-- dentro). Se borra al recogerlo y, si nadie lo recoge, a los 7 días.
--
--   - siri_enlaces: el resumen (SHA-256) de la llave personal con la que los Atajos
--     "Apunta en Rusko" y "Alarma en Rusko" mandan lo dicho (función siri).
--   - siri_buzon: lo dicho y aún sin recoger. "apuntar" guarda la frase; "alarma", el
--     día y la hora (y la función alarmas-reloj la incluye en lo que lee el Atajo de
--     cada noche, para que no se pierda si Rusko no se abre antes).
--
-- Sin políticas de RLS: solo las funciones (con la clave secreta) leen y escriben.

create table public.siri_enlaces (
  usuario uuid primary key references auth.users (id) on delete cascade,
  llave text not null unique,
  creado timestamptz not null default now(),
  ultimo_uso timestamptz
);
alter table public.siri_enlaces enable row level security;

create table public.siri_buzon (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('apuntar', 'alarma')),
  texto text check (char_length(texto) <= 300),
  dia date, -- solo alarma: el día en que suena (hora local del iPhone)
  hora text check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), -- solo alarma
  cuando timestamptz, -- solo alarma: el momento exacto
  creado timestamptz not null default now(),
  check (
    (tipo = 'apuntar' and texto is not null)
    or (tipo = 'alarma' and dia is not null and hora is not null and cuando is not null)
  )
);
create index siri_buzon_usuario on public.siri_buzon (usuario, creado);
alter table public.siri_buzon enable row level security;

select cron.schedule(
  'siri-limpiar',
  '50 3 * * *',
  $$ delete from public.siri_buzon where creado < now() - interval '7 days'; $$
);
