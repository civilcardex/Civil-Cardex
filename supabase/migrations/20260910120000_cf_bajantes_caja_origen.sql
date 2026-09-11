-- Bombas (orig. usuario): proveniencia de la bomba (caja_origen_id en tipo 'bomba') y del
-- bajante ligado a una bomba de piso inferior (bomba_en_id). get_plano_data devuelve todas
-- las columnas (to_jsonb), no cambia; save_plano_data se recrea con ambas columnas en
-- insert/update de bajantes.
-- UP
alter table public.cf_planos_bajantes add column if not exists caja_origen_id text;
alter table public.cf_planos_bajantes add column if not exists bomba_en_id text;

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
  insert into public.cf_planos_ramales (plano_id, user_id, client_id, net, tipo, padre, pts, total_l, label, ini, fin, piso, dz, uc, label_x, label_y, label_angle, label_moved, material, diametro, pendiente, bloqueado, accesorio_inicio, accesorio_fin, diametro_inicio, diametro_fin, aparato_inicio, aparato_fin, n_salidas, diam_pulg, trib_reversed, acc_med, caudal, lvert, merges_from, sifon_label_ini, sifon_label_fin, fixtures, hydro_accesorios, gas_accesorios, show_length, show_name, show_guide, show_flow_dir, show_mat_diam_pend, yee_doble)
  select p_plano_id, uid, r.client_id, r.net, r.tipo, r.padre, coalesce(r.pts, '[]'::jsonb), r.total_l, r.label, r.ini, r.fin, r.piso, r.dz, r.uc, r.label_x, r.label_y, r.label_angle, coalesce(r.label_moved, false), r.material, r.diametro, r.pendiente, coalesce(r.bloqueado, false), r.accesorio_inicio, r.accesorio_fin, r.diametro_inicio, r.diametro_fin, r.aparato_inicio, r.aparato_fin, r.n_salidas, r.diam_pulg, r.trib_reversed, r.acc_med, r.caudal, r.lvert, r.merges_from, r.sifon_label_ini, r.sifon_label_fin, coalesce(r.fixtures, '{}'::jsonb), coalesce(r.hydro_accesorios, '{}'::jsonb), coalesce(r.gas_accesorios, '{}'::jsonb), coalesce(r.show_length, true), coalesce(r.show_name, true), coalesce(r.show_guide, true), coalesce(r.show_flow_dir, true), coalesce(r.show_mat_diam_pend, true), r.yee_doble
  from jsonb_populate_recordset(null::public.cf_planos_ramales, coalesce(p_data->'ramales','[]'::jsonb)) r;

  create temp table _baj_map on commit drop as
  with ins as (
    insert into public.cf_planos_bajantes (plano_id, user_id, client_id, net, tipo, code, x, y, piso_base, piso_cima, npt_base, npt_cima, h_vert, d_nominal, uc_acum, uc_extra, area_m2, desplazamientos, lbl_off_x, lbl_off_y, label_angle, label_x, label_y, label_moved, direccion, aparato, total_l, pendiente, piso, baj_r, ghost_data, is_fantasma, diam_pulg, diametro, aco_diam, capacidad, base, altura, canal_id, descarga_en_id, origen_id, caja_origen_id, bomba_en_id)
    select p_plano_id, uid, r.client_id, r.net, r.tipo, r.code, coalesce(r.x, 0), coalesce(r.y, 0), r.piso_base, r.piso_cima, r.npt_base, r.npt_cima, r.h_vert, r.d_nominal, r.uc_acum, r.uc_extra, r.area_m2, coalesce(r.desplazamientos, '{}'::jsonb), r.lbl_off_x, r.lbl_off_y, r.label_angle, r.label_x, r.label_y, coalesce(r.label_moved, false), r.direccion, r.aparato, r.total_l, r.pendiente, r.piso, r.baj_r, r.ghost_data, coalesce(r.is_fantasma, false), r.diam_pulg, r.diametro, r.aco_diam, r.capacidad, r.base, r.altura, r.canal_id, r.descarga_en_id, r.origen_id, r.caja_origen_id, r.bomba_en_id
    from jsonb_populate_recordset(null::public.cf_planos_bajantes, coalesce(p_data->'bajantes','[]'::jsonb)) r
    on conflict (plano_id, client_id) do update set
      net = excluded.net, tipo = excluded.tipo, code = excluded.code, x = excluded.x, y = excluded.y, piso_base = excluded.piso_base, piso_cima = excluded.piso_cima, npt_base = excluded.npt_base, npt_cima = excluded.npt_cima, h_vert = excluded.h_vert, d_nominal = excluded.d_nominal, uc_acum = excluded.uc_acum, uc_extra = excluded.uc_extra, area_m2 = excluded.area_m2, desplazamientos = excluded.desplazamientos, lbl_off_x = excluded.lbl_off_x, lbl_off_y = excluded.lbl_off_y, label_angle = excluded.label_angle, label_x = excluded.label_x, label_y = excluded.label_y, label_moved = excluded.label_moved, direccion = excluded.direccion, aparato = excluded.aparato, total_l = excluded.total_l, pendiente = excluded.pendiente, piso = excluded.piso, baj_r = excluded.baj_r, ghost_data = excluded.ghost_data, is_fantasma = excluded.is_fantasma, diam_pulg = excluded.diam_pulg, diametro = excluded.diametro, aco_diam = excluded.aco_diam, capacidad = excluded.capacidad, base = excluded.base, altura = excluded.altura, canal_id = excluded.canal_id, descarga_en_id = excluded.descarga_en_id, origen_id = excluded.origen_id, caja_origen_id = excluded.caja_origen_id, bomba_en_id = excluded.bomba_en_id, updated_at = now()
    returning id, client_id)
  select client_id, id from ins;

  delete from public.cf_planos_bajantes where plano_id = p_plano_id and client_id not in (select client_id from _baj_map);

  delete from public.cf_planos_areas where plano_id = p_plano_id;
  insert into public.cf_planos_areas (plano_id, user_id, client_id, pts, color, label, label_x, label_y, label_angle, label_moved, area_m2, net)
  select p_plano_id, uid, r.client_id, coalesce(r.pts, '[]'::jsonb), r.color, r.label, r.label_x, r.label_y, r.label_angle, coalesce(r.label_moved, false), r.area_m2, r.net
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

-- DOWN
alter table public.cf_planos_bajantes drop column if exists caja_origen_id;
alter table public.cf_planos_bajantes drop column if exists bomba_en_id;
