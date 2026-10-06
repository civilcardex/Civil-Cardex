-- cf_proyectos: la columna `id` pasa a ser el UUID (paridad cm_proyectos) y la PK numérica
-- queda como `proyecto_num`. Requiere 20261005000002 aplicado (columna slug creada/backfill).
--
-- Las 45 referencias vivas `cf_proyectos p where p.id = …` (guards de RPCs + policies RLS)
-- se reescriben PROGRAMÁTICAMENTE a `p.proyecto_num`:
--  - Funciones: pg_get_functiondef() + CREATE OR REPLACE (conserva grants del gating —
--    lección R-1: nunca drop).
--  - Policies: pg_policies (qual/with_check/roles/cmd) → drop + create con la expresión
--    reescrita (respeta las definiciones VIGENTES, incluidas las del DO de empresa).
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable (los renames fallan si ya se aplicaron: los dos
-- primeros ALTER son los únicos no-idempotentes).

alter table public.cf_proyectos rename column id to proyecto_num;
alter table public.cf_proyectos rename column slug to id;

-- ── RPCs: reescribir cuerpos que referencian cf_proyectos p.id ─────────────────────
do $$
declare r record; nueva text;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ilike '%cf_proyectos p where p.id%'
  loop
    nueva := regexp_replace(
      r.def,
      '(cf_proyectos\s+p\s+where\s+p\.)id\b',
      '\1proyecto_num',
      'g'
    );
    if nueva <> r.def then
      execute nueva;
    end if;
  end loop;
end $$;

-- ── Policies RLS: mismas expresiones con proyecto_num ──────────────────────────────
do $$
declare r record; q text; wq text; roles_txt text; per text;
begin
  for r in
    select schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ilike '%cf_proyectos p where p.id%'
        or coalesce(with_check, '') ilike '%cf_proyectos p where p.id%')
  loop
    q := regexp_replace(coalesce(r.qual, 'true'),
      '(cf_proyectos\s+p\s+where\s+p\.)id\b', '\1proyecto_num', 'g');
    wq := regexp_replace(coalesce(r.with_check, ''),
      '(cf_proyectos\s+p\s+where\s+p\.)id\b', '\1proyecto_num', 'g');
    roles_txt := (select string_agg(format('%I', role), ', ') from unnest(r.roles) role);
    per := case when r.permissive then 'AS PERMISSIVE' else 'AS RESTRICTIVE' end;
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
    execute format(
      'create policy %I on %I.%I %s for %s to %s using (%s)%s',
      r.policyname, r.schemaname, r.tablename,
      per,
      r.cmd,
      roles_txt,
      q,
      case when coalesce(r.with_check, '') = '' then '' else format(' with check (%s)', wq) end
    );
  end loop;
end $$;
