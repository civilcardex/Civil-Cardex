-- Save PARCIAL de CivilManager + revisión de cierre de presupuestos (auditoría de
-- persistencia 2026-11-27, hallazgos Alta 1 y Alta 3).
--
-- 1) cm_save_state acepta payload PARCIAL: una colección ausente del jsonb CONSERVA sus filas
--    (antes: payload_malformado; el cliente siempre enviaba las 8 y una pestaña vieja reponía
--    filas que nunca editó). Regla de producto intacta: última escritura gana SOBRE lo enviado.
-- 2) cm_config (preferencias de cuenta) solo se escribe si el payload la trae.
-- 3) cm_presupuestos gana herr_pct_snap y usar_fp_en_apu_snap: parámetros que congelan al
--    cerrar para que el recálculo de un presupuesto cerrado no use la config VIVA.
--
-- El cliente (rpc.ts) envía solo las colecciones modificadas desde su carga; un cliente viejo
-- que sigue enviando las 8 se comporta exactamente igual que hoy.

alter table public.cm_presupuestos add column if not exists herr_pct_snap numeric;
alter table public.cm_presupuestos add column if not exists usar_fp_en_apu_snap boolean;

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
  v_rows integer;
  v_tabla text;
  v_anterior jsonb;
  v_filas jsonb;
begin
  -- ═══ 1) GUARDS PRIMERO (igual que 20261112000000) ════════════════════════════════════
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_proyecto_id is null then raise exception 'proyecto_requerido'; end if;
  if not public.acceso_modulo(uid, 'manage') then raise exception 'suscripcion_requerida'; end if;

  foreach v_k in array array[
    'factoresPrestaciones','cargos','proveedores','cuadrillas',
    'equipos','insumos','apus','presupuestos'
  ] loop
    -- Save parcial (2026-11-27): colección AUSENTE = no se toca (la UI envía solo lo que
    -- cambió y una pestaña vieja deja de reposar filas que nunca editó). Presente debe
    -- ser array.
    if p_state ? v_k and jsonb_typeof(p_state -> v_k) is distinct from 'array' then
      raise exception 'payload_malformado: %', v_k;
    end if;
  end loop;

  -- ═══ 2) LOCK PESIMISTA del proyecto ══════════════════════════════════════════════════
  select p.* into v_proyecto from public.cm_proyectos p
   where p.id = p_proyecto_id
     and (p.user_id = uid or public.empresa_escritura(p.user_id, 'manage') is true)
   for update;
  if not found then raise exception 'no_autorizado'; end if;

  -- ═══ 2b) CONCURRENCIA OPTIMISTIC: el cliente manda el updated_at que LEYÓ al cargar. ══
  -- Si la BD tiene uno MAYOR, otro dispositivo guardó después → conflicto explícito en vez
  -- de last-write-wins silencioso. null = sin check (frontend viejo sin el parámetro).
  if p_updated_at is not null and v_proyecto.updated_at is distinct from p_updated_at then
    raise exception 'conflicto_concurrencia';
  end if;

  -- Completar solo claves omitidas antes de borrar/reordenar dependencias.
  for v_k, v_tabla in
    select * from (values
      ('factoresPrestaciones', 'cm_factores_prestacionales'), ('cargos', 'cm_cargos'),
      ('proveedores', 'cm_proveedores'), ('cuadrillas', 'cm_cuadrillas'),
      ('equipos', 'cm_equipos'), ('insumos', 'cm_insumos'),
      ('apus', 'cm_apus'), ('presupuestos', 'cm_presupuestos')
    ) as tabla(clave, nombre)
  loop
    if p_state -> v_k is null then continue; end if;  -- save parcial
    execute format(
      'select coalesce(jsonb_agg(coalesce(to_jsonb(prev), ''{}''::jsonb) || f.r order by f.pos), ''[]''::jsonb)
       from jsonb_array_elements($1) with ordinality f(r, pos)
       left join public.%I prev on prev.id = f.r ->> ''id'' and prev.proyecto_id = $2 and prev.user_id = $3',
      v_tabla
    ) into v_filas using p_state -> v_k, p_proyecto_id, v_proyecto.user_id;
    p_state := jsonb_set(p_state, array[v_k], v_filas);
  end loop;
  if p_state -> 'cuadrillas' is not null then
  select coalesce(jsonb_agg(
    case when fila.r ? 'integrantes' then fila.r - 'integrantes' ||
      jsonb_build_object('integrantes', coalesce(nullif(fila.r -> 'integrantes', 'null'::jsonb), '[]'::jsonb))
    else fila.r || jsonb_build_object('integrantes', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.id) from public.cm_cuadrilla_integrantes i
       where i.cuadrilla_id = fila.r ->> 'id' and i.proyecto_id = p_proyecto_id
    ), '[]'::jsonb)) end order by fila.pos), '[]'::jsonb)
    into v_filas
    from jsonb_array_elements(p_state -> 'cuadrillas') with ordinality fila(r, pos);
  p_state := jsonb_set(p_state, '{cuadrillas}', v_filas);

  -- ═══ 3) INTEGRANTES de cuadrilla: delete-then-insert (delete primero por FK restrict) ═
  delete from public.cm_cuadrilla_integrantes i where i.proyecto_id = p_proyecto_id;

  end if;

  -- ═══ 4) OLA 1 — tablas sin FKs cruzadas entre sí ═════════════════════════════════════

  if p_state -> 'factoresPrestaciones' is not null then
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
      tipo   = coalesce(excluded.tipo, f.tipo)
    where f.proyecto_id = excluded.proyecto_id and f.user_id = excluded.user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> jsonb_array_length(p_state -> 'factoresPrestaciones') then
    raise exception 'referencia_fuera_de_proyecto';
  end if;
  delete from public.cm_factores_prestacionales f
   where f.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'factoresPrestaciones') as j(r)
                      where j.r ->> 'id' = f.id);

  end if;

  if p_state -> 'cargos' is not null then
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
      num_salarios_base = coalesce(excluded.num_salarios_base, c.num_salarios_base)
    where c.proyecto_id = excluded.proyecto_id and c.user_id = excluded.user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> jsonb_array_length(p_state -> 'cargos') then
    raise exception 'referencia_fuera_de_proyecto';
  end if;
  delete from public.cm_cargos c
   where c.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'cargos') as j(r)
                      where j.r ->> 'id' = c.id);

  end if;

  if p_state -> 'proveedores' is not null then
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
         case when j.r ? 'tipo' then case when jsonb_typeof(j.r -> 'tipo') = 'array'
              then coalesce((select array_agg(x)
                               from jsonb_array_elements_text(j.r -> 'tipo') a(x)),
                            '{}'::text[])
              else '{}'::text[] end
              else coalesce(anterior.tipo, '{}'::text[]) end,
         coalesce(j.r ->> 'notas', ''),
         coalesce((j.r ->> 'activo')::boolean, true)
    from jsonb_array_elements(p_state -> 'proveedores') as j(r)
    left join public.cm_proveedores anterior
      on anterior.id = j.r ->> 'id' and anterior.proyecto_id = p_proyecto_id
      and anterior.user_id = v_proyecto.user_id
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
      tipo         = excluded.tipo,
      notas        = coalesce(excluded.notas, pv.notas),
      activo       = coalesce(excluded.activo, pv.activo)
    where pv.proyecto_id = excluded.proyecto_id and pv.user_id = excluded.user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> jsonb_array_length(p_state -> 'proveedores') then
    raise exception 'referencia_fuera_de_proyecto';
  end if;
  delete from public.cm_proveedores pv
   where pv.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'proveedores') as j(r)
                      where j.r ->> 'id' = pv.id);

  end if;

  if p_state -> 'cuadrillas' is not null then
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
      descripcion = coalesce(excluded.descripcion, q.descripcion)
    where q.proyecto_id = excluded.proyecto_id and q.user_id = excluded.user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> jsonb_array_length(p_state -> 'cuadrillas') then
    raise exception 'referencia_fuera_de_proyecto';
  end if;
  delete from public.cm_cuadrillas q
   where q.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'cuadrillas') as j(r)
                      where j.r ->> 'id' = q.id);

  end if;

  if p_state -> 'apus' is not null then
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
      recursos_transporte = coalesce(excluded.recursos_transporte, a.recursos_transporte)
    where a.proyecto_id = excluded.proyecto_id and a.user_id = excluded.user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> jsonb_array_length(p_state -> 'apus') then
    raise exception 'referencia_fuera_de_proyecto';
  end if;
  delete from public.cm_apus a
   where a.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'apus') as j(r)
                      where j.r ->> 'id' = a.id);

  -- cm_presupuestos: SIN formulario_original / tipo_precio_formulario /
  -- alarmas_precio_faltante (columnas dropeadas arriba).
  end if;

  if p_state -> 'presupuestos' is not null then
  insert into public.cm_presupuestos as pr
    (id, user_id, proyecto_id, codigo, nombre, entidad, contrato, objeto, plazo,
     fecha_creacion, ciudad, departamento, elaborado_por, activo, con_sub_proyectos,
     parent_id, estado, fecha_cierre, observaciones, items, aiu_override,
     factores_snap, cargos_snap, apus_snap, insumos_snap, equipos_snap, cuadrillas_snap,
     perfil_pais_snap, herr_pct_snap, usar_fp_en_apu_snap)
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
         case when j.r ? 'parent_id' then nullif(j.r ->> 'parent_id', '')
              else anterior.parent_id end,
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
         case when j.r ? 'perfil_pais_snap' then nullif(j.r -> 'perfil_pais_snap', 'null'::jsonb)
              else anterior.perfil_pais_snap end,
         -- Revisión de cierre (auditoría 2026-11-27): % de herramienta y uso de factores
         -- prestacionales congelados al cerrar; null = presupuesto histórico sin foto.
         case when jsonb_typeof(j.r -> 'herr_pct_snap') = 'number'
              then (j.r ->> 'herr_pct_snap')::numeric else anterior.herr_pct_snap end,
         case when jsonb_typeof(j.r -> 'usar_fp_en_apu_snap') = 'boolean'
              then (j.r ->> 'usar_fp_en_apu_snap')::boolean else anterior.usar_fp_en_apu_snap end
    from jsonb_array_elements(p_state -> 'presupuestos') as j(r)
    left join public.cm_presupuestos anterior
      on anterior.id = j.r ->> 'id' and anterior.proyecto_id = p_proyecto_id
      and anterior.user_id = v_proyecto.user_id
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
      parent_id         = excluded.parent_id,
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
      perfil_pais_snap  = excluded.perfil_pais_snap,
      herr_pct_snap     = excluded.herr_pct_snap,
      usar_fp_en_apu_snap = excluded.usar_fp_en_apu_snap
    where pr.proyecto_id = excluded.proyecto_id and pr.user_id = excluded.user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> jsonb_array_length(p_state -> 'presupuestos') then
    raise exception 'referencia_fuera_de_proyecto';
  end if;
  delete from public.cm_presupuestos pr
   where pr.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'presupuestos') as j(r)
                      where j.r ->> 'id' = pr.id);

  -- ═══ 5) OLA 2 — equipos/insumos (FK proveedor) ═══════════════════════════════════════

  end if;

  if p_state -> 'equipos' is not null then
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
         case when j.r ? 'proveedor_id' then nullif(j.r ->> 'proveedor_id', '')
              else anterior.proveedor_id end
    from jsonb_array_elements(p_state -> 'equipos') as j(r)
    left join public.cm_equipos anterior
      on anterior.id = j.r ->> 'id' and anterior.proyecto_id = p_proyecto_id
      and anterior.user_id = v_proyecto.user_id
    on conflict (id) do update set
      codigo           = coalesce(excluded.codigo, e.codigo),
      nombre           = coalesce(excluded.nombre, e.nombre),
      tipo             = coalesce(excluded.tipo, e.tipo),
      unidad           = coalesce(excluded.unidad, e.unidad),
      costo_hora       = coalesce(excluded.costo_hora, e.costo_hora),
      fecha_cotizacion = coalesce(excluded.fecha_cotizacion, e.fecha_cotizacion),
      proveedor_id     = excluded.proveedor_id
    where e.proyecto_id = excluded.proyecto_id and e.user_id = excluded.user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> jsonb_array_length(p_state -> 'equipos') then
    raise exception 'referencia_fuera_de_proyecto';
  end if;
  delete from public.cm_equipos e
   where e.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'equipos') as j(r)
                      where j.r ->> 'id' = e.id);

  end if;

  if p_state -> 'insumos' is not null then
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
         case when j.r ? 'apu_basico_id' then nullif(j.r ->> 'apu_basico_id', '')
              else anterior.apu_basico_id end,
         case when j.r ? 'proveedor_id' then nullif(j.r ->> 'proveedor_id', '')
              else anterior.proveedor_id end
    from jsonb_array_elements(p_state -> 'insumos') as j(r)
    left join public.cm_insumos anterior
      on anterior.id = j.r ->> 'id' and anterior.proyecto_id = p_proyecto_id
      and anterior.user_id = v_proyecto.user_id
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
      apu_basico_id    = excluded.apu_basico_id,
      proveedor_id     = excluded.proveedor_id
    where ins.proyecto_id = excluded.proyecto_id and ins.user_id = excluded.user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> jsonb_array_length(p_state -> 'insumos') then
    raise exception 'referencia_fuera_de_proyecto';
  end if;
  delete from public.cm_insumos ins
   where ins.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'insumos') as j(r)
                      where j.r ->> 'id' = ins.id);
  end if;

  if p_state -> 'cuadrillas' is not null then

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

  end if;

  -- Validar referencias una vez reconciliadas todas las colecciones.
  if exists (
    select from public.cm_cuadrilla_integrantes origen
     where origen.proyecto_id = p_proyecto_id and origen.cuadrilla_id is not null
       and not exists (select from public.cm_cuadrillas destino
                        where destino.id = origen.cuadrilla_id and destino.proyecto_id = p_proyecto_id
                          and destino.user_id = v_proyecto.user_id)
  ) or exists (
    select from public.cm_cuadrilla_integrantes origen
     where origen.proyecto_id = p_proyecto_id and origen.cargo_id is not null
       and not exists (select from public.cm_cargos destino
                        where destino.id = origen.cargo_id and destino.proyecto_id = p_proyecto_id
                          and destino.user_id = v_proyecto.user_id)
  ) or exists (
    select from public.cm_presupuestos origen
     where origen.proyecto_id = p_proyecto_id and origen.parent_id is not null
       and not exists (select from public.cm_presupuestos destino
                        where destino.id = origen.parent_id and destino.proyecto_id = p_proyecto_id
                          and destino.user_id = v_proyecto.user_id)
  ) or exists (
    select from public.cm_equipos origen
     where origen.proyecto_id = p_proyecto_id and origen.proveedor_id is not null
       and not exists (select from public.cm_proveedores destino
                        where destino.id = origen.proveedor_id and destino.proyecto_id = p_proyecto_id
                          and destino.user_id = v_proyecto.user_id)
  ) or exists (
    select from public.cm_insumos origen
     where origen.proyecto_id = p_proyecto_id and origen.proveedor_id is not null
       and not exists (select from public.cm_proveedores destino
                        where destino.id = origen.proveedor_id and destino.proyecto_id = p_proyecto_id
                          and destino.user_id = v_proyecto.user_id)
  ) or exists (
    select from public.cm_insumos origen
     where origen.proyecto_id = p_proyecto_id and origen.apu_basico_id is not null
       and not exists (select from public.cm_apus destino
                        where destino.id = origen.apu_basico_id and destino.proyecto_id = p_proyecto_id
                          and destino.user_id = v_proyecto.user_id)
  ) then
    raise exception 'referencia_fuera_de_proyecto';
  end if;

  -- ═══ 7) cm_config ════════════════════════════════════════════════════════════════════
  -- El guardado OK sube el reloj del proyecto: la siguiente carga/edita compara contra él.
  update public.cm_proyectos set updated_at = now() where id = p_proyecto_id;
  -- Preferencias de cuenta SOLO si el guardado las trae (auditoría 2026-11-27): un proyecto
  -- guardado desde otra cuenta deja de republicar la config de quien abre.
  if p_state ? 'config' or p_state ? 'config_listas' or p_state ? 'categorias_apu' then
  select to_jsonb(c) into v_anterior from public.cm_config c where c.user_id = uid;
  p_state := coalesce(v_anterior, '{}'::jsonb) || p_state;
  insert into public.cm_config (user_id, config, config_listas, categorias_apu)
  values (uid,
          coalesce(nullif(p_state -> 'config', 'null'::jsonb), '{}'::jsonb),
          coalesce(nullif(p_state -> 'config_listas', 'null'::jsonb), '{}'::jsonb),
          coalesce(nullif(p_state -> 'categorias_apu', 'null'::jsonb), '[]'::jsonb))
  on conflict (user_id) do update set
    -- H-13 (remediación 2026-11-27): merge POR CLAVE dentro del jsonb — dos guardados con
    -- configuraciones disjuntas de la misma cuenta no se tumban mutuamente; las claves
    -- omitidas conservan el valor de la fila que el servidor actualiza. categorias_apu es
    -- una lista: se sustituye entera cuando el payload la trae.
    config          = coalesce(public.cm_config.config, '{}'::jsonb)
                      || coalesce(excluded.config, '{}'::jsonb),
    config_listas   = coalesce(public.cm_config.config_listas, '{}'::jsonb)
                      || coalesce(excluded.config_listas, '{}'::jsonb),
    categorias_apu  = coalesce(excluded.categorias_apu, public.cm_config.categorias_apu, '[]'::jsonb),
    updated_at      = now();
  end if;
end;
$$;
