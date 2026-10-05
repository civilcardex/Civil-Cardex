-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261005000006 — Índice para FK asignado_por (lint 0001)
-- DELETE de auth.users hace cascade por esta columna; sin índice el cascade escanea.
-- ═══════════════════════════════════════════════════════════════════════════════════════

create index if not exists app_suscripciones_miembros_asignado_por_idx
  on public.app_suscripciones_miembros (asignado_por);
