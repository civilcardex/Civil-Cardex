-- Segunda pasada del rename cf_proyectos (20261005000003): la primera solo cubría la forma
-- `cf_proyectos p where p.id = …`; quedaron vivas las formas SIN alias que revientan con
-- `operator does not exist: uuid = bigint`:
--   delete_proyecto:  delete from public.cf_proyectos where id = p_id …
--   update_proyecto_nombre: update public.cf_proyectos set … where id = p_id …
-- Esta pasada reescribe `cf_proyectos where id` → `cf_proyectos where proyecto_num` en TODOS
-- los cuerpos de funciones del esquema public, y refresca el caché de PostgREST (los 404 del
-- rpc tras el DDL son caché de schema). Re-ejecutable.
-- ⚠️ APLICAR EN SQL EDITOR.

do $$
declare r record; nueva text;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ilike '%cf_proyectos where id%'
  loop
    nueva := regexp_replace(
      r.def,
      '(cf_proyectos\s+where\s+)id\b',
      '\1proyecto_num',
      'g'
    );
    -- Forma UPDATE: `set … where id = p_id` (el where queda separado del nombre de tabla
    -- por el SET — la primera regex no lo cubre). `where id = p_id and user_id = uid` es
    -- exclusivo del CRUD de cf_proyectos.
    nueva := regexp_replace(
      nueva,
      'where id = p_id and user_id = uid',
      'where proyecto_num = p_id and user_id = uid',
      'g'
    );
    if nueva <> r.def then
      execute nueva;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
