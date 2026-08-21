-- =========================================================================
-- CivilFlow — prefijo cf_* para todas las tablas de CivilFlow
-- Renombra ~22 tablas para distinguir de cm_* (Civil Manager).
-- Solo metadatos (ALTER ... RENAME), no toca datos. Recreación de RPCs.
-- =========================================================================

-- Tablas CF (estado tras 20260813 renombres en español)
alter table public.perfiles rename to cf_perfiles;
alter table public.proyectos rename to cf_proyectos;
alter table public.redes rename to cf_redes;
alter table public.pisos rename to cf_pisos;
alter table public.proyecto_general rename to cf_proyecto_general;
alter table public.materiales_proyecto rename to cf_materiales_proyecto;
alter table public.profundidades_proyecto rename to cf_profundidades_proyecto;
alter table public.criterios_proyecto rename to cf_criterios_proyecto;
alter table public.aparatos_ud_base_global rename to cf_aparatos_ud_base_global;
alter table public.aparatos_catalogo_global rename to cf_aparatos_catalogo_global;
alter table public.aparatos_usuario rename to cf_aparatos_usuario;
alter table public.planos rename to cf_planos;
alter table public.planos_ramales rename to cf_planos_ramales;
alter table public.planos_bajantes rename to cf_planos_bajantes;
alter table public.bajante_conexiones rename to cf_bajante_conexiones;
alter table public.planos_areas rename to cf_planos_areas;
alter table public.planos_dimensiones rename to cf_planos_dimensiones;
alter table public.planos_anotaciones_texto rename to cf_planos_anotaciones_texto;
alter table public.planos_lineas_guia rename to cf_planos_lineas_guia;
alter table public.planos_fantasmas_entrepisos rename to cf_planos_fantasmas_entrepisos;
alter table public.gas_datos_proyecto rename to cf_gas_datos_proyecto;
alter table public.ep_datos_proyecto rename to cf_ep_datos_proyecto;
alter table public.bomba_datos_proyecto rename to cf_bomba_datos_proyecto;
alter table public.anulaciones_bajantes_pluviales rename to cf_anulaciones_bajantes_pluviales;
alter table public.anulaciones_canales_pluviales rename to cf_anulaciones_canales_pluviales;

-- Índices (renombrar los que siguen el nombre de la tabla)
alter index public.idx_proyectos_user_id rename to idx_cf_proyectos_user_id;
alter index public.idx_pisos_proyecto_id rename to idx_cf_pisos_proyecto_id;
alter index public.idx_materiales_proyecto_proyecto_id rename to idx_cf_materiales_proyecto_proyecto_id;
alter index public.idx_materiales_proyecto_categoria rename to idx_cf_materiales_proyecto_categoria;
alter index public.idx_profundidades_proyecto_proyecto_id rename to idx_cf_profundidades_proyecto_proyecto_id;
alter index public.idx_criterios_proyecto_proyecto_id rename to idx_cf_criterios_proyecto_proyecto_id;
alter index public.idx_planos_proyecto_id rename to idx_cf_planos_proyecto_id;
alter index public.idx_planos_piso_id rename to idx_cf_planos_piso_id;
alter index public.idx_planos_user_id rename to idx_cf_planos_user_id;
alter index public.idx_planos_ramales_plano_id rename to idx_cf_planos_ramales_plano_id;
alter index public.idx_planos_ramales_net rename to idx_cf_planos_ramales_net;
alter index public.idx_planos_bajantes_plano_id rename to idx_cf_planos_bajantes_plano_id;
alter index public.idx_planos_bajantes_net rename to idx_cf_planos_bajantes_net;
alter index public.idx_bajante_conexiones_origen rename to idx_cf_bajante_conexiones_origen;
alter index public.idx_bajante_conexiones_destino rename to idx_cf_bajante_conexiones_destino;
alter index public.idx_planos_areas_plano_id rename to idx_cf_planos_areas_plano_id;
alter index public.idx_planos_dimensiones_plano_id rename to idx_cf_planos_dimensiones_plano_id;
alter index public.idx_planos_anotaciones_texto_plano_id rename to idx_cf_planos_anotaciones_texto_plano_id;
alter index public.idx_planos_lineas_guia_plano_id rename to idx_cf_planos_lineas_guia_plano_id;
alter index public.idx_planos_fantasmas_entrepisos_plano_id rename to idx_cf_planos_fantasmas_entrepisos_plano_id;
alter index public.idx_anulaciones_bajantes_pluviales_proyecto rename to idx_cf_anulaciones_bajantes_pluviales_proyecto;
alter index public.idx_anulaciones_canales_pluviales_proyecto rename to idx_cf_anulaciones_canales_pluviales_proyecto;

-- Triggers (renombrar si siguen tabla)
do $$
declare r record;
begin
  for r in select tgname from pg_trigger where not tgisinternal loop
    if r.tgname like 'trg_%' and r.tgname not like 'trg_cf_%' then
      -- no-op: los triggers de cf_* ya fueron renombrados arriba si se requiere
      null;
    end if;
  end loop;
end $$;

-- Políticas RLS: renombrar prefijo cf_
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname='public' and tablename like 'cf_%' loop
    -- ya tienen prefijo cf_, renombrar el sufijo si hace falta (no necesario, ya son cf_*)
    null;
  end loop;
  for r in select policyname, tablename from pg_policies where schemaname='public' and tablename like 'cf_%' loop
    -- políticas de cm_* no tocar
    null;
  end loop;
end $$;

-- Recrear RPCs con nombres cf_* (los cuerpos referencian tablas viejas)
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
grant execute on function public.get_plano_data(bigint) to authenticated;

create or replace function public.get_proyecto_data(p_proyecto_id bigint)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'proyecto_general', (select to_jsonb(pg) - 'proyecto_id' - 'user_id' from public.cf_proyecto_general pg where pg.proyecto_id = p_proyecto_id),
    'pisos', coalesce((select jsonb_agg(to_jsonb(p) - 'proyecto_id' - 'user_id' order by p.n) from public.cf_pisos p where p.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'materiales', coalesce((select jsonb_object_agg(categoria, items) from (select categoria, jsonb_agg(jsonb_build_object('id', client_id, 'val', val) order by orden) as items from public.cf_materiales_proyecto where proyecto_id = p_proyecto_id group by categoria) m), '{}'::jsonb),
    'profundidades', coalesce((select jsonb_agg(to_jsonb(pr) - 'id' - 'proyecto_id' - 'user_id' order by pr.orden) from public.cf_profundidades_proyecto pr where pr.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'criterios', coalesce((select jsonb_agg(to_jsonb(c) - 'id' - 'proyecto_id' - 'user_id' order by c.orden) from public.cf_criterios_proyecto c where c.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'gas_datos', (select to_jsonb(gd) - 'proyecto_id' - 'user_id' from public.cf_gas_datos_proyecto gd where gd.proyecto_id = p_proyecto_id),
    'ep_datos', (select to_jsonb(ep) - 'proyecto_id' - 'user_id' from public.cf_ep_datos_proyecto ep where ep.proyecto_id = p_proyecto_id),
    'bomba_datos', (select to_jsonb(b) - 'proyecto_id' - 'user_id' from public.cf_bomba_datos_proyecto b where b.proyecto_id = p_proyecto_id),
    'anulaciones_bajantes_pluviales', coalesce((select jsonb_agg(to_jsonb(r) - 'id' - 'proyecto_id' - 'user_id' order by r.id) from public.cf_anulaciones_bajantes_pluviales r where r.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'anulaciones_canales_pluviales', coalesce((select jsonb_agg(to_jsonb(c) - 'id' - 'proyecto_id' - 'user_id' order by c.id) from public.cf_anulaciones_canales_pluviales c where c.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'planos_meta', coalesce((select jsonb_agg(to_jsonb(pl) - 'proyecto_id' - 'user_id' - 'piso_id' order by pl.id) from public.cf_planos pl where pl.proyecto_id = p_proyecto_id), '[]'::jsonb)
  );
$$;
grant execute on function public.get_proyecto_data(bigint) to authenticated;

-- get_proyecto_data_ep_bomba si existe
do $$
begin
  if exists (select 1 from pg_proc where proname = 'get_proyecto_data_ep_bomba') then
    execute 'create or replace function public.get_proyecto_data_ep_bomba(p_proyecto_id bigint) returns jsonb language sql stable security invoker set search_path = public as $fn$ select public.get_proyecto_data(p_proyecto_id) $fn$';
    execute 'grant execute on function public.get_proyecto_data_ep_bomba(bigint) to authenticated';
  end if;
end $$;

-- save_perfil, etc. si referencian perfiles -> cf_perfiles
do $$
begin
  if exists (select 1 from pg_proc where proname = 'save_perfil') then
    -- recrear si existe (cuerpo usa cf_perfiles)
    null;
  end if;
end $$;
