-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261005000000 — COMPARTIR PROYECTOS con miembros de suscripción empresarial
--
-- Lectura: policies SELECT de las tablas de negocio += empresa_lectura(owner, modulo).
-- Escritura CF: cirugía sobre los CUERPOS VIVOS de los *_impl (lección R-1 de este repo:
-- NUNCA copiar cuerpos desde migraciones viejas — se divergen). Los guards
--   `p.user_id = uid`  →  `(p.user_id = uid or empresa_escritura(p.user_id,'flow'))`
--   `pl.user_id <> uid` →  `(pl.user_id <> uid and not empresa_escritura(pl.user_id,'flow'))`
-- y el sellado de INSERTs de miembros lo hace un TRIGGER (new.user_id → owner del proyecto),
-- así el cuerpo vivo no se re-emite a mano y no hay riesgo de perder columnas nuevas.
-- Re-ejecución IDEMPOTENTE (I-12): el patrón pl.user_id (prefijo de su propio reemplazo) se
-- salta si el cuerpo ya trae empresa_escritura; la verificación de guards es per-patrón
-- (aborta solo si un guard crudo presente no produjo su contraparte, no si ya está operado).
-- Escritura CM: policies RLS (CM escribe directo) + el cliente sella user_id = dueño del
-- proyecto activo.
-- NO cambia el ciclo de vida: save_proyecto / update_proyecto_nombre / delete_proyecto y
-- las policies de cm_proyectos siguen owner-only (los miembros editan CONTENIDO).
--
-- Requiere 20261004000000 (empresa_lectura/empresa_escritura). Sigue deshabilitado por flags.
-- ⚠️ APLICAR EN SQL EDITOR DESPUÉS DE 20261004000000. Re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) Cirugía de guards en los cuerpos VIVOS (impls + save_proyecto_general_campo) ════
do $do$
declare
  f record;
  v_src text;
  v_new text;
begin
  for f in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'save_plano_data_impl','save_proyecto_core_impl','save_redes_activas_impl',
        'save_gas_datos_impl','save_ep_datos_impl','save_bomba_datos_impl',
        'save_planos_meta_impl','save_rainwater_overrides_impl','delete_plano_meta_impl',
        'save_proyecto_general_campo'
      )
  loop
    select prosrc into v_src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f.proname
        and pg_get_function_identity_arguments(p.oid) = f.args;

    v_new := replace(v_src,
      'p.user_id = uid)',
      -- 3 cierres: función empresa_escritura, grupo nuevo y el exists original consumido.
      '(p.user_id = uid or public.empresa_escritura(p.user_id, ''flow'')))');
    -- Skip-si-ya-operado (I-12): este patrón es PREFIJO de su propio reemplazo (no
    -- idempotente: una re-ejecución lo doble-envolvería). Los otros dos consumen su
    -- ')' / ';' original y no vuelven a matchear. Un cuerpo ya operado es atómico
    -- (este DO es una sola transacción), así que el skip por cuerpo es suficiente.
    if v_src !~ 'empresa_escritura' then
      v_new := replace(v_new,
        'pl.user_id <> uid',
        '(pl.user_id <> uid and not public.empresa_escritura(pl.user_id, ''flow''))');
    end if;
    v_new := replace(v_new,
      'and user_id = uid;',
      'and (user_id = uid or public.empresa_escritura(user_id, ''flow''));');

    -- Verificación dura PER-PATRÓN (I-12): si el cuerpo tenía un guard crudo y el resultado
    -- no trae su contraparte con empresa_escritura, el cuerpo vivo divergió — ABORTAR (hay
    -- que auditar, no pisar a ciegas). Un cuerpo ya operado no matchea los patrones crudos
    -- y pasa sin abortar (idempotencia). En la string SQL el backslash viaja literal al
    -- regex: \. = punto literal, \( = paréntesis literal.
    if (v_src ~ 'pl\.user_id <> uid' and v_new !~ 'not public\.empresa_escritura\(pl\.user_id')
       or (v_src ~ 'p\.user_id = uid\)' and v_new !~ 'public\.empresa_escritura\(p\.user_id')
       or (v_src ~ 'and user_id = uid;' and v_new !~ 'or public\.empresa_escritura\(user_id') then
      raise exception 'guard_sin_reconocer: %', f.proname;
    end if;

    execute format(
      'create or replace function public.%I(%s) returns void language plpgsql security definer set search_path = public as $body$%s$body$',
      f.proname, f.args, v_new);
  end loop;
end $do$;

-- ═══ 2) TRIGGER: los INSERTs/UPDATEs de un miembro quedan a nombre del DUEÑO ════════════
-- Los impls sellan user_id = uid (quien llama). Un miembro editando el proyecto del dueño
-- insertaría filas a SU uuid — invisibles para el dueño. Este trigger re-sella al dueño
-- cuando quien llama es miembro-editor de ese dueño (empresa_escritura).
-- SIN early-return por identidad (C-2): los impls SIEMPRE llegan con user_id = auth.uid()
-- (el propio miembro), así que ese return anulaba el re-sellado por completo. Owner por la
-- clave de la fila; dueño escribiendo su fila → no-op; fail-closed si un no-dueño escribe
-- una fila sin owner resoluble (sello_sin_owner).
create or replace function public.cf_sellar_owner_contenido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_row jsonb := to_jsonb(new);
begin
  if v_row ? 'proyecto_id' then
    select p.user_id into v_owner from public.cf_proyectos p
      where p.id = (v_row->>'proyecto_id')::bigint;
  elsif v_row ? 'plano_id' then
    select p.user_id into v_owner from public.cf_proyectos p
      join public.cf_planos pl on pl.proyecto_id = p.id
      where pl.id = (v_row->>'plano_id')::bigint;
  elsif v_row ? 'bajante_origen_id' then
    select p.user_id into v_owner from public.cf_proyectos p
      join public.cf_planos pl on pl.proyecto_id = p.id
      join public.cf_planos_bajantes b on b.plano_id = pl.id
      where b.id = (v_row->>'bajante_origen_id')::bigint;
  elsif v_row ? 'plano_origen_id' then
    select p.user_id into v_owner from public.cf_proyectos p
      join public.cf_planos pl on pl.proyecto_id = p.id
      where pl.id = (v_row->>'plano_origen_id')::bigint;
  end if;
  -- Dueño escribiendo su fila (v_owner = new.user_id) → no-op. Miembro-editor → re-sellar.
  if v_owner is not null and new.user_id <> v_owner
     and public.empresa_escritura(v_owner, 'flow') then
    new.user_id := v_owner;
  end if;
  -- Fail-closed real: no-dueño sin owner resoluble → bloqueado (auth.uid() null/anon también).
  if v_owner is null and (auth.uid() is null or new.user_id <> auth.uid()) then
    raise exception 'sello_sin_owner';
  end if;
  return new;
end;
$$;
revoke all on function public.cf_sellar_owner_contenido() from public, anon, authenticated;

do $do$
declare t text;
begin
  foreach t in array array[
    'cf_proyecto_general','cf_pisos','cf_materiales_proyecto','cf_profundidades_proyecto',
    'cf_criterios_proyecto','cf_gas_datos_proyecto','cf_ep_datos_proyecto',
    'cf_bomba_datos_proyecto','cf_anulaciones_bajantes_pluviales',
    'cf_anulaciones_canales_pluviales','cf_planos','cf_planos_ramales','cf_planos_bajantes',
    'cf_planos_areas','cf_planos_dimensiones','cf_planos_anotaciones_texto',
    'cf_planos_lineas_guia','cf_planos_fantasmas_entrepisos','cf_bajante_conexiones'
  ] loop
    execute format('drop trigger if exists trg_sellar_owner on public.%I', t);
    execute format('create trigger trg_sellar_owner before insert or update on public.%I for each row execute function public.cf_sellar_owner_contenido()', t);
  end loop;
end $do$;

-- ═══ 3) Lectura compartida: policies SELECT de tablas con user_id (familia cf_/cm_) ═════
-- Excluye cm_config (config personal, nunca compartida). cf_perfiles no tiene user_id →
-- queda fuera sola. Los catálogos globales tampoco tienen user_id → intactos.
do $do$
declare r record; v_mod text;
begin
  for r in
    select pol.schemaname, pol.tablename, pol.policyname, pol.roles
    from pg_policies pol
    where pol.schemaname = 'public'
      and pol.cmd = 'SELECT'
      and (pol.tablename like 'cf\_%' or pol.tablename like 'cm\_%')
      and pol.tablename <> 'cm_config'
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = pol.tablename
          and c.column_name = 'user_id'
      )
  loop
    v_mod := case when r.tablename like 'cm\_%' then 'manage' else 'flow' end;
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    -- Conserva el TO de la policy original (pg_policies.roles): sin esto las re-creadas
    -- quedaban to public y una policy to authenticated perdía su target.
    execute format(
      'create policy %I on public.%I for select%s using ((select auth.uid()) = user_id or public.empresa_lectura(user_id, %L))',
      r.policyname, r.tablename,
      case when r.roles <> '{public}' then ' to ' || array_to_string(r.roles, ', ') else '' end,
      v_mod);
  end loop;
end $do$;

-- ═══ 4) Escritura CM: policies de las 9 tablas hijas (cm_proyectos sigue owner-only) ════
create or replace function public.cm_proyecto_de_propietario(p_proyecto_id uuid, p_owner uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.cm_proyectos p
                 where p.id = p_proyecto_id and p.user_id = p_owner);
$$;

do $do$
declare t text;
begin
  foreach t in array array[
    'cm_factores_prestacionales','cm_cargos','cm_proveedores','cm_cuadrillas',
    'cm_cuadrilla_integrantes','cm_equipos','cm_insumos','cm_apus','cm_presupuestos'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_propietario_insertar', t);
    execute format($q$create policy %I on public.%I for insert with check (
        ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id))
        or (public.empresa_escritura(user_id, 'manage')
            and public.cm_proyecto_de_propietario(proyecto_id, user_id)))$q$,
      t || '_propietario_insertar', t);

    execute format('drop policy if exists %I on public.%I', t || '_propietario_actualizar', t);
    execute format($q$create policy %I on public.%I for update using (
        (select auth.uid()) = user_id or public.empresa_escritura(user_id, 'manage'))
      with check (
        ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id))
        or (public.empresa_escritura(user_id, 'manage')
            and public.cm_proyecto_de_propietario(proyecto_id, user_id)))$q$,
      t || '_propietario_actualizar', t);

    execute format('drop policy if exists %I on public.%I', t || '_propietario_eliminar', t);
    execute format($q$create policy %I on public.%I for delete using (
        (select auth.uid()) = user_id or public.empresa_escritura(user_id, 'manage'))$q$,
      t || '_propietario_eliminar', t);
  end loop;
end $do$;

-- ═══ 5) PDFs del bucket plan_pdfs: el miembro lee (y sube) los del dueño ════════════════
create or replace function public.uuid_seguro(t text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

drop policy if exists pdfs_empresa_leer on storage.objects;
create policy pdfs_empresa_leer on storage.objects for select to authenticated
  using (bucket_id = 'plan_pdfs'
         and public.empresa_lectura(public.uuid_seguro((storage.foldername(name))[1]), 'flow'));

drop policy if exists pdfs_empresa_escribir on storage.objects;
create policy pdfs_empresa_escribir on storage.objects for insert to authenticated
  with check (bucket_id = 'plan_pdfs'
         and public.empresa_escritura(public.uuid_seguro((storage.foldername(name))[1]), 'flow'));

drop policy if exists pdfs_empresa_actualizar on storage.objects;
create policy pdfs_empresa_actualizar on storage.objects for update to authenticated
  using (bucket_id = 'plan_pdfs'
         and public.empresa_escritura(public.uuid_seguro((storage.foldername(name))[1]), 'flow'))
  with check (bucket_id = 'plan_pdfs'
         and public.empresa_escritura(public.uuid_seguro((storage.foldername(name))[1]), 'flow'));

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- 1) guards cirugía: select prosrc like '%empresa_escritura%' from pg_proc
--     where proname in ('save_plano_data_impl','save_proyecto_core_impl', ...);  -- todo true
-- 2) triggers: select tgrelid::regclass from pg_trigger where tgname='trg_sellar_owner';
-- 3) lectura: select policyname from pg_policies where cmd='SELECT'
--     and qual like '%empresa_lectura%';                            -- ~30 filas
-- 4) cm: select policyname from pg_policies where tablename like 'cm\_%' escape '\'
--     and qual like '%empresa_escritura%';
-- 5) storage: select policyname from pg_policies where schemaname='storage'
--     and policyname like 'pdfs_empresa%';                                      -- 3 filas
