-- GRANTS DATA API (aviso Supabase: desde el 30 de octubre de 2026 las tablas nuevas en
-- public ya NO reciben grants automáticos del Data API — sin GRANT explícito, supabase-js/
-- PostgREST devuelven permission denied; las migraciones que crean tablas deben incluirlos).
--
-- Tablas creadas en 20260924000000_suscripciones.sql sin grants:
--   cf_suscripciones / cf_pagos: lectura vía policies propietario → select a anon+authenticated
--     (la escritura va por funciones SECURITY DEFINER con revoke de DML ya en la migración).
--   cf_app_config: NO se conceden — tiene revoke intencional (flag gestionado por service_role).
-- Re-ejecutable.

grant select on public.cf_suscripciones to anon;
grant select on public.cf_suscripciones to authenticated;
grant select on public.cf_pagos to anon;
grant select on public.cf_pagos to authenticated;

-- PATRÓN para migraciones futuras (copiar junto al create table):
-- grant select on public.mi_tabla to anon;
-- grant select, insert, update, delete on public.mi_tabla to authenticated;
-- grant select, insert, update, delete on public.mi_tabla to service_role;
