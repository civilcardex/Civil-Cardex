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
--
-- IMPORTANTE (corrección 2026-10-21): la firma NO se puede hardcodear. La función nació
-- como (bigint, text, text) en 20261002000000, pero 20261006000000 la reescribió a
-- (uuid, text, text) y borró la bigint. La versión anterior de esta migración asumía
-- `bigint` y creaba una SEGUNDA sobrecarga -> PostgREST no podía elegir candidato
-- ("Could not choose the best candidate function") y NINGÚN guardado de campo del
-- proyecto funcionaba. Por eso aquí se DETECTA la firma viva y se envuelve la que exista.

do $$
declare
  r record;
  v_args text;
  v_llamada text;
begin
  -- Si el _impl ya existe, la función YA está envuelta: no se toca (idempotencia).
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_proyecto_general_campo_impl'
  ) then
    raise notice 'save_proyecto_general_campo ya está envuelta: no se toca';
    return;
  end if;

  -- La función viva: la que NO es _impl. Si hubiera varias (por el bug de la versión
  -- anterior de esta migración), se prefiere la que NO es bigint: la del cliente.
  select p.oid, pg_get_function_identity_arguments(p.oid) as args
    into r
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'save_proyecto_general_campo'
   order by (pg_get_function_identity_arguments(p.oid) ilike '%bigint%') asc
   limit 1;

  if not found then
    raise exception 'no existe public.save_proyecto_general_campo: revisa el orden de migraciones';
  end if;

  v_args := r.args;

  -- Solo se soporta la firma de 3 argumentos simples (p_proyecto_id, p_campo, p_valor).
  if array_length(string_to_array(v_args, ','), 1) <> 3 then
    raise exception 'firma inesperada de save_proyecto_general_campo: %', v_args;
  end if;

  -- Nombres de los argumentos (para la llamada al impl). btrim: la firma viene con
  -- espacios tras las comas (" p_campo text") y split_part devolvería vacío sin el trim.
  select string_agg(split_part(btrim(x), ' ', 1), ', ')
    into v_llamada
    from unnest(string_to_array(v_args, ',')) as x;

  -- Renombrar a _impl: el cuerpo real se conserva intacto y los grants viajan con el rename
  -- (se revocan abajo).
  execute format('alter function public.save_proyecto_general_campo(%s) rename to save_proyecto_general_campo_impl', v_args);

  -- Wrapper con candado de USO. El cuerpo real vive en el _impl (sin cambios de lógica).
  execute format($ddl$
    create or replace function public.save_proyecto_general_campo(%s)
    returns void language plpgsql security definer set search_path = public as $fn$
    begin
      if auth.uid() is null then raise exception 'no_autenticado'; end if;
      if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
      perform public.save_proyecto_general_campo_impl(%s);
    end;
    $fn$;
  $ddl$, v_args, v_llamada);

  raise notice 'save_proyecto_general_campo envuelta con candado: (%)', v_args;
end;
$$;

-- Grants: el impl NO se expone (solo lo llama el wrapper, que es SECURITY DEFINER);
-- el wrapper es el único ejecutable por un usuario autenticado.
do $$
declare
  r record;
  v_args text;
begin
  select pg_get_function_identity_arguments(p.oid) as args
    into r
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'save_proyecto_general_campo_impl'
   limit 1;
  if found then
    v_args := r.args;
    execute format('revoke all on function public.save_proyecto_general_campo_impl(%s) from public, anon, authenticated', v_args);
    execute format('revoke all on function public.save_proyecto_general_campo(%s) from public, anon', v_args);
    execute format('grant execute on function public.save_proyecto_general_campo(%s) to authenticated', v_args);
  end if;
end;
$$;

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

-- ═══ Comprobación dura: UNA sola sobrecarga con el nombre "de cara al cliente" ════════
-- Con dos sobrecargas, PostgREST responde "Could not choose the best candidate function"
-- y NINGÚN guardado de campo del proyecto funciona. Esta comprobación hace que el fallo
-- aparezca al aplicar la migración y no meses después en producción.
do $$
declare
  n int;
  firmas text;
begin
  select count(*), string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
    into n, firmas
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname = 'save_proyecto_general_campo';
  if n <> 1 then
    raise exception 'save_proyecto_general_campo tiene % sobrecargas (debe tener 1): %', n, coalesce(firmas, '');
  end if;
  if firmas like '%bigint%' then
    raise exception 'quedó la sobrecarga bigint: %', firmas;
  end if;
end;
$$;
