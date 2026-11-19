-- Campos V24 del módulo EPC (ped. 2026-11-19): control con variador, entorno (altitud/
-- temperatura), aparato crítico, material del cuarto, P parada máx. del Perfil y la fuente
-- de la importación (marcas azul/ámbar). En UNA columna jsonb `v24` (los campos cambian de
-- forma en fases — el jsonb absorbe sin nuevas migraciones). Aplicar en SQL Editor.
-- Cirugía sobre el CUERPO VIVO de save_ep_datos_impl (lección R-1): añade v24 al INSERT y
-- al UPDATE del upsert. Idempotente; aborta si el cuerpo divergió.

alter table public.cf_ep_datos_proyecto add column if not exists v24 jsonb;

do $do$
declare
  v_src text;
  v_new text;
begin
  -- Firma VIGENTE: p_proyecto_id es UUID (20261005000009 lo convirtió desde bigint).
  -- pg_get_function_identity_arguments SÍ trae nombres ('p_proyecto_id uuid, p_datos jsonb'):
  -- solo omite los defaults. No comparar contra 'uuid, jsonb' (eso es pg_get_functiondef).
  select prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_ep_datos_impl'
      and pg_get_function_identity_arguments(p.oid) = 'p_proyecto_id uuid, p_datos jsonb';
  if v_src is null then
    raise exception 'save_ep_datos_impl_no_encontrado';
  end if;
  -- Ya parcheado (re-ejecución): salir sin error.
  if strpos(v_src, 'v24 = excluded.v24') > 0 then
    return;
  end if;
  v_new := v_src;

  -- 1) INSERT: v24 al final de la lista de columnas y su r.v24 en el SELECT.
  v_new := replace(v_new,
    'pv, npshr, updated_at)',
    'pv, npshr, v24, updated_at)');
  v_new := replace(v_new,
    'r.npshr, now()',
    'r.npshr, r.v24, now()');

  -- 2) UPDATE del upsert: v24 = excluded.v24 al final.
  v_new := replace(v_new,
    'npshr = excluded.npshr, updated_at = now();',
    'npshr = excluded.npshr, v24 = excluded.v24, updated_at = now();');

  -- Verificación dura: los 3 fragmentos deben haber calzado.
  if v_new = v_src
     or strpos(v_new, 'npshr, v24, updated_at)') = 0
     or strpos(v_new, 'r.npshr, r.v24, now()') = 0
     or strpos(v_new, 'v24 = excluded.v24') = 0 then
    raise exception 'ep_v24_fields: cuerpo divergió';
  end if;
  execute format(
    'create or replace function public.save_ep_datos_impl(p_proyecto_id uuid, p_datos jsonb) returns void language plpgsql security definer set search_path = public as $body$%s$body$',
    v_new);
end $do$;
