-- =========================================================================
-- CivilFlow — actualización de RPCs tras los gaps de persistencia C/D
--
-- get_proyecto_data: agrega gas_datos (1:1) y los overrides de drenaje
-- pluvial, para que el dataset core del proyecto siga leyéndose en una sola
-- ida y vuelta (los consumidores directos GasDesign/RainwaterContext también
-- pueden seguir usando sus servicios específicos; este RPC es el camino
-- canónico agregado).
--
-- get_plano_data: NO requiere cambio — hydro_accesorios/gas_accesorios ya
-- viajan en `to_jsonb(r) - 'id' - 'plano_id' - 'user_id'` (columnas nuevas
-- de planos_ramales, migración 20260806000001). Se deja intacto.
-- =========================================================================

create or replace function public.get_proyecto_data(p_proyecto_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'proyecto_general', (
      select to_jsonb(pg) - 'proyecto_id' - 'user_id'
      from public.proyecto_general pg where pg.proyecto_id = p_proyecto_id
    ),
    'pisos', coalesce((
      select jsonb_agg(to_jsonb(p) - 'proyecto_id' - 'user_id' order by p.n)
      from public.pisos p where p.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'materiales', coalesce((
      select jsonb_object_agg(categoria, items) from (
        select categoria, jsonb_agg(jsonb_build_object('id', client_id, 'val', val) order by orden) as items
        from public.materiales_proyecto where proyecto_id = p_proyecto_id
        group by categoria
      ) m
    ), '{}'::jsonb),
    'profundidades', coalesce((
      select jsonb_agg(to_jsonb(pr) - 'id' - 'proyecto_id' - 'user_id' order by pr.orden)
      from public.profundidades_proyecto pr where pr.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'criterios', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'proyecto_id' - 'user_id' order by c.orden)
      from public.criterios_proyecto c where c.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'gas_datos', (
      select to_jsonb(gd) - 'proyecto_id' - 'user_id'
      from public.gas_datos_proyecto gd where gd.proyecto_id = p_proyecto_id
    ),
    'rainwater_bajantes_overrides', coalesce((
      select jsonb_agg(to_jsonb(r) - 'id' - 'proyecto_id' - 'user_id' order by r.id)
      from public.rainwater_bajantes_overrides r where r.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'rainwater_canales_overrides', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'proyecto_id' - 'user_id' order by c.id)
      from public.rainwater_canales_overrides c where c.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'planos_meta', coalesce((
      select jsonb_agg(to_jsonb(pl) - 'proyecto_id' - 'user_id' - 'piso_id' order by pl.id)
      from public.planos pl where pl.proyecto_id = p_proyecto_id
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_proyecto_data(bigint) to authenticated;
