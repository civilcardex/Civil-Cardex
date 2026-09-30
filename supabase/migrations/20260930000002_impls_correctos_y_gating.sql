-- RONDA 9 — impls divergentes en BD + gating CRUD faltante + RLS app_config.
--
-- Cierra 4 hallazgos del auditor de BD (aplicar DESPUÉS de 28000001..04 y 29000001):
--   BD-I1: save_ep_datos_impl perdió las 7 columnas de cisterna → guardar EP cae a defaults
--          '' desde el 28-sep (cisterna sin persistencia).
--   BD-I2: save_proyecto_core_impl perdió el guard 'pisos_vacios_no_permitidos' → snapshot
--          parcial con pisos=[] vuelve a poder vaciar cf_pisos (incidente 2026-09-24).
--   BD-C1: 20260930000000_material recreó el WRAPPER save_rainwater_overrides como cuerpo
--          directo (mató el candado acceso_modulo, lección R-1) y dejó el impl sin las
--          columnas nuevas → aquí el impl se recrea CON material_* y el wrapper se restaura.
--   BD-I3: update_proyecto_nombre / delete_proyecto sin candado (vencido podía renombrar y
--          ELIMINAR proyectos propios).
-- Además: RLS en app_config (BD-I5, deny-all intencional).
-- Re-ejecutable (create or replace). ⚠️ APLICAR EN SQL EDITOR.

-- ═══ BD-I1 · save_ep_datos_impl con CISTERNA (cuerpo de 20260925000004) ═══════════════
create or replace function public.save_ep_datos_impl(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_ep_datos_proyecto (proyecto_id, user_id, qac, qasc, hfac, hfacs, hfotros, pred, pmin, pmax, zbomba, ztop, zcis, hfcis, nt, nr, etab, etam, fs, ciclos, alfa, vsuc, vimp, dnsuc, dnimp, pcomercial, modo, dot_l, n_usuarios, dias_aut, bci_l, patm, pv, npshr, updated_at)
  select p_proyecto_id, uid, r.qac, r.qasc, r.hfac, r.hfacs, r.hfotros, r.pred, r.pmin, r.pmax, r.zbomba, r.ztop, r.zcis, r.hfcis, r.nt, r.nr, r.etab, r.etam, r.fs, r.ciclos, r.alfa, r.vsuc, r.vimp, r.dnsuc, r.dnimp, r.pcomercial, r.modo, r.dot_l, r.n_usuarios, r.dias_aut, r.bci_l, r.patm, r.pv, r.npshr, now()
  from jsonb_populate_recordset(null::public.cf_ep_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    qac = excluded.qac, qasc = excluded.qasc, hfac = excluded.hfac, hfacs = excluded.hfacs, hfotros = excluded.hfotros, pred = excluded.pred, pmin = excluded.pmin, pmax = excluded.pmax, zbomba = excluded.zbomba, ztop = excluded.ztop, zcis = excluded.zcis, hfcis = excluded.hfcis, nt = excluded.nt, nr = excluded.nr, etab = excluded.etab, etam = excluded.etam, fs = excluded.fs, ciclos = excluded.ciclos, alfa = excluded.alfa, vsuc = excluded.vsuc, vimp = excluded.vimp, dnsuc = excluded.dnsuc, dnimp = excluded.dnimp, pcomercial = excluded.pcomercial, modo = excluded.modo, dot_l = excluded.dot_l, n_usuarios = excluded.n_usuarios, dias_aut = excluded.dias_aut, bci_l = excluded.bci_l, patm = excluded.patm, pv = excluded.pv, npshr = excluded.npshr, updated_at = now();
end;
$$;

-- ═══ BD-I2 · save_proyecto_core_impl CON guard pisos vacíos (cuerpo de 20260925000000) ═
create or replace function public.save_proyecto_core_impl(p_proyecto_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_data->'pisos','[]'::jsonb)) > 100 then raise exception 'demasiados_pisos'; end if;
  if (select coalesce(sum(jsonb_array_length(v.value)), 0) from jsonb_each(coalesce(p_data->'mats','{}'::jsonb)) v) > 1000 then raise exception 'demasiados_materiales'; end if;
  if jsonb_array_length(coalesce(p_data->'profs','[]'::jsonb)) > 500 then raise exception 'demasiados_profundidades'; end if;
  if jsonb_array_length(coalesce(p_data->'crits','[]'::jsonb)) > 500 then raise exception 'demasiados_criterios'; end if;
  -- Incidente 2026-09-24: snapshot local parcial (nombre/mats presentes, pisos aún sin
  -- restaurar) no puede vaciar cf_pisos de un proyecto que SÍ tiene pisos.
  if jsonb_array_length(coalesce(p_data->'pisos','[]'::jsonb)) = 0
     and exists (select 1 from public.cf_pisos where proyecto_id = p_proyecto_id) then
    raise exception 'pisos_vacios_no_permitidos';
  end if;

  if p_data ? 'proyecto_general' then
    insert into public.cf_proyecto_general (proyecto_id, user_id, nombre, dir, ciudad, pais, uso, empresa, p_red, dot, mat_af, mat_ac, mat_rci, mat_san, mat_ll, mat_ven, mat_gas, altitud, p_atm, pobl_fija, pobl_flot, area_piscina, area_verdes, c_escorrentia, pendiente_san, updated_at)
    select p_proyecto_id, uid, r.nombre, r.dir, r.ciudad, r.pais, r.uso, r.empresa, r.p_red, r.dot, r.mat_af, r.mat_ac, r.mat_rci, r.mat_san, r.mat_ll, r.mat_ven, r.mat_gas, r.altitud, r.p_atm, r.pobl_fija, r.pobl_flot, r.area_piscina, r.area_verdes, r.c_escorrentia, r.pendiente_san, now()
    from jsonb_populate_recordset(null::public.cf_proyecto_general, jsonb_build_array(p_data->'proyecto_general')) r
    on conflict (proyecto_id) do update set
      nombre = excluded.nombre, dir = excluded.dir, ciudad = excluded.ciudad, pais = excluded.pais, uso = excluded.uso, empresa = excluded.empresa, p_red = excluded.p_red, dot = excluded.dot, mat_af = excluded.mat_af, mat_ac = excluded.mat_ac, mat_rci = excluded.mat_rci, mat_san = excluded.mat_san, mat_ll = excluded.mat_ll, mat_ven = excluded.mat_ven, mat_gas = excluded.mat_gas, altitud = excluded.altitud, p_atm = excluded.p_atm, pobl_fija = excluded.pobl_fija, pobl_flot = excluded.pobl_flot, area_piscina = excluded.area_piscina, area_verdes = excluded.area_verdes, c_escorrentia = excluded.c_escorrentia, pendiente_san = excluded.pendiente_san, updated_at = now();
  end if;

  delete from public.cf_pisos where proyecto_id = p_proyecto_id;
  insert into public.cf_pisos (proyecto_id, user_id, n, npt, ok, tipo, h)
  select p_proyecto_id, uid, r.n, r.npt, coalesce(r.ok, false), r.tipo, r.h
  from jsonb_populate_recordset(null::public.cf_pisos, coalesce(p_data->'pisos','[]'::jsonb)) r;

  delete from public.cf_materiales_proyecto where proyecto_id = p_proyecto_id;
  insert into public.cf_materiales_proyecto (proyecto_id, user_id, categoria, client_id, val, orden)
  select p_proyecto_id, uid, m.categoria, it.item->>'id', it.item->>'val', it.orden
  from jsonb_each(coalesce(p_data->'mats','{}'::jsonb)) as m(categoria, items)
  cross join lateral jsonb_array_elements(m.items) with ordinality as it(item, orden);

  delete from public.cf_profundidades_proyecto where proyecto_id = p_proyecto_id;
  insert into public.cf_profundidades_proyecto (proyecto_id, user_id, client_id, red, col, prof, norma, nota, orden)
  select p_proyecto_id, uid, r.client_id, r.red, r.col, r.prof, r.norma, r.nota, coalesce(r.orden, 0)
  from jsonb_populate_recordset(null::public.cf_profundidades_proyecto, coalesce(p_data->'profs','[]'::jsonb)) r;

  delete from public.cf_criterios_proyecto where proyecto_id = p_proyecto_id;
  insert into public.cf_criterios_proyecto (proyecto_id, user_id, client_id, red, param, val, uni, norma, art, cumple, nota, orden)
  select p_proyecto_id, uid, r.client_id, r.red, r.param, r.val, r.uni, r.norma, r.art, r.cumple, r.nota, coalesce(r.orden, 0)
  from jsonb_populate_recordset(null::public.cf_criterios_proyecto, coalesce(p_data->'crits','[]'::jsonb)) r;
end;
$$;

-- ═══ BD-C1 · save_rainwater_overrides_impl CON material_* (cuerpo de 30000000_material) ═
create or replace function public.save_rainwater_overrides_impl(p_proyecto_id bigint, p_bajantes jsonb, p_canales jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_bajantes,'[]'::jsonb)) > 1000 then raise exception 'demasiados_overrides_bajantes'; end if;
  if jsonb_array_length(coalesce(p_canales,'[]'::jsonb)) > 1000 then raise exception 'demasiados_overrides_canales'; end if;
  delete from public.cf_anulaciones_bajantes_pluviales where proyecto_id = p_proyecto_id;
  insert into public.cf_anulaciones_bajantes_pluviales (proyecto_id, user_id, id_cliente, bajante, area_parcial, area_otras, area_acumulada, intensidad, coeficiente_c, material_cubierta, R, manning, diam_propuesto)
  select p_proyecto_id, uid, r.id_cliente, r.bajante, coalesce(r.area_parcial, 0), coalesce(r.area_otras, 0), coalesce(r.area_acumulada, 0), coalesce(r.intensidad, 100), coalesce(r.coeficiente_c, 0.0278), coalesce(r.material_cubierta, ''), coalesce(r.R, ''), coalesce(r.manning, 0), coalesce(r.diam_propuesto, 0)
  from jsonb_populate_recordset(null::public.cf_anulaciones_bajantes_pluviales, coalesce(p_bajantes,'[]'::jsonb)) r;
  delete from public.cf_anulaciones_canales_pluviales where proyecto_id = p_proyecto_id;
  insert into public.cf_anulaciones_canales_pluviales (proyecto_id, user_id, id_cliente, sector, area_parcial, area_otras, area_acumulada, intensidad, coeficiente_c, material_cubierta, material_canal, muro_vertical, borde_libre_cm, manning, pendiente, b, h)
  select p_proyecto_id, uid, r.id_cliente, r.sector, coalesce(r.area_parcial, 0), coalesce(r.area_otras, 0), coalesce(r.area_acumulada, 0), coalesce(r.intensidad, 100), coalesce(r.coeficiente_c, 0.0278), coalesce(r.material_cubierta, ''), coalesce(r.material_canal, ''), coalesce(r.muro_vertical, 0), coalesce(r.borde_libre_cm, 10), coalesce(r.manning, 0.011), coalesce(r.pendiente, 0), coalesce(r.b, 0), coalesce(r.h, 0)
  from jsonb_populate_recordset(null::public.cf_anulaciones_canales_pluviales, coalesce(p_canales,'[]'::jsonb)) r;
end;
$$;

-- El wrapper público VUELVE a ser el delgado con candado: 30000000_material lo pisó con un
-- cuerpo directo (lección R-1). Re-emite revokes del impl.
revoke all on function public.save_ep_datos_impl(bigint, jsonb),
  public.save_proyecto_core_impl(bigint, jsonb),
  public.save_rainwater_overrides_impl(bigint, jsonb, jsonb)
from public, anon, authenticated;
create or replace function public.save_rainwater_overrides(p_proyecto_id bigint, p_bajantes jsonb, p_canales jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_rainwater_overrides_impl(p_proyecto_id, p_bajantes, p_canales);
end;
$$;
revoke all on function public.save_rainwater_overrides(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.save_rainwater_overrides(bigint, jsonb, jsonb) to authenticated;

-- ═══ BD-I3 · gating de USO en CRUD de proyectos (inline, cuerpos de 20260910160000) ════
create or replace function public.update_proyecto_nombre(p_id bigint, p_nombre text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;
  update public.cf_proyectos set nombre = btrim(p_nombre)
  where id = p_id and user_id = uid;
  if not found then raise exception 'no_autorizado'; end if;
end;
$$;

create or replace function public.delete_proyecto(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  delete from public.cf_proyectos where id = p_id and user_id = uid;
  if not found then raise exception 'no_autorizado'; end if;
end;
$$;

-- ═══ BD-I5 · RLS en app_config (deny-all intencional; service_role bypassa) ════════════
alter table public.app_config enable row level security;

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- 1) impls correctos y sin authenticated:
--    select p.proname,
--           prosrc like '%pisos_vacios_no_permitidos%' as guard_pisos,
--           prosrc like '%dot_l%' as cisterna,
--           prosrc like '%material_cubierta%' as mat_cub,
--           proacl::text not like '%authenticated%' as sin_auth
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and proname like '%\_impl';
-- 2) wrapper con candado: prosrc de save_rainwater_overrides contiene 'suscripcion_requerida'.
-- 3) app_config con RLS: select relrowsecurity from pg_class where relname='app_config';
