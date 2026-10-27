-- ══════════════════════════════════════════════════════════════════════════════════
-- Candado de suscripción en cm_config (auditoría 2026-10-27 ronda 2, hallazgo 3).
-- La migración 20261021000000 cubrió las 9 tablas hijas de CM + save_proyecto_general_
-- campo, pero cm_config (parámetros y listas de cálculo del usuario) quedó con policies
-- solo-owner: un usuario con el módulo 'manage' VENCIDO seguía escribiendo (y BORRANDO)
-- su config vía PostgREST directo. Mismo candado que el resto de CM, también en DELETE.
-- Idempotente (drop+create). ⚠️ APLICAR EN EL SQL EDITOR.
-- ══════════════════════════════════════════════════════════════════════════════════

drop policy if exists cm_config_propietario_insertar on public.cm_config;
create policy cm_config_propietario_insertar on public.cm_config for insert
with check (
  (select auth.uid()) = user_id
  and public.acceso_modulo((select auth.uid()), 'manage')
);

drop policy if exists cm_config_propietario_actualizar on public.cm_config;
create policy cm_config_propietario_actualizar on public.cm_config for update
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
  and public.acceso_modulo((select auth.uid()), 'manage')
);

drop policy if exists cm_config_propietario_eliminar on public.cm_config;
create policy cm_config_propietario_eliminar on public.cm_config for delete
using (
  (select auth.uid()) = user_id
  and public.acceso_modulo((select auth.uid()), 'manage')
);

-- Verificación (debe devolver 0 filas: toda policy de ESCRITURA de cm_ con candado).
-- OJO a la precedencia: `and` liga más que `or` — los paréntesis son obligatorios o el
-- segundo brazo devuelve cualquier policy '%actualizar%' de todo el esquema.
-- select tablename, policyname from pg_policies
--  where schemaname='public' and tablename like 'cm_%'
--    and (policyname like '%insertar%' or policyname like '%actualizar%' or policyname like '%eliminar%')
--    and (qual not like '%acceso_modulo%' or qual is null)
--    and (with_check not like '%acceso_modulo%' or with_check is null);
