-- Companion del 20261116000000 (drop de la columna n_salidas): el CUERPO VIVO de
-- save_plano_data_impl seguía INSERTándola → «column "n_salidas" of relation
-- "cf_planos_ramales" does not exist» en cada guardado. Cirugía sobre el cuerpo (lección
-- R-1: NUNCA re-emitir el cuerpo desde una copia — los parches previos label_moved,
-- show_*_flags, altura_m/es_rect_fuego, empresa_escritura... sobreviven intactos): quita
-- la columna de la lista del INSERT de ramales y su r.n_salidas del SELECT.
-- get_plano_data NO se toca: lee con to_jsonb(r) sin nombres de columna (inmune).
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable. Aplicar DESPUÉS del 20261116000000.

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
  if strpos(v_src, 'n_salidas') = 0 then
    return;
  end if;
  v_new := v_src;

  -- 1) INSERT de ramales: la columna fuera de la lista (sin ')' — la lista sigue hasta
  --    gas_accesorios).
  v_new := replace(v_new,
    'aparato_fin, n_salidas, diam_pulg',
    'aparato_fin, diam_pulg');

  -- 2) SELECT del populate_recordset: r.n_salidas fuera.
  v_new := replace(v_new,
    'r.aparato_fin, r.n_salidas, r.diam_pulg',
    'r.aparato_fin, r.diam_pulg');

  -- Verificación dura: cero n_salidas en el cuerpo; si sobró una mención el cuerpo divergió
  -- → abortar sin pisar (nunca dejar un cuerpo a medio parchear).
  if v_new = v_src or strpos(v_new, 'n_salidas') > 0 then
    raise exception 'drop_n_salidas_rpc: cuerpo divergió';
  end if;
  execute format(
    'create or replace function public.save_plano_data_impl(p_plano_id bigint, p_data jsonb) returns void language plpgsql security definer set search_path = public as $body$%s$body$',
    v_new);
end $do$;
