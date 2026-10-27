-- Pruebas de la copia en la nube (supabase/migrations/20261027000000_copias_nube.sql).
--
-- Como las de la empresa: contra el Supabase real, dentro de una transacción que se
-- deshace al final. Si algo no se cumple, se para con "FALLA: ...".
--
--   npx supabase db query --linked --project-ref <ref> --file supabase/tests/copias_nube_rls.sql
--
-- Si todo va bien, termina con una fila: resultado = "todo bien".

begin;

create function pg_temp.comprobar(p_ok boolean, p_que text) returns void
language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FALLA: %', p_que;
  end if;
end;
$$;

create function pg_temp.falla(p_sql text, p_que text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'FALLA: % (debería haber fallado)', p_que;
end;
$$;

create function pg_temp.filas(p_sql text) returns integer
language plpgsql as $$
declare
  n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function pg_temp.comprobar(boolean, text), pg_temp.falla(text, text), pg_temp.filas(text) to authenticated;

-- Personas de prueba (sus correos no existen de verdad).
create temporary table gente (quien text primary key, id uuid not null default gen_random_uuid(), correo text, anonimo boolean default false);
insert into gente (quien, correo, anonimo) values
  ('yo', 'yo.prueba.organizy@gmail.com', false),
  ('otro', 'otro.prueba.organizy@gmail.com', false),
  ('anonimo', null, true);
grant select on gente to authenticated;

insert into auth.users (instance_id, id, aud, role, email, is_anonymous, raw_app_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', g.id, 'authenticated', 'authenticated', g.correo, g.anonimo,
  case when g.anonimo then '{}'::jsonb else '{"provider": "email", "providers": ["email"]}'::jsonb end, now(), now()
from gente g;

create function pg_temp.como(p_quien text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', (select id from gente where quien = p_quien),
    'role', 'authenticated',
    'is_anonymous', (select anonimo from gente where quien = p_quien)
  )::text, true);
end;
$$;
grant execute on function pg_temp.como(text) to authenticated;

set local role authenticated;

-- 1. La sesión anónima no guarda copias.
select pg_temp.como('anonimo');
select pg_temp.falla(
  $$insert into public.copias_nube (usuario, copia, huella, dispositivo)
    values ((select id from gente where quien = 'anonimo'), '{"app":"organizy"}', 'h0', 'd0')$$,
  'un anónimo no guarda copias');

-- 2. La cuenta guarda la suya, pero no una a nombre de otro.
select pg_temp.como('yo');
insert into public.copias_nube (usuario, copia, huella, dispositivo)
  values ((select id from gente where quien = 'yo'), '{"app":"organizy","v":1}', 'h1', 'movil');
select pg_temp.falla(
  $$insert into public.copias_nube (usuario, copia, huella, dispositivo)
    values ((select id from gente where quien = 'otro'), '{"app":"organizy"}', 'hx', 'dx')$$,
  'nadie guarda una copia a nombre de otro');
select pg_temp.comprobar(
  (select count(*) from public.copias_nube) = 1 and (select anterior is null from public.copias_nube),
  'la cuenta ve su copia, sin anterior');

-- 3. Al cambiarla, la de antes queda en "anterior" y la hora la pone el servidor.
update public.copias_nube
  set copia = '{"app":"organizy","v":2}', huella = 'h2', dispositivo = 'web',
      actualizada = '2000-01-01', anterior = null
  where usuario = (select id from gente where quien = 'yo');
select pg_temp.comprobar(
  (select copia ->> 'v' = '2' and anterior ->> 'v' = '1' and actualizada > '2001-01-01'
   from public.copias_nube),
  'al cambiarla se guarda la anterior y la hora del servidor');

-- 4. Otra cuenta y la sesión anónima no la ven, ni la cambian, ni la borran.
select pg_temp.como('otro');
select pg_temp.comprobar((select count(*) from public.copias_nube) = 0, 'otra cuenta no ve la copia');
select pg_temp.comprobar(pg_temp.filas($$update public.copias_nube set huella = 'mal'$$) = 0, 'otra cuenta no la cambia');
select pg_temp.comprobar(pg_temp.filas($$delete from public.copias_nube$$) = 0, 'otra cuenta no la borra');
select pg_temp.como('anonimo');
select pg_temp.comprobar((select count(*) from public.copias_nube) = 0, 'la sesión anónima no ve la copia');

-- 5. La cuenta no puede pasar su copia a otro.
select pg_temp.como('yo');
update public.copias_nube set usuario = (select id from gente where quien = 'otro');
select pg_temp.comprobar(
  (select count(*) from public.copias_nube where usuario = (select id from gente where quien = 'yo')) = 1,
  'la copia sigue siendo de su cuenta');

-- 6. Y la puede borrar.
select pg_temp.comprobar(pg_temp.filas($$delete from public.copias_nube$$) = 1, 'la cuenta borra su copia');

reset role;
select 'todo bien' as resultado;

rollback;
