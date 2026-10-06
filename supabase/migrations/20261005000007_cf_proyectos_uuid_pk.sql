-- FASE 1 — cf_proyectos: PK uuid EN TODO el sistema (paridad cm_proyectos).
-- Estado previo requerido: 000002..000006 aplicadas (id=uuid PK, proyecto_num bigint legacy,
-- hijos proyecto_id bigint, RPCs con parámetro proyecto bigint).
--
-- RE-EJECUTABLE sobre estados parciales: cada bloque salta si ya hizo su trabajo (el SQL
-- Editor autocomite por sentencia — un fallo a mitad deja lo anterior comprometido).
--   0. Trigger de sellado: fix de tipos (compara contra el uuid).
--   1. Hijas → uuid con remapeo (saltando las ya convertidas) + policies respaldadas.
--   1b. Índices/constraints/PKs recreados (if not exists / guard por constraint).
--   2. RPCs de proyecto: firma bigint → uuid (siempre crea la sobrecarga y suelta la
--      firma vieja) + cast del header en save_plano_data/impl.
--   2b. Grants/revokes por firma uuid.
--   4. Policies con `p.proyecto_num` restantes → p.id.
--   5. proyecto_num → legacy_num (guardado).
--   6. notify pgrst, 'reload schema'.
-- ⚠️ APLICAR EN SQL EDITOR ("Run without RLS" si sale el advisory — la tabla _cf_uuid_mig_pol_backup
-- es un respaldo efímero de policies dentro de la migración).

-- ── 0) Trigger de sellado ───────────────────────────────────────────────────────────
-- a) La función pasa a comparar contra el id uuid (los UPDATE del remapeo la disparan).
do $$
declare r record; nueva text;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cf_sellar_owner_contenido'
      and p.prosrc ilike '%proyecto_id%'')::bigint%'
  loop
    nueva := replace(r.def, '{proyecto_id}'')::bigint', '{proyecto_id}'')::uuid');
    nueva := replace(nueva, 'p.proyecto_num', 'p.id');
    if nueva <> r.def then
      execute nueva;
    end if;
  end loop;
end $$;


-- ── 1) Hijas: proyecto_id bigint → uuid con remapeo ────────────────────────────────
-- Backup de policies que dependen de proyecto_id (el DROP COLUMN las exige soltadas):
-- se re-crean al final de cada tabla con `p.id` en vez de `p.proyecto_num`.
create table if not exists public._cf_uuid_mig_pol_backup(
  tablename text, policyname text, cmd text, roles text[], permissive text, qual text, with_check text
);
insert into public._cf_uuid_mig_pol_backup
select tablename, policyname, cmd, roles, permissive, coalesce(qual, 'true'), coalesce(with_check, '')
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') ilike '%proyecto_id%' or coalesce(with_check, '') ilike '%proyecto_id%')
  and not exists (
    select 1 from public._cf_uuid_mig_pol_backup b
    where b.tablename = pg_policies.tablename and b.policyname = pg_policies.policyname
  );

do $$
declare t record; pol record; roles_txt text; per text; q text; wq text; dt text;
begin
  -- tabla, nombre de FK a soltar
  for t in
    select * from (values
      ('cf_pisos',                      'pisos_proyecto_id_fkey'),
      ('cf_proyecto_general',           'proyecto_general_proyecto_id_fkey'),
      ('cf_materiales_proyecto',        'materiales_proyecto_proyecto_id_fkey'),
      ('cf_profundidades_proyecto',     'profundidades_proyecto_proyecto_id_fkey'),
      ('cf_criterios_proyecto',         'criterios_proyecto_proyecto_id_fkey'),
      ('cf_planos',                     'planos_proyecto_id_fkey'),
      ('cf_gas_datos_proyecto',         'gas_datos_proyecto_proyecto_id_fkey'),
      ('cf_ep_datos_proyecto',          'ep_datos_proyecto_proyecto_id_fkey'),
      ('cf_bomba_datos_proyecto',       'bomba_datos_proyecto_proyecto_id_fkey'),
      ('cf_anulaciones_bajantes_pluviales', 'anulaciones_bajantes_pluviales_proyecto_id_fkey'),
      ('cf_anulaciones_canales_pluviales',  'anulaciones_canales_pluviales_proyecto_id_fkey')
    ) as x(tabla, fk)
  loop
    -- Re-ejecución sobre estado parcial: si la hija ya es uuid, saltar todo el bloque.
    select data_type into dt
    from information_schema.columns
    where table_schema = 'public' and table_name = t.tabla and column_name = 'proyecto_id';
    if dt = 'uuid' then
      continue;
    end if;
    if dt is null then
      raise exception 'tabla % sin columna proyecto_id', t.tabla;
    end if;

    -- Los triggers de usuario (sellado, updated_at) NO deben dispararse durante el
    -- remapeo: el payload lleva proyecto_id viejo numérico y el sellado ya castea ::uuid.
    execute format('alter table public.%I disable trigger user', t.tabla);

    -- Soltar las policies que dependen de proyecto_id (respaldadas arriba).
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t.tabla
        and (coalesce(qual, '') ilike '%proyecto_id%' or coalesce(with_check, '') ilike '%proyecto_id%')
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t.tabla);
    end loop;

    execute format('alter table public.%I drop constraint %I', t.tabla, t.fk);
    execute format('alter table public.%I add column proyecto_id_new uuid', t.tabla);
    execute format(
      'update public.%I h set proyecto_id_new = p.id from public.cf_proyectos p where p.proyecto_num = h.proyecto_id',
      t.tabla
    );
    execute format('alter table public.%I drop column proyecto_id', t.tabla);
    execute format('alter table public.%I rename column proyecto_id_new to proyecto_id', t.tabla);
    execute format('alter table public.%I alter column proyecto_id set not null', t.tabla);
    execute format(
      'alter table public.%I add constraint %I foreign key (proyecto_id) references public.cf_proyectos(id) on delete cascade',
      t.tabla, t.fk
    );

    -- Recrear policies respaldadas: el lado cf_proyectos pasa a p.id (la columna de la hija
    -- conserva el nombre proyecto_id).
    for pol in
      select * from public._cf_uuid_mig_pol_backup where tablename = t.tabla
    loop
      q := replace(pol.qual, 'p.proyecto_num', 'p.id');
      wq := replace(pol.with_check, 'p.proyecto_num', 'p.id');
      roles_txt := (select string_agg(format('%I', role), ', ') from unnest(pol.roles) role);
      per := 'AS ' || coalesce(pol.permissive, 'PERMISSIVE');
      if pol.cmd = 'INSERT' then
        execute format(
          'create policy %I on public.%I %s for INSERT to %s with check (%s)',
          pol.policyname, t.tabla, per, roles_txt, wq
        );
      elsif pol.cmd = 'SELECT' then
        execute format(
          'create policy %I on public.%I %s for SELECT to %s using (%s)',
          pol.policyname, t.tabla, per, roles_txt, q
        );
      else
        execute format(
          'create policy %I on public.%I %s for %s to %s using (%s) with check (%s)',
          pol.policyname, t.tabla, per, pol.cmd, roles_txt, q, wq
        );
      end if;
    end loop;

    execute format('alter table public.%I enable trigger user', t.tabla);
  end loop;
end $$;

-- ── 1b) Índices/constraints/PKs recreados ───────────────────────────────────────────
create unique index if not exists idx_cf_pisos_proyecto_id_n on public.cf_pisos(proyecto_id, n);
create index if not exists idx_cf_pisos_proyecto_id on public.cf_pisos(proyecto_id);
create index if not exists idx_cf_materiales_proyecto_proyecto_id on public.cf_materiales_proyecto(proyecto_id);
create unique index if not exists idx_cf_materiales_proyecto_cat_cliente on public.cf_materiales_proyecto(proyecto_id, categoria, client_id);
create index if not exists idx_cf_profundidades_proyecto_proyecto_id on public.cf_profundidades_proyecto(proyecto_id);
create unique index if not exists idx_cf_profundidades_proyecto_cliente on public.cf_profundidades_proyecto(proyecto_id, client_id);
create index if not exists idx_cf_criterios_proyecto_proyecto_id on public.cf_criterios_proyecto(proyecto_id);
create unique index if not exists idx_cf_criterios_proyecto_cliente on public.cf_criterios_proyecto(proyecto_id, client_id);
create index if not exists idx_cf_planos_proyecto_id on public.cf_planos(proyecto_id);
create unique index if not exists idx_cf_anulaciones_bajantes_proyecto_cliente on public.cf_anulaciones_bajantes_pluviales(proyecto_id, id_cliente);
create index if not exists idx_cf_anulaciones_bajantes_proyecto on public.cf_anulaciones_bajantes_pluviales(proyecto_id);
create unique index if not exists idx_cf_anulaciones_canales_proyecto_cliente on public.cf_anulaciones_canales_pluviales(proyecto_id, id_cliente);
create index if not exists idx_cf_anulaciones_canales_proyecto on public.cf_anulaciones_canales_pluviales(proyecto_id);
do $$
declare t record;
begin
  -- PKs mono-columna (proyecto_general + gas/ep/bomba datos): guard por constraint.
  for t in
    select * from (values
      ('cf_proyecto_general'), ('cf_gas_datos_proyecto'),
      ('cf_ep_datos_proyecto'), ('cf_bomba_datos_proyecto')
    ) as x(tabla)
  loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', t.tabla)::regclass and contype = 'p'
    ) then
      execute format('alter table public.%I add primary key (proyecto_id)', t.tabla);
    end if;
  end loop;
end $$;

-- ── 2) RPCs de proyecto: firma + cuerpo a uuid ─────────────────────────────────────
do $$
declare
  r record;
  firma_vieja text;
  nueva text;
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as identidad,
           pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'save_proyecto_core', 'save_planos_meta', 'save_redes_activas',
        'save_gas_datos', 'save_ep_datos', 'save_bomba_datos',
        'save_rainwater_overrides', 'get_proyecto_data',
        'save_proyecto_general_campo',
        'update_proyecto_nombre', 'delete_proyecto',
        'save_proyecto_core_impl', 'save_planos_meta_impl', 'save_redes_activas_impl',
        'save_gas_datos_impl', 'save_ep_datos_impl', 'save_bomba_datos_impl',
        'save_rainwater_overrides_impl'
      )
      and pg_get_function_identity_arguments(p.oid) ilike '%bigint%'
  loop
    firma_vieja := format('public.%I(%s)', r.proname, r.identidad);
    nueva := r.def;
    nueva := replace(nueva, 'p_proyecto_id bigint', 'p_proyecto_id uuid');
    nueva := replace(nueva, 'p_id bigint', 'p_id uuid');
    -- cuerpos: llave numérica → uuid
    nueva := replace(nueva, 'p.proyecto_num = p_proyecto_id', 'p.id = p_proyecto_id');
    nueva := replace(nueva, 'p.proyecto_num = p_id', 'p.id = p_id');
    nueva := replace(nueva, 'where proyecto_num = p_id', 'where id = p_id');
    -- Siempre crear la sobrecarga uuid (aunque el cuerpo ya quedara en p.id) y soltar
    -- la firma bigint vieja: el grants DO de abajo exige la firma uuid de TODAS.
    execute nueva;
    execute format('drop function %s', firma_vieja);
  end loop;

  -- save_plano_data(+impl): la firma queda (p_plano_id bigint, p_data jsonb) — el PLANO no
  -- cambia; solo el cast del proyecto del header y el guard interno.
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('save_plano_data', 'save_plano_data_impl')
      and p.prosrc ilike '%proyecto_id%'')::bigint%'
  loop
    nueva := replace(r.def, '{header,proyecto_id}'')::bigint', '{header,proyecto_id}'')::uuid');
    nueva := replace(nueva, 'p.proyecto_num = proy_id', 'p.id = proy_id');
    if nueva <> r.def then
      execute nueva;
    end if;
  end loop;
end $$;

-- ── 2b) Grants/revokes por firma uuid ───────────────────────────────────────────────
do $$
declare f text;
begin
  -- WRAPPERS + singles: solo authenticated
  foreach f in array array[
    'save_proyecto_core(uuid, jsonb)',
    'save_planos_meta(uuid, jsonb)',
    'save_redes_activas(uuid, text[])',
    'save_gas_datos(uuid, jsonb)',
    'save_ep_datos(uuid, jsonb)',
    'save_bomba_datos(uuid, jsonb)',
    'save_rainwater_overrides(uuid, jsonb, jsonb)',
    'save_plano_data(bigint, jsonb)',
    'save_proyecto_general_campo(uuid, text, text)',
    'update_proyecto_nombre(uuid, text)',
    'delete_proyecto(uuid)',
    'get_proyecto_data(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- IMPLS: nada ejecutable
  foreach f in array array[
    'save_proyecto_core_impl(uuid, jsonb)',
    'save_planos_meta_impl(uuid, jsonb)',
    'save_redes_activas_impl(uuid, text[])',
    'save_gas_datos_impl(uuid, jsonb)',
    'save_ep_datos_impl(uuid, jsonb)',
    'save_bomba_datos_impl(uuid, jsonb)',
    'save_rainwater_overrides_impl(uuid, jsonb, jsonb)',
    'save_plano_data_impl(bigint, jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ── 4) Policies con p.proyecto_num restantes → p.id ─────────────────────────────────
do $$
declare r record; q text; wq text; roles_txt text; per text;
begin
  for r in
    select schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ilike '%p.proyecto_num%'
        or coalesce(with_check, '') ilike '%p.proyecto_num%')
  loop
    q := replace(coalesce(r.qual, 'true'), 'p.proyecto_num', 'p.id');
    wq := replace(coalesce(r.with_check, ''), 'p.proyecto_num', 'p.id');
    roles_txt := (select string_agg(format('%I', role), ', ') from unnest(r.roles) role);
    per := 'AS ' || coalesce(r.permissive, 'PERMISSIVE');
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
    if r.cmd = 'INSERT' then
      execute format(
        'create policy %I on %I.%I %s for INSERT to %s with check (%s)',
        r.policyname, r.schemaname, r.tablename, per, roles_txt, wq
      );
    elsif r.cmd = 'SELECT' then
      execute format(
        'create policy %I on %I.%I %s for SELECT to %s using (%s)',
        r.policyname, r.schemaname, r.tablename, per, roles_txt, q
      );
    else
      execute format(
        'create policy %I on %I.%I %s for %s to %s using (%s) with check (%s)',
        r.policyname, r.schemaname, r.tablename, per, r.cmd, roles_txt, q, wq
      );
    end if;
  end loop;
end $$;


-- ── 5) proyecto_num → legacy_num (guardado) ─────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cf_proyectos'
      and column_name = 'proyecto_num'
  ) then
    alter table public.cf_proyectos rename column proyecto_num to legacy_num;
    alter table public.cf_proyectos alter column legacy_num drop default;
  end if;
end $$;

-- Limpieza de los respaldos internos de la migración.
drop table if exists public._cf_uuid_mig_trg_backup;
drop table if exists public._cf_uuid_mig_pol_backup;

notify pgrst, 'reload schema';
