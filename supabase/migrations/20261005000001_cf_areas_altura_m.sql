-- Persistencia de la ALTURA del sector de rejillas (NTC 3631) en BD.
--
-- PlanoArea.alturaM (panel derecho del área con Gas + subred rejillas: "Altura (m)") solo
-- vivía en la caché local de trazos: areaToRow/rowToArea no lo mapeaban y cf_planos_areas
-- no tenía columna — al recargar desde BD (otro dispositivo o caché limpia) el sector
-- volvía con altura indefinida (2,4 m por defecto) y el volumen/requerimiento cambiaban.
--
-- get_plano_proyecto_data usa to_jsonb(fila) → la columna nueva sale sola, sin tocarlo.
-- save_plano_data vive como WRAPPER + _impl desde 20260928000001 (gating de USO): aquí se
-- inyecta altura_m en el INSERT de areas del CUERPO VIVO del _impl (cirugía — lección R-1:
-- NUNCA re-emitir el cuerpo desde una copia, se divergen; además 20261005000000 inyectó
-- guards empresa_escritura en el cuerpo vivo que una re-emisión a mano pisaría). El
-- wrapper no se toca (recrearlo rompería el candado acceso_modulo).
-- Idempotente: si el cuerpo vivo ya trae altura_m, el DO no hace nada. Si algún patrón no
-- calza (cuerpo divergió), ABORTA en vez de pisar o dejar un cuerpo a medio parchear.
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable.

alter table public.cf_planos_areas add column if not exists altura_m numeric;

-- ═══ Cirugía sobre el cuerpo VIVO de save_plano_data_impl ══════════════════════════════
-- Mismos dos fragmentos que la re-emisión original aplicó (lista de columnas del INSERT de
-- areas + su SELECT), inyectados solo si faltan. Los guards de empresa_escritura que el
-- cuerpo vivo traiga (20261005000000) sobreviven intactos.
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

  -- Solo si falta el parche (strpos y no like: el `_` de altura_m no debe actuar de
  -- wildcard en la detección).
  if strpos(v_src, 'altura_m') = 0 then
    v_new := replace(v_src,
      'area_m2, net)',              -- lista de columnas del INSERT de areas
      'area_m2, net, altura_m)');
    v_new := replace(v_new,
      'r.area_m2, r.net',           -- SELECT del insert de areas (termina en fin de línea)
      'r.area_m2, r.net, r.altura_m');
    -- Verificación dura: AMBOS fragmentos deben haber calzado; si el cuerpo vivo divergió,
    -- abortar sin pisar (nunca dejar un cuerpo a medio parchear).
    if v_new = v_src
       or strpos(v_new, 'area_m2, net, altura_m)') = 0
       or strpos(v_new, 'r.area_m2, r.net, r.altura_m') = 0 then
      raise exception 'areas_sin_altura: cuerpo divergió';
    end if;
    execute format(
      'create or replace function public.save_plano_data_impl(p_plano_id bigint, p_data jsonb) returns void language plpgsql security definer set search_path = public as $body$%s$body$',
      v_new);
  end if;
end $do$;

-- El _impl ya está revocado a public/anon/authenticated (20260928000001) y el
-- create-or-replace de la cirugía conserva grants: se re-emite el revoke por idempotencia.
revoke all on function public.save_plano_data_impl(bigint, jsonb) from public, anon, authenticated;
