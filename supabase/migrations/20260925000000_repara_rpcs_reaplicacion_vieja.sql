-- REPARACIÓN (incidente 2026-09-24): el esquema PRE-agosto se re-aplicó encima de la BD y
-- pisó los RPCs con versiones que leen las tablas VIEJAS (public.pisos, public.planos,
-- public.materiales_proyecto, ...) re-creadas y vacías. La data real vive en las tablas cf_*.
-- Este script re-aplica las versiones vigentes (todas re-ejecutables):
--   get_proyecto_data / get_plano_data  ← 20260814000002_cf_prefix.sql
--   save_proyecto_core                  ← 20260814000006_cf_write_rpcs.sql (+ guard pisos vacíos)
--   save_planos_meta / delete_plano_meta← 20260918000000_save_planos_meta_guard.sql
--   save_plano_data                     ← 20260922000000_fix_dimensiones_y1_x2.sql (fix cotas)
-- ⚠️ APLICAR EN SQL EDITOR. Verificación al final del archivo.

-- ═══ 1) get_proyecto_data ═════════════════════════════════════════════════════════════
create or replace function public.get_proyecto_data(p_proyecto_id bigint)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'proyecto_general', (select to_jsonb(pg) - 'proyecto_id' - 'user_id'
      from public.cf_proyecto_general pg where pg.proyecto_id = p_proyecto_id),
    'pisos', coalesce((select jsonb_agg(to_jsonb(p) - 'proyecto_id' - 'user_id' order by p.n)
      from public.cf_pisos p where p.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'materiales', coalesce((select jsonb_object_agg(categoria, items) from (
        select categoria, jsonb_agg(jsonb_build_object('id', client_id, 'val', val) order by orden) as items
        from public.cf_materiales_proyecto where proyecto_id = p_proyecto_id group by categoria) m),
      '{}'::jsonb),
    'profundidades', coalesce((select jsonb_agg(to_jsonb(pr) - 'id' - 'proyecto_id' - 'user_id' order by pr.orden)
      from public.cf_profundidades_proyecto pr where pr.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'criterios', coalesce((select jsonb_agg(to_jsonb(c) - 'id' - 'proyecto_id' - 'user_id' order by c.orden)
      from public.cf_criterios_proyecto c where c.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'planos_meta', coalesce((select jsonb_agg(to_jsonb(pl) - 'proyecto_id' - 'user_id' - 'piso_id' order by pl.id)
      from public.cf_planos pl where pl.proyecto_id = p_proyecto_id), '[]'::jsonb)
  );
$$;

-- ═══ 2) get_plano_data ════════════════════════════════════════════════════════════════
create or replace function public.get_plano_data(p_plano_id bigint)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'plano', to_jsonb(pl) - 'id' - 'proyecto_id' - 'user_id' - 'piso_id',
    'ramales', coalesce((select jsonb_agg(to_jsonb(r) - 'id' - 'plano_id' - 'user_id' order by r.id) from public.cf_planos_ramales r where r.plano_id = p_plano_id), '[]'::jsonb),
    'bajantes', coalesce((select jsonb_agg(to_jsonb(b) - 'id' - 'plano_id' - 'user_id' order by b.id) from public.cf_planos_bajantes b where b.plano_id = p_plano_id), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(to_jsonb(a) - 'id' - 'plano_id' - 'user_id' order by a.id) from public.cf_planos_areas a where a.plano_id = p_plano_id), '[]'::jsonb),
    'dimensiones', coalesce((select jsonb_agg(to_jsonb(d) - 'id' - 'plano_id' - 'user_id' order by d.id) from public.cf_planos_dimensiones d where d.plano_id = p_plano_id), '[]'::jsonb),
    'anotaciones_texto', coalesce((select jsonb_agg(to_jsonb(t) - 'id' - 'plano_id' - 'user_id' order by t.id) from public.cf_planos_anotaciones_texto t where t.plano_id = p_plano_id), '[]'::jsonb),
    'lineas_guia', coalesce((select jsonb_agg(to_jsonb(g) - 'id' - 'plano_id' - 'user_id' order by g.id) from public.cf_planos_lineas_guia g where g.plano_id = p_plano_id), '[]'::jsonb),
    'fantasmas_entrepisos', coalesce((select jsonb_agg(to_jsonb(c) - 'id' - 'plano_id' - 'user_id' order by c.id) from public.cf_planos_fantasmas_entrepisos c where c.plano_id = p_plano_id), '[]'::jsonb),
    'bajante_conexiones', coalesce((select jsonb_agg(jsonb_build_object('origen_client_id', bo.client_id, 'destino_client_id', bd.client_id, 'tipo', bc.tipo) order by bc.id) from public.cf_bajante_conexiones bc join public.cf_planos_bajantes bo on bo.id = bc.bajante_origen_id join public.cf_planos_bajantes bd on bd.id = bc.bajante_destino_id where bo.plano_id = p_plano_id or bd.plano_id = p_plano_id), '[]'::jsonb)
  ) from public.cf_planos pl where pl.id = p_plano_id;
$$;

-- ═══ 3) save_proyecto_core (+ guard: pisos vacíos jamás borran cf_pisos existente) ════
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

-- ═══ 4) save_planos_meta + delete_plano_meta (lista vacía = no-op) ════════════════════
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
  -- Lista vacía = no-op: el autosave del cliente NUNCA debe poder vaciar el proyecto.
  if p_planos is null or jsonb_array_length(p_planos) = 0 then
    return;
  end if;
  delete from public.cf_planos pl where pl.proyecto_id = p_proyecto_id and pl.id not in (select (x->>'id')::bigint from jsonb_array_elements(p_planos) x);
  insert into public.cf_planos (id, proyecto_id, user_id, name, nivel, scale, status, origen_x_px, origen_y_px, factor_x, factor_y, cal_global, defined_scale, updated_at)
  select r.id, p_proyecto_id, uid, coalesce(r.name, ''), r.nivel, r.scale, coalesce(r.status, 'pending'), r.origen_x_px, r.origen_y_px, r.factor_x, r.factor_y, r.cal_global, r.defined_scale, now()
  from jsonb_populate_recordset(null::public.cf_planos, p_planos) r
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id, name = excluded.name, nivel = excluded.nivel, scale = excluded.scale, status = excluded.status, origen_x_px = excluded.origen_x_px, origen_y_px = excluded.origen_y_px, factor_x = excluded.factor_x, factor_y = excluded.factor_y, cal_global = excluded.cal_global, defined_scale = excluded.defined_scale, updated_at = now();
end;
$$;

create or replace function public.delete_plano_meta(p_plano_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  delete from public.cf_planos where id = p_plano_id and user_id = uid;
end;
$$;

-- ═══ 5) save_plano_data (fix cotas y1↔x2 incluido) ═══════════════════════════════════
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

  insert into public.cf_planos (id, proyecto_id, user_id, version, scale_m, defined_scale_m, active_net, zoom, off_x, off_y, line_width, ts, updated_at)
  values (p_plano_id, proy_id, uid,
    coalesce((p_data #>> '{header,v}')::int, 6),
    coalesce((p_data #>> '{header,scaleM}')::numeric, 0.5),
    coalesce((p_data #>> '{header,definedScaleM}')::numeric, 0),
    nullif(p_data #>> '{header,activeNet}', ''),
    coalesce((p_data #>> '{header,zoom}')::numeric, 1),
    coalesce((p_data #>> '{header,offX}')::numeric, 0),
    coalesce((p_data #>> '{header,offY}')::numeric, 0),
    coalesce((p_data #>> '{header,lineWidth}')::numeric, 1),
    coalesce(nullif(p_data #>> '{header,ts}', '')::timestamptz, now()), now())
  on conflict (id) do update set
    version = excluded.version, scale_m = excluded.scale_m,
    defined_scale_m = excluded.defined_scale_m, active_net = excluded.active_net,
    zoom = excluded.zoom, off_x = excluded.off_x, off_y = excluded.off_y,
    line_width = excluded.line_width,
    ts = excluded.ts, updated_at = now();

  delete from public.cf_planos_ramales where plano_id = p_plano_id;
  insert into public.cf_planos_ramales (plano_id, user_id, client_id, net, tipo, padre, pts, total_l, label, ini, fin, piso, dz, uc, label_x, label_y, label_angle, label_moved, material, diametro, pendiente, bloqueado, accesorio_inicio, accesorio_fin, diametro_inicio, diametro_fin, aparato_inicio, aparato_fin, n_salidas, diam_pulg, trib_reversed, acc_med, caudal, lvert, merges_from, sifon_label_ini, sifon_label_fin, fixtures, hydro_accesorios, gas_accesorios, show_length, show_name, show_guide, show_flow_dir, show_mat_diam_pend, yee_doble, copia_piso, sin_acc_med_interior)
  select p_plano_id, uid, r.client_id, r.net, r.tipo, r.padre, coalesce(r.pts, '[]'::jsonb), r.total_l, r.label, r.ini, r.fin, r.piso, r.dz, r.uc, r.label_x, r.label_y, r.label_angle, coalesce(r.label_moved, false), r.material, r.diametro, r.pendiente, coalesce(r.bloqueado, false), r.accesorio_inicio, r.accesorio_fin, r.diametro_inicio, r.diametro_fin, r.aparato_inicio, r.aparato_fin, r.n_salidas, r.diam_pulg, r.trib_reversed, r.acc_med, r.caudal, r.lvert, r.merges_from, r.sifon_label_ini, r.sifon_label_fin, coalesce(r.fixtures, '{}'::jsonb), coalesce(r.hydro_accesorios, '{}'::jsonb), coalesce(r.gas_accesorios, '{}'::jsonb), coalesce(r.show_length, true), coalesce(r.show_name, true), coalesce(r.show_guide, true), coalesce(r.show_flow_dir, true), coalesce(r.show_mat_diam_pend, true), r.yee_doble, coalesce(r.copia_piso, false), coalesce(r.sin_acc_med_interior, false)
  from jsonb_populate_recordset(null::public.cf_planos_ramales, coalesce(p_data->'ramales','[]'::jsonb)) r;

  create temp table _baj_map on commit drop as
  with ins as (
    insert into public.cf_planos_bajantes (plano_id, user_id, client_id, net, tipo, code, x, y, piso_base, piso_cima, npt_base, npt_cima, h_vert, d_nominal, uc_acum, uc_extra, area_m2, desplazamientos, lbl_off_x, lbl_off_y, label_angle, label_x, label_y, label_moved, direccion, aparato, total_l, pendiente, piso, baj_r, ghost_data, is_fantasma, diam_pulg, diametro, aco_diam, capacidad, base, altura, canal_id, descarga_en_id, origen_id, caja_origen_id, bomba_en_id, fixtures, uc_aplicado, uc_aplicado_hidro, factor_sim, longitud, copia_piso, copiado_de_plan, copiado_de_id, bajante_externo_id)
    select p_plano_id, uid, r.client_id, r.net, r.tipo, r.code, coalesce(r.x, 0), coalesce(r.y, 0), r.piso_base, r.piso_cima, r.npt_base, r.npt_cima, r.h_vert, r.d_nominal, r.uc_acum, r.uc_extra, r.area_m2, coalesce(r.desplazamientos, '{}'::jsonb), r.lbl_off_x, r.lbl_off_y, r.label_angle, r.label_x, r.label_y, coalesce(r.label_moved, false), r.direccion, r.aparato, r.total_l, r.pendiente, r.piso, r.baj_r, r.ghost_data, coalesce(r.is_fantasma, false), r.diam_pulg, r.diametro, r.aco_diam, r.capacidad, r.base, r.altura, r.canal_id, r.descarga_en_id, r.origen_id, r.caja_origen_id, r.bomba_en_id, coalesce(r.fixtures, '{}'::jsonb), r.uc_aplicado, r.uc_aplicado_hidro, r.factor_sim, r.longitud, coalesce(r.copia_piso, false), r.copiado_de_plan, r.copiado_de_id, r.bajante_externo_id
    from jsonb_populate_recordset(null::public.cf_planos_bajantes, coalesce(p_data->'bajantes','[]'::jsonb)) r
    on conflict (plano_id, client_id) do update set
      net = excluded.net, tipo = excluded.tipo, code = excluded.code, x = excluded.x, y = excluded.y, piso_base = excluded.piso_base, piso_cima = excluded.piso_cima, npt_base = excluded.npt_base, npt_cima = excluded.npt_cima, h_vert = excluded.h_vert, d_nominal = excluded.d_nominal, uc_acum = excluded.uc_acum, uc_extra = excluded.uc_extra, area_m2 = excluded.area_m2, desplazamientos = excluded.desplazamientos, lbl_off_x = excluded.lbl_off_x, lbl_off_y = excluded.lbl_off_y, label_angle = excluded.label_angle, label_x = excluded.label_x, label_y = excluded.label_y, label_moved = excluded.label_moved, direccion = excluded.direccion, aparato = excluded.aparato, total_l = excluded.total_l, pendiente = excluded.pendiente, piso = excluded.piso, baj_r = excluded.baj_r, ghost_data = excluded.ghost_data, is_fantasma = excluded.is_fantasma, diam_pulg = excluded.diam_pulg, diametro = excluded.diametro, aco_diam = excluded.aco_diam, capacidad = excluded.capacidad, base = excluded.base, altura = excluded.altura, canal_id = excluded.canal_id, descarga_en_id = excluded.descarga_en_id, origen_id = excluded.origen_id, caja_origen_id = excluded.caja_origen_id, bomba_en_id = excluded.bomba_en_id, fixtures = excluded.fixtures, uc_aplicado = excluded.uc_aplicado, uc_aplicado_hidro = excluded.uc_aplicado_hidro, factor_sim = excluded.factor_sim, longitud = excluded.longitud, copia_piso = excluded.copia_piso, copiado_de_plan = excluded.copiado_de_plan, copiado_de_id = excluded.copiado_de_id, bajante_externo_id = excluded.bajante_externo_id, updated_at = now()
    returning id, client_id)
  select client_id, id from ins;

  delete from public.cf_planos_bajantes where plano_id = p_plano_id and client_id not in (select client_id from _baj_map);

  delete from public.cf_planos_areas where plano_id = p_plano_id;
  insert into public.cf_planos_areas (plano_id, user_id, client_id, pts, color, label, label_x, label_y, label_angle, label_moved, area_m2, net)
  select p_plano_id, uid, r.client_id, coalesce(r.pts, '[]'::jsonb), r.color, r.label, r.label_x, r.label_y, r.label_angle, coalesce(r.label_moved, false), r.area_m2, r.net
  from jsonb_populate_recordset(null::public.cf_planos_areas, coalesce(p_data->'areas','[]'::jsonb)) r;

  delete from public.cf_planos_dimensiones where plano_id = p_plano_id;
  insert into public.cf_planos_dimensiones (plano_id, user_id, client_id, x1, y1, x2, y2, l, lbl_x, lbl_y)
  select p_plano_id, uid, r.client_id, coalesce(r.x1, 0), coalesce(r.y1, 0), coalesce(r.x2, 0), coalesce(r.y2, 0), coalesce(r.l, 0), r.lbl_x, r.lbl_y
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

-- ═══ GRANTS (los renames del esquema viejo pudieron revocar) ══════════════════════════
revoke all on function public.get_proyecto_data(bigint) from public, anon;
grant execute on function public.get_proyecto_data(bigint) to authenticated;
revoke all on function public.get_plano_data(bigint) from public, anon;
grant execute on function public.get_plano_data(bigint) to authenticated;
revoke all on function public.save_proyecto_core(bigint, jsonb) from public, anon;
grant execute on function public.save_proyecto_core(bigint, jsonb) to authenticated;
revoke all on function public.save_planos_meta(bigint, jsonb) from public, anon;
grant execute on function public.save_planos_meta(bigint, jsonb) to authenticated;
revoke all on function public.delete_plano_meta(bigint) from public, anon;
grant execute on function public.delete_plano_meta(bigint) to authenticated;
revoke all on function public.save_plano_data(bigint, jsonb) from public, anon;
grant execute on function public.save_plano_data(bigint, jsonb) to authenticated;

-- ═══ VERIFICACIÓN ═════════════════════════════════════════════════════════════════════
-- Todas deben decir true:
-- select proname, position('cf_' in prosrc) > 0 as usa_cf
-- from pg_proc
-- where proname in ('get_proyecto_data','get_plano_data','save_proyecto_core',
--                   'save_planos_meta','save_plano_data');
