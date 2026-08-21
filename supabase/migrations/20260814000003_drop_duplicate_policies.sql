-- =========================================================================
-- CivilFlow — limpieza de políticas RLS duplicadas en cf_anulaciones_*
--
-- La migración 20260806000004 creó políticas con nombre en inglés
--   rainwater_bajantes_owner_* / rainwater_canales_owner_*
-- La migración 20260813000001_rls_project_ownership agregó además el set
--   anulaciones_*_propietario_* (con check de proyecto).
-- Tras el rename a cf_* quedaron 2 juegos por role+action (INSERT/UPDATE)
-- → WARN multiple_permissive_policies del Security Advisor.
--
-- Solución: DROP de las 4 políticas viejas en inglés y reconstrucción
-- idempotente del set completo anulaciones_*_propietario_{leer,insertar,
-- actualizar,eliminar} sobre las tablas cf_. Las demás tablas cf_ ya
-- tienen un solo set; solo anulaciones tenía el duplicado.
-- =========================================================================

-- -------------------------------------------------------------------------
-- cf_anulaciones_bajantes_pluviales
-- -------------------------------------------------------------------------
drop policy if exists "rainwater_bajantes_owner_select"  on public.cf_anulaciones_bajantes_pluviales;
drop policy if exists "rainwater_bajantes_owner_insert"  on public.cf_anulaciones_bajantes_pluviales;
drop policy if exists "rainwater_bajantes_owner_update"  on public.cf_anulaciones_bajantes_pluviales;
drop policy if exists "rainwater_bajantes_owner_delete"  on public.cf_anulaciones_bajantes_pluviales;

drop policy if exists "anulaciones_bajantes_pluviales_propietario_leer" on public.cf_anulaciones_bajantes_pluviales;
create policy "anulaciones_bajantes_pluviales_propietario_leer" on public.cf_anulaciones_bajantes_pluviales
  for select using ((select auth.uid()) = user_id);
drop policy if exists "anulaciones_bajantes_pluviales_propietario_insertar" on public.cf_anulaciones_bajantes_pluviales;
create policy "anulaciones_bajantes_pluviales_propietario_insertar" on public.cf_anulaciones_bajantes_pluviales
  for insert with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cf_proyectos p where p.id = cf_anulaciones_bajantes_pluviales.proyecto_id and p.user_id = (select auth.uid()))
  );
drop policy if exists "anulaciones_bajantes_pluviales_propietario_actualizar" on public.cf_anulaciones_bajantes_pluviales;
create policy "anulaciones_bajantes_pluviales_propietario_actualizar" on public.cf_anulaciones_bajantes_pluviales
  for update using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cf_proyectos p where p.id = cf_anulaciones_bajantes_pluviales.proyecto_id and p.user_id = (select auth.uid()))
  );
drop policy if exists "anulaciones_bajantes_pluviales_propietario_eliminar" on public.cf_anulaciones_bajantes_pluviales;
create policy "anulaciones_bajantes_pluviales_propietario_eliminar" on public.cf_anulaciones_bajantes_pluviales
  for delete using ((select auth.uid()) = user_id);

-- -------------------------------------------------------------------------
-- cf_anulaciones_canales_pluviales
-- -------------------------------------------------------------------------
drop policy if exists "rainwater_canales_owner_select"  on public.cf_anulaciones_canales_pluviales;
drop policy if exists "rainwater_canales_owner_insert"  on public.cf_anulaciones_canales_pluviales;
drop policy if exists "rainwater_canales_owner_update"  on public.cf_anulaciones_canales_pluviales;
drop policy if exists "rainwater_canales_owner_delete"  on public.cf_anulaciones_canales_pluviales;

drop policy if exists "anulaciones_canales_pluviales_propietario_leer" on public.cf_anulaciones_canales_pluviales;
create policy "anulaciones_canales_pluviales_propietario_leer" on public.cf_anulaciones_canales_pluviales
  for select using ((select auth.uid()) = user_id);
drop policy if exists "anulaciones_canales_pluviales_propietario_insertar" on public.cf_anulaciones_canales_pluviales;
create policy "anulaciones_canales_pluviales_propietario_insertar" on public.cf_anulaciones_canales_pluviales
  for insert with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cf_proyectos p where p.id = cf_anulaciones_canales_pluviales.proyecto_id and p.user_id = (select auth.uid()))
  );
drop policy if exists "anulaciones_canales_pluviales_propietario_actualizar" on public.cf_anulaciones_canales_pluviales;
create policy "anulaciones_canales_pluviales_propietario_actualizar" on public.cf_anulaciones_canales_pluviales
  for update using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cf_proyectos p where p.id = cf_anulaciones_canales_pluviales.proyecto_id and p.user_id = (select auth.uid()))
  );
drop policy if exists "anulaciones_canales_pluviales_propietario_eliminar" on public.cf_anulaciones_canales_pluviales;
create policy "anulaciones_canales_pluviales_propietario_eliminar" on public.cf_anulaciones_canales_pluviales
  for delete using ((select auth.uid()) = user_id);