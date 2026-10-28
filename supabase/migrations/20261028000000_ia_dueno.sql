-- Rusko · El dueño de la app sin límites de IA y lo gastado de la clave (28/10/2026).
--
-- Lo pidió el usuario: a su cuenta la IA no la para nunca (ni las 5 horas, ni la semana,
-- ni los topes por día de cada función), aunque sigue viendo las barras; y solo a él le
-- sale cuánto se ha gastado de la clave de Anthropic y cuánto queda del saldo.
--
-- - ia_cuentas.dueno: se marca a mano con SQL para su usuario (no va aquí, para no dejar
--   su cuenta en el repositorio):
--     insert into public.ia_cuentas (usuario, dueno) values ('<id>', true)
--       on conflict (usuario) do update set dueno = true;
-- - ia_gasto: todo lo que ha gastado la clave, de todas las personas y todas las
--   funciones (también el correo, que no cuenta para los límites), sumado por día. No se
--   borra: ia_consumo solo guarda 8 días. Anthropic no deja leer el saldo con la clave,
--   así que Rusko lleva su propia cuenta.

alter table public.ia_cuentas add column if not exists dueno boolean not null default false;

create table if not exists public.ia_gasto (
  dia date not null,
  funcion text not null,
  llamadas integer not null default 0,
  entrada bigint not null default 0,
  salida bigint not null default 0,
  coste bigint not null default 0, -- millonésimas de dólar
  primary key (dia, funcion)
);

alter table public.ia_gasto enable row level security;
revoke all on table public.ia_gasto from anon, authenticated;

create or replace function public.ia_es_dueno(p_usuario uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select dueno from public.ia_cuentas where usuario = p_usuario), false);
$$;

create or replace function public.ia_sumar_gasto(
  p_funcion text,
  p_entrada integer,
  p_salida integer,
  p_coste integer
) returns void
language sql
set search_path = ''
as $$
  insert into public.ia_gasto as g (dia, funcion, llamadas, entrada, salida, coste)
  values ((now() at time zone 'Europe/Madrid')::date, p_funcion, 1,
          greatest(p_entrada, 0), greatest(p_salida, 0), greatest(p_coste, 0))
  on conflict (dia, funcion) do update set
    llamadas = g.llamadas + 1,
    entrada = g.entrada + excluded.entrada,
    salida = g.salida + excluded.salida,
    coste = g.coste + excluded.coste;
$$;

-- Lo gastado desde un día (el de la última recarga de saldo).
create or replace function public.ia_gasto_clave(p_desde date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'llamadas', coalesce(sum(llamadas), 0),
    'entrada', coalesce(sum(entrada), 0),
    'salida', coalesce(sum(salida), 0),
    'coste', coalesce(sum(coste), 0)
  )
  from public.ia_gasto
  where dia >= p_desde;
$$;

-- Como antes, pero el dueño siempre puede (y su ventana y su semana empiezan igual,
-- para que vea las barras).
create or replace function public.ia_permitir(
  p_usuario uuid,
  p_horas integer,
  p_limite_ventana bigint,
  p_limite_semana bigint
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_estado jsonb;
  v_ventana_llena boolean;
  v_semana_llena boolean;
  v_dueno boolean := public.ia_es_dueno(p_usuario);
begin
  perform pg_advisory_xact_lock(hashtext('ia:' || p_usuario::text));
  v_estado := public.ia_estado(p_usuario, p_horas);
  v_ventana_llena := (v_estado ->> 'ventana')::bigint >= p_limite_ventana;
  v_semana_llena := (v_estado ->> 'semana')::bigint >= p_limite_semana;

  if not v_dueno and (v_ventana_llena or v_semana_llena) and (v_estado ->> 'extra')::bigint <= 0 then
    if v_semana_llena then
      return jsonb_build_object('permitido', false, 'motivo', 'semana', 'libre', v_estado -> 'semanaFin');
    end if;
    return jsonb_build_object('permitido', false, 'motivo', 'ventana', 'libre', v_estado -> 'ventanaFin');
  end if;

  insert into public.ia_cuentas as c (usuario, ventana_inicio, semana_inicio)
  values (p_usuario, now(), now())
  on conflict (usuario) do update set
    ventana_inicio = case
      when c.ventana_inicio is null or c.ventana_inicio + make_interval(hours => p_horas) <= now()
      then now() else c.ventana_inicio end,
    semana_inicio = case
      when c.semana_inicio is null or c.semana_inicio + interval '7 days' <= now()
      then now() else c.semana_inicio end,
    actualizado = now();

  return jsonb_build_object(
    'permitido', true,
    'conExtra', not v_dueno and (v_ventana_llena or v_semana_llena),
    'dueno', v_dueno
  );
end;
$$;

-- Como antes, y además suma lo gastado a la cuenta de la clave. Al dueño no se le
-- descuenta saldo extra.
create or replace function public.ia_apuntar(
  p_usuario uuid,
  p_funcion text,
  p_entrada integer,
  p_salida integer,
  p_coste integer,
  p_horas integer,
  p_limite_ventana bigint,
  p_limite_semana bigint
) returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_estado jsonb;
  v_exceso bigint;
  v_extra bigint;
begin
  perform pg_advisory_xact_lock(hashtext('ia:' || p_usuario::text));
  insert into public.ia_consumo (usuario, funcion, entrada, salida, coste)
  values (p_usuario, p_funcion, greatest(p_entrada, 0), greatest(p_salida, 0), greatest(p_coste, 0));
  perform public.ia_sumar_gasto(p_funcion, p_entrada, p_salida, p_coste);

  v_estado := public.ia_estado(p_usuario, p_horas);
  v_exceso := greatest(
    (v_estado ->> 'ventana')::bigint - p_limite_ventana,
    (v_estado ->> 'semana')::bigint - p_limite_semana,
    0
  );
  v_exceso := least(v_exceso, greatest(p_coste, 0));
  if public.ia_es_dueno(p_usuario) then
    v_exceso := 0;
  end if;

  update public.ia_cuentas
  set extra = greatest(extra - v_exceso, 0), actualizado = now()
  where usuario = p_usuario
  returning extra into v_extra;
  return coalesce(v_extra, 0);
end;
$$;

-- Lo de hoy que ya estaba apuntado (la clave se puso el 28/10/2026). El correo de
-- antes de esto no se apuntaba en ningún sitio.
insert into public.ia_gasto (dia, funcion, llamadas, entrada, salida, coste)
select (momento at time zone 'Europe/Madrid')::date, funcion, count(*), sum(entrada), sum(salida), sum(coste)
from public.ia_consumo
where momento >= '2026-10-28'
group by 1, 2
on conflict (dia, funcion) do nothing;

revoke all on function public.ia_es_dueno(uuid) from public, anon, authenticated;
revoke all on function public.ia_sumar_gasto(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.ia_gasto_clave(date) from public, anon, authenticated;
revoke all on function public.ia_permitir(uuid, integer, bigint, bigint) from public, anon, authenticated;
revoke all on function public.ia_apuntar(uuid, text, integer, integer, integer, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function public.ia_es_dueno(uuid) to service_role;
grant execute on function public.ia_sumar_gasto(text, integer, integer, integer) to service_role;
grant execute on function public.ia_gasto_clave(date) to service_role;
grant execute on function public.ia_permitir(uuid, integer, bigint, bigint) to service_role;
grant execute on function public.ia_apuntar(uuid, text, integer, integer, integer, integer, bigint, bigint) to service_role;
