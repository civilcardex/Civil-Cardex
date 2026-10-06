-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261005000025 — Cierre de la conversión uuid: trigger de sellado, declare de
-- save_plano_data y PK de cf_proyectos (huecos que 05000007/05000009 no cubren)
--
--   1. TRIGGER cf_sellar_owner_contenido: los replaces de 05000007/05000009 buscan
--      '{proyecto_id}')::bigint' CON llaves (patrón de save_plano_data), pero el cuerpo
--      real usa (v_row->>'proyecto_id')::bigint SIN llaves → el cast quedó en bigint y
--      TODA escritura en las tablas con trg_sellar_owner revienta 22P02.
--   2. save_plano_data(+impl): el declare `proy_id bigint;` quedó sin convertir —
--      asignar el uuid del header a la variable revienta 42804 en el primer autosave.
--   3. PK: al dropear legacy_num (05000011) se fue con ella la PK heredada; id queda
--      solo UNIQUE → cf_proyectos sin primary key (riesgo de replicación/ORM).
--
-- ⚠️ APLICAR DESPUÉS de 05000009/05000010/05000011. Re-ejecutable (idempotente).
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) Trigger de sellado: cast proyecto_id bigint → uuid ═════════════════════════════
do $fix$
declare
  def text;
  nueva text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cf_sellar_owner_contenido';
  if def is null then raise exception 'cf_sellar_owner_contenido_no_existe'; end if;

  -- Solo el cast de proyecto_id; plano_id/bajante_origen_id/plano_origen_id siguen bigint.
  nueva := regexp_replace(def,
    $r$((v_row|new)->>'proyecto_id'\s*)::bigint$r$, $r$\1::uuid$r$, 'g');

  if nueva <> def then
    execute nueva;
  end if;

  -- Verificación dura: sin ::bigint en la rama de proyecto_id → ok; si queda, abortar.
  if (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'cf_sellar_owner_contenido')
      ~ 'proyecto_id.{0,4}::bigint' then
    raise exception 'sello_sin_convertir: el trigger sigue casteando proyecto_id a bigint';
  end if;
end
$fix$;

-- ═══ 2) save_plano_data(+impl): declare proy_id uuid ═══════════════════════════════════
do $fix$
declare
  r record;
  nueva text;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('save_plano_data', 'save_plano_data_impl')
      and p.prosrc like '%proy_id bigint%'
  loop
    nueva := replace(r.def, 'proy_id bigint', 'proy_id uuid');
    execute nueva;
    raise notice 'proy_id convertido a uuid en %', r.proname;
  end loop;
end
$fix$;

-- ═══ 3) PK de cf_proyectos sobre id ════════════════════════════════════════════════════
do $fix$
declare
  conname_actual text;
begin
  -- La PK heredada (si quedó anclada a una columna renombrada) sale con la columna;
  -- en cualquier caso: si id no es PK, se la damos.
  select c.conname into conname_actual
    from pg_constraint c join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public' and t.relname = 'cf_proyectos' and c.contype = 'p';
  if conname_actual is null then
    alter table public.cf_proyectos add primary key (id);
  elsif conname_actual <> 'cf_proyectos_pkey' or not exists (
    select 1 from pg_constraint c
     where c.conrelid = 'public.cf_proyectos'::regclass and c.contype = 'p'
       and 'id'::name = any(c.conkey::name[])
  ) then
    execute format('alter table public.cf_proyectos drop constraint %I', conname_actual);
    alter table public.cf_proyectos add primary key (id);
  end if;
end
$fix$;

-- ═══ VERIFICACIÓN ═══════════════════════════════════════════════════════════════════════
-- select prosrc like '%proyecto_id%'')::bigint%' as trigger_roto    -- false
--   from pg_proc where proname = 'cf_sellar_owner_contenido';
-- select prosrc like '%proy_id bigint%' as declare_roto             -- false
--   from pg_proc where proname in ('save_plano_data','save_plano_data_impl');
-- select kcu.column_name from information_schema.table_constraints tc
--   join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
--  where tc.table_name = 'cf_proyectos' and tc.constraint_type = 'PRIMARY KEY';  → 'id'
