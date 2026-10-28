-- Correo (27/10/2026): si lo manda una máquina (boletín, publicidad, aviso automático).
-- La app lo usa para la importancia de cada correo (blanco = poco importante). El campo
-- "resumen" vuelve a llevar de qué trata el correo en una frase (antes, solo la línea del
-- aviso de los importantes).
alter table public.correo_resumenes add column if not exists automatico boolean not null default false;
