-- Copia en la nube (27/10/2026): con una cuenta de correo y contraseña, la copia de
-- seguridad de Organizy (el mismo JSON que el archivo de Perfil > Copia de seguridad) se
-- guarda aquí y se trae en los otros dispositivos donde se entra con esa cuenta.
--
-- Séptima excepción a "los datos solo en el dispositivo", aceptada por el usuario: una
-- fila por cuenta con todo lo suyo. Solo la lee y la cambia esa cuenta (las sesiones
-- anónimas, no). Se borra sola si se borra la cuenta.
--
-- "anterior" guarda la copia de antes del último cambio, por si un dispositivo pisa al
-- otro sin querer (hoy solo se recupera a mano desde el panel).

create table if not exists public.copias_nube (
  usuario uuid primary key references auth.users (id) on delete cascade,
  copia jsonb not null,
  huella text not null check (length(huella) <= 64),
  dispositivo text not null check (length(dispositivo) <= 64),
  actualizada timestamptz not null default now(),
  anterior jsonb,
  anterior_el timestamptz,
  constraint copias_nube_tamano check (pg_column_size(copia) < 8 * 1024 * 1024)
);

-- La hora la pone siempre el servidor (así los dispositivos comparan la misma hora) y,
-- al cambiar, se guarda la copia que había.
create or replace function public.copias_nube_antes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizada := now();
  if tg_op = 'UPDATE' then
    new.usuario := old.usuario;
    new.anterior := old.copia;
    new.anterior_el := old.actualizada;
  else
    new.anterior := null;
    new.anterior_el := null;
  end if;
  return new;
end;
$$;

drop trigger if exists copias_nube_antes on public.copias_nube;
create trigger copias_nube_antes
  before insert or update on public.copias_nube
  for each row execute function public.copias_nube_antes();

alter table public.copias_nube enable row level security;

revoke all on table public.copias_nube from anon, authenticated;
grant select, insert, update, delete on table public.copias_nube to authenticated;

-- Solo la propia fila y solo con una cuenta de verdad (no la sesión anónima de la app).
drop policy if exists "copia de la cuenta" on public.copias_nube;
create policy "copia de la cuenta" on public.copias_nube
  for all to authenticated
  using (
    usuario = (select auth.uid())
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  )
  with check (
    usuario = (select auth.uid())
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  );
