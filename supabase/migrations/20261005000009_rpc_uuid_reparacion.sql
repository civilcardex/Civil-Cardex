-- FASE 1-R — Reparación de la conversión uuid en RPCs (la corrida por sentencias del
-- 000007 dejó funciones sin convertir: 404 en save_* y `uuid = bigint` en save_plano_data).
-- Idempotente: salta lo ya convertido. Al final deja un SELECT de verificación visible.
-- ⚠️ APLICAR EN SQL EDITOR. El resultado del SELECT final es el comprobante.

do $$
declare
  r record;
  firma_vieja text;
  nueva text;
  n int := 0;
begin
  -- ── Firmas de PROYECTO: bigint → uuid ─────────────────────────────────────────
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
    n := n + 1;
  end loop;

  -- ── save_plano_data(+impl): cast del proyecto del header bigint → uuid ─────────
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('save_plano_data', 'save_plano_data_impl')
      and p.prosrc ilike '%header,proyecto_id%'')::bigint%'
  loop
    nueva := replace(r.def, '{header,proyecto_id}'')::bigint', '{header,proyecto_id}'')::uuid');
    nueva := replace(nueva, 'p.proyecto_num = proy_id', 'p.id = proy_id');
    if nueva <> r.def then
      execute nueva;
      n := n + 1;
    end if;
  end loop;

  raise notice 'funciones reparadas: %', n;
end $$;

-- Grants por firma uuid (las funciones nuevas nacen sin grants).
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
              and p.prosrc ilike '%proyecto_id%'')::bigint%'
           then '⚠ REVISAR (cast del header sigue bigint)'
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
