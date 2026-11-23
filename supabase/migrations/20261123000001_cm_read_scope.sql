-- El proyecto debe ser visible para el llamador. RLS autoriza al dueño y a miembros vigentes.

create or replace function public.cm_get_data(p_proyecto_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with proyecto_visible as (
    select p.* from public.cm_proyectos p where p.id = p_proyecto_id
  )
  select case when exists (select from proyecto_visible) then jsonb_build_object(
    'proyectos',       coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from proyecto_visible p), '[]'::jsonb),
    'factores',        coalesce((select jsonb_agg(to_jsonb(f) order by f.codigo) from public.cm_factores_prestacionales f where f.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'cargos',          coalesce((select jsonb_agg(to_jsonb(c) order by c.codigo) from public.cm_cargos c where c.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'cuadrillas',      coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'codigo', q.codigo, 'descripcion', q.descripcion, 'integrantes', coalesce((select jsonb_agg(to_jsonb(i) order by i.cargo_id) from public.cm_cuadrilla_integrantes i where i.cuadrilla_id = q.id and i.proyecto_id = p_proyecto_id), '[]'::jsonb)) order by q.codigo) from public.cm_cuadrillas q where q.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'equipos',         coalesce((select jsonb_agg(to_jsonb(e) order by e.codigo) from public.cm_equipos e where e.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'insumos',         coalesce((select jsonb_agg(to_jsonb(ii) order by ii.codigo) from public.cm_insumos ii where ii.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'proveedores',     coalesce((select jsonb_agg(to_jsonb(pr) order by pr.codigo) from public.cm_proveedores pr where pr.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'apus',            coalesce((select jsonb_agg(to_jsonb(a) order by a.codigo) from public.cm_apus a where a.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'presupuestos',    coalesce((select jsonb_agg(to_jsonb(pp) order by pp.codigo) from public.cm_presupuestos pp where pp.proyecto_id = p_proyecto_id), '[]'::jsonb),
    'config',          coalesce((select to_jsonb(cc) - 'user_id' from public.cm_config cc where cc.user_id = auth.uid()), '{}'::jsonb)
  ) else null end;
$$;
-- RLS ya protege cada select (auth.uid() = user_id); SECURITY INVOKER para que no
-- sea ejecutable como definer. Revocar anon/público.
revoke execute on function public.cm_get_data(uuid) from anon, public;
grant execute on function public.cm_get_data(uuid) to authenticated;
