-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261118000000 — cm_doctrina_fixes (auditoría CivilManager 2026-11-17 + concurrencia)
--
-- 1. DROP de columnas fantasma en cm_presupuestos: tipo_precio_formulario y
--    alarmas_precio_faltante NUNCA tuvieron productor/consumidor en la UI (M-14).
--    formulario_original también se descontinó: ninguna UI lo escribe (el importador
--    actual solo mapea 4 columnas); su columna se elimina por inerte — los 3 drops son
--    seguros (dato siempre null/vacío).
-- 2. cm_save_state regenerada SIN esas 3 columnas (insert/update de presupuestos) y con
--    integrantes en numeric(6,2) SIN redondeo a entero (M-15: la UI acepta 1.5 integrantes
--    = plaza y media; antes la BD los deformaba a 1 o 2).
-- 3. cm_cuadrilla_integrantes.cantidad pasa de integer a numeric(6,2).
-- 4. Concurrencia optimistic (quick-win del reporte 2026-11): cm_save_state recibe
--    p_updated_at (el que el cliente LEYÓ al cargar); si la BD tiene uno MAYOR, otro
--    dispositivo guardó después → 'conflicto_concurrencia' en vez de pisar en silencio.
--    default null = sin check (compat con frontend viejo). Al guardar OK se sube
--    cm_proyectos.updated_at para el siguiente ciclo.
--
-- CÓMO APLICAR (manual): SQL Editor del proyecto Supabase → pegar COMPLETO → Run.
-- Idempotente: drops con IF EXISTS + create or replace.
-- ═══════════════════════════════════════════════════════════════════════════════════════

alter table public.cm_presupuestos drop column if exists formulario_original;
alter table public.cm_presupuestos drop column if exists tipo_precio_formulario;
alter table public.cm_presupuestos drop column if exists alarmas_precio_faltante;

alter table public.cm_cuadrilla_integrantes
  alter column cantidad type numeric(6, 2);

create or replace function public.cm_save_state(
  p_proyecto_id uuid,
  p_state jsonb,
  p_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_proyecto public.cm_proyectos%rowtype;
  v_k text;
begin
  -- ═══ 1) GUARDS PRIMERO (igual que 20261112000000) ════════════════════════════════════
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_proyecto_id is null then raise exception 'proyecto_requerido'; end if;
  if not public.acceso_modulo(uid, 'manage') then raise exception 'suscripcion_requerida'; end if;

  foreach v_k in array array[
    'factoresPrestaciones','cargos','proveedores','cuadrillas',
    'equipos','insumos','apus','presupuestos'
  ] loop
    if jsonb_typeof(p_state -> v_k) is distinct from 'array' then
      raise exception 'payload_malformado: %', v_k;
    end if;
  end loop;

  -- ═══ 2) LOCK PESIMISTA del proyecto ══════════════════════════════════════════════════
  select * into v_proyecto from public.cm_proyectos where id = p_proyecto_id for update;
  if not found then raise exception 'proyecto_no_encontrado'; end if;

  if v_proyecto.user_id <> uid
     and not public.empresa_escritura(v_proyecto.user_id, 'manage') then
    raise exception 'no_autorizado';
  end if;

  -- ═══ 2b) CONCURRENCIA OPTIMISTIC: el cliente manda el updated_at que LEYÓ al cargar. ══
  -- Si la BD tiene uno MAYOR, otro dispositivo guardó después → conflicto explícito en vez
  -- de last-write-wins silencioso. null = sin check (frontend viejo sin el parámetro).
  if p_updated_at is not null and v_proyecto.updated_at is not null
     and v_proyecto.updated_at > p_updated_at then
    raise exception 'conflicto_concurrencia';
  end if;

  -- ═══ 3) INTEGRANTES de cuadrilla: delete-then-insert (delete primero por FK restrict) ═
  delete from public.cm_cuadrilla_integrantes i where i.proyecto_id = p_proyecto_id;

  -- ═══ 4) OLA 1 — tablas sin FKs cruzadas entre sí ═════════════════════════════════════

  insert into public.cm_factores_prestacionales as f
    (id, user_id, proyecto_id, codigo, nombre, factor, tipo)
  select j.r ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         coalesce(j.r ->> 'codigo', ''),
         coalesce(j.r ->> 'nombre', ''),
         coalesce((j.r ->> 'factor')::numeric, 0),
         coalesce(j.r ->> 'tipo', 'prestaciones')
    from jsonb_array_elements(p_state -> 'factoresPrestaciones') as j(r)
    on conflict (id) do update set
      codigo = coalesce(excluded.codigo, f.codigo),
      nombre = coalesce(excluded.nombre, f.nombre),
      factor = coalesce(excluded.factor, f.factor),
      tipo   = coalesce(excluded.tipo, f.tipo);
  delete from public.cm_factores_prestacionales f
   where f.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'factoresPrestaciones') as j(r)
                      where j.r ->> 'id' = f.id);

  insert into public.cm_cargos as c
    (id, user_id, proyecto_id, codigo, descripcion, num_salarios_base)
  select j.r ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         coalesce(j.r ->> 'codigo', ''),
         coalesce(j.r ->> 'descripcion', ''),
         coalesce((j.r ->> 'num_salarios_base')::numeric, 1)
    from jsonb_array_elements(p_state -> 'cargos') as j(r)
    on conflict (id) do update set
      codigo            = coalesce(excluded.codigo, c.codigo),
      descripcion       = coalesce(excluded.descripcion, c.descripcion),
      num_salarios_base = coalesce(excluded.num_salarios_base, c.num_salarios_base);
  delete from public.cm_cargos c
   where c.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'cargos') as j(r)
                      where j.r ->> 'id' = c.id);

  insert into public.cm_proveedores as pv
    (id, user_id, proyecto_id, codigo, nombre, nit, contacto, tel1, tel2, email,
     direccion, ciudad, departamento, tipo, notas, activo)
  select j.r ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         coalesce(j.r ->> 'codigo', ''),
         coalesce(j.r ->> 'nombre', ''),
         coalesce(j.r ->> 'nit', ''),
         coalesce(j.r ->> 'contacto', ''),
         coalesce(j.r ->> 'tel1', ''),
         coalesce(j.r ->> 'tel2', ''),
         coalesce(j.r ->> 'email', ''),
         coalesce(j.r ->> 'direccion', ''),
         coalesce(j.r ->> 'ciudad', ''),
         coalesce(j.r ->> 'departamento', ''),
         case when jsonb_typeof(j.r -> 'tipo') = 'array'
              then coalesce((select array_agg(x)
                               from jsonb_array_elements_text(j.r -> 'tipo') a(x)),
                            '{}'::text[])
              else '{}'::text[] end,
         coalesce(j.r ->> 'notas', ''),
         coalesce((j.r ->> 'activo')::boolean, true)
    from jsonb_array_elements(p_state -> 'proveedores') as j(r)
    on conflict (id) do update set
      codigo       = coalesce(excluded.codigo, pv.codigo),
      nombre       = coalesce(excluded.nombre, pv.nombre),
      nit          = coalesce(excluded.nit, pv.nit),
      contacto     = coalesce(excluded.contacto, pv.contacto),
      tel1         = coalesce(excluded.tel1, pv.tel1),
      tel2         = coalesce(excluded.tel2, pv.tel2),
      email        = coalesce(excluded.email, pv.email),
      direccion    = coalesce(excluded.direccion, pv.direccion),
      ciudad       = coalesce(excluded.ciudad, pv.ciudad),
      departamento = coalesce(excluded.departamento, pv.departamento),
      tipo         = case when j.r ? 'tipo' then coalesce(excluded.tipo, pv.tipo)
                          else pv.tipo end,
      notas        = coalesce(excluded.notas, pv.notas),
      activo       = coalesce(excluded.activo, pv.activo);
  delete from public.cm_proveedores pv
   where pv.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'proveedores') as j(r)
                      where j.r ->> 'id' = pv.id);

  insert into public.cm_cuadrillas as q
    (id, user_id, proyecto_id, codigo, descripcion)
  select j.r ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         coalesce(j.r ->> 'codigo', ''),
         coalesce(j.r ->> 'descripcion', '')
    from jsonb_array_elements(p_state -> 'cuadrillas') as j(r)
    on conflict (id) do update set
      codigo      = coalesce(excluded.codigo, q.codigo),
      descripcion = coalesce(excluded.descripcion, q.descripcion);
  delete from public.cm_cuadrillas q
   where q.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'cuadrillas') as j(r)
                      where j.r ->> 'id' = q.id);

  insert into public.cm_apus as a
    (id, user_id, proyecto_id, codigo, nombre, categoria, unidad, fecha_creacion,
     es_basico, recursos_mo, recursos_eq, recursos_ins, recursos_transporte)
  select j.r ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         coalesce(j.r ->> 'codigo', ''),
         coalesce(j.r ->> 'nombre', ''),
         coalesce(j.r ->> 'categoria', ''),
         coalesce(j.r ->> 'unidad', ''),
         coalesce(j.r ->> 'fecha_creacion', ''),
         coalesce((j.r ->> 'es_basico')::boolean, false),
         coalesce(nullif(j.r -> 'recursos_mo', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'recursos_eq', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'recursos_ins', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'recursos_transporte', 'null'::jsonb), '[]'::jsonb)
    from jsonb_array_elements(p_state -> 'apus') as j(r)
    on conflict (id) do update set
      codigo              = coalesce(excluded.codigo, a.codigo),
      nombre              = coalesce(excluded.nombre, a.nombre),
      categoria           = coalesce(excluded.categoria, a.categoria),
      unidad              = coalesce(excluded.unidad, a.unidad),
      fecha_creacion      = coalesce(excluded.fecha_creacion, a.fecha_creacion),
      es_basico           = coalesce(excluded.es_basico, a.es_basico),
      recursos_mo         = coalesce(excluded.recursos_mo, a.recursos_mo),
      recursos_eq         = coalesce(excluded.recursos_eq, a.recursos_eq),
      recursos_ins        = coalesce(excluded.recursos_ins, a.recursos_ins),
      recursos_transporte = coalesce(excluded.recursos_transporte, a.recursos_transporte);
  delete from public.cm_apus a
   where a.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'apus') as j(r)
                      where j.r ->> 'id' = a.id);

  -- cm_presupuestos: SIN formulario_original / tipo_precio_formulario /
  -- alarmas_precio_faltante (columnas dropeadas arriba).
  insert into public.cm_presupuestos as pr
    (id, user_id, proyecto_id, codigo, nombre, entidad, contrato, objeto, plazo,
     fecha_creacion, ciudad, departamento, elaborado_por, activo, con_sub_proyectos,
     parent_id, estado, fecha_cierre, observaciones, items, aiu_override,
     factores_snap, cargos_snap, apus_snap, insumos_snap, equipos_snap, cuadrillas_snap,
     perfil_pais_snap)
  select j.r ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         coalesce(j.r ->> 'codigo', ''),
         coalesce(j.r ->> 'nombre', ''),
         coalesce(j.r ->> 'entidad', ''),
         coalesce(j.r ->> 'contrato', ''),
         coalesce(j.r ->> 'objeto', ''),
         coalesce(j.r ->> 'plazo', ''),
         coalesce(j.r ->> 'fecha_creacion', ''),
         coalesce(j.r ->> 'ciudad', ''),
         coalesce(j.r ->> 'departamento', ''),
         coalesce(j.r ->> 'elaborado_por', ''),
         coalesce((j.r ->> 'activo')::boolean, true),
         coalesce((j.r ->> 'con_sub_proyectos')::boolean, false),
         j.r ->> 'parent_id',
         coalesce(j.r ->> 'estado', 'borrador'),
         coalesce(j.r ->> 'fecha_cierre', ''),
         coalesce(j.r ->> 'observaciones', ''),
         coalesce(nullif(j.r -> 'items', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'aiu_override', 'null'::jsonb),
                  '{"activo":false,"pct_a":10,"pct_i":3,"pct_u":6,"iva_pct":19}'::jsonb),
         coalesce(nullif(j.r -> 'factores_snap', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'cargos_snap', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'apus_snap', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'insumos_snap', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'equipos_snap', 'null'::jsonb), '[]'::jsonb),
         coalesce(nullif(j.r -> 'cuadrillas_snap', 'null'::jsonb), '[]'::jsonb),
         nullif(j.r -> 'perfil_pais_snap', 'null'::jsonb)
    from jsonb_array_elements(p_state -> 'presupuestos') as j(r)
    on conflict (id) do update set
      codigo            = coalesce(excluded.codigo, pr.codigo),
      nombre            = coalesce(excluded.nombre, pr.nombre),
      entidad           = coalesce(excluded.entidad, pr.entidad),
      contrato          = coalesce(excluded.contrato, pr.contrato),
      objeto            = coalesce(excluded.objeto, pr.objeto),
      plazo             = coalesce(excluded.plazo, pr.plazo),
      fecha_creacion    = coalesce(excluded.fecha_creacion, pr.fecha_creacion),
      ciudad            = coalesce(excluded.ciudad, pr.ciudad),
      departamento      = coalesce(excluded.departamento, pr.departamento),
      elaborado_por     = coalesce(excluded.elaborado_por, pr.elaborado_por),
      activo            = coalesce(excluded.activo, pr.activo),
      con_sub_proyectos = coalesce(excluded.con_sub_proyectos, pr.con_sub_proyectos),
      parent_id         = case when j.r ? 'parent_id' then j.r ->> 'parent_id'
                              else pr.parent_id end,
      estado            = coalesce(excluded.estado, pr.estado),
      fecha_cierre      = coalesce(excluded.fecha_cierre, pr.fecha_cierre),
      observaciones     = coalesce(excluded.observaciones, pr.observaciones),
      items             = coalesce(excluded.items, pr.items),
      aiu_override      = coalesce(excluded.aiu_override, pr.aiu_override),
      factores_snap     = coalesce(excluded.factores_snap, pr.factores_snap),
      cargos_snap       = coalesce(excluded.cargos_snap, pr.cargos_snap),
      apus_snap         = coalesce(excluded.apus_snap, pr.apus_snap),
      insumos_snap      = coalesce(excluded.insumos_snap, pr.insumos_snap),
      equipos_snap      = coalesce(excluded.equipos_snap, pr.equipos_snap),
      cuadrillas_snap   = coalesce(excluded.cuadrillas_snap, pr.cuadrillas_snap),
      perfil_pais_snap  = case when j.r ? 'perfil_pais_snap'
                              then nullif(j.r -> 'perfil_pais_snap', 'null'::jsonb)
                              else pr.perfil_pais_snap end;
  delete from public.cm_presupuestos pr
   where pr.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'presupuestos') as j(r)
                      where j.r ->> 'id' = pr.id);

  -- ═══ 5) OLA 2 — equipos/insumos (FK proveedor) ═══════════════════════════════════════

  insert into public.cm_equipos as e
    (id, user_id, proyecto_id, codigo, nombre, tipo, unidad, costo_hora,
     fecha_cotizacion, proveedor_id)
  select j.r ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         coalesce(j.r ->> 'codigo', ''),
         coalesce(j.r ->> 'nombre', ''),
         coalesce(j.r ->> 'tipo', ''),
         coalesce(j.r ->> 'unidad', ''),
         coalesce((j.r ->> 'costo_hora')::numeric, 0),
         coalesce(j.r ->> 'fecha_cotizacion', ''),
         nullif(j.r ->> 'proveedor_id', '')
    from jsonb_array_elements(p_state -> 'equipos') as j(r)
    on conflict (id) do update set
      codigo           = coalesce(excluded.codigo, e.codigo),
      nombre           = coalesce(excluded.nombre, e.nombre),
      tipo             = coalesce(excluded.tipo, e.tipo),
      unidad           = coalesce(excluded.unidad, e.unidad),
      costo_hora       = coalesce(excluded.costo_hora, e.costo_hora),
      fecha_cotizacion = coalesce(excluded.fecha_cotizacion, e.fecha_cotizacion),
      proveedor_id     = case when j.r ? 'proveedor_id'
                              then nullif(j.r ->> 'proveedor_id', '')
                              else e.proveedor_id end;
  delete from public.cm_equipos e
   where e.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'equipos') as j(r)
                      where j.r ->> 'id' = e.id);

  insert into public.cm_insumos as ins
    (id, user_id, proyecto_id, codigo, nombre, unidad, origen, categoria, subcategoria,
     marca_referencia, costo_unitario, fecha_cotizacion, apu_basico_id, proveedor_id)
  select j.r ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         coalesce(j.r ->> 'codigo', ''),
         coalesce(j.r ->> 'nombre', ''),
         coalesce(j.r ->> 'unidad', ''),
         coalesce(j.r ->> 'origen', ''),
         coalesce(j.r ->> 'categoria', ''),
         coalesce(j.r ->> 'subcategoria', ''),
         coalesce(j.r ->> 'marca_referencia', ''),
         coalesce((j.r ->> 'costo_unitario')::numeric, 0),
         coalesce(j.r ->> 'fecha_cotizacion', ''),
         j.r ->> 'apu_basico_id',
         nullif(j.r ->> 'proveedor_id', '')
    from jsonb_array_elements(p_state -> 'insumos') as j(r)
    on conflict (id) do update set
      codigo           = coalesce(excluded.codigo, ins.codigo),
      nombre           = coalesce(excluded.nombre, ins.nombre),
      unidad           = coalesce(excluded.unidad, ins.unidad),
      origen           = coalesce(excluded.origen, ins.origen),
      categoria        = coalesce(excluded.categoria, ins.categoria),
      subcategoria     = coalesce(excluded.subcategoria, ins.subcategoria),
      marca_referencia = coalesce(excluded.marca_referencia, ins.marca_referencia),
      costo_unitario   = coalesce(excluded.costo_unitario, ins.costo_unitario),
      fecha_cotizacion = coalesce(excluded.fecha_cotizacion, ins.fecha_cotizacion),
      apu_basico_id    = case when j.r ? 'apu_basico_id' then j.r ->> 'apu_basico_id'
                              else ins.apu_basico_id end,
      proveedor_id     = case when j.r ? 'proveedor_id'
                              then nullif(j.r ->> 'proveedor_id', '')
                              else ins.proveedor_id end;
  delete from public.cm_insumos ins
   where ins.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'insumos') as j(r)
                      where j.r ->> 'id' = ins.id);

  -- ═══ 6) INTEGRANTES: cantidad numeric(6,2) SIN redondeo (M-15: la UI acepta 1.5) ═════
  insert into public.cm_cuadrilla_integrantes
    (id, user_id, proyecto_id, cuadrilla_id, cargo_id, cantidad)
  select k.it ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         q.r ->> 'id',
         k.it ->> 'cargo_id',
         greatest(0, coalesce((k.it ->> 'cantidad')::numeric, 0))
    from jsonb_array_elements(p_state -> 'cuadrillas') as q(r)
    cross join lateral jsonb_array_elements(q.r -> 'integrantes') as k(it)
   where nullif(k.it ->> 'cargo_id', '') is not null;

  -- ═══ 7) cm_config ════════════════════════════════════════════════════════════════════
  -- El guardado OK sube el reloj del proyecto: la siguiente carga/edita compara contra él.
  update public.cm_proyectos set updated_at = now() where id = p_proyecto_id;
  insert into public.cm_config (user_id, config, config_listas, categorias_apu)
  values (uid,
          coalesce(nullif(p_state -> 'config', 'null'::jsonb), '{}'::jsonb),
          coalesce(nullif(p_state -> 'config_listas', 'null'::jsonb), '{}'::jsonb),
          coalesce(nullif(p_state -> 'categorias_apu', 'null'::jsonb), '[]'::jsonb))
  on conflict (user_id) do update set
    config          = excluded.config,
    config_listas   = excluded.config_listas,
    categorias_apu  = excluded.categorias_apu,
    updated_at      = now();
end;
$$;

-- El overload VIEJO (uuid, jsonb) sin guard de concurrencia quedaría como bypass de dos
-- vías: llamada directa + ambigüedad de resolución en la llamada de 2 args. Fuera.
drop function if exists public.cm_save_state(uuid, jsonb);
revoke execute on function public.cm_save_state(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.cm_save_state(uuid, jsonb, timestamptz) to authenticated;
