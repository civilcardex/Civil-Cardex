-- =========================================================================
-- CivilFlow — recrear RPCs de escritura tras el rename cf_*
--
-- La migración 20260814000002_cf_prefix.sql renombró las tablas a cf_* pero
-- NO recreó los RPCs SECURITY DEFINER de escritura (save_*, etc.). Sus bodies
-- seguían referenciando public.proyectos / public.planos / ... → al renombrar
-- quedaron rotos (relation does not exist) → el cliente no podía guardar y los
-- modales de "nuevo proyecto" abortaban la redirección.
--
-- Aquí se recrean los 14 RPCs con los nombres cf_* y se re-emiten los grants.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- save_plano_data
-- ---------------------------------------------------------------------------
create or replace function public.save_plano_data(p_plano_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  proy_id bigint;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_data is null then raise exception 'payload_requerido'; end if;
  proy_id := (p_data #>> '{header,proyecto_id}')::bigint;
  if proy_id is null then raise exception 'proyecto_requerido'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = proy_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  if exists (select 1 from public.cf_planos pl where pl.id = p_plano_id and pl.user_id <> uid) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_data->'ramales','[]'::jsonb)) > 6000 then raise exception 'demasiados_ramales'; end if;
  if jsonb_array_length(coalesce(p_data->'bajantes','[]'::jsonb)) > 3000 then raise exception 'demasiados_bajantes'; end if;
  if jsonb_array_length(coalesce(p_data->'areas','[]'::jsonb)) > 2000 then raise exception 'demasiadas_areas'; end if;
  if jsonb_array_length(coalesce(p_data->'dimensiones','[]'::jsonb)) > 2000 then raise exception 'demasiadas_dimensiones'; end if;
  if jsonb_array_length(coalesce(p_data->'anotaciones_texto','[]'::jsonb)) > 2000 then raise exception 'demasiadas_anotaciones'; end if;
  if jsonb_array_length(coalesce(p_data->'lineas_guia','[]'::jsonb)) > 2000 then raise exception 'demasiadas_lineas_guia'; end if;
  if jsonb_array_length(coalesce(p_data->'fantasmas_entrepisos','[]'::jsonb)) > 3000 then raise exception 'demasiados_ghosts'; end if;

  insert into public.cf_planos (id, proyecto_id, user_id, version, scale_m, defined_scale_m, active_net, zoom, off_x, off_y, ts, updated_at)
  values (p_plano_id, proy_id, uid,
    coalesce((p_data #>> '{header,v}')::int, 6),
    coalesce((p_data #>> '{header,scaleM}')::numeric, 0.5),
    coalesce((p_data #>> '{header,definedScaleM}')::numeric, 0),
    nullif(p_data #>> '{header,activeNet}', ''),
    coalesce((p_data #>> '{header,zoom}')::numeric, 1),
    coalesce((p_data #>> '{header,offX}')::numeric, 0),
    coalesce((p_data #>> '{header,offY}')::numeric, 0),
    coalesce(nullif(p_data #>> '{header,ts}', '')::timestamptz, now()), now())
  on conflict (id) do update set
    version = excluded.version, scale_m = excluded.scale_m,
    defined_scale_m = excluded.defined_scale_m, active_net = excluded.active_net,
    zoom = excluded.zoom, off_x = excluded.off_x, off_y = excluded.off_y,
    ts = excluded.ts, updated_at = now();

  delete from public.cf_planos_ramales where plano_id = p_plano_id;
  insert into public.cf_planos_ramales (plano_id, user_id, client_id, net, tipo, padre, pts, total_l, label, ini, fin, piso, dz, uc, label_x, label_y, label_angle, material, diametro, pendiente, bloqueado, accesorio_inicio, accesorio_fin, diametro_inicio, diametro_fin, aparato_inicio, aparato_fin, n_salidas, diam_pulg, trib_reversed, acc_med, caudal, lvert, merges_from, sifon_label_ini, sifon_label_fin, fixtures, hydro_accesorios, gas_accesorios)
  select p_plano_id, uid, r.client_id, r.net, r.tipo, r.padre, coalesce(r.pts, '[]'::jsonb), r.total_l, r.label, r.ini, r.fin, r.piso, r.dz, r.uc, r.label_x, r.label_y, r.label_angle, r.material, r.diametro, r.pendiente, coalesce(r.bloqueado, false), r.accesorio_inicio, r.accesorio_fin, r.diametro_inicio, r.diametro_fin, r.aparato_inicio, r.aparato_fin, r.n_salidas, r.diam_pulg, r.trib_reversed, r.acc_med, r.caudal, r.lvert, r.merges_from, r.sifon_label_ini, r.sifon_label_fin, coalesce(r.fixtures, '{}'::jsonb), coalesce(r.hydro_accesorios, '{}'::jsonb), coalesce(r.gas_accesorios, '{}'::jsonb)
  from jsonb_populate_recordset(null::public.cf_planos_ramales, coalesce(p_data->'ramales','[]'::jsonb)) r;

  create temp table _baj_map on commit drop as
  with ins as (
    insert into public.cf_planos_bajantes (plano_id, user_id, client_id, net, tipo, code, x, y, piso_base, piso_cima, npt_base, npt_cima, h_vert, d_nominal, uc_acum, uc_extra, area_m2, desplazamientos, lbl_off_x, lbl_off_y, label_angle, label_x, label_y, direccion, aparato, total_l, pendiente, piso, baj_r, ghost_data, is_fantasma, diam_pulg, diametro, aco_diam, capacidad, base, altura, canal_id, descarga_en_id, origen_id)
    select p_plano_id, uid, r.client_id, r.net, r.tipo, r.code, coalesce(r.x, 0), coalesce(r.y, 0), r.piso_base, r.piso_cima, r.npt_base, r.npt_cima, r.h_vert, r.d_nominal, r.uc_acum, r.uc_extra, r.area_m2, coalesce(r.desplazamientos, '{}'::jsonb), r.lbl_off_x, r.lbl_off_y, r.label_angle, r.label_x, r.label_y, r.direccion, r.aparato, r.total_l, r.pendiente, r.piso, r.baj_r, r.ghost_data, coalesce(r.is_fantasma, false), r.diam_pulg, r.diametro, r.aco_diam, r.capacidad, r.base, r.altura, r.canal_id, r.descarga_en_id, r.origen_id
    from jsonb_populate_recordset(null::public.cf_planos_bajantes, coalesce(p_data->'bajantes','[]'::jsonb)) r
    on conflict (plano_id, client_id) do update set
      net = excluded.net, tipo = excluded.tipo, code = excluded.code, x = excluded.x, y = excluded.y, piso_base = excluded.piso_base, piso_cima = excluded.piso_cima, npt_base = excluded.npt_base, npt_cima = excluded.npt_cima, h_vert = excluded.h_vert, d_nominal = excluded.d_nominal, uc_acum = excluded.uc_acum, uc_extra = excluded.uc_extra, area_m2 = excluded.area_m2, desplazamientos = excluded.desplazamientos, lbl_off_x = excluded.lbl_off_x, lbl_off_y = excluded.lbl_off_y, label_angle = excluded.label_angle, label_x = excluded.label_x, label_y = excluded.label_y, direccion = excluded.direccion, aparato = excluded.aparato, total_l = excluded.total_l, pendiente = excluded.pendiente, piso = excluded.piso, baj_r = excluded.baj_r, ghost_data = excluded.ghost_data, is_fantasma = excluded.is_fantasma, diam_pulg = excluded.diam_pulg, diametro = excluded.diametro, aco_diam = excluded.aco_diam, capacidad = excluded.capacidad, base = excluded.base, altura = excluded.altura, canal_id = excluded.canal_id, descarga_en_id = excluded.descarga_en_id, origen_id = excluded.origen_id, updated_at = now()
    returning id, client_id)
  select client_id, id from ins;

  delete from public.cf_planos_bajantes where plano_id = p_plano_id and client_id not in (select client_id from _baj_map);

  delete from public.cf_planos_areas where plano_id = p_plano_id;
  insert into public.cf_planos_areas (plano_id, user_id, client_id, pts, color, label, label_x, label_y, label_angle, area_m2, net)
  select p_plano_id, uid, r.client_id, coalesce(r.pts, '[]'::jsonb), r.color, r.label, r.label_x, r.label_y, r.label_angle, r.area_m2, r.net
  from jsonb_populate_recordset(null::public.cf_planos_areas, coalesce(p_data->'areas','[]'::jsonb)) r;

  delete from public.cf_planos_dimensiones where plano_id = p_plano_id;
  insert into public.cf_planos_dimensiones (plano_id, user_id, client_id, x1, y1, x2, y2, l, lbl_x, lbl_y)
  select p_plano_id, uid, r.client_id, coalesce(r.x1, 0), coalesce(r.y1, 0), coalesce(r.x2, 0), coalesce(r.y2, 0), r.l, r.lbl_x, r.lbl_y
  from jsonb_populate_recordset(null::public.cf_planos_dimensiones, coalesce(p_data->'dimensiones','[]'::jsonb)) r;

  delete from public.cf_planos_anotaciones_texto where plano_id = p_plano_id;
  insert into public.cf_planos_anotaciones_texto (plano_id, user_id, client_id, x, y, text, font_mm, box_w, lbl_off_x, lbl_off_y, text_angle)
  select p_plano_id, uid, r.client_id, coalesce(r.x, 0), coalesce(r.y, 0), r.text, r.font_mm, r.box_w, r.lbl_off_x, r.lbl_off_y, r.text_angle
  from jsonb_populate_recordset(null::public.cf_planos_anotaciones_texto, coalesce(p_data->'anotaciones_texto','[]'::jsonb)) r;

  delete from public.cf_planos_lineas_guia where plano_id = p_plano_id;
  insert into public.cf_planos_lineas_guia (plano_id, user_id, client_id, net, pts)
  select p_plano_id, uid, r.client_id, r.net, coalesce(r.pts, '[]'::jsonb)
  from jsonb_populate_recordset(null::public.cf_planos_lineas_guia, coalesce(p_data->'lineas_guia','[]'::jsonb)) r;

  delete from public.cf_planos_fantasmas_entrepisos where plano_id = p_plano_id;
  insert into public.cf_planos_fantasmas_entrepisos (plano_id, user_id, id_cliente, red, codigo, x, y, d_nominal, direccion, direccion_padre, piso, plano_origen_id, bajante_origen_id, bajante_destino_id)
  select p_plano_id, uid, r.id_cliente, r.red, r.codigo, coalesce(r.x, 0), coalesce(r.y, 0), r.d_nominal, r.direccion, r.direccion_padre, r.piso, r.plano_origen_id, r.bajante_origen_id, r.bajante_destino_id
  from jsonb_populate_recordset(null::public.cf_planos_fantasmas_entrepisos, coalesce(p_data->'fantasmas_entrepisos','[]'::jsonb)) r;

  delete from public.cf_bajante_conexiones bc
  where exists (select 1 from public.cf_planos_bajantes pb where pb.id = bc.bajante_origen_id and pb.plano_id = p_plano_id)
     or exists (select 1 from public.cf_planos_bajantes pb where pb.id = bc.bajante_destino_id and pb.plano_id = p_plano_id);

  insert into public.cf_bajante_conexiones (user_id, bajante_origen_id, bajante_destino_id, tipo)
  select uid, m1.id, m2.id, x.tipo
  from jsonb_array_elements(coalesce(p_data->'bajantes','[]'::jsonb)) as b
  join _baj_map m1 on m1.client_id = b->>'client_id'
  cross join lateral (
    select 'recibe'::text as tipo, r.value as destino from jsonb_array_elements_text(coalesce(b->'recibe_de_ids','[]'::jsonb)) r
    union all
    select 'alimenta'::text, r.value from jsonb_array_elements_text(coalesce(b->'alimenta_ids','[]'::jsonb)) r
    union all
    select 'descarga'::text, b->>'descarga_en_id' where b->>'descarga_en_id' is not null
  ) x
  join _baj_map m2 on m2.client_id = x.destino;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_proyecto_core
-- ---------------------------------------------------------------------------
create or replace function public.save_proyecto_core(p_proyecto_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_data->'pisos','[]'::jsonb)) > 100 then raise exception 'demasiados_pisos'; end if;
  if (select coalesce(sum(jsonb_array_length(v.value)), 0) from jsonb_each(coalesce(p_data->'mats','{}'::jsonb)) v) > 1000 then raise exception 'demasiados_materiales'; end if;
  if jsonb_array_length(coalesce(p_data->'profs','[]'::jsonb)) > 500 then raise exception 'demasiadas_profundidades'; end if;
  if jsonb_array_length(coalesce(p_data->'crits','[]'::jsonb)) > 500 then raise exception 'demasiados_criterios'; end if;

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

-- ---------------------------------------------------------------------------
-- save_redes_activas
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- save_gas_datos / save_ep_datos / save_bomba_datos
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- save_planos_meta
-- ---------------------------------------------------------------------------
create or replace function public.save_planos_meta(p_proyecto_id bigint, p_planos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_planos,'[]'::jsonb)) > 500 then raise exception 'demasiados_planos'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_planos,'[]'::jsonb)) x join public.cf_planos pl on pl.id = (x->>'id')::bigint where pl.user_id <> uid) then
    raise exception 'no_autorizado';
  end if;
  if p_planos is null or jsonb_array_length(p_planos) = 0 then
    delete from public.cf_planos where proyecto_id = p_proyecto_id;
  else
    delete from public.cf_planos pl where pl.proyecto_id = p_proyecto_id and pl.id not in (select (x->>'id')::bigint from jsonb_array_elements(p_planos) x);
  end if;
  insert into public.cf_planos (id, proyecto_id, user_id, name, nivel, scale, status, origen_x_px, origen_y_px, factor_x, factor_y, cal_global, defined_scale, updated_at)
  select r.id, p_proyecto_id, uid, coalesce(r.name, ''), r.nivel, r.scale, coalesce(r.status, 'pending'), r.origen_x_px, r.origen_y_px, r.factor_x, r.factor_y, r.cal_global, r.defined_scale, now()
  from jsonb_populate_recordset(null::public.cf_planos, coalesce(p_planos,'[]'::jsonb)) r
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id, name = excluded.name, nivel = excluded.nivel, scale = excluded.scale, status = excluded.status, origen_x_px = excluded.origen_x_px, origen_y_px = excluded.origen_y_px, factor_x = excluded.factor_x, factor_y = excluded.factor_y, cal_global = excluded.cal_global, defined_scale = excluded.defined_scale, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- save_rainwater_overrides
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- save_aparatos_usuario
-- ---------------------------------------------------------------------------
create or replace function public.save_aparatos_usuario(p_aps jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if jsonb_array_length(coalesce(p_aps,'[]'::jsonb)) > 1000 then raise exception 'demasiados_aparatos'; end if;
  delete from public.cf_aparatos_usuario where user_id = uid;
  insert into public.cf_aparatos_usuario (user_id, client_id, s, n, g, ucaf, ucac, ud, pmin, pmax, qg, ctrl, blk_ud)
  select uid, r.client_id, r.s, r.n, r.g, r.ucaf, r.ucac, r.ud, r.pmin, r.pmax, r.qg, r.ctrl, coalesce(r.blk_ud, false)
  from jsonb_populate_recordset(null::public.cf_aparatos_usuario, coalesce(p_aps,'[]'::jsonb)) r;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_net_colors
-- ---------------------------------------------------------------------------
create or replace function public.save_net_colors(p_colors jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_colors is null then raise exception 'payload_requerido'; end if;
  insert into public.cf_perfiles (id, net_colors, updated_at)
  values (uid, p_colors, now())
  on conflict (id) do update set net_colors = excluded.net_colors, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- save_perfil
-- ---------------------------------------------------------------------------
create or replace function public.save_perfil(p_perfil jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  insert into public.cf_perfiles (id, nombre, apellido, email, profesion, matricula, telefono, updated_at)
  select uid, r.nombre, r.apellido, r.email, r.profesion, r.matricula, r.telefono, now()
  from jsonb_populate_recordset(null::public.cf_perfiles, jsonb_build_array(coalesce(p_perfil,'{}'::jsonb))) r
  on conflict (id) do update set
    nombre = excluded.nombre, apellido = excluded.apellido, email = excluded.email, profesion = excluded.profesion, matricula = excluded.matricula, telefono = excluded.telefono, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- save_proyecto / update_proyecto_nombre / delete_proyecto
-- ---------------------------------------------------------------------------
create or replace function public.save_proyecto(p_codigo text, p_nombre text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
  v_proyecto public.cf_proyectos%rowtype;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_codigo is null or btrim(p_codigo) = '' then raise exception 'codigo_requerido'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_codigo) > 50 or char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;
  insert into public.cf_proyectos (user_id, codigo, nombre)
  values (uid, btrim(p_codigo), btrim(p_nombre))
  returning * into v_proyecto;
  return to_jsonb(v_proyecto);
end;
$$;

create or replace function public.update_proyecto_nombre(p_id bigint, p_nombre text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;
  update public.cf_proyectos set nombre = btrim(p_nombre) where id = p_id and user_id = uid;
  if not found then raise exception 'no_autorizado'; end if;
end;
$$;

create or replace function public.delete_proyecto(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  delete from public.cf_proyectos where id = p_id and user_id = uid;
  if not found then raise exception 'no_autorizado'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (solo authenticated)
-- ---------------------------------------------------------------------------
revoke all on function public.save_plano_data(bigint, jsonb) from public, anon;
revoke all on function public.save_proyecto_core(bigint, jsonb) from public, anon;
revoke all on function public.save_redes_activas(bigint, text[]) from public, anon;
revoke all on function public.save_gas_datos(bigint, jsonb) from public, anon;
revoke all on function public.save_ep_datos(bigint, jsonb) from public, anon;
revoke all on function public.save_bomba_datos(bigint, jsonb) from public, anon;
revoke all on function public.save_planos_meta(bigint, jsonb) from public, anon;
revoke all on function public.save_rainwater_overrides(bigint, jsonb, jsonb) from public, anon;
revoke all on function public.save_aparatos_usuario(jsonb) from public, anon;
revoke all on function public.save_net_colors(jsonb) from public, anon;
revoke all on function public.save_perfil(jsonb) from public, anon;
revoke all on function public.save_proyecto(text, text) from public, anon;
revoke all on function public.update_proyecto_nombre(bigint, text) from public, anon;
revoke all on function public.delete_proyecto(bigint) from public, anon;

grant execute on function public.save_plano_data(bigint, jsonb) to authenticated;
grant execute on function public.save_proyecto_core(bigint, jsonb) to authenticated;
grant execute on function public.save_redes_activas(bigint, text[]) to authenticated;
grant execute on function public.save_gas_datos(bigint, jsonb) to authenticated;
grant execute on function public.save_ep_datos(bigint, jsonb) to authenticated;
grant execute on function public.save_bomba_datos(bigint, jsonb) to authenticated;
grant execute on function public.save_planos_meta(bigint, jsonb) to authenticated;
grant execute on function public.save_rainwater_overrides(bigint, jsonb, jsonb) to authenticated;
grant execute on function public.save_aparatos_usuario(jsonb) to authenticated;
grant execute on function public.save_net_colors(jsonb) to authenticated;
grant execute on function public.save_perfil(jsonb) to authenticated;
grant execute on function public.save_proyecto(text, text) to authenticated;
grant execute on function public.update_proyecto_nombre(bigint, text) to authenticated;
grant execute on function public.delete_proyecto(bigint) to authenticated;