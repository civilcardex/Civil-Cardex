-- ═══════════════════════════════════════════════════════════════════════════════════════
-- CORRECTIVA v2: deja UNA sola sobrecarga de save_proyecto_general_campo, con candado
-- Fecha: 2026-10-21
--
-- CADENA DE INCIDENTES (para no repetirla):
--   1) 20261021000000 (1ª versión) creó una sobrecarga (bigint, text, text) de una función
--      que ya no existía con esa firma: la viva es (uuid, text, text), convertida por
--      20261006000000. Con dos sobrecargas, PostgREST responde "Could not choose the best
--      candidate function" y NINGÚN guardado de campo del proyecto funciona.
--   2) La 20261021000000 (2ª versión) envolvía la función correcta pero NO limpiaba la
--      sobrecarga bigint espuria -> su comprobación dura ("debe tener 1") falló.
--
-- QUÉ HACE ESTA: converge CUALQUIER estado previo a un único estado válido, y lo hace
-- localizando el CUERPO REAL por su contenido (la función que escribe en
-- cf_proyecto_general), no por la firma. Así no depende de en qué orden se aplicaron las
-- migraciones ni de qué sobrecargas quedaron sueltas.
--
--   1) Localiza el cuerpo real (prosrc con 'cf_proyecto_general') y exige que su firma
--      sea la que usa el cliente (uuid). Si no lo es, se detiene con un mensaje claro
--      (convertir la firma sería rehacer 20261006000000).
--   2) Lo deja como save_proyecto_general_campo_impl (el rename NO toca el cuerpo).
--   3) Borra TODO lo demás con esos nombres (wrappers y sobrecargas bigint huérfanas).
--   4) Crea el wrapper con el candado de suscripción sobre la MISMA firma.
--   5) Comprueba que quede 1 sobrecarga expuesta y que el impl no sea público.
--
-- Es IDEMPOTENTE: se puede aplicar las veces que haga falta y sobre una base ya corregida.
--
-- ⚠️  APLICAR EN EL SQL EDITOR.
-- ═══════════════════════════════════════════════════════════════════════════════════════

do $$
declare
  r record;
  v_cuerpo record;
  v_args text;
  v_llamada text;
begin
  -- ═══ 1) Localizar el CUERPO REAL ══════════════════════════════════════════════════
  -- Es la función que ESCRIBE en cf_proyecto_general; la wrapper solo delega en el _impl.
  -- Se busca por contenido porque las firmas cambiaron varias veces (bigint -> uuid).
  select p.proname, pg_get_function_identity_arguments(p.oid) as args
    into v_cuerpo
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('save_proyecto_general_campo', 'save_proyecto_general_campo_impl')
     and p.prosrc like '%cf_proyecto_general%'
   order by (pg_get_function_identity_arguments(p.oid) ilike '%bigint%') asc
   limit 1;

  if not found then
    raise exception '[fix] no se encuentra el cuerpo real de save_proyecto_general_campo (prosrc con cf_proyecto_general)';
  end if;

  v_args := v_cuerpo.args;

  -- El cliente manda un uuid: si el cuerpo real no tiene esa firma, no la convertimos aquí
  -- (eso es trabajo de 20261006000000). Se dice en voz alta en vez de dejar un desastre.
  if v_args ilike '%bigint%' then
    raise exception '[fix] el cuerpo real tiene firma bigint (%) pero el cliente manda uuid: revisa 20261006000000', v_args;
  end if;

  -- ═══ 2) El cuerpo real pasa a llamarse _impl (el rename NO toca el cuerpo) ══════════
  if v_cuerpo.proname <> 'save_proyecto_general_campo_impl' then
    execute format(
      'alter function public.save_proyecto_general_campo(%s) rename to save_proyecto_general_campo_impl',
      v_args
    );
    raise notice '[fix] cuerpo real movido a _impl: (%)', v_args;
  end if;

  -- ═══ 3) Borrar TODO lo demás con estos nombres ═══════════════════════════════════
  -- (wrappers viejos, sobrecargas bigint espurias, el _impl huérfano de otra firma).
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('save_proyecto_general_campo', 'save_proyecto_general_campo_impl')
       and not (
         p.proname = 'save_proyecto_general_campo_impl'
         and pg_get_function_identity_arguments(p.oid) = v_args
       )
  loop
    execute format('drop function if exists public.%I(%s)', r.proname, r.args);
    raise notice '[fix] eliminada función sobrante: % (%)', r.proname, r.args;
  end loop;

  -- ═══ 4) Wrapper con candado de uso, sobre la MISMA firma que el impl ═══════════════
  if array_length(string_to_array(v_args, ','), 1) <> 3 then
    raise exception '[fix] firma inesperada de save_proyecto_general_campo: %', v_args;
  end if;

  -- btrim: la firma viene con espacios tras las comas (" p_campo text") y split_part
  -- devolvería vacío sin el trim.
  select string_agg(split_part(btrim(x), ' ', 1), ', ')
    into v_llamada
    from unnest(string_to_array(v_args, ',')) as x;

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

  -- ═══ 5) Grants: el impl no se expone; el wrapper es el único ejecutable ════════════
  execute format('revoke all on function public.save_proyecto_general_campo_impl(%s) from public, anon, authenticated', v_args);
  execute format('revoke all on function public.save_proyecto_general_campo(%s) from public, anon', v_args);
  execute format('grant execute on function public.save_proyecto_general_campo(%s) to authenticated', v_args);

  raise notice '[fix] save_proyecto_general_campo lista: wrapper + impl sobre (%)', v_args;
end;
$$;

-- ═══ Comprobaciones duras (fallan ruidosamente si algo quedó mal) ═════════════════════
-- (a) Exactamente UNA sobrecarga con el nombre de cara al cliente.
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
    raise exception '[fix] save_proyecto_general_campo tiene % sobrecargas (debe tener 1): %', n, coalesce(firmas, '');
  end if;
  if firmas like '%bigint%' then
    raise exception '[fix] quedó la sobrecarga bigint: %', firmas;
  end if;
end;
$$;

-- (b) El impl existe, comparte firma con el wrapper y NO es ejecutable por PUBLIC.
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
    raise exception '[fix] falta save_proyecto_general_campo_impl';
  end if;
  if v_wrapper_args is null then
    raise exception '[fix] falta save_proyecto_general_campo';
  end if;
  if v_impl_args <> v_wrapper_args then
    raise exception '[fix] impl (%) y wrapper (%) no comparten firma', v_impl_args, v_wrapper_args;
  end if;
  -- proacl NULL = ACL por defecto = PUBLIC tiene EXECUTE. Con el revoke aplicado el acl
  -- queda {owner=X/owner} (sin la entrada "=X", que es PUBLIC).
  if v_impl_acl is null or v_impl_acl ~ '(^|[{,])=X' then
    raise exception '[fix] el impl sigue siendo ejecutable por PUBLIC: %', coalesce(v_impl_acl, '(acl por defecto)');
  end if;
  if v_wrapper_acl is null or v_wrapper_acl not like '%authenticated=X%' then
    raise exception '[fix] el wrapper no es ejecutable por authenticated: %', coalesce(v_wrapper_acl, '(acl por defecto)');
  end if;
end;
$$;

-- ═══ Comprobación manual ════════════════════════════════════════════════════════════
-- select p.proname,
--        pg_get_function_identity_arguments(p.oid) as args,
--        p.proacl
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname like 'save_proyecto_general_campo%'
--  order by p.proname;
-- Debe salir EXACTAMENTE 2 filas:
--   save_proyecto_general_campo      (p_proyecto_id uuid, p_campo text, p_valor text)  {…authenticated…}
--   save_proyecto_general_campo_impl (p_proyecto_id uuid, p_campo text, p_valor text)  {…owner…}
