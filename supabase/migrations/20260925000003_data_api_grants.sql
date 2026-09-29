-- GRANTS DATA API (aviso Supabase: desde el 30 de octubre de 2026 las tablas nuevas en
-- public ya NO reciben grants automáticos del Data API — sin GRANT explícito, supabase-js/
-- PostgREST devuelven permission denied; las migraciones que crean tablas deben incluirlos).
--
-- Tablas creadas en 20260924000000_suscripciones.sql sin grants:
--   app_suscripciones / app_pagos: lectura vía policies propietario → select a anon+authenticated
--     (la escritura va por funciones SECURITY DEFINER con revoke de DML ya en la migración).
--   app_config: NO se conceden — tiene revoke intencional (flag gestionado por service_role).
-- Re-ejecutable.

grant select on public.app_suscripciones to anon;
grant select on public.app_suscripciones to authenticated;
grant select on public.app_pagos to anon;
grant select on public.app_pagos to authenticated;

-- PATRÓN para migraciones futuras (copiar junto al create table) — GRANTS MÍNIMOS:
-- escrituras SOLO por RPC SECURITY DEFINER (con candado acceso_modulo), nunca directo.
-- grant select on public.mi_tabla to authenticated;   -- lectura propia (RLS owner-only)
-- grant select, insert, update, delete on public.mi_tabla to service_role;  -- solo backend
-- NUNCA grant DML a authenticated ni nada a anon (doctrina 20260813000003).
