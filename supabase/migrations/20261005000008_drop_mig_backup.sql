-- Limpieza: respaldo interno de policies de la migración 20261005000007 que quedó vivo
-- en public (el linter lo marca rls_disabled_in_public — es tabla de trabajo de la
-- migración, no expuesta por intención). Re-ejecutable.
drop table if exists public._cf_uuid_mig_pol_backup;
drop table if exists public._cf_uuid_mig_trg_backup;
