-- FASE 1-R2 — save_plano_data(+impl): cierre de la conversión uuid del proyecto del header.
--
-- Síntoma (orig. usuario 2026-10-06): `save_plano_data` → 22P02 `invalid input syntax for
-- type bigint: "48292e31-…"`. El uuid NO es el plano (cf_planos.id sigue bigint y el cliente
-- siempre manda Number) — es el PROYECTO nuevo (uuid) viajando en p_data.header.proyecto_id
-- contra el cuerpo vivo `proy_id := (p_data #>> '{header,proyecto_id}')::bigint`.
--
-- Dos huecos que esta migración cierra de una vez (idempotente — corre limpio sobre 00000009
-- aplicada o no aplicada):
--  1. 00000009 convertía el CAST pero dejaba `proy_id bigint;` declarado → tras el cast ::uuid
--     la asignación fallaba con 42846 `cannot cast type uuid to bigint`.
--  2. Si 00000009 no se aplicó (o el loop no matcheó), el cast ::bigint sigue vivo → 22P02.
--
-- Patrón de la casa: leer el cuerpo VIVO (pg_get_functiondef), reemplazos quirúrgicos con
-- verificación dura (abortar sin pisar si el cuerpo divergió), re-emitir con la MISMA firma
-- (los grants sobreviven al create or replace; revoke del impl re-emitido por idempotencia).
-- ⚠️ APLICAR EN SQL EDITOR. El SELECT final es el comprobante.

do $$
declare
  r record;
  v_new text;
begin
  -- ── save_plano_data + save_plano_data_impl: cast del header + declaración proy_id ──
  for r in
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('save_plano_data', 'save_plano_data_impl')
      and pg_get_function_identity_arguments(p.oid) = 'p_plano_id bigint, p_data jsonb'
  loop
    v_new := r.def;
    v_new := replace(v_new, 'proy_id bigint', 'proy_id uuid');
    v_new := replace(v_new, '{header,proyecto_id}'')::bigint', '{header,proyecto_id}'')::uuid');
    v_new := replace(v_new, 'p.proyecto_num = proy_id', 'p.id = proy_id');
    v_new := replace(v_new, 'where proyecto_num = proy_id', 'where id = proy_id');
    if v_new <> r.def then
      -- Verificación dura: nada del legado puede quedar en el cuerpo nuevo.
      if strpos(v_new, 'proy_id bigint') > 0
         or strpos(v_new, '{header,proyecto_id}'')::bigint') > 0
         or strpos(v_new, 'proyecto_num') > 0 then
        raise exception 'save_plano_body_divergio: %', r.proname;
      end if;
      execute v_new;
      raise notice 'reparado: %', r.proname;
    end if;
  end loop;
end $$;

-- ── RPCs de firma PROYECTO que sigan bigint (por si 00000009 no llegó a aplicarse) ──
-- Idempotente: solo matchea firmas con bigint; las ya convertidas se saltan.
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
    nueva := replace(nueva, 'p.proyecto_num = p_proyecto_id', 'p.id = p_proyecto_id');
    nueva := replace(nueva, 'p.proyecto_num = p_id', 'p.id = p_id');
    nueva := replace(nueva, 'where proyecto_num = p_id', 'where id = p_id');
    execute nueva;
    execute format('drop function %s', firma_vieja);
    raise notice 'reparado: %', r.proname;
  end loop;
end $$;

-- ── Grants por firma (los wrappers ejecutables por authenticated; impl revocados) ──
do $$
declare f text;
begin
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

-- ── VERIFICACIÓN (pegá el resultado si algo sigue fallando) ────────────────────────
select p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       case
         when p.proname in ('save_plano_data', 'save_plano_data_impl')
              and (p.prosrc ilike '%proyecto_id%'')::bigint%'
                   or p.prosrc ilike '%proy_id bigint%')
           then '⚠ REVISAR (header/variable sigue bigint)'
         when p.proname not in ('save_plano_data', 'save_plano_data_impl')
              and (p.prosrc ilike '%proyecto_num%' or p.prosrc ilike '%p_proyecto_id bigint%'
                   or p.prosrc ilike '%p_id bigint%')
           then '⚠ REVISAR (quedó numérico)'
         else 'ok'
       end as estado
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'save_proyecto_core', 'save_planos_meta', 'save_redes_activas',
    'save_gas_datos', 'save_ep_datos', 'save_bomba_datos',
    'save_rainwater_overrides', 'get_proyecto_data',
    'save_proyecto_general_campo', 'update_proyecto_nombre', 'delete_proyecto',
    'save_proyecto_core_impl', 'save_planos_meta_impl', 'save_redes_activas_impl',
    'save_gas_datos_impl', 'save_ep_datos_impl', 'save_bomba_datos_impl',
    'save_rainwater_overrides_impl', 'save_plano_data', 'save_plano_data_impl'
  )
order by 1;

notify pgrst, 'reload schema';
