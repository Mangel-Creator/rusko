-- Filtro con IA del correo (28/10/2026, lo pidió el usuario): las reglas que escribe la
-- persona en Correo > "Filtro con IA". La misma lista en todas sus cuentas, como
-- siempre_avisar y vetados. Las usa correo-cuentas al revisar.
alter table public.correo_cuentas add column if not exists filtro text[] not null default '{}';
