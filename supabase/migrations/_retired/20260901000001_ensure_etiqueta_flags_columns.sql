-- Garantiza las columnas de flags de etiqueta en cf_planos_ramales.
--
-- Contexto: la migración 20260827000001_etiqueta_flags.sql hace `create or replace function
-- save_plano_data` que INSERTA show_length/show_name/show_guide. En plpgsql el cuerpo del
-- RPC NO se valida al crearse, así que en algunas bases el RPC quedó actualizado pero el
-- `ALTER TABLE ADD COLUMN` de esa migración no llegó a aplicarse. Resultado: el RPC falla con
-- 400 `column "show_length" of relation "cf_planos_ramales" does not exist` y TODO el guardado
-- del plano se aborta (el RPC es atómico: un INSERT inválido revierte todo el payload).
--
-- Esta migración re-aplica los ADD COLUMN de forma idempotente para cerrar ese gap.
-- Si las columnas ya existen, es no-op.

-- UP
alter table public.cf_planos_ramales add column if not exists show_length boolean default true;
alter table public.cf_planos_ramales add column if not exists show_name boolean default true;
alter table public.cf_planos_ramales add column if not exists show_guide boolean default true;

-- DOWN
-- No-op deliberado: las columnas son requeridas por save_plano_data (20260827000001).
-- Bajarlas aquí rompería el guardado; el rollback real de estos flags pertenece a
-- 20260827000001_etiqueta_flags.sql.
select 1;
