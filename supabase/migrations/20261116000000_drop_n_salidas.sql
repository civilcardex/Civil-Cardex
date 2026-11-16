-- Elimina la columna n_salidas (H-06 companion, doctrina 2026-11-16): el motor ya NO usa
-- el «N° de descargas» (Hunter simplificado — curva pura f(UC/UD), sin K de simultaneidad)
-- y la columna queda huérfana. Idempotente: IF EXISTS + JSONB con limpieza condicionada.
-- Aplicar en SQL Editor (Supabase Dashboard → SQL Editor → New query → pegar → Run).
-- NOTA: NO existe tabla plano_trazos — los ramales viven SOLO como filas de
-- cf_planos_ramales (el RPC save_plano_data hace delete+insert por fila), así que la
-- columna (1) y su espejo hydro_accesorios (2) cubren todo el dato histórico.

-- 1. Columna relacional en cf_planos_ramales (única tabla de ramales; planos_ramales se
--    renombró a cf_ en 20260814000002)
alter table public.cf_planos_ramales drop column if exists n_salidas;

-- 2. Limpieza del espejo JSONB hydro_accesorios: quita nSalidas de cada entrada. El
--    jsonb_typeof guarda: algunas entradas traen valores ESCALARES (string/número, p. ej.
--    c90: 2) donde `- 'nSalidas'` lanzaría «cannot delete from scalar» — esos pasan intactos.
update public.cf_planos_ramales
set hydro_accesorios = (
  select coalesce(
    jsonb_object_agg(
      key,
      case when jsonb_typeof(value) = 'object' then value - 'nSalidas' else value end
    ),
    '{}'::jsonb
  )
  from jsonb_each(hydro_accesorios)
)
where hydro_accesorios::text like '%nSalidas%';
