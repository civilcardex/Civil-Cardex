-- FIX quirúrgico: línea 3 del cuerpo real de cf_sellar_owner_contenido
--   `where p.id = (v_row->>'proyecto_id')::bigint;` → cast ::uuid.
-- (Los casts de plano_id / bajante_origen_id / plano_origen_id siguen bigint — correcto:
--  los ids de plano/bajante NO se migraron a uuid.)
-- Corre el error 42883 `uuid = bigint` en TODA escritura de tablas con trg_sellar_owner.
-- Verificado contra el cuerpo real (diagnóstico del usuario, líneas del prosrc).
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable.

do $$
declare def text; nueva text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cf_sellar_owner_contenido';

  if def is null then
    raise exception 'cf_sellar_owner_contenido no existe';
  end if;

  -- Solo la comparación contra proyecto_id; los casts de plano/bajante quedan bigint.
  -- Regex tolerante: comillas simples o dobles, espacios variables (el cuerpo fue recreado
  -- por format() en otras migraciones y puede llevar comillas dobladas).
  nueva := regexp_replace(
    def,
    '\(v_row\s*->>\s*''{0,2}proyecto_id''{0,2}\)\s*::bigint',
    '(v_row ->> ''proyecto_id'')::uuid',
    'g'
  );

  if nueva = def then
    raise notice 'el trigger ya estaba convertido a uuid (no-op)';
  else
    execute nueva;
  end if;

  -- Verificación dura: ninguna línea puede seguir comparando proyecto_id contra bigint.
  if exists (
    select 1
    from unnest(string_to_array(
      (select prosrc from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'cf_sellar_owner_contenido'),
      chr(10)
    )) as linea
    where linea ilike '%proyecto_id%::bigint%'
  ) then
    raise exception 'sello_sin_convertir: la comparacion contra proyecto_id sigue en bigint';
  end if;
end
$$;

notify pgrst, 'reload schema';
