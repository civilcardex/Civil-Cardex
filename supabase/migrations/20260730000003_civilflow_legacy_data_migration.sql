-- =========================================================================
-- CivilFlow — migración OPCIONAL de datos legacy (jsonb) a esquema nuevo
-- Solo aplica si se copiaron proyectos/proyecto_data/plano_trazos del
-- proyecto viejo (qgldfvqnlzehttebtlbo) a tablas de staging
-- legacy_proyectos/legacy_proyecto_data/legacy_plano_trazos en ESTA base.
-- =========================================================================

begin;

insert into public.proyectos (id, user_id, codigo, nombre, created_at)
overriding system value
select id, user_id, codigo, nombre, created_at
from legacy_proyectos
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.proyectos','id'),
              coalesce((select max(id) from public.proyectos), 1));

insert into public.pisos (proyecto_id, user_id, n, npt, ok, tipo, h)
select pd.proyecto_id, pd.user_id,
       (piso->>'n')::int,
       nullif(piso->>'npt','')::numeric,
       coalesce((piso->>'ok')::boolean, false),
       coalesce(piso->>'tipo', 'piso'),
       nullif(piso->>'h','')::numeric
from legacy_proyecto_data pd,
     jsonb_array_elements(coalesce(pd.pisos, '[]'::jsonb)) as piso
on conflict (proyecto_id, n) do nothing;

insert into public.proyecto_general (
  proyecto_id, user_id, nombre, dir, ciudad, pais, uso, empresa, p_red, dot,
  mat_af, mat_ac, mat_rci, mat_san, mat_ll, mat_ven, mat_gas,
  altitud, p_atm, pobl_fija, pobl_flot, area_piscina, area_verdes,
  c_escorrentia, pendiente_san
)
select
  pd.proyecto_id, pd.user_id,
  pd.proy->>'nombre', pd.proy->>'dir', pd.proy->>'ciudad', pd.proy->>'pais',
  pd.proy->>'uso', pd.proy->>'empresa', pd.proy->>'p_red', pd.proy->>'dot',
  pd.proy->>'mat_af', pd.proy->>'mat_ac', pd.proy->>'mat_rci', pd.proy->>'mat_san',
  pd.proy->>'mat_ll', pd.proy->>'mat_ven', pd.proy->>'mat_gas',
  pd.proy->>'altitud', pd.proy->>'p_atm',
  nullif(pd.proy->>'poblFija','')::numeric, nullif(pd.proy->>'poblFlot','')::numeric,
  nullif(pd.proy->>'areaPiscina','')::numeric, nullif(pd.proy->>'areaVerdes','')::numeric,
  nullif(pd.proy->>'C_escorrentia','')::numeric, nullif(pd.proy->>'pendienteSan','')::numeric
from legacy_proyecto_data pd
where pd.proy is not null
on conflict (proyecto_id) do nothing;

insert into public.materiales_proyecto (proyecto_id, user_id, categoria, client_id, val, orden)
select pd.proyecto_id, pd.user_id, cat.key,
       item->>'id', item->>'val', ord.ordinality::int
from legacy_proyecto_data pd,
     jsonb_each(coalesce(pd.mats, '{}'::jsonb)) as cat,
     jsonb_array_elements(cat.value) with ordinality as ord(item, ordinality)
on conflict (proyecto_id, categoria, client_id) do nothing;

insert into public.profundidades_proyecto (proyecto_id, user_id, client_id, red, col, prof, norma, nota, orden)
select pd.proyecto_id, pd.user_id, r.value->>'id', r.value->>'red', r.value->>'col',
       nullif(r.value->>'prof','')::numeric, r.value->>'norma', r.value->>'nota', r.ordinality::int
from legacy_proyecto_data pd,
     jsonb_array_elements(coalesce(pd.profs, '[]'::jsonb)) with ordinality as r(value, ordinality)
on conflict (proyecto_id, client_id) do nothing;

insert into public.criterios_proyecto (proyecto_id, user_id, client_id, red, param, val, uni, norma, art, cumple, nota, orden)
select pd.proyecto_id, pd.user_id, r.value->>'id', r.value->>'red', r.value->>'param',
       r.value->>'val', r.value->>'uni', r.value->>'norma', r.value->>'art',
       r.value->>'cumple', r.value->>'nota', r.ordinality::int
from legacy_proyecto_data pd,
     jsonb_array_elements(coalesce(pd.crits, '[]'::jsonb)) with ordinality as r(value, ordinality)
on conflict (proyecto_id, client_id) do nothing;

insert into public.planos (
  id, proyecto_id, user_id, name, nivel, scale, status,
  origen_x_px, origen_y_px, factor_x, factor_y, cal_global, defined_scale,
  version, scale_m, defined_scale_m, active_net, zoom, off_x, off_y, ts
)
select
  (pm->>'id')::bigint,
  pd.proyecto_id, pd.user_id,
  pm->>'name',
  nullif(pm->>'nivel','')::int,
  nullif(pm->>'scale','')::numeric,
  coalesce(pm->>'status', 'pending'),
  nullif(pm->'origen'->>'x_px','')::numeric,
  nullif(pm->'origen'->>'y_px','')::numeric,
  nullif(pm->>'factorX','')::numeric,
  nullif(pm->>'factorY','')::numeric,
  (pm->>'calGlobal')::boolean,
  nullif(pm->>'definedScale','')::numeric,
  coalesce((pt.data->>'v')::int, 6),
  coalesce((pt.data->>'scaleM')::numeric, 0.5),
  coalesce((pt.data->>'definedScaleM')::numeric, 0),
  pt.data->>'activeNet',
  coalesce((pt.data->>'zoom')::numeric, 1),
  coalesce((pt.data->>'offX')::numeric, 0),
  coalesce((pt.data->>'offY')::numeric, 0),
  case when (pt.data->>'ts') is not null
       then to_timestamp((pt.data->>'ts')::bigint / 1000.0)
       else null end
from legacy_proyecto_data pd,
     jsonb_array_elements(coalesce(pd.plans_meta, '[]'::jsonb)) as pm
left join legacy_plano_trazos pt
  on pt.plano_id = pd.user_id::text || '_' || pd.proyecto_id::text || '_' || (pm->>'id')
on conflict (id) do nothing;

insert into public.planos_ramales (
  plano_id, user_id, client_id, net, tipo, padre, pts, total_l, label, ini, fin,
  piso, dz, uc, label_x, label_y, label_angle, material, diametro, pendiente,
  bloqueado, accesorio_inicio, accesorio_fin, diametro_inicio, diametro_fin,
  aparato_inicio, aparato_fin, n_salidas, diam_pulg, bilateral_crossings,
  bilateral_pair_ids, trib_reversed, acc_med, caudal, lvert, merges_from,
  sifon_label_ini, sifon_label_fin
)
select
  p.id, p.user_id,
  r.value->>'id', r.value->>'net', r.value->>'tipo', r.value->>'padre',
  coalesce(r.value->'pts', '[]'::jsonb),
  nullif(r.value->>'totalL','')::numeric, r.value->>'label', r.value->>'ini', r.value->>'fin',
  r.value->>'piso', r.value->>'dz', nullif(r.value->>'uc','')::numeric,
  nullif(r.value->>'labelX','')::numeric, nullif(r.value->>'labelY','')::numeric,
  nullif(r.value->>'labelAngle','')::numeric,
  r.value->>'material', r.value->>'diametro', nullif(r.value->>'pendiente','')::numeric,
  coalesce((r.value->>'bloqueado')::boolean, false),
  r.value->>'accesorioInicio', r.value->>'accesorioFin',
  r.value->>'diametroInicio', r.value->>'diametroFin',
  r.value->>'aparatoInicio', r.value->>'aparatoFin',
  nullif(r.value->>'nSalidas','')::int, nullif(r.value->>'diamPulg','')::numeric,
  r.value->'bilateralCrossings',
  (select array_agg(x) from jsonb_array_elements_text(coalesce(r.value->'bilateralPairIds','[]'::jsonb)) x),
  (r.value->>'_tribReversed')::boolean,
  r.value->'accMed', nullif(r.value->>'caudal','')::numeric, r.value->>'lvert',
  (select array_agg(x) from jsonb_array_elements_text(coalesce(r.value->'mergesFrom','[]'::jsonb)) x),
  (select array_agg((x)::numeric) from jsonb_array_elements_text(coalesce(r.value->'sifonLabelIni','[]'::jsonb)) x),
  (select array_agg((x)::numeric) from jsonb_array_elements_text(coalesce(r.value->'sifonLabelFin','[]'::jsonb)) x)
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'ramales', '[]'::jsonb)) as r(value)
on conflict (plano_id, client_id) do nothing;

insert into public.planos_bajantes (
  plano_id, user_id, client_id, net, tipo, code, x, y, piso_base, piso_cima,
  npt_base, npt_cima, h_vert, d_nominal, uc_acum, uc_extra, area_m2,
  desplazamientos, lbl_off_x, lbl_off_y, label_angle, label_x, label_y,
  direccion, aparato, total_l, pendiente, piso, baj_r, ghost_data,
  is_fantasma, diam_pulg, diametro, aco_diam, capacidad, base, altura
)
select
  p.id, p.user_id,
  b.value->>'id', b.value->>'net', b.value->>'tipo', b.value->>'code',
  (b.value->>'x')::numeric, (b.value->>'y')::numeric,
  b.value->>'pisoBase', b.value->>'pisoCima',
  nullif(b.value->>'nptBase','')::numeric, nullif(b.value->>'nptCima','')::numeric,
  nullif(b.value->>'hVert','')::numeric, b.value->>'dNominal',
  nullif(b.value->>'ucAcum','')::numeric, nullif(b.value->>'ucExtra','')::numeric,
  nullif(b.value->>'area_m2','')::numeric,
  b.value->'desplazamientos',
  nullif(b.value->>'lblOffX','')::numeric, nullif(b.value->>'lblOffY','')::numeric,
  nullif(b.value->>'labelAngle','')::numeric,
  nullif(b.value->>'labelX','')::numeric, nullif(b.value->>'labelY','')::numeric,
  b.value->>'direccion', b.value->>'aparato',
  nullif(b.value->>'totalL','')::numeric, nullif(b.value->>'pendiente','')::numeric,
  b.value->>'piso', nullif(b.value->>'bajR','')::numeric,
  b.value->'ghostData',
  coalesce((b.value->>'isFantasma')::boolean, false),
  nullif(b.value->>'diamPulg','')::numeric, b.value->>'diametro',
  b.value->>'acoDiam', b.value->>'capacidad',
  nullif(b.value->>'base','')::numeric, nullif(b.value->>'altura','')::numeric
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'bajantes', '[]'::jsonb)) as b(value)
on conflict (plano_id, client_id) do nothing;

insert into public.bajante_conexiones (user_id, bajante_origen_id, bajante_destino_id, tipo)
select p.user_id, pb_origen.id, pb_destino.id, 'recibe'
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'bajantes', '[]'::jsonb)) as b(value),
     jsonb_array_elements_text(coalesce(b.value->'recibeDeIds', '[]'::jsonb)) as recibe_id
join public.planos_bajantes pb_destino
  on pb_destino.plano_id = p.id and pb_destino.client_id = b.value->>'id'
join public.planos_bajantes pb_origen
  on pb_origen.plano_id = p.id and pb_origen.client_id = recibe_id
on conflict (bajante_origen_id, bajante_destino_id, tipo) do nothing;

insert into public.bajante_conexiones (user_id, bajante_origen_id, bajante_destino_id, tipo)
select p.user_id, pb_origen.id, pb_destino.id, 'alimenta'
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'bajantes', '[]'::jsonb)) as b(value),
     jsonb_array_elements_text(coalesce(b.value->'alimentaIds', '[]'::jsonb)) as alimenta_id
join public.planos_bajantes pb_origen
  on pb_origen.plano_id = p.id and pb_origen.client_id = b.value->>'id'
join public.planos_bajantes pb_destino
  on pb_destino.plano_id = p.id and pb_destino.client_id = alimenta_id
on conflict (bajante_origen_id, bajante_destino_id, tipo) do nothing;

insert into public.bajante_conexiones (user_id, bajante_origen_id, bajante_destino_id, tipo)
select p.user_id, pb_origen.id, pb_destino.id, 'descarga'
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'bajantes', '[]'::jsonb)) as b(value)
join public.planos_bajantes pb_origen
  on pb_origen.plano_id = p.id and pb_origen.client_id = b.value->>'id'
join public.planos_bajantes pb_destino
  on pb_destino.plano_id = p.id and pb_destino.client_id = b.value->>'descargaEnId'
where b.value->>'descargaEnId' is not null
on conflict (bajante_origen_id, bajante_destino_id, tipo) do nothing;

insert into public.planos_areas (plano_id, user_id, client_id, pts, color, label, label_x, label_y, label_angle, area_m2, net)
select p.id, p.user_id, a.value->>'id', coalesce(a.value->'pts','[]'::jsonb), a.value->>'color',
       a.value->>'label', nullif(a.value->>'labelX','')::numeric, nullif(a.value->>'labelY','')::numeric,
       nullif(a.value->>'labelAngle','')::numeric, nullif(a.value->>'areaM2','')::numeric, a.value->>'net'
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'areas', '[]'::jsonb)) as a(value)
on conflict (plano_id, client_id) do nothing;

insert into public.planos_dimensiones (plano_id, user_id, client_id, x1, y1, x2, y2, l, lbl_x, lbl_y)
select p.id, p.user_id, d.value->>'id',
       (d.value->>'x1')::numeric, (d.value->>'y1')::numeric,
       (d.value->>'x2')::numeric, (d.value->>'y2')::numeric,
       nullif(d.value->>'L','')::numeric,
       nullif(d.value->>'lblX','')::numeric, nullif(d.value->>'lblY','')::numeric
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'dims', '[]'::jsonb)) as d(value)
on conflict (plano_id, client_id) do nothing;

insert into public.planos_anotaciones_texto (plano_id, user_id, client_id, x, y, text, font_mm, box_w, lbl_off_x, lbl_off_y, text_angle)
select p.id, p.user_id, t.value->>'id',
       (t.value->>'x')::numeric, (t.value->>'y')::numeric, t.value->>'text',
       nullif(t.value->>'fontMm','')::numeric, nullif(t.value->>'boxW','')::numeric,
       nullif(t.value->>'lblOffX','')::numeric, nullif(t.value->>'lblOffY','')::numeric,
       nullif(t.value->>'textAngle','')::numeric
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'textAnnots', '[]'::jsonb)) as t(value)
on conflict (plano_id, client_id) do nothing;

insert into public.planos_lineas_guia (plano_id, user_id, client_id, net, pts)
select p.id, p.user_id, g.value->>'id', g.value->>'net', coalesce(g.value->'pts','[]'::jsonb)
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'guideLines', '[]'::jsonb)) as g(value)
on conflict (plano_id, client_id) do nothing;

insert into public.planos_cross_floor_ghosts (
  plano_id, user_id, client_id, net, code, x, y, d_nominal, direccion,
  parent_direccion, piso, source_plano_id, source_bajante_id, target_bajante_id
)
select
  p.id, p.user_id, c.value->>'id', c.value->>'net', c.value->>'code',
  (c.value->>'x')::numeric, (c.value->>'y')::numeric, c.value->>'dNominal',
  c.value->>'direccion', c.value->>'parentDireccion', c.value->>'piso',
  nullif(c.value->>'sourcePlanId','')::bigint,
  c.value->>'sourceBajanteId',
  c.value->>'targetBajanteId'
from public.planos p
join legacy_plano_trazos pt
  on pt.plano_id = p.user_id::text || '_' || p.proyecto_id::text || '_' || p.id::text,
     jsonb_array_elements(coalesce(pt.data->'crossFloorGhosts', '[]'::jsonb)) as c(value)
on conflict (plano_id, client_id) do nothing;

commit;

-- Migración de DROP separada, correr solo tras validar (ver sesión anterior).
-- alter table public.proyecto_data
--   drop column pisos, drop column proy, drop column mats,
--   drop column profs, drop column crits, drop column plans_meta;
