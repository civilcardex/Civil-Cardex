-- Persistencia de los flags de la ronda RCI (ped. usuario: auditoría de guardado):
--   cf_planos_lineas_guia.es_muro      — muros de la herramienta Muro / guías marcadas (RCI)
--   cf_planos_areas.es_rect_fuego      — rectángulo de fuego DEFINIDO en el dibujo (RCI)
-- Ambos se perdían en el tramo BD: el mapper no los mandaba y la tabla no tenía columna
-- (jsonb_populate_recordset descarta claves sin columna). Sin ellos, al recargar con caché
-- fría los muros volvían grises y el rectángulo dejaba de alimentar la sub Rociadores.
--
-- inyecta es_muro/es_rect_fuego en el INSERT de lineas_guia y areas del CUERPO VIVO del
-- _impl (cirugía — lección R-1: NUNCA re-emitir el cuerpo desde una copia, se divergen;
-- los guards empresa_escritura y los parches previos altura_m/asoc_links/alt_deriv
-- sobreviven intactos). El wrapper no se toca (recrearlo rompería el candado acceso_modulo).
-- Idempotente: si el cuerpo vivo ya trae los flags, el DO no hace nada. Si algún patrón no
-- calza (cuerpo divergió), ABORTA en vez de pisar o dejar un cuerpo a medio parchear.
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable.

alter table public.cf_planos_lineas_guia
  add column if not exists es_muro boolean not null default false;
alter table public.cf_planos_areas
  add column if not exists es_rect_fuego boolean not null default false;

-- ═══ Cirugía sobre el cuerpo VIVO de save_plano_data_impl ══════════════════════════════
-- Cuatro fragmentos: lista de columnas + SELECT de lineas_guia y de areas (el ancla del
-- SELECT es el FROM de su tabla — único por colección en el cuerpo).
do $do$
declare
  v_src text;
  v_new text;
begin
  select prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'save_plano_data_impl'
      and pg_get_function_identity_arguments(p.oid) = 'p_plano_id bigint, p_data jsonb';
  if v_src is null then
    raise exception 'save_plano_data_impl_no_encontrado';
  end if;
  -- Ya parcheado (re-ejecución): salir sin error.
  if strpos(v_src, 'client_id, net, pts, es_muro)') > 0
     and strpos(v_src, 'r.altura_m, coalesce(r.es_rect_fuego, false)') > 0 then
    return;
  end if;
  v_new := v_src;

  -- 1) INSERT de lineas_guia: es_muro al final de la lista de columnas.
  if strpos(v_new, 'client_id, net, pts, es_muro)') = 0 then
    v_new := replace(v_new,
      'plano_id, user_id, client_id, net, pts)',
      'plano_id, user_id, client_id, net, pts, es_muro)');
  end if;

  -- 2) SELECT de lineas_guia (ancla: el FROM de la tabla).
  if strpos(v_new, 'coalesce(r.pts, ''[]''::jsonb), r.es_muro') = 0 then
    v_new := replace(v_new,
      'coalesce(r.pts, ''[]''::jsonb)
  from jsonb_populate_recordset(null::public.cf_planos_lineas_guia',
      'coalesce(r.pts, ''[]''::jsonb), coalesce(r.es_muro, false)
  from jsonb_populate_recordset(null::public.cf_planos_lineas_guia');
  end if;

  -- 3) INSERT de areas: es_rect_fuego al final (tras altura_m, parche 20261005000001).
  if strpos(v_new, 'area_m2, net, altura_m, es_rect_fuego)') = 0 then
    v_new := replace(v_new,
      'area_m2, net, altura_m)',
      'area_m2, net, altura_m, es_rect_fuego)');
  end if;

  -- 4) SELECT de areas (ancla: el FROM de la tabla).
  if strpos(v_new, 'r.altura_m, r.es_rect_fuego') = 0 then
    v_new := replace(v_new,
      'r.area_m2, r.net, r.altura_m
  from jsonb_populate_recordset(null::public.cf_planos_areas',
      'r.area_m2, r.net, r.altura_m, coalesce(r.es_rect_fuego, false)
  from jsonb_populate_recordset(null::public.cf_planos_areas');
  end if;

  -- Verificación dura: los 4 fragmentos deben haber calzado; si el cuerpo divergió, abortar
  -- sin pisar (nunca dejar un cuerpo a medio parchear).
  if v_new = v_src
     or strpos(v_new, 'client_id, net, pts, es_muro)') = 0
     or strpos(v_new, 'coalesce(r.pts, ''[]''::jsonb), coalesce(r.es_muro, false)') = 0
     or strpos(v_new, 'area_m2, net, altura_m, es_rect_fuego)') = 0
     or strpos(v_new, 'r.altura_m, coalesce(r.es_rect_fuego, false)') = 0 then
    raise exception 'es_muro_es_rect_fuego: cuerpo divergió';
  end if;
  execute format(
    'create or replace function public.save_plano_data_impl(p_plano_id bigint, p_data jsonb) returns void language plpgsql security definer set search_path = public as $body$%s$body$',
    v_new);
end $do$;
