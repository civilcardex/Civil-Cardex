-- Adds persistence for "Redes activas" / "Equipos activos" (InfoTab), previously
-- localStorage-only (ACTIVE_NETS_KEY). Correr en el SQL Editor del proyecto knswtfckzodiuiladmbt.

alter table public.proyecto_general
  add column if not exists redes_activas text[];
