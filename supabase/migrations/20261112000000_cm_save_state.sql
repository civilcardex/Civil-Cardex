-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261112000000 — cm_save_state: guardado ATÓMICO de todo el estado de Civil Manager
--
-- PROBLEMA que resuelve: hoy el cliente (src/modules/civilmanager/storage.ts) guarda CM con
-- ~20 round-trips PostgREST en dos olas paralelas. Si uno falla a mitad de camino, la BD
-- queda a MEDIAS (apus de una generación y presupuestos de otra) y el error se traga por
-- tabla. Este RPC recibe el estado COMPLETO en un jsonb y lo aplica en UNA transacción:
-- si algo falla, no se escribe nada (o todo, o nada).
--
-- ESTRUCTURA del jsonb p_state (claves EXACTAS que arma el cliente):
--   factoresPrestaciones, cargos, proveedores, cuadrillas (CON integrantes anidados),
--   equipos, insumos, apus, presupuestos  → arrays de filas limpias (id + columnas de negocio)
--   config, config_listas, categorias_apu → blobs jsonb para cm_config
--
-- AUTORIZACIÓN (SECURITY DEFINER → RLS NO aplica, los guards SON la autorización):
--   1. auth.uid() nulo → 'no_autenticado'
--   2. acceso_modulo(uid,'manage') falso → 'suscripcion_requerida'
--      (mismo candado de suscripción que las policies de las 9 tablas hijas, 20261021000000)
--   3. el proyecto debe existir y ser del dueño, O el llamador debe ser miembro-empresa con
--      asiento vigente y puede_editar (public.empresa_escritura(dueño,'manage')) → 'no_autorizado'
-- Sellado: las filas de las 9 tablas hijas viajan SIEMPRE con user_id = DUEÑO del proyecto y
-- proyecto_id = p_proyecto_id (un miembro-editor escribe contenido a nombre del dueño, igual
-- que hace el cliente hoy con ownerIdProyectoActivo). cm_config va con auth.uid() (config
-- personal, self-only, nunca compartida — igual que el cliente hoy).
--
-- SEMÁNTICA por columna (igual a la del cliente con upsert + defaultToNull:false):
--   - Clave ausente o null en columna NOT NULL → DEFAULT de la columna al insertar, y el
--     valor previo se CONSERVA al actualizar (via coalesce(excluded.x, tabla.x)).
--   - Clave ausente en columna ANULABLE → conservar el valor previo (jsonb_exists).
--     JSON null explícito en anulable → limpiar el valor. '' en FKs anulables → NULL.
--   - user_id/proyecto_id/created_at/updated_at que vengan en el jsonb se IGNORAN.
-- CAMBIO intencional vs. el cliente viejo: un array VACÍO sí reconcilia (borra todas las
-- filas del proyecto para esa tabla). El camino viejo saltaba la tabla entera cuando el
-- array llegaba vacío y los registros borrados resucitaban al recargar.
-- Un error de validación (FK a proveedor borrado, check de estado, payload_malformado)
-- falla COMPLETO y avisa — antes el camino viejo lo tragaba por tabla.
--
-- ═══ CÓMO APLICAR (el usuario, manual — SQL Editor del proyecto Supabase) ═══════════════
--   PASO 1. Supabase Dashboard → SQL Editor → New query.
--   PASO 2. Pegar el contenido COMPLETO de este archivo.
--   PASO 3. Run. Es idempotente: re-ejecutar no rompe nada (create or replace + revokes).
--   PASO 4. Verificar con las consultas de la sección VERIFICACIÓN (al final): la función
--           debe existir con search_path vacío y execute SOLO para authenticated.
--   PASO 5. No hay que redeployar el frontend: mientras la función no exista, el cliente
--           sigue usando su camino legado de olas paralelas (detecta el 404/PGRST202); al
--           aparecer la función, el próximo guardado migra solo al RPC.
-- ═══════════════════════════════════════════════════════════════════════════════════════

create or replace function public.cm_save_state(p_proyecto_id uuid, p_state jsonb)
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
  -- ═══ 1) GUARDS PRIMERO (patrón save_proyecto_general_campo / familia empresa) ════════
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_proyecto_id is null then raise exception 'proyecto_requerido'; end if;
  -- Candado de suscripción: mismo que exigen las policies de las 9 tablas hijas (con el
  -- flag de suscripciones apagado acceso_modulo devuelve true → sin cambio de comportamiento).
  if not public.acceso_modulo(uid, 'manage') then raise exception 'suscripcion_requerida'; end if;

  -- Payload completo o nada: las 8 claves de filas DEBEN ser arrays (jsonb_typeof de una
  -- clave ausente es SQL null → 'is distinct from' también la rechaza aquí). El cliente
  -- siempre manda el estado entero; un payload parcial quedaría a medias.
  foreach v_k in array array[
    'factoresPrestaciones','cargos','proveedores','cuadrillas',
    'equipos','insumos','apus','presupuestos'
  ] loop
    if jsonb_typeof(p_state -> v_k) is distinct from 'array' then
      raise exception 'payload_malformado: %', v_k;
    end if;
  end loop;

  -- ═══ 2) LOCK PESIMISTA del proyecto (patrón race de 20260924000001: FOR UPDATE + rowcount) ══
  -- Dos saves concurrentes se serializan aquí: el segundo espera y aplica su estado completo
  -- sobre el primero (no se intercalan tablas). El `if not found` es el rowcount: cierra el
  -- caso proyecto borrado entre el rpc y el lock.
  select * into v_proyecto from public.cm_proyectos where id = p_proyecto_id for update;
  if not found then raise exception 'proyecto_no_encontrado'; end if;

  -- Dueño del proyecto, O miembro de empresa con asiento vigente y puede_editar
  -- (empresa_escritura ya mira puede_editar + estado 'activa' + fecha_fin).
  if v_proyecto.user_id <> uid
     and not public.empresa_escritura(v_proyecto.user_id, 'manage') then
    raise exception 'no_autorizado';
  end if;

  -- ═══ 3) INTEGRANTES de cuadrilla: delete-then-insert (patrón del cliente, ahora atómico) ══
  -- El DELETE va PRIMERO (antes de reconciliar cm_cargos) porque cargo_id tiene FK restrict
  -- desde integrantes: reconciliar cargos con integrantes vivos tumbaba el delete del cargo
  -- y el camino viejo lo tragaba — el cargo borrado resucitaba al recargar. Dentro de esta
  -- transacción, si el insert final falla, el delete revierte con todo lo demás.
  delete from public.cm_cuadrilla_integrantes i where i.proyecto_id = p_proyecto_id;

  -- ═══ 4) OLA 1 — tablas sin FKs cruzadas entre sí (solo apuntan a cm_proyectos/auth.users) ══

  -- cm_factores_prestacionales (factoresPrestaciones)
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
  -- Reconciliación de borrados: solo quedan vivos los ids que viajaron en el jsonb.
  delete from public.cm_factores_prestacionales f
   where f.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'factoresPrestaciones') as j(r)
                      where j.r ->> 'id' = f.id);

  -- cm_cargos
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

  -- cm_proveedores (tipo es text[]: el jsonb trae un array de strings)
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

  -- cm_cuadrillas: la clave 'integrantes' del jsonb se IGNORA aquí (se inserta al final,
  -- en el paso 6, tras reconciliar cargos y cuadrillas).
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

  -- cm_apus (recursos_* son jsonb: 'null' jsonb o ausente → '[]')
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

  -- cm_presupuestos (el más grande: columnas base + los 6 snaps + formulario original)
  insert into public.cm_presupuestos as pr
    (id, user_id, proyecto_id, codigo, nombre, entidad, contrato, objeto, plazo,
     fecha_creacion, ciudad, departamento, elaborado_por, activo, con_sub_proyectos,
     parent_id, estado, fecha_cierre, observaciones, items, aiu_override,
     factores_snap, cargos_snap, apus_snap, insumos_snap, equipos_snap, cuadrillas_snap,
     perfil_pais_snap, formulario_original, tipo_precio_formulario, alarmas_precio_faltante)
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
         nullif(j.r -> 'perfil_pais_snap', 'null'::jsonb),
         nullif(j.r -> 'formulario_original', 'null'::jsonb),
         nullif(j.r -> 'tipo_precio_formulario', 'null'::jsonb),
         nullif(j.r -> 'alarmas_precio_faltante', 'null'::jsonb)
    from jsonb_array_elements(p_state -> 'presupuestos') as j(r)
    on conflict (id) do update set
      codigo                 = coalesce(excluded.codigo, pr.codigo),
      nombre                 = coalesce(excluded.nombre, pr.nombre),
      entidad                = coalesce(excluded.entidad, pr.entidad),
      contrato               = coalesce(excluded.contrato, pr.contrato),
      objeto                 = coalesce(excluded.objeto, pr.objeto),
      plazo                  = coalesce(excluded.plazo, pr.plazo),
      fecha_creacion         = coalesce(excluded.fecha_creacion, pr.fecha_creacion),
      ciudad                 = coalesce(excluded.ciudad, pr.ciudad),
      departamento           = coalesce(excluded.departamento, pr.departamento),
      elaborado_por          = coalesce(excluded.elaborado_por, pr.elaborado_por),
      activo                 = coalesce(excluded.activo, pr.activo),
      con_sub_proyectos      = coalesce(excluded.con_sub_proyectos, pr.con_sub_proyectos),
      parent_id              = case when j.r ? 'parent_id' then j.r ->> 'parent_id'
                                    else pr.parent_id end,
      estado                 = coalesce(excluded.estado, pr.estado),
      fecha_cierre           = coalesce(excluded.fecha_cierre, pr.fecha_cierre),
      observaciones          = coalesce(excluded.observaciones, pr.observaciones),
      items                  = coalesce(excluded.items, pr.items),
      aiu_override           = coalesce(excluded.aiu_override, pr.aiu_override),
      factores_snap          = coalesce(excluded.factores_snap, pr.factores_snap),
      cargos_snap            = coalesce(excluded.cargos_snap, pr.cargos_snap),
      apus_snap              = coalesce(excluded.apus_snap, pr.apus_snap),
      insumos_snap           = coalesce(excluded.insumos_snap, pr.insumos_snap),
      equipos_snap           = coalesce(excluded.equipos_snap, pr.equipos_snap),
      cuadrillas_snap        = coalesce(excluded.cuadrillas_snap, pr.cuadrillas_snap),
      perfil_pais_snap       = case when j.r ? 'perfil_pais_snap'
                                    then nullif(j.r -> 'perfil_pais_snap', 'null'::jsonb)
                                    else pr.perfil_pais_snap end,
      formulario_original    = case when j.r ? 'formulario_original'
                                    then nullif(j.r -> 'formulario_original', 'null'::jsonb)
                                    else pr.formulario_original end,
      tipo_precio_formulario = case when j.r ? 'tipo_precio_formulario'
                                    then nullif(j.r -> 'tipo_precio_formulario', 'null'::jsonb)
                                    else pr.tipo_precio_formulario end,
      alarmas_precio_faltante = case when j.r ? 'alarmas_precio_faltante'
                                     then nullif(j.r -> 'alarmas_precio_faltante', 'null'::jsonb)
                                     else pr.alarmas_precio_faltante end;
  delete from public.cm_presupuestos pr
   where pr.proyecto_id = p_proyecto_id
     and not exists (select 1
                       from jsonb_array_elements(p_state -> 'presupuestos') as j(r)
                      where j.r ->> 'id' = pr.id);

  -- ═══ 5) OLA 2 — dependen de la ola 1: equipos/insumos (FK proveedor) ══════════════════
  -- Nota: si un equipo/insumo referencia un proveedor borrado en esta misma transacción,
  -- la FK tumba TODO el guardado (antes el camino viejo tragaba el 409 y la BD quedaba a
  -- medias). El estado del cliente no deja referencias colgantes: fallar aquí es correcto.

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

  -- ═══ 6) INTEGRANTES: insert del delete-then-insert del paso 3 ════════════════════════
  -- Los integrantes viajan anidados en cada cuadrilla (como el estado del cliente). El
  -- cuadrilla_id se toma del PADRE (alias q), no de la fila; sin cargo_id no viajan
  -- (igual que el filtro del cliente) y la cantidad se redondea/acota a >= 0 (check BD).
  insert into public.cm_cuadrilla_integrantes
    (id, user_id, proyecto_id, cuadrilla_id, cargo_id, cantidad)
  select k.it ->> 'id',
         v_proyecto.user_id,
         p_proyecto_id,
         q.r ->> 'id',
         k.it ->> 'cargo_id',
         greatest(0, round(coalesce((k.it ->> 'cantidad')::numeric, 0)))::integer
    from jsonb_array_elements(p_state -> 'cuadrillas') as q(r)
    cross join lateral jsonb_array_elements(q.r -> 'integrantes') as k(it)
   where nullif(k.it ->> 'cargo_id', '') is not null;

  -- ═══ 7) cm_config: parámetros y listas de cálculo — SIEMPRE a nombre del que llama ════
  -- (config personal self-only, nunca compartida: un miembro-editor actualiza SU config,
  -- igual que hace el cliente hoy con user_id: userId).
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

-- Solo authenticated la llama (el cliente); anon/public sin execute (patrón cm_get_data).
revoke execute on function public.cm_save_state(uuid, jsonb) from public, anon;
grant execute on function public.cm_save_state(uuid, jsonb) to authenticated;

-- ═══ VERIFICACIÓN (pegar en SQL Editor tras aplicar) ═══════════════════════════════════
-- select proconfig, prosecdef from pg_proc
--  where proname = 'cm_save_state';
--   → proconfig = {search_path=""} | prosecdef = true
--
-- select has_function_privilege('anon',          'public.cm_save_state(null::uuid, null::jsonb)', 'execute');  → false
-- select has_function_privilege('authenticated', 'public.cm_save_state(null::uuid, null::jsonb)', 'execute');  → true
--
-- Guardado de humo (con un proyecto y usuario reales) desde SQL Editor no sirve para el
-- sello (auth.uid() es null ahí) — la prueba real es guardar desde la app: consola sin
-- 'cm_save_state' y una recarga que muestre los cambios persistidos.
-- ═══════════════════════════════════════════════════════════════════════════════════════
