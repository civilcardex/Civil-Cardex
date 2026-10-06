-- FASE 0 — Estabilización: guards de cf_proyectos que las pasadas 000003/000004 no cubrieron.
--
-- El sintoma (orig. usuario, tras aplicar 000002..000005): 404 en todos los save rpc (caché
-- de PostgREST sin refrescar) + `operator does not exist: uuid = bigint` en
-- save_rainwater_overrides / saveTrazosToDB. Causa: impls cuyo guard usa el parámetro
-- `p_proyecto_id` con la forma `p.id = p_proyecto_id` o `where id = p_proyecto_id` — ninguna
-- de las dos regex anteriores las alcanzaba (000003: `p.id` SOLO si el prosrc matcheó en su
-- momento; 000004: literal `where id = p_id and user_id = uid`).
--
-- Esta pasada barre TODOS los cuerpos que mencionan cf_proyectos con los tres formularios.
-- Re-ejecutable. ⚠️ APLICAR EN SQL EDITOR.

do $$
declare r record; nueva text;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ilike '%cf_proyectos%'
      and (
        p.prosrc ilike '%where id = p_proyecto_id%'
        or p.prosrc ilike '%p.id = p_proyecto_id%'
        or p.prosrc ilike '%where id = p_id%'
      )
  loop
    nueva := r.def;
    -- Forma 1: guard `p.id = p_proyecto_id` (impls con parámetro p_proyecto_id).
    nueva := regexp_replace(
      nueva,
      '(cf_proyectos\s+p\s+where\s+p\.)id(\s*=\s*p_proyecto_id\b)',
      '\1proyecto_num\2',
      'g'
    );
    -- Forma 2: alias-less `where id = p_proyecto_id …` (delete/update directos).
    nueva := regexp_replace(
      nueva,
      '(cf_proyectos\s+where\s+)id(\s*=\s*p_proyecto_id\b)',
      '\1proyecto_num\2',
      'g'
    );
    -- Forma 3: literal `where id = p_id and user_id = uid` (misma de 000004, por seguridad).
    nueva := replace(
      nueva,
      'where id = p_id and user_id = uid',
      'where proyecto_num = p_id and user_id = uid'
    );
    if nueva <> r.def then
      execute nueva;
    end if;
  end loop;
end $$;

-- Refresca el caché de PostgREST (404 "Not Found" en rpc tras DDL).
notify pgrst, 'reload schema';
