-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CORRECTIVA: sobrecarga espuria de save_proyecto_general_campo (2026-10-21)
-- Fecha: 2026-10-21
--
-- Qué pasó: la migración 20261021000000 (candado de suscripción) creó una sobrecarga
-- (bigint, text, text) de public.save_proyecto_general_campo. La función VIVA es la
-- (uuid, text, text): la convirtió 20261006000000, que reescribió el cuerpo y borró la
-- bigint. Con DOS sobrecargas del mismo nombre, PostgREST no puede elegir candidato:
--
--   Could not choose the best candidate function between:
--     public.save_proyecto_general_campo(p_proyecto_id -> bigint, p_campo -> text, p_valor -> text),
--     public.save_proyecto_general_campo(p_proyecto_id -> uuid,  p_campo -> text, p_valor -> text)
--
-- Efecto: NINGÚN guardado de campo del proyecto funcionaba (rejillas, af_alimentacion,
-- tanque_npt, presion_garantizada) — todos van por ese RPC.
--
-- Esta migración es IDEMPOTENTE: sirve tanto para la base que ya aplicó la 20261021000000
-- rota (limpia la sobrecarga y envuelve la uuid) como para una base donde la 20261021000000
-- ya está corregida (solo comprueba y no toca nada).
--
-- ⚠️  APLICAR EN EL SQL EDITOR (después de 20261021000000).
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) Limpiar las sobrecargas espurias (las de firma bigint) ══════════════════════
-- Primero el wrapper, luego el impl (por si ambos existieran).
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('save_proyecto_general_campo', 'save_proyecto_general_campo_impl')
       and pg_get_function_identity_arguments(p.oid) ilike '%bigint%'
  loop
    execute format('drop function if exists public.%I(%s)', r.proname, r.args);
    raise notice 'eliminada sobrecarga espuria: % (%)', r.proname, r.args;
  end loop;
end;
$$;

-- ═══ 2) Envolver la función viva con el candado de uso (solo si no lo tenía) ══════════
-- Si el _impl NO existe, la función viva es la original (sin candado): se renombra a
-- _impl y se crea el wrapper con candado. Si el _impl YA existe, la 20261021000000 (o
-- esta misma migración) ya la envolvió y no hay que hacer nada.
do $$
declare
  r record;
  v_args text;
  v_llamada text;
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_proyecto_general_campo_impl'
  ) then
    raise notice 'save_proyecto_general_campo ya estaba envuelta: no se toca';
    return;
  end if;

  select pg_get_function_identity_arguments(p.oid) as args
    into r
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'save_proyecto_general_campo'
   limit 1;

  if not found then
    raise exception 'no existe public.save_proyecto_general_campo: revisa el orden de migraciones';
  end if;

  v_args := r.args;
  if array_length(string_to_array(v_args, ','), 1) <> 3 then
    raise exception 'firma inesperada de save_proyecto_general_campo: %', v_args;
  end if;

  -- btrim: la firma viene con espacios tras las comas (" p_campo text") y split_part
  -- devolvería vacío sin el trim.
  select string_agg(split_part(btrim(x), ' ', 1), ', ')
    into v_llamada
    from unnest(string_to_array(v_args, ',')) as x;

  -- El cuerpo real se conserva: el rename no lo toca.
  execute format('alter function public.save_proyecto_general_campo(%s) rename to save_proyecto_general_campo_impl', v_args);

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

  -- Grants: el impl no se expone; el wrapper es el único ejecutable por un usuario.
  execute format('revoke all on function public.save_proyecto_general_campo_impl(%s) from public, anon, authenticated', v_args);
  execute format('revoke all on function public.save_proyecto_general_campo(%s) from public, anon', v_args);
  execute format('grant execute on function public.save_proyecto_general_campo(%s) to authenticated', v_args);

  raise notice 'save_proyecto_general_campo envuelta con candado: (%)', v_args;
end;
$$;

-- ═══ 3) Comprobaciones duras (fallan ruidosamente si algo quedó mal) ═════════════════
-- (a) No puede quedar más de una sobrecarga con el nombre "de cara al cliente".
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

-- (b) El impl existe y NO es ejecutable por nadie; el wrapper sí lo es por authenticated.
do $$
declare
  v_impl_args text;
  v_wrapper_args text;
  v_impl_acl text;
  v_wrapper_acl text;
begin
  select pg_get_function_identity_arguments(p.oid), p.proacl::text
    into v_impl_args, v_impl_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_proyecto_general_campo_impl'
   limit 1;

  select pg_get_function_identity_arguments(p.oid), p.proacl::text
    into v_wrapper_args, v_wrapper_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_proyecto_general_campo'
   limit 1;

  if v_impl_args is null then
    raise exception 'falta save_proyecto_general_campo_impl';
  end if;
  if v_wrapper_args is null then
    raise exception 'falta save_proyecto_general_campo';
  end if;
  if v_impl_args <> v_wrapper_args then
    raise exception 'impl (%) y wrapper (%) no comparten firma', v_impl_args, v_wrapper_args;
  end if;
  -- proacl NULL = ACL por defecto = PUBLIC tiene EXECUTE. Con el revoke aplicado el acl
  -- queda {owner=X/owner} (sin entrada "=X" que es PUBLIC). Si el acl es NULL o trae
  -- la entrada de PUBLIC, el impl sigue expuesto.
  if v_impl_acl is null or v_impl_acl ~ '(^|[{,])=X' then
    raise exception 'el impl sigue siendo ejecutable por PUBLIC: %', coalesce(v_impl_acl, '(acl por defecto)');
  end if;
  if v_wrapper_acl is null or v_wrapper_acl not like '%authenticated=X%' then
    raise exception 'el wrapper no es ejecutable por authenticated: %', coalesce(v_wrapper_acl, '(acl por defecto)');
  end if;
end;
$$;

-- ═══ 4) Comprobación manual (pegar el resultado si algo sigue fallando) ═════════════
-- select p.proname,
--        pg_get_function_identity_arguments(p.oid) as args,
--        p.proacl
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname like 'save_proyecto_general_campo%'
--  order by p.proname;
-- Debe salir EXACTAMENTE 2 filas:
--   save_proyecto_general_campo      (p_proyecto_id uuid, p_campo text, p_valor text)  {authenticated}
--   save_proyecto_general_campo_impl (p_proyecto_id uuid, p_campo text, p_valor text)  {}
