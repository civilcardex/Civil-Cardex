-- =========================================================================
-- CivilFlow — renombres inglés → español (SOLO RENOMBRES, los datos no se tocan)
--
-- Tablas con nombres en inglés → español:
--   planos_cross_floor_ghosts      → planos_fantasmas_entrepisos
--   rainwater_bajantes_overrides   → anulaciones_bajantes_pluviales
--   rainwater_canales_overrides    → anulaciones_canales_pluviales
--
-- Columnas en inglés de esas tablas (user_id se deja igual por decisión explícita):
--   client_id          → id_cliente
--   net                → red
--   code               → codigo
--   parent_direccion   → direccion_padre
--   source_plano_id    → plano_origen_id
--   source_bajante_id  → bajante_origen_id
--   target_bajante_id  → bajante_destino_id
--
-- Títulos de políticas RLS → español:
--   <tabla>_owner_select  → <tabla>_propietario_leer
--   <tabla>_owner_insert  → <tabla>_propietario_insertar
--   <tabla>_owner_update  → <tabla>_propietario_actualizar
--   <tabla>_owner_delete  → <tabla>_propietario_eliminar
--   <tabla>_read_all      → <tabla>_leer_autenticados
--
-- ALTER ... RENAME preserva los datos intactos (solo cambia metadatos).
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1. Renombres de tablas
-- ---------------------------------------------------------------------------
alter table public.planos_cross_floor_ghosts rename to planos_fantasmas_entrepisos;
alter table public.rainwater_bajantes_overrides rename to anulaciones_bajantes_pluviales;
alter table public.rainwater_canales_overrides rename to anulaciones_canales_pluviales;

-- ---------------------------------------------------------------------------
-- 2. Renombres de columnas (solo las en inglés; user_id queda igual)
-- ---------------------------------------------------------------------------
alter table public.planos_fantasmas_entrepisos rename column client_id to id_cliente;
alter table public.planos_fantasmas_entrepisos rename column net to red;
alter table public.planos_fantasmas_entrepisos rename column code to codigo;
alter table public.planos_fantasmas_entrepisos rename column parent_direccion to direccion_padre;
alter table public.planos_fantasmas_entrepisos rename column source_plano_id to plano_origen_id;
alter table public.planos_fantasmas_entrepisos rename column source_bajante_id to bajante_origen_id;
alter table public.planos_fantasmas_entrepisos rename column target_bajante_id to bajante_destino_id;

alter table public.anulaciones_bajantes_pluviales rename column client_id to id_cliente;
alter table public.anulaciones_canales_pluviales rename column client_id to id_cliente;

-- ---------------------------------------------------------------------------
-- 3. Renombres de índices y constraints (seguir a las tablas)
-- ---------------------------------------------------------------------------
alter index public.idx_planos_cross_floor_ghosts_plano_id rename to idx_planos_fantasmas_entrepisos_plano_id;
alter index public.idx_rainwater_baj_overrides_proyecto rename to idx_anulaciones_bajantes_pluviales_proyecto;
alter index public.idx_rainwater_canales_overrides_proyecto rename to idx_anulaciones_canales_pluviales_proyecto;

alter table public.planos_fantasmas_entrepisos rename constraint planos_cross_floor_ghosts_pkey to planos_fantasmas_entrepisos_pkey;
alter table public.planos_fantasmas_entrepisos rename constraint planos_cross_floor_ghosts_plano_id_client_id_key to planos_fantasmas_entrepisos_plano_id_id_cliente_key;
alter table public.planos_fantasmas_entrepisos rename constraint planos_cross_floor_ghosts_plano_id_fkey to planos_fantasmas_entrepisos_plano_id_fkey;
alter table public.planos_fantasmas_entrepisos rename constraint planos_cross_floor_ghosts_user_id_fkey to planos_fantasmas_entrepisos_user_id_fkey;
alter table public.planos_fantasmas_entrepisos rename constraint planos_cross_floor_ghosts_net_fkey to planos_fantasmas_entrepisos_red_fkey;
alter table public.planos_fantasmas_entrepisos rename constraint planos_cross_floor_ghosts_source_plano_id_fkey to planos_fantasmas_entrepisos_plano_origen_id_fkey;

alter table public.anulaciones_bajantes_pluviales rename constraint rainwater_bajantes_overrides_pkey to anulaciones_bajantes_pluviales_pkey;
alter table public.anulaciones_bajantes_pluviales rename constraint rainwater_bajantes_overrides_proyecto_id_client_id_key to anulaciones_bajantes_pluviales_proyecto_id_id_cliente_key;
alter table public.anulaciones_bajantes_pluviales rename constraint rainwater_bajantes_overrides_proyecto_id_fkey to anulaciones_bajantes_pluviales_proyecto_id_fkey;
alter table public.anulaciones_bajantes_pluviales rename constraint rainwater_bajantes_overrides_user_id_fkey to anulaciones_bajantes_pluviales_user_id_fkey;

alter table public.anulaciones_canales_pluviales rename constraint rainwater_canales_overrides_pkey to anulaciones_canales_pluviales_pkey;
alter table public.anulaciones_canales_pluviales rename constraint rainwater_canales_overrides_proyecto_id_client_id_key to anulaciones_canales_pluviales_proyecto_id_id_cliente_key;
alter table public.anulaciones_canales_pluviales rename constraint rainwater_canales_overrides_proyecto_id_fkey to anulaciones_canales_pluviales_proyecto_id_fkey;
alter table public.anulaciones_canales_pluviales rename constraint rainwater_canales_overrides_user_id_fkey to anulaciones_canales_pluviales_user_id_fkey;

-- ---------------------------------------------------------------------------
-- 4. Renombres de títulos de políticas RLS (todas las de public, dinámico)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_prefijo_antiguo text;
  v_nuevo text;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    -- El prefijo de política puede llevar el NOMBRE VIEJO de la tabla (políticas
    -- creadas antes de los renombres de la sección 1).
    v_prefijo_antiguo := case r.tablename
      when 'planos_fantasmas_entrepisos' then 'planos_cross_floor_ghosts'
      when 'anulaciones_bajantes_pluviales' then 'rainwater_bajantes_overrides'
      when 'anulaciones_canales_pluviales' then 'rainwater_canales_overrides'
      else r.tablename
    end;

    v_nuevo := null;
    if r.policyname = v_prefijo_antiguo || '_owner_select' then v_nuevo := r.tablename || '_propietario_leer'; end if;
    if r.policyname = v_prefijo_antiguo || '_owner_insert' then v_nuevo := r.tablename || '_propietario_insertar'; end if;
    if r.policyname = v_prefijo_antiguo || '_owner_update' then v_nuevo := r.tablename || '_propietario_actualizar'; end if;
    if r.policyname = v_prefijo_antiguo || '_owner_delete' then v_nuevo := r.tablename || '_propietario_eliminar'; end if;
    if r.policyname = v_prefijo_antiguo || '_read_all' then v_nuevo := r.tablename || '_leer_autenticados'; end if;

    if v_nuevo is not null and v_nuevo <> r.policyname then
      execute format('alter policy %I on public.%I rename to %I', r.policyname, r.tablename, v_nuevo);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Recrear RPCs de lectura (sus cuerpos referencian tablas/columnas viejas;
--    el renombre no las actualiza, hay que recrearlas con los nombres nuevos).
--    get_plano_data: ghost key 'cross_floor_ghosts' → 'fantasmas_entrepisos'
--    (el cliente lee ese key + las columnas renombradas vía to_jsonb).
-- ---------------------------------------------------------------------------
create or replace function public.get_plano_data(p_plano_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'plano', to_jsonb(pl) - 'id' - 'proyecto_id' - 'user_id' - 'piso_id',
    'ramales', coalesce((
      select jsonb_agg(to_jsonb(r) - 'id' - 'plano_id' - 'user_id' order by r.id)
      from public.planos_ramales r where r.plano_id = p_plano_id
    ), '[]'::jsonb),
    'bajantes', coalesce((
      select jsonb_agg(to_jsonb(b) - 'id' - 'plano_id' - 'user_id' order by b.id)
      from public.planos_bajantes b where b.plano_id = p_plano_id
    ), '[]'::jsonb),
    'areas', coalesce((
      select jsonb_agg(to_jsonb(a) - 'id' - 'plano_id' - 'user_id' order by a.id)
      from public.planos_areas a where a.plano_id = p_plano_id
    ), '[]'::jsonb),
    'dimensiones', coalesce((
      select jsonb_agg(to_jsonb(d) - 'id' - 'plano_id' - 'user_id' order by d.id)
      from public.planos_dimensiones d where d.plano_id = p_plano_id
    ), '[]'::jsonb),
    'anotaciones_texto', coalesce((
      select jsonb_agg(to_jsonb(t) - 'id' - 'plano_id' - 'user_id' order by t.id)
      from public.planos_anotaciones_texto t where t.plano_id = p_plano_id
    ), '[]'::jsonb),
    'lineas_guia', coalesce((
      select jsonb_agg(to_jsonb(g) - 'id' - 'plano_id' - 'user_id' order by g.id)
      from public.planos_lineas_guia g where g.plano_id = p_plano_id
    ), '[]'::jsonb),
    'fantasmas_entrepisos', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'plano_id' - 'user_id' order by c.id)
      from public.planos_fantasmas_entrepisos c where c.plano_id = p_plano_id
    ), '[]'::jsonb),
    'bajante_conexiones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'origen_client_id', bo.client_id,
        'destino_client_id', bd.client_id,
        'tipo', bc.tipo
      ) order by bc.id)
      from public.bajante_conexiones bc
      join public.planos_bajantes bo on bo.id = bc.bajante_origen_id
      join public.planos_bajantes bd on bd.id = bc.bajante_destino_id
      where bo.plano_id = p_plano_id or bd.plano_id = p_plano_id
    ), '[]'::jsonb)
  )
  from public.planos pl
  where pl.id = p_plano_id;
$$;

grant execute on function public.get_plano_data(bigint) to authenticated;

-- get_proyecto_data: overrides key 'rainwater_*_overrides' → 'anulaciones_*_pluviales'
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
    'anulaciones_bajantes_pluviales', coalesce((
      select jsonb_agg(to_jsonb(r) - 'id' - 'proyecto_id' - 'user_id' order by r.id)
      from public.anulaciones_bajantes_pluviales r where r.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'anulaciones_canales_pluviales', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'proyecto_id' - 'user_id' order by c.id)
      from public.anulaciones_canales_pluviales c where c.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'planos_meta', coalesce((
      select jsonb_agg(to_jsonb(pl) - 'proyecto_id' - 'user_id' - 'piso_id' order by pl.id)
      from public.planos pl where pl.proyecto_id = p_proyecto_id
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_proyecto_data(bigint) to authenticated;
