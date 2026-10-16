-- Drop de RPC huérfana: intenciones_recientes(uuid) nació en 20260928000003 para las
-- edges Wompi (ya eliminadas del dashboard) y ningún edge Lemon la llama — el cap
-- anti-spam vive en registrar_intencion_pago (20261006000000, una transacción, sin TOCTOU).
-- 0 callers en src/ y supabase/functions (verificado 2026-10-15).
drop function if exists public.intenciones_recientes(uuid);

-- Verificación: debe devolver 0 filas.
-- select count(*) from pg_proc where proname = 'intenciones_recientes';
