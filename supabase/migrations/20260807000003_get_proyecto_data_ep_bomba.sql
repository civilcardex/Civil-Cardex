-- =========================================================================
-- CivilFlow — extensión de get_proyecto_data con ep_datos y bomba_datos
--
-- Los nuevos gaps A/B (equipo de presión y bomba sumergible) viajan en el
-- mismo RPC canónico para que el dataset core del proyecto siga leyéndose en
-- una sola ida y vuelta (los consumidores directos PressureEquipmentDesign/
-- BombaARDesign también usan sus servicios específicos, mismo criterio que
-- GasDesign con gas_datos).
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
    'ep_datos', (
      select to_jsonb(ep) - 'proyecto_id' - 'user_id'
      from public.ep_datos_proyecto ep where ep.proyecto_id = p_proyecto_id
    ),
    'bomba_datos', (
      select to_jsonb(b) - 'proyecto_id' - 'user_id'
      from public.bomba_datos_proyecto b where b.proyecto_id = p_proyecto_id
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
