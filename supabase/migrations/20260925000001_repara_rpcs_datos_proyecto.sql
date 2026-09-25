-- REPARACIÓN (incidente 2026-09-24, parte 2): 5 RPCs pisados por la re-aplicación del
-- esquema viejo. Fuentes: 20260814000006_cf_write_rpcs.sql. Re-ejecutable.
-- ⚠️ APLICAR EN SQL EDITOR.

create or replace function public.save_redes_activas(p_proyecto_id bigint, p_redes text[])
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_proyecto_general (proyecto_id, user_id, redes_activas, updated_at)
  values (p_proyecto_id, uid, p_redes, now())
  on conflict (proyecto_id) do update set redes_activas = excluded.redes_activas, updated_at = now();
end;
$$;

create or replace function public.save_gas_datos(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_gas_datos_proyecto (proyecto_id, user_id, altitud, presion_atm, temperatura, presion_min, densidad_relativa, updated_at)
  select p_proyecto_id, uid, r.altitud, r.presion_atm, r.temperatura, r.presion_min, r.densidad_relativa, now()
  from jsonb_populate_recordset(null::public.cf_gas_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    altitud = excluded.altitud, presion_atm = excluded.presion_atm, temperatura = excluded.temperatura, presion_min = excluded.presion_min, densidad_relativa = excluded.densidad_relativa, updated_at = now();
end;
$$;

create or replace function public.save_ep_datos(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_ep_datos_proyecto (proyecto_id, user_id, qac, qasc, hfac, hfacs, hfotros, pred, pmin, pmax, zbomba, ztop, zcis, hfcis, nt, nr, etab, etam, fs, ciclos, alfa, vsuc, vimp, dnsuc, dnimp, pcomercial, modo, updated_at)
  select p_proyecto_id, uid, r.qac, r.qasc, r.hfac, r.hfacs, r.hfotros, r.pred, r.pmin, r.pmax, r.zbomba, r.ztop, r.zcis, r.hfcis, r.nt, r.nr, r.etab, r.etam, r.fs, r.ciclos, r.alfa, r.vsuc, r.vimp, r.dnsuc, r.dnimp, r.pcomercial, r.modo, now()
  from jsonb_populate_recordset(null::public.cf_ep_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    qac = excluded.qac, qasc = excluded.qasc, hfac = excluded.hfac, hfacs = excluded.hfacs, hfotros = excluded.hfotros, pred = excluded.pred, pmin = excluded.pmin, pmax = excluded.pmax, zbomba = excluded.zbomba, ztop = excluded.ztop, zcis = excluded.zcis, hfcis = excluded.hfcis, nt = excluded.nt, nr = excluded.nr, etab = excluded.etab, etam = excluded.etam, fs = excluded.fs, ciclos = excluded.ciclos, alfa = excluded.alfa, vsuc = excluded.vsuc, vimp = excluded.vimp, dnsuc = excluded.dnsuc, dnimp = excluded.dnimp, pcomercial = excluded.pcomercial, modo = excluded.modo, updated_at = now();
end;
$$;

create or replace function public.save_bomba_datos(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_bomba_datos_proyecto (proyecto_id, user_id, sal_sim, ud_tot, hz, l_imp, d_imp, c_hw, p_desc, eta_b, f_srv, t_cic, h_min, h_max, b_cam, l_cam, npsh, updated_at)
  select p_proyecto_id, uid, r.sal_sim, r.ud_tot, r.hz, r.l_imp, r.d_imp, r.c_hw, r.p_desc, r.eta_b, r.f_srv, r.t_cic, r.h_min, r.h_max, r.b_cam, r.l_cam, r.npsh, now()
  from jsonb_populate_recordset(null::public.cf_bomba_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    sal_sim = excluded.sal_sim, ud_tot = excluded.ud_tot, hz = excluded.hz, l_imp = excluded.l_imp, d_imp = excluded.d_imp, c_hw = excluded.c_hw, p_desc = excluded.p_desc, eta_b = excluded.eta_b, f_srv = excluded.f_srv, t_cic = excluded.t_cic, h_min = excluded.h_min, h_max = excluded.h_max, b_cam = excluded.b_cam, l_cam = excluded.l_cam, npsh = excluded.npsh, updated_at = now();
end;
$$;

create or replace function public.save_rainwater_overrides(p_proyecto_id bigint, p_bajantes jsonb, p_canales jsonb)
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
  insert into public.cf_anulaciones_bajantes_pluviales (proyecto_id, user_id, id_cliente, bajante, area_parcial, area_acumulada, intensidad, coeficiente_c, R, manning, diam_propuesto)
  select p_proyecto_id, uid, r.id_cliente, r.bajante, r.area_parcial, r.area_acumulada, r.intensidad, r.coeficiente_c, r.R, r.manning, r.diam_propuesto
  from jsonb_populate_recordset(null::public.cf_anulaciones_bajantes_pluviales, coalesce(p_bajantes,'[]'::jsonb)) r;
  delete from public.cf_anulaciones_canales_pluviales where proyecto_id = p_proyecto_id;
  insert into public.cf_anulaciones_canales_pluviales (proyecto_id, user_id, id_cliente, sector, area_parcial, area_acumulada, intensidad, coeficiente_c, manning, pendiente, b, h)
  select p_proyecto_id, uid, r.id_cliente, r.sector, r.area_parcial, r.area_acumulada, r.intensidad, r.coeficiente_c, r.manning, r.pendiente, r.b, r.h
  from jsonb_populate_recordset(null::public.cf_anulaciones_canales_pluviales, coalesce(p_canales,'[]'::jsonb)) r;
end;
$$;

revoke all on function public.save_redes_activas(bigint, text[]) from public, anon;
grant execute on function public.save_redes_activas(bigint, text[]) to authenticated;
revoke all on function public.save_gas_datos(bigint, jsonb) from public, anon;
grant execute on function public.save_gas_datos(bigint, jsonb) to authenticated;
revoke all on function public.save_ep_datos(bigint, jsonb) from public, anon;
grant execute on function public.save_ep_datos(bigint, jsonb) to authenticated;
revoke all on function public.save_bomba_datos(bigint, jsonb) from public, anon;
grant execute on function public.save_bomba_datos(bigint, jsonb) to authenticated;
revoke all on function public.save_rainwater_overrides(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.save_rainwater_overrides(bigint, jsonb, jsonb) to authenticated;
