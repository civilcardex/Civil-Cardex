-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CANDADO DE SUSCRIPCIÓN: hueco en save_proyecto_general_campo + las 9 tablas de CM
-- Fecha: 2026-10-21
--
-- Auditoría de código (code review del codebase completo, 2026-10-21):
--   H-01  save_proyecto_general_campo NO tenía candado de uso.
--   H-02  Las 9 tablas hijas de CM (cm_cargos, cm_apus, cm_presupuestos, …) NO
--         comprobaban acceso_modulo: el candado solo estaba en cm_proyectos.
--
-- Por qué importa: con app_config('suscripciones_activas') = true, un usuario cuyo
-- módulo venció:
--   - seguía escribiendo campos del proyecto (af_alimentacion, tanque_npt,
--     presion_garantizada, rejillas) vía PostgREST;
--   - y seguía escribiendo TODO el contenido de gestión (presupuestos, APUs, insumos,
--     equipos, costos) en las 9 tablas hijas, porque CM escribe DIRECTO a las tablas
--     (no por RPC) y su policy solo comprobaba user_id + pertenencia del proyecto.
--
-- Patrón: el mismo de 20260924000001 (wrapper delgado con candado + impl separada) y
-- el de 20261005000000 (policies de empresa por tabla).
--
-- ⚠️  APLICAR EN EL SQL EDITOR (en orden). Con el flag apagado NO cambia nada:
--     acceso_modulo() devuelve true para todos y el comportamiento es idéntico.
--
-- Verificación tras aplicar:
--   select proname, proargnames, proacl from pg_proc
--    where proname like 'save_proyecto_general_campo%';
--   select tablename, policyname, cmd, qual, with_check from pg_policies
--    where schemaname = 'public' and tablename like 'cm_%' and policyname like '%propietario%';
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) save_proyecto_general_campo: impl + wrapper con candado ═══════════════════════
--
-- La versión vigente (20261002000000_persistencia_huecos.sql) recreó la función con
-- firma (bigint, text, text) — DISTINTA de la que tenía el wrapper con candado
-- (bigint, text, jsonb) en 20260924000001, que 20260924000002 borró con un DROP.
-- Resultado: la función viva nunca recibió el candado.

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_proyecto_general_campo'
      and pg_get_function_identity_arguments(p.oid) = 'p_proyecto_id bigint, p_campo text, p_valor text'
  ) then
    -- Renombrar a _impl: los grants viajan con el rename (se revocan abajo).
    execute 'alter function public.save_proyecto_general_campo(bigint, text, text) '
         || 'rename to save_proyecto_general_campo_impl';
  end if;
end;
$$;

-- Wrapper con candado de USO. El cuerpo real vive en el _impl (sin cambios de lógica).
create or replace function public.save_proyecto_general_campo(
  p_proyecto_id bigint,
  p_campo text,
  p_valor text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_proyecto_general_campo_impl(p_proyecto_id, p_campo, p_valor);
end;
$$;

-- El impl NO se expone: solo el wrapper (que tiene el candado) lo llama.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_proyecto_general_campo_impl'
      and pg_get_function_identity_arguments(p.oid) = 'p_proyecto_id bigint, p_campo text, p_valor text'
  ) then
    execute 'revoke all on function public.save_proyecto_general_campo_impl(bigint, text, text) '
         || 'from public, anon, authenticated';
  end if;
end;
$$;

revoke all on function public.save_proyecto_general_campo(bigint, text, text) from public, anon;
grant execute on function public.save_proyecto_general_campo(bigint, text, text) to authenticated;

-- ═══ 2) Las 9 tablas hijas de CM: el candado va en SU policy ════════════════════════
--
-- cm_proyectos ya lo tiene (policy de INSERT con acceso_modulo(uid,'manage')), pero un
-- proyecto creado antes de que la suscripción venciera sigue existiendo: sin el candado
-- en las hijas, el usuario sigue escribiendo presupuestos y APUs.
--
-- Se recrean las policies de las 9 tablas con el candado añadido, conservando la
-- autorización por EMPRESA (miembro con asiento escritura) tal como quedó en
-- 20261005000000_empresa_escritura.sql.

do $$
declare
  t text;
begin
  foreach t in array array[
    'cm_factores_prestacionales','cm_cargos','cm_proveedores','cm_cuadrillas',
    'cm_cuadrilla_integrantes','cm_equipos','cm_insumos','cm_apus','cm_presupuestos'
  ] loop
    -- INSERT
    execute format('drop policy if exists %I on public.%I', t || '_propietario_insertar', t);
    execute format($q$create policy %I on public.%I for insert with check (
        ((select auth.uid()) = user_id
             and public.cm_proyecto_de_usuario(proyecto_id)
             and public.acceso_modulo((select auth.uid()), 'manage'))
        or (public.empresa_escritura(user_id, 'manage')
            and public.cm_proyecto_de_propietario(proyecto_id, user_id)
            and public.acceso_modulo((select auth.uid()), 'manage')))$q$,
      t || '_propietario_insertar', t);

    -- UPDATE
    execute format('drop policy if exists %I on public.%I', t || '_propietario_actualizar', t);
    execute format($q$create policy %I on public.%I for update using (
        ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'manage'))
          and public.acceso_modulo((select auth.uid()), 'manage'))
      with check (
        ((select auth.uid()) = user_id
             and public.cm_proyecto_de_usuario(proyecto_id)
             and public.acceso_modulo((select auth.uid()), 'manage'))
        or (public.empresa_escritura(user_id, 'manage')
            and public.cm_proyecto_de_propietario(proyecto_id, user_id)
            and public.acceso_modulo((select auth.uid()), 'manage')))$q$,
      t || '_propietario_actualizar', t);

    -- DELETE
    execute format('drop policy if exists %I on public.%I', t || '_propietario_eliminar', t);
    execute format($q$create policy %I on public.%I for delete using (
        ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'manage'))
          and public.acceso_modulo((select auth.uid()), 'manage'))$q$,
      t || '_propietario_eliminar', t);
  end loop;
end;
$$;

-- ═══ 3) Comprobación ════════════════════════════════════════════════════════════════
-- select proname, proacl from pg_proc where proname like 'save_proyecto_general_campo%';
-- -- save_proyecto_general_campo      -> {authenticated} (execute)
-- -- save_proyecto_general_campo_impl -> {} (sin execute para nadie)
--
-- select count(*) from pg_policies
--  where schemaname='public' and policyname like '%_propietario_%' and qual is not null
--    and qual not like '%acceso_modulo%';
-- -- 0 (todas las policies de escritura de CM llevan el candado)
