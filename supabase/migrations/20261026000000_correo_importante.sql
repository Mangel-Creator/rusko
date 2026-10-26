-- Organizy · Correo sin resúmenes, solo lo importante (26/10/2026).
--
-- La IA ya no resume: dice qué es, la fecha que importa y si es importante, y solo se
-- avisa de eso. Se guarda si un correo es importante y la lista de "Avisarme siempre
-- de…" de cada persona (la misma en todas sus cuentas vinculadas).

alter table public.correo_resumenes
  add column if not exists importante boolean not null default false;

alter table public.correo_cuentas
  add column if not exists siempre_avisar text[] not null default '{}';
