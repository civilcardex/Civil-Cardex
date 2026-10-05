-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261005000005 — Dedupe de policies en cf_aparatos_usuario (lint 0006 ×20)
--
-- Dos rondas crearon policies para la misma tabla: `aparatos_usuario_propietario_*`
-- (sesión empresa) y `aparatos_usuario_owner_*` (20261005000004, con empresa_lectura/
-- escritura para miembros). Ambas permissive para el mismo rol+acción → la BD evalúa
-- todas en cada query (lint 0006). Se conserva el set `owner_*` (incluye la lógica de
-- asientos de empresa) y se retira el duplicado `propietario_*`.
--
-- ⚠️ Antes de correr: verificar que el set conservado tenga la lógica de empresa —
--   select policyname, qual from pg_policies where tablename = 'cf_aparatos_usuario';
--   `owner_select` debe contener empresa_lectura. Si NO la tiene, correr primero
--   20261005000004 (drop+re-create idempotente) y luego este dedupe.
--
-- Idempotente (drop if exists).
-- ═══════════════════════════════════════════════════════════════════════════════════════

drop policy if exists "aparatos_usuario_propietario_leer" on public.cf_aparatos_usuario;
drop policy if exists "aparatos_usuario_propietario_insertar" on public.cf_aparatos_usuario;
drop policy if exists "aparatos_usuario_propietario_actualizar" on public.cf_aparatos_usuario;
drop policy if exists "aparatos_usuario_propietario_eliminar" on public.cf_aparatos_usuario;

-- ═══ VERIFICACIÓN ═══════════════════════════════════════════════════════════════════════
-- select policyname, cmd from pg_policies where tablename = 'cf_aparatos_usuario';
--   → 4 filas: owner_select/insert/update/delete. Cero duplicados.
