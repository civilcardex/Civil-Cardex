-- ═══════════════════════════════════════════════════════════════════════════════
-- CIVIL CARDEX — BD COMPLETA DESDE CERO · PARTE 1/2: BASE COMÚN + CIVIL FLOW
-- ═══════════════════════════════════════════════════════════════════════════════
-- Estado FINAL consolidado de supabase/migrations/ (20260730000001 → 20261006000000).
-- Este archivo es REFERENCIA documental: reproduce la BD tal como está hoy, sin la
-- historia de parches (alter-chains, cirugías sobre funciones, renombres). La fuente
-- de verdad aplicada sigue siendo la carpeta migrations/.
--
-- Ejecutable sobre un proyecto Supabase VACÍO (el esquema auth/ y storage/ ya
-- existen ahí). Orden de dependencias respetado: helpers antes de policies que los
-- invocan; tablas antes de funciones.
--
-- Convivencia: correr 01_civilflow.sql COMPLETO y luego 02_civilmanager.sql
-- (la parte común — perfiles, app_* — vive aquí y manage la referencia).
--
-- Decisiones de fondo documentadas inline:
--   · cf_proyectos.id es UUID (conversión 2026-10-05; el número legado se eliminó).
--     cf_planos.id sigue siendo BIGINT generado por el CLIENTE (Date.now*1000+rand).
--   · Las escrituras de flow van SOLO por RPCs SECURITY DEFINER (wrapper con candado
--     acceso_modulo → *_impl con validación). Los grants de escritura directa están
--     revocados para authenticated (20260813000003).
--   · Empresarial: miembros de suscripciones vigentes leen/escriben vía
--     empresa_lectura/empresa_escritura en policies; los INSERTs de miembros se
--     re-sellan al dueño con el trigger trg_sellar_owner (19 tablas de contenido).
--   · Suscripciones apagadas por defecto (app_config.suscripciones_activas = false):
--     acceso_modulo() devuelve true para todos y la app behave como antes.
-- ═══════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1 · BASE COMÚN (perfiles + suscripciones/pricing)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Perfil de usuario (1:1 con auth.users; la fila la crea el trigger on_auth_user_created).
create table public.cf_perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  apellido text,
  email text,
  profesion text,
  matricula text,
  telefono text,
  -- Mapa { netId: color } de colores de redes; global al usuario, no por proyecto.
  net_colors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cf_perfiles enable row level security;

-- Interruptor maestro de suscripciones. false = acceso_modulo() devuelve true para
-- todos (app sin gating; ni Lemon Squeezy ni candados activos).
create table public.app_config (
  clave text primary key,
  valor boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_config (clave, valor) values ('suscripciones_activas', false)
on conflict (clave) do nothing;
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- Precios LISTA por módulo en CENTAVOS USD (la verdad del pricing; el cliente los
-- sincroniza vía obtener_catalogo). Cambiar precio = UPDATE aquí, sin deploy.
create table public.app_precios (
  modulo text primary key check (modulo in ('flow', 'manage')),
  precio_mensual_centavos bigint not null,
  precio_semestral_centavos bigint not null,
  precio_anual_centavos bigint not null,
  updated_at timestamptz not null default now()
);
insert into public.app_precios (modulo, precio_mensual_centavos, precio_semestral_centavos, precio_anual_centavos)
values
  ('flow',   2500, 15000, 30000),
  ('manage', 2500, 15000, 30000)
on conflict (modulo) do nothing;
alter table public.app_precios enable row level security;

-- Suscripciones vigentes (se paga por adelantado; fecha_fin > now() es la única verdad).
create table public.app_suscripciones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null check (modulo in ('flow', 'manage')),
  periodo text not null check (periodo in ('mensual', 'semestral', 'anual')),
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa', 'cancelada')),
  -- Empresarial: N puestos (asientos para miembros) por suscripción.
  puestos int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, modulo),
  constraint app_suscripciones_puestos_check check (puestos >= 1)
);
alter table public.app_suscripciones enable row level security;
create index app_suscripciones_usuario_idx on public.app_suscripciones (user_id);

-- Asientos: miembros asignados a una suscripción del dueño. Solo usuarios ya
-- registrados (asignar_puesto busca por email en auth.users).
create table public.app_suscripciones_miembros (
  id bigint generated always as identity primary key,
  suscripcion_id bigint not null references public.app_suscripciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asignado_por uuid not null references auth.users(id) on delete cascade,
  puede_editar boolean not null default true,
  created_at timestamptz not null default now(),
  unique (suscripcion_id, user_id)
);
alter table public.app_suscripciones_miembros enable row level security;
create index app_suscripciones_miembros_usuario_idx on public.app_suscripciones_miembros (user_id);
create index app_suscripciones_miembros_suscripcion_idx on public.app_suscripciones_miembros (suscripcion_id);
create index app_suscripciones_miembros_asignado_por_idx on public.app_suscripciones_miembros (asignado_por);

-- Ledger de pagos (los inserta la edge function crear-checkout; activar_suscripciones
-- consume la referencia idempotentemente).
create table public.app_pagos (
  id bigint generated always as identity primary key,
  referencia text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  modulos text[] not null check (array_length(modulos, 1) >= 1),
  periodo text not null check (periodo in ('mensual', 'semestral', 'anual')),
  monto_centavos bigint not null check (monto_centavos > 0),
  moneda text not null default 'USD',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado')),
  txn_id text unique,
  puestos_por_modulo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  aprobado_at timestamptz
);
alter table public.app_pagos enable row level security;
create index app_pagos_usuario_idx on public.app_pagos (user_id);

-- Policies de la base común (solo lectura propia; las escrituras van por RPC/service_role).
create policy app_suscripciones_propietario_leer on public.app_suscripciones
  for select using ((select auth.uid()) = user_id);
create policy app_suscripciones_miembros_leer on public.app_suscripciones_miembros
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.app_suscripciones s
      where s.id = suscripcion_id and s.user_id = (select auth.uid())
    )
  );
create policy app_pagos_propietario_leer on public.app_pagos
  for select using ((select auth.uid()) = user_id);
create policy cf_perfiles_propietario_leer on public.cf_perfiles for select using ((select auth.uid()) = id);
create policy cf_perfiles_propietario_insertar on public.cf_perfiles for insert with check ((select auth.uid()) = id);
create policy cf_perfiles_propietario_actualizar on public.cf_perfiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy cf_perfiles_propietario_eliminar on public.cf_perfiles for delete using ((select auth.uid()) = id);

revoke insert, update, delete on public.app_suscripciones, public.app_pagos,
  public.app_suscripciones_miembros from authenticated;
revoke all on public.app_suscripciones, public.app_pagos, public.app_suscripciones_miembros from anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2 · FUNCIONES DE ACCESO (helpers invocados por policies y RPCs)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ¿Gating activo? Con app_config en false, TODO el acceso está abierto.
create or replace function public.suscripciones_habilitadas()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select valor from public.app_config where clave = 'suscripciones_activas'),
    false
  );
$$;

-- Verdad de acceso: flag apagado → todos; encendido → suscripción propia vigente
-- o asiento (miembro) en suscripción vigente del módulo.
create or replace function public.acceso_modulo(p_uid uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.suscripciones_habilitadas()
    or exists (
      select 1 from public.app_suscripciones s
      where s.user_id = p_uid and s.modulo = p_modulo
        and s.estado = 'activa' and s.fecha_fin > now()
    )
    or exists (
      select 1 from public.app_suscripciones_miembros m
      join public.app_suscripciones s on s.id = m.suscripcion_id
      where m.user_id = p_uid and s.modulo = p_modulo
        and s.estado = 'activa' and s.fecha_fin > now()
    );
$$;

-- ¿El caller puede LEER contenido del dueño p_owner en el módulo? (dueño mismo o miembro
-- con asiento vigente). La invocan las policies SELECT de cf_*/cm_* y las de storage.
create or replace function public.empresa_lectura(p_owner uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid())
    or exists (
      select 1 from public.app_suscripciones_miembros m
      join public.app_suscripciones s on s.id = m.suscripcion_id
      where m.user_id = (select auth.uid()) and s.user_id = p_owner
        and s.modulo = p_modulo and s.estado = 'activa' and s.fecha_fin > now()
    );
$$;

-- Ídem para ESCRIBIR (exige puede_editar del asiento).
create or replace function public.empresa_escritura(p_owner uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid())
    or exists (
      select 1 from public.app_suscripciones_miembros m
      join public.app_suscripciones s on s.id = m.suscripcion_id
      where m.user_id = (select auth.uid()) and s.user_id = p_owner
        and s.modulo = p_modulo and m.puede_editar
        and s.estado = 'activa' and s.fecha_fin > now()
    );
$$;

-- Cast tolerante de texto → uuid (paths de storage hechos de segmentos arbitrarios).
create or replace function public.uuid_seguro(t text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Módulos con acceso vigente del caller (propios + asientos). La usa el cliente
-- para pintar el selector de módulos.
create or replace function public.mis_accesos()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct modulo), '{}')
  from (
    select s.modulo from public.app_suscripciones s
      where s.user_id = (select auth.uid()) and s.estado = 'activa' and s.fecha_fin > now()
    union
    select s.modulo from public.app_suscripciones_miembros m
      join public.app_suscripciones s on s.id = m.suscripcion_id
      where m.user_id = (select auth.uid()) and s.estado = 'activa' and s.fecha_fin > now()
  ) a;
$$;

-- Catálogo de precios para el cliente (fuente: app_precios).
create or replace function public.obtener_catalogo()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    jsonb_object_agg(
      modulo,
      jsonb_build_object(
        'id', modulo,
        'precioMensualCentavos', precio_mensual_centavos,
        'precioSemestralCentavos', precio_semestral_centavos,
        'precioAnualCentavos', precio_anual_centavos
      )
    ),
    '{}'::jsonb
  )
  from public.app_precios;
$$;

-- Anti-spam de intenciones de pago: pagos pendientes del usuario en la última hora.
create or replace function public.intenciones_recientes(p_uid uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*)
  from public.app_pagos
  where user_id = p_uid
    and estado = 'pendiente'
    and created_at > now() - interval '1 hour';
$$;

-- Activa suscripciones desde un pago aprobado. Idempotente (verify del pago y webhook
-- de Lemon Squeezy pueden llegar en cualquier orden): FOR UPDATE + early-return si ya
-- está aprobado. Extiende fecha_fin acumulando desde el máximo actual.
create or replace function public.activar_suscripciones(p_referencia text, p_txn_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pago public.app_pagos%rowtype;
  v_mod text;
  v_delta interval;
  v_puestos int;
begin
  select * into v_pago from public.app_pagos where referencia = p_referencia for update;
  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado = 'aprobado' then return; end if;
  update public.app_pagos
  set estado = 'aprobado', txn_id = p_txn_id, aprobado_at = now()
  where id = v_pago.id and estado = 'pendiente';
  if not found then return; end if;
  v_delta := case v_pago.periodo
               when 'anual' then interval '12 months'
               when 'semestral' then interval '6 months'
               else interval '1 month'
             end;
  foreach v_mod in array v_pago.modulos loop
    v_puestos := greatest(coalesce((v_pago.puestos_por_modulo ->> v_mod)::int, 1), 1);
    insert into public.app_suscripciones (user_id, modulo, periodo, fecha_fin, puestos)
    values (v_pago.user_id, v_mod, v_pago.periodo, now() + v_delta, v_puestos)
    on conflict (user_id, modulo) do update
      set periodo = excluded.periodo,
          estado = 'activa',
          puestos = excluded.puestos,
          updated_at = now(),
          fecha_fin = greatest(now(), public.app_suscripciones.fecha_fin) + v_delta;
  end loop;
end;
$$;

-- ── Gestión de puestos (empresarial) ─────────────────────────────────────────

create or replace function public.asignar_puesto(p_suscripcion_id bigint, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_sus public.app_suscripciones%rowtype;
  v_miembro_id uuid;
  v_usados int;
  v_email text := btrim(coalesce(p_email, ''));
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  select * into v_sus from public.app_suscripciones
    where id = p_suscripcion_id and user_id = uid
    for update;
  if not found then raise exception 'no_autorizado'; end if;
  if v_sus.estado <> 'activa' or v_sus.fecha_fin <= now() then
    raise exception 'suscripcion_vencida';
  end if;
  if v_email = '' or char_length(v_email) > 200 then raise exception 'email_invalido'; end if;
  select u.id into v_miembro_id from auth.users u where lower(u.email) = lower(v_email);
  if v_miembro_id is null then raise exception 'usuario_no_encontrado'; end if;
  if v_miembro_id = uid then raise exception 'no_puedes_asignarte'; end if;
  if exists (select 1 from public.app_suscripciones_miembros
             where suscripcion_id = v_sus.id and user_id = v_miembro_id) then
    raise exception 'ya_es_miembro';
  end if;
  select count(*) into v_usados from public.app_suscripciones_miembros
    where suscripcion_id = v_sus.id;
  if v_usados >= v_sus.puestos then raise exception 'sin_puestos_disponibles'; end if;
  insert into public.app_suscripciones_miembros (suscripcion_id, user_id, asignado_por, puede_editar)
  values (v_sus.id, v_miembro_id, uid, true);
  return jsonb_build_object('user_id', v_miembro_id, 'email', v_email, 'puede_editar', true);
end;
$$;

create or replace function public.quitar_puesto(p_suscripcion_id bigint, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.app_suscripciones
                 where id = p_suscripcion_id and user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  delete from public.app_suscripciones_miembros
    where suscripcion_id = p_suscripcion_id and user_id = p_user_id;
end;
$$;

create or replace function public.cambiar_permiso_miembro(
  p_suscripcion_id bigint, p_user_id uuid, p_puede_editar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.app_suscripciones
                 where id = p_suscripcion_id and user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  update public.app_suscripciones_miembros set puede_editar = coalesce(p_puede_editar, true)
    where suscripcion_id = p_suscripcion_id and user_id = p_user_id;
  if not found then raise exception 'miembro_no_encontrado'; end if;
end;
$$;

create or replace function public.mis_miembros(p_suscripcion_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', m.user_id, 'email', u.email,
           'puede_editar', m.puede_editar, 'asignado_en', m.created_at
         ) order by m.created_at), '[]'::jsonb)
  from public.app_suscripciones_miembros m
  join auth.users u on u.id = m.user_id
  where m.suscripcion_id = p_suscripcion_id
    and exists (select 1 from public.app_suscripciones s
                where s.id = m.suscripcion_id and s.user_id = (select auth.uid()));
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3 · CATÁLOGOS GLOBALES (solo lectura para authenticated)
-- ═══════════════════════════════════════════════════════════════════════════════

create table public.cf_redes (
  id text primary key,
  lbl text not null,
  col text not null,
  uc_type text,
  bm_type text not null,
  bm_pfx text not null,
  bm_ico text not null,
  emoji text not null,
  name text not null
);
insert into public.cf_redes (id, lbl, col, uc_type, bm_type, bm_pfx, bm_ico, emoji, name) values
  ('af',          'RAF',    '#4D8FF7', 'uc',  'montante', 'MAF',    '⬆', '💧',  'Agua fría'),
  ('ac',          'RAC',    '#F04545', 'uc',  'montante', 'MAC',    '⬆', '🔥',  'Agua caliente'),
  ('san',         'RS',     '#F5A623', 'ud',  'bajante',  'BAN',    '⬇', '🚽',  'Sanitaria'),
  ('vent',        'REV',    '#808080', null,  'bajante',  'BREV',   '⬇', '🌬', 'Ventilación'),
  ('ll',          'RALL',   '#8B5CF6', 'ud',  'bajante',  'BALL',   '⬇', '🌧', 'Aguas lluvias'),
  ('recolectora', 'RECOLL', '#7C3AED', null,  'bajante',  'RECOLL', '⬇', '🏠',  'Canal recolectora'),
  ('gas',         'RG',     '#A855F7', null,  'montante', 'MG',     '⬆', '⛽',  'Gas'),
  ('rci',         'RRCI',   '#F87171', null,  'montante', 'MRCI',   '⬆', '🔴',  'Contra incendio'),
  ('rec',         'RREC',   '#22D3EE', null,  'montante', 'MREC',   '⬆', '🔄',  'Recirculación'),
  ('bom',         'RBOM',   '#8A9BB8', null,  'bajante',  'BOM',    '⬇', '⬆️', 'Bombeo');
alter table public.cf_redes enable row level security;

-- Base de UDs por aparato (el cliente la usa como base del catálogo propio).
create table public.cf_aparatos_ud_base_global (
  id text primary key,
  nombre text not null,
  ud numeric not null
);
alter table public.cf_aparatos_ud_base_global enable row level security;

-- Catálogo base de aparatos (usuarios sin filas propias en cf_aparatos_usuario).
create table public.cf_aparatos_catalogo_global (
  id text primary key,
  s text,
  n text,
  g text,
  ucaf numeric,
  ucac numeric,
  ud numeric,
  pmin numeric,
  pmax numeric,
  qg numeric,
  ctrl text,
  blk_ud boolean not null default false
);
alter table public.cf_aparatos_catalogo_global enable row level security;

create policy cf_redes_leer_autenticados on public.cf_redes for select using ((select auth.role()) = 'authenticated');
create policy cf_aparatos_ud_base_global_leer_autenticados on public.cf_aparatos_ud_base_global for select using ((select auth.role()) = 'authenticated');
create policy cf_aparatos_catalogo_global_leer_autenticados on public.cf_aparatos_catalogo_global for select using ((select auth.role()) = 'authenticated');
revoke all on table public.cf_redes, public.cf_aparatos_ud_base_global, public.cf_aparatos_catalogo_global from anon;
revoke insert, update, delete on table public.cf_redes, public.cf_aparatos_ud_base_global, public.cf_aparatos_catalogo_global from authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4 · NÚCLEO CIVIL FLOW (proyectos y datos 1:1 / por proyecto)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Proyectos de Civil Flow. id = UUID (paridad cm_proyectos); slug uuid para deep-links.
create table public.cf_proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  slug uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);
create index idx_cf_proyectos_user_id on public.cf_proyectos(user_id);

create table public.cf_pisos (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  n integer not null,
  npt numeric,
  ok boolean not null default false,
  tipo text not null check (tipo in ('sotano','piso','cubierta')),
  h numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, n)
);
create index idx_cf_pisos_proyecto_id on public.cf_pisos(proyecto_id);
create index idx_cf_pisos_user on public.cf_pisos(user_id);

-- Datos generales del proyecto (1:1). Incluye toggles de redes activas y blobs
-- de rejillas/parámetros de alimentación que el cliente persiste campo a campo
-- vía save_proyecto_general_campo.
create table public.cf_proyecto_general (
  proyecto_id uuid primary key references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text default '',
  dir text default '',
  ciudad text default '',
  pais text default '',
  uso text default '',
  empresa text default '',
  p_red text default '',
  dot text default '',
  mat_af text default '',
  mat_ac text default '',
  mat_rci text default '',
  mat_san text default '',
  mat_ll text default '',
  mat_ven text default '',
  mat_gas text default '',
  altitud text default '',
  p_atm text default '',
  pobl_fija numeric,
  pobl_flot numeric,
  area_piscina numeric,
  area_verdes numeric,
  c_escorrentia numeric,
  pendiente_san numeric,
  redes_activas text[],
  af_alimentacion text,
  tanque_npt text,
  presion_garantizada text,
  rejillas jsonb,
  updated_at timestamptz not null default now()
);
create index idx_cf_proyecto_general_user on public.cf_proyecto_general(user_id);

create table public.cf_materiales_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null,
  client_id text not null,
  val text not null,
  orden integer not null default 0,
  unique (proyecto_id, categoria, client_id)
);
create index idx_cf_materiales_proyecto_proyecto_id on public.cf_materiales_proyecto(proyecto_id);
create index idx_cf_materiales_proyecto_categoria on public.cf_materiales_proyecto(proyecto_id, categoria);
create index idx_cf_materiales_proyecto_user on public.cf_materiales_proyecto(user_id);

create table public.cf_profundidades_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  red text not null,
  col text,
  prof numeric,
  norma text,
  nota text,
  orden integer not null default 0,
  unique (proyecto_id, client_id)
);
create index idx_cf_profundidades_proyecto_proyecto_id on public.cf_profundidades_proyecto(proyecto_id);
create index idx_cf_profundidades_proyecto_user on public.cf_profundidades_proyecto(user_id);

create table public.cf_criterios_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  red text not null,
  param text,
  val text,
  uni text,
  norma text,
  art text,
  cumple text,
  nota text,
  orden integer not null default 0,
  unique (proyecto_id, client_id)
);
create index idx_cf_criterios_proyecto_proyecto_id on public.cf_criterios_proyecto(proyecto_id);
create index idx_cf_criterios_proyecto_user on public.cf_criterios_proyecto(user_id);

-- Diseño de gas (datos generales, 1:1).
create table public.cf_gas_datos_proyecto (
  proyecto_id uuid primary key references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  altitud text not null default '',
  presion_atm text not null default '',
  temperatura text not null default '',
  presion_min text not null default '',
  densidad_relativa text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cf_gas_datos_proyecto_user on public.cf_gas_datos_proyecto(user_id);

-- Equipo de presión (1:1). Todos los inputs text (los defaults los resuelve el cliente).
create table public.cf_ep_datos_proyecto (
  proyecto_id uuid primary key references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  qac text not null default '',
  qasc text not null default '',
  hfac text not null default '',
  hfacs text not null default '',
  hfotros text not null default '',
  pred text not null default '',
  pmin text not null default '',
  pmax text not null default '',
  zbomba text not null default '',
  ztop text not null default '',
  zcis text not null default '',
  hfcis text not null default '',
  nt text not null default '',
  nr text not null default '',
  etab text not null default '',
  etam text not null default '',
  fs text not null default '',
  ciclos text not null default '',
  alfa text not null default '',
  vsuc text not null default '',
  vimp text not null default '',
  dnsuc text not null default '',
  dnimp text not null default '',
  pcomercial text not null default '',
  modo text not null default 'red' check (modo in ('red', 'cisterna')),
  -- Cisterna (hoja CISTERNA del Excel):
  dot_l text not null default '',
  n_usuarios text not null default '',
  dias_aut text not null default '',
  bci_l text not null default '',
  patm text not null default '',
  pv text not null default '',
  npshr text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cf_ep_datos_proyecto_user on public.cf_ep_datos_proyecto(user_id);

-- Bomba sumergible trituradora (1:1) + cálculos por bomba (mapa bombas jsonb).
create table public.cf_bomba_datos_proyecto (
  proyecto_id uuid primary key references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sal_sim text not null default '',
  ud_tot text not null default '',
  hz text not null default '',
  l_imp text not null default '',
  d_imp text not null default '',
  c_hw text not null default '',
  p_desc text not null default '',
  eta_b text not null default '',
  f_srv text not null default '',
  t_cic text not null default '',
  h_min text not null default '',
  h_max text not null default '',
  b_cam text not null default '',
  l_cam text not null default '',
  npsh text not null default '',
  tipo_tuberia text not null default '',
  bombas jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cf_bomba_datos_proyecto_user on public.cf_bomba_datos_proyecto(user_id);

-- Overrides manuales de drenaje pluvial: bajantes LL (tabla 1) y canales LL (tabla 2).
-- Solo lo editado a mano; lo autocalculado se regenera del dibujo. Clave natural
-- bajante/sector (los ids BLL-n/CLL-n son efímeros).
create table public.cf_anulaciones_bajantes_pluviales (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  id_cliente text not null,
  bajante text not null,
  area_parcial numeric not null default 0,
  area_otras numeric not null default 0,
  area_acumulada numeric not null default 0,
  intensidad numeric not null default 100,
  coeficiente_c numeric not null default 0.0278,
  material_cubierta text not null default '',
  R text not null default '',
  manning numeric not null default 0,
  diam_propuesto numeric not null default 0,
  unique (proyecto_id, id_cliente)
);
create index idx_cf_anulaciones_bajantes_pluviales_proyecto on public.cf_anulaciones_bajantes_pluviales(proyecto_id);
create index idx_cf_anulaciones_bajantes_pluviales_user on public.cf_anulaciones_bajantes_pluviales(user_id);

create table public.cf_anulaciones_canales_pluviales (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  id_cliente text not null,
  sector text not null,
  area_parcial numeric not null default 0,
  area_otras numeric not null default 0,
  area_acumulada numeric not null default 0,
  intensidad numeric not null default 100,
  coeficiente_c numeric not null default 0.0278,
  material_cubierta text not null default '',
  material_canal text not null default '',
  muro_vertical numeric not null default 0,
  borde_libre_cm numeric not null default 10,
  manning numeric not null default 0.011,
  pendiente numeric not null default 0,
  b numeric not null default 0,
  h numeric not null default 0,
  unique (proyecto_id, id_cliente)
);
create index idx_cf_anulaciones_canales_pluviales_proyecto on public.cf_anulaciones_canales_pluviales(proyecto_id);
create index idx_cf_anulaciones_canales_pluviales_user on public.cf_anulaciones_canales_pluviales(user_id);

-- Catálogo de aparatos por usuario (snapshot completo; borra-e-inserta vía RPC).
create table public.cf_aparatos_usuario (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  s text,
  n text,
  g text,
  ucaf numeric,
  ucac numeric,
  ud numeric,
  pmin numeric,
  pmax numeric,
  qg numeric,
  ctrl text,
  blk_ud boolean not null default false,
  unique (user_id, client_id)
);
create index idx_cf_aparatos_usuario_user_id on public.cf_aparatos_usuario(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5 · VISOR DE PLANOS (cf_planos + colecciones del dibujo)
-- ═══════════════════════════════════════════════════════════════════════════════
-- cf_planos.id es BIGINT generado por el CLIENTE (Date.now*1000 + rand): el visor
-- crea el id antes de la primera fila en BD. NUNCA uuid aquí (el RPC espera bigint).

create table public.cf_planos (
  id bigint primary key,
  proyecto_id uuid not null references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  piso_id bigint references public.cf_pisos(id) on delete set null,
  name text not null default '',
  nivel integer,
  scale numeric,
  status text not null default 'pending' check (status in ('pending','confirmed')),
  origen_x_px numeric,
  origen_y_px numeric,
  factor_x numeric,
  factor_y numeric,
  cal_global boolean,
  defined_scale numeric,
  version integer not null default 6,
  scale_m numeric not null default 0.5,
  defined_scale_m numeric not null default 0,
  active_net text references public.cf_redes(id),
  zoom numeric not null default 1,
  off_x numeric not null default 0,
  off_y numeric not null default 0,
  -- Grosor base de líneas del visor (slider por plano; factor multiplicador).
  line_width numeric not null default 1,
  ts timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cf_planos_proyecto_id on public.cf_planos(proyecto_id);
create index idx_cf_planos_piso_id on public.cf_planos(piso_id);
create index idx_cf_planos_user_id on public.cf_planos(user_id);
create index idx_cf_planos_active_net on public.cf_planos(active_net);

-- Trazos de tubería (ramales/tributarios/montantes) por plano.
create table public.cf_planos_ramales (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.cf_planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  net text not null references public.cf_redes(id),
  tipo text not null,
  padre text,
  pts jsonb not null default '[]'::jsonb,
  total_l numeric,
  label text,
  ini text,
  fin text,
  piso text,
  dz text,
  uc numeric,
  label_x numeric,
  label_y numeric,
  label_angle numeric,
  label_moved boolean default false,
  material text,
  diametro text,
  pendiente numeric,
  bloqueado boolean not null default false,
  accesorio_inicio text,
  accesorio_fin text,
  diametro_inicio text,
  diametro_fin text,
  aparato_inicio text,
  aparato_fin text,
  n_salidas integer,
  diam_pulg numeric,
  trib_reversed boolean,
  acc_med jsonb,
  caudal numeric,
  lvert text,
  merges_from text[],
  sifon_label_ini numeric[],
  sifon_label_fin numeric[],
  -- Conteos de aparatos/UD del ramal + accesorios hidro/gas (claves net_id_plan).
  fixtures jsonb,
  hydro_accesorios jsonb not null default '{}'::jsonb,
  gas_accesorios jsonb not null default '{}'::jsonb,
  -- Flags de etiqueta (qué muestra el rótulo del ramal).
  show_length boolean default true,
  show_name boolean default true,
  show_guide boolean default true,
  show_flow_dir boolean default true,
  show_mat_diam_pend boolean default true,
  -- Identidad persistida de la yee doble (par de vértices).
  yee_doble jsonb,
  copia_piso boolean,
  -- Tributarios creados desde guía: suprime glifos de accesorio en dobleces internos.
  sin_acc_med_interior boolean,
  -- Ramal marcado como eje de canal (lluvias).
  es_canal_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_cf_planos_ramales_plano_id on public.cf_planos_ramales(plano_id);
create index idx_cf_planos_ramales_net on public.cf_planos_ramales(plano_id, net);
create index idx_cf_planos_ramales_net_fk on public.cf_planos_ramales(net);
create index idx_cf_planos_ramales_user on public.cf_planos_ramales(user_id);

-- Bajantes / montantes / calentadores / cajas / bombas por plano.
create table public.cf_planos_bajantes (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.cf_planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  net text not null references public.cf_redes(id),
  tipo text not null,
  code text,
  x numeric not null,
  y numeric not null,
  piso_base text,
  piso_cima text,
  npt_base numeric,
  npt_cima numeric,
  h_vert numeric,
  d_nominal text,
  uc_acum numeric,
  uc_extra numeric,
  area_m2 numeric,
  desplazamientos jsonb,
  lbl_off_x numeric,
  lbl_off_y numeric,
  label_angle numeric,
  label_x numeric,
  label_y numeric,
  label_moved boolean default false,
  direccion text check (direccion in ('sube','baja','continua','mantiene')),
  aparato text,
  total_l numeric,
  pendiente numeric,
  piso text,
  baj_r numeric,
  ghost_data jsonb,
  is_fantasma boolean not null default false,
  diam_pulg numeric,
  diametro text,
  aco_diam text,
  capacidad text,
  factor_sim numeric,
  base numeric,
  altura numeric,
  longitud numeric,
  -- Canal recolectora que contiene a esta bajante LL (client_id, no FK).
  canal_id text,
  -- Descarga verbatim: client_id propio o "planId|bajanteId" cross-floor (opaco).
  descarga_en_id text,
  -- Puntero inverso de la asociación entre pisos (lado destino).
  origen_id text,
  -- Bombas: caja de origen y bomba enlazada.
  caja_origen_id text,
  bomba_en_id text,
  -- UDs propias de la bajante/bomba/caja + libro de herencia entre pisos
  -- (qué UDs/hidro aplicó la asociación; delta idempotente al re-aplicar).
  fixtures jsonb not null default '{}',
  uc_aplicado jsonb,
  uc_aplicado_hidro jsonb,
  -- Copia de piso: procedencia del elemento copiado.
  copia_piso boolean,
  copiado_de_plan text,
  copiado_de_id text,
  bajante_externo_id text,
  -- Canales en diagonal + dirección de flujo del ramal de canal.
  angulo numeric,
  canal_flow_dir text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_cf_planos_bajantes_plano_id on public.cf_planos_bajantes(plano_id);
create index idx_cf_planos_bajantes_net on public.cf_planos_bajantes(plano_id, net);
create index idx_cf_planos_bajantes_net_fk on public.cf_planos_bajantes(net);
create index idx_cf_planos_bajantes_user on public.cf_planos_bajantes(user_id);

-- Conexiones normalizadas entre bajantes del mismo plano (recibe/alimenta/descarga).
create table public.cf_bajante_conexiones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bajante_origen_id bigint not null references public.cf_planos_bajantes(id) on delete cascade,
  bajante_destino_id bigint not null references public.cf_planos_bajantes(id) on delete cascade,
  tipo text not null check (tipo in ('recibe','alimenta','descarga')),
  created_at timestamptz not null default now(),
  unique (bajante_origen_id, bajante_destino_id, tipo)
);
create index idx_cf_bajante_conexiones_origen on public.cf_bajante_conexiones(bajante_origen_id);
create index idx_cf_bajante_conexiones_destino on public.cf_bajante_conexiones(bajante_destino_id);
create index idx_cf_bajante_conexiones_user on public.cf_bajante_conexiones(user_id);

create table public.cf_planos_areas (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.cf_planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  pts jsonb not null default '[]'::jsonb,
  color text,
  label text,
  label_x numeric,
  label_y numeric,
  label_angle numeric,
  label_moved boolean default false,
  area_m2 numeric,
  net text references public.cf_redes(id),
  -- Altura del sector de rejillas (NTC 3631).
  altura_m numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_cf_planos_areas_plano_id on public.cf_planos_areas(plano_id);
create index idx_cf_planos_areas_net on public.cf_planos_areas(net);
create index idx_cf_planos_areas_user on public.cf_planos_areas(user_id);

create table public.cf_planos_dimensiones (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.cf_planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  x1 numeric not null,
  y1 numeric not null,
  x2 numeric not null,
  y2 numeric not null,
  l numeric,
  lbl_x numeric,
  lbl_y numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_cf_planos_dimensiones_plano_id on public.cf_planos_dimensiones(plano_id);
create index idx_cf_planos_dimensiones_user on public.cf_planos_dimensiones(user_id);

create table public.cf_planos_anotaciones_texto (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.cf_planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  x numeric not null,
  y numeric not null,
  text text,
  font_mm numeric,
  box_w numeric,
  lbl_off_x numeric,
  lbl_off_y numeric,
  text_angle numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_cf_planos_anotaciones_texto_plano_id on public.cf_planos_anotaciones_texto(plano_id);
create index idx_cf_planos_anotaciones_texto_user on public.cf_planos_anotaciones_texto(user_id);

create table public.cf_planos_lineas_guia (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.cf_planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  net text references public.cf_redes(id),
  pts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_cf_planos_lineas_guia_plano_id on public.cf_planos_lineas_guia(plano_id);
create index idx_cf_planos_lineas_guia_net on public.cf_planos_lineas_guia(net);
create index idx_cf_planos_lineas_guia_user on public.cf_planos_lineas_guia(user_id);

-- Fantasmas entre pisos (marcadores de bajantes de otro nivel).
create table public.cf_planos_fantasmas_entrepisos (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.cf_planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  id_cliente text not null,
  red text references public.cf_redes(id),
  codigo text,
  x numeric not null,
  y numeric not null,
  d_nominal text,
  direccion text check (direccion in ('sube','baja')),
  direccion_padre text check (direccion_padre in ('sube','baja')),
  piso text,
  plano_origen_id bigint references public.cf_planos(id) on delete cascade,
  bajante_origen_id text,
  bajante_destino_id text,
  -- Layout de la asociación (2 = fantasma+Ldesvio en piso inferior).
  layout int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, id_cliente)
);
create index idx_cf_planos_fantasmas_entrepisos_plano_id on public.cf_planos_fantasmas_entrepisos(plano_id);
create index idx_cf_planos_fantasmas_entrepisos_red on public.cf_planos_fantasmas_entrepisos(red);
create index idx_cf_planos_fantasmas_entrepisos_plano_origen on public.cf_planos_fantasmas_entrepisos(plano_origen_id);
create index idx_cf_planos_fantasmas_entrepisos_user on public.cf_planos_fantasmas_entrepisos(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6 · RPCS DE LECTURA
-- ═══════════════════════════════════════════════════════════════════════════════
-- security invoker: RLS owner/empresa filtra las filas; el RPC solo arma el jsonb.

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
      from public.cf_planos_ramales r where r.plano_id = p_plano_id
    ), '[]'::jsonb),
    'bajantes', coalesce((
      select jsonb_agg(to_jsonb(b) - 'id' - 'plano_id' - 'user_id' order by b.id)
      from public.cf_planos_bajantes b where b.plano_id = p_plano_id
    ), '[]'::jsonb),
    'areas', coalesce((
      select jsonb_agg(to_jsonb(a) - 'id' - 'plano_id' - 'user_id' order by a.id)
      from public.cf_planos_areas a where a.plano_id = p_plano_id
    ), '[]'::jsonb),
    'dimensiones', coalesce((
      select jsonb_agg(to_jsonb(d) - 'id' - 'plano_id' - 'user_id' order by d.id)
      from public.cf_planos_dimensiones d where d.plano_id = p_plano_id
    ), '[]'::jsonb),
    'anotaciones_texto', coalesce((
      select jsonb_agg(to_jsonb(t) - 'id' - 'plano_id' - 'user_id' order by t.id)
      from public.cf_planos_anotaciones_texto t where t.plano_id = p_plano_id
    ), '[]'::jsonb),
    'lineas_guia', coalesce((
      select jsonb_agg(to_jsonb(g) - 'id' - 'plano_id' - 'user_id' order by g.id)
      from public.cf_planos_lineas_guia g where g.plano_id = p_plano_id
    ), '[]'::jsonb),
    'fantasmas_entrepisos', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'plano_id' - 'user_id' order by c.id)
      from public.cf_planos_fantasmas_entrepisos c where c.plano_id = p_plano_id
    ), '[]'::jsonb),
    'bajante_conexiones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'origen_client_id', bo.client_id,
        'destino_client_id', bd.client_id,
        'tipo', bc.tipo
      ) order by bc.id)
      from public.cf_bajante_conexiones bc
      join public.cf_planos_bajantes bo on bo.id = bc.bajante_origen_id
      join public.cf_planos_bajantes bd on bd.id = bc.bajante_destino_id
      where bo.plano_id = p_plano_id or bd.plano_id = p_plano_id
    ), '[]'::jsonb)
  )
  from public.cf_planos pl
  where pl.id = p_plano_id;
$$;

create or replace function public.get_proyecto_data(p_proyecto_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'proyecto_general', (
      select to_jsonb(pg) - 'proyecto_id' - 'user_id'
      from public.cf_proyecto_general pg where pg.proyecto_id = p_proyecto_id
    ),
    'pisos', coalesce((
      select jsonb_agg(to_jsonb(p) - 'proyecto_id' - 'user_id' order by p.n)
      from public.cf_pisos p where p.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'materiales', coalesce((
      select jsonb_object_agg(categoria, items) from (
        select categoria, jsonb_agg(jsonb_build_object('id', client_id, 'val', val) order by orden) as items
        from public.cf_materiales_proyecto where proyecto_id = p_proyecto_id
        group by categoria
      ) m
    ), '{}'::jsonb),
    'profundidades', coalesce((
      select jsonb_agg(to_jsonb(pr) - 'id' - 'proyecto_id' - 'user_id' order by pr.orden)
      from public.cf_profundidades_proyecto pr where pr.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'criterios', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'proyecto_id' - 'user_id' order by c.orden)
      from public.cf_criterios_proyecto c where c.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'gas_datos', (
      select to_jsonb(gd) - 'proyecto_id' - 'user_id'
      from public.cf_gas_datos_proyecto gd where gd.proyecto_id = p_proyecto_id
    ),
    'ep_datos', (
      select to_jsonb(ep) - 'proyecto_id' - 'user_id'
      from public.cf_ep_datos_proyecto ep where ep.proyecto_id = p_proyecto_id
    ),
    'bomba_datos', (
      select to_jsonb(b) - 'proyecto_id' - 'user_id'
      from public.cf_bomba_datos_proyecto b where b.proyecto_id = p_proyecto_id
    ),
    'anulaciones_bajantes_pluviales', coalesce((
      select jsonb_agg(to_jsonb(r) - 'id' - 'proyecto_id' - 'user_id' order by r.id)
      from public.cf_anulaciones_bajantes_pluviales r where r.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'anulaciones_canales_pluviales', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'proyecto_id' - 'user_id' order by c.id)
      from public.cf_anulaciones_canales_pluviales c where c.proyecto_id = p_proyecto_id
    ), '[]'::jsonb),
    'planos_meta', coalesce((
      select jsonb_agg(to_jsonb(pl) - 'proyecto_id' - 'user_id' - 'piso_id' order by pl.id)
      from public.cf_planos pl where pl.proyecto_id = p_proyecto_id
    ), '[]'::jsonb)
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7 · RPCS DE ESCRITURA (wrapper con candado → *_impl con validación)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Patrón uniforme: el WRAPPER verifica sesión + acceso_modulo(uid,'flow') y delega;
-- el IMPL (security definer, revocado para clientes) valida propiedad/estructura/caps
-- y escribe en una transacción. Los guards de propiedad aceptan también MIEMBROS con
-- escritura vigente (empresa_escritura(owner,'flow')).

-- ── save_plano_data: header + colecciones del dibujo + rebuild de conexiones ──
create or replace function public.save_plano_data(p_plano_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_plano_data_impl(p_plano_id, p_data);
end;
$$;

create or replace function public.save_plano_data_impl(p_plano_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  proy_id uuid;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_data is null then raise exception 'payload_requerido'; end if;
  proy_id := (p_data #>> '{header,proyecto_id}')::uuid;
  if proy_id is null then raise exception 'proyecto_requerido'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = proy_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  if exists (select 1 from public.cf_planos pl
             where pl.id = p_plano_id
               and (pl.user_id <> uid and not public.empresa_escritura(pl.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  -- Caps anti-abuso (holgados, muy por encima de lo real)
  if jsonb_array_length(coalesce(p_data->'ramales','[]'::jsonb)) > 6000 then raise exception 'demasiados_ramales'; end if;
  if jsonb_array_length(coalesce(p_data->'bajantes','[]'::jsonb)) > 3000 then raise exception 'demasiados_bajantes'; end if;
  if jsonb_array_length(coalesce(p_data->'areas','[]'::jsonb)) > 2000 then raise exception 'demasiadas_areas'; end if;
  if jsonb_array_length(coalesce(p_data->'dimensiones','[]'::jsonb)) > 2000 then raise exception 'demasiadas_dimensiones'; end if;
  if jsonb_array_length(coalesce(p_data->'anotaciones_texto','[]'::jsonb)) > 2000 then raise exception 'demasiadas_anotaciones'; end if;
  if jsonb_array_length(coalesce(p_data->'lineas_guia','[]'::jsonb)) > 2000 then raise exception 'demasiadas_lineas_guia'; end if;
  if jsonb_array_length(coalesce(p_data->'fantasmas_entrepisos','[]'::jsonb)) > 3000 then raise exception 'demasiados_ghosts'; end if;

  -- Header del plano (upsert parcial; name/nivel/scale/status son de save_planos_meta).
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

  -- Ramales: reemplazo completo (destructivo por diseño; el cliente manda TODO el piso).
  delete from public.cf_planos_ramales where plano_id = p_plano_id;
  insert into public.cf_planos_ramales (plano_id, user_id, client_id, net, tipo, padre, pts, total_l, label, ini, fin, piso, dz, uc, label_x, label_y, label_angle, label_moved, material, diametro, pendiente, bloqueado, accesorio_inicio, accesorio_fin, diametro_inicio, diametro_fin, aparato_inicio, aparato_fin, n_salidas, diam_pulg, trib_reversed, acc_med, caudal, lvert, merges_from, sifon_label_ini, sifon_label_fin, fixtures, hydro_accesorios, gas_accesorios, show_length, show_name, show_guide, show_flow_dir, show_mat_diam_pend, yee_doble, copia_piso, sin_acc_med_interior, es_canal_id)
  select p_plano_id, uid, r.client_id, r.net, r.tipo, r.padre, coalesce(r.pts, '[]'::jsonb), r.total_l, r.label, r.ini, r.fin, r.piso, r.dz, r.uc, r.label_x, r.label_y, r.label_angle, coalesce(r.label_moved, false), r.material, r.diametro, r.pendiente, coalesce(r.bloqueado, false), r.accesorio_inicio, r.accesorio_fin, r.diametro_inicio, r.diametro_fin, r.aparato_inicio, r.aparato_fin, r.n_salidas, r.diam_pulg, r.trib_reversed, r.acc_med, r.caudal, r.lvert, r.merges_from, r.sifon_label_ini, r.sifon_label_fin, coalesce(r.fixtures, '{}'::jsonb), coalesce(r.hydro_accesorios, '{}'::jsonb), coalesce(r.gas_accesorios, '{}'::jsonb), coalesce(r.show_length, true), coalesce(r.show_name, true), coalesce(r.show_guide, true), coalesce(r.show_flow_dir, true), coalesce(r.show_mat_diam_pend, true), r.yee_doble, coalesce(r.copia_piso, false), coalesce(r.sin_acc_med_interior, false), r.es_canal_id
  from jsonb_populate_recordset(null::public.cf_planos_ramales, coalesce(p_data->'ramales','[]'::jsonb)) r;

  -- Bajantes: upsert por (plano_id, client_id) preservando ids sustitutos + poda.
  create temp table _baj_map on commit drop as
  with ins as (
    insert into public.cf_planos_bajantes (plano_id, user_id, client_id, net, tipo, code, x, y, piso_base, piso_cima, npt_base, npt_cima, h_vert, d_nominal, uc_acum, uc_extra, area_m2, desplazamientos, lbl_off_x, lbl_off_y, label_angle, label_x, label_y, label_moved, direccion, aparato, total_l, pendiente, piso, baj_r, ghost_data, is_fantasma, diam_pulg, diametro, aco_diam, capacidad, base, altura, canal_id, descarga_en_id, origen_id, caja_origen_id, bomba_en_id, fixtures, uc_aplicado, uc_aplicado_hidro, factor_sim, longitud, copia_piso, copiado_de_plan, copiado_de_id, bajante_externo_id, angulo, canal_flow_dir)
    select p_plano_id, uid, r.client_id, r.net, r.tipo, r.code, coalesce(r.x, 0), coalesce(r.y, 0), r.piso_base, r.piso_cima, r.npt_base, r.npt_cima, r.h_vert, r.d_nominal, r.uc_acum, r.uc_extra, r.area_m2, coalesce(r.desplazamientos, '{}'::jsonb), r.lbl_off_x, r.lbl_off_y, r.label_angle, r.label_x, r.label_y, coalesce(r.label_moved, false), r.direccion, r.aparato, r.total_l, r.pendiente, r.piso, r.baj_r, r.ghost_data, coalesce(r.is_fantasma, false), r.diam_pulg, r.diametro, r.aco_diam, r.capacidad, r.base, r.altura, r.canal_id, r.descarga_en_id, r.origen_id, r.caja_origen_id, r.bomba_en_id, coalesce(r.fixtures, '{}'::jsonb), r.uc_aplicado, r.uc_aplicado_hidro, r.factor_sim, r.longitud, coalesce(r.copia_piso, false), r.copiado_de_plan, r.copiado_de_id, r.bajante_externo_id, r.angulo, r.canal_flow_dir
    from jsonb_populate_recordset(null::public.cf_planos_bajantes, coalesce(p_data->'bajantes','[]'::jsonb)) r
    on conflict (plano_id, client_id) do update set
      net = excluded.net, tipo = excluded.tipo, code = excluded.code, x = excluded.x, y = excluded.y, piso_base = excluded.piso_base, piso_cima = excluded.piso_cima, npt_base = excluded.npt_base, npt_cima = excluded.npt_cima, h_vert = excluded.h_vert, d_nominal = excluded.d_nominal, uc_acum = excluded.uc_acum, uc_extra = excluded.uc_extra, area_m2 = excluded.area_m2, desplazamientos = excluded.desplazamientos, lbl_off_x = excluded.lbl_off_x, lbl_off_y = excluded.lbl_off_y, label_angle = excluded.label_angle, label_x = excluded.label_x, label_y = excluded.label_y, label_moved = excluded.label_moved, direccion = excluded.direccion, aparato = excluded.aparato, total_l = excluded.total_l, pendiente = excluded.pendiente, piso = excluded.piso, baj_r = excluded.baj_r, ghost_data = excluded.ghost_data, is_fantasma = excluded.is_fantasma, diam_pulg = excluded.diam_pulg, diametro = excluded.diametro, aco_diam = excluded.aco_diam, capacidad = excluded.capacidad, base = excluded.base, altura = excluded.altura, canal_id = excluded.canal_id, descarga_en_id = excluded.descarga_en_id, origen_id = excluded.origen_id, caja_origen_id = excluded.caja_origen_id, bomba_en_id = excluded.bomba_en_id, fixtures = excluded.fixtures, uc_aplicado = excluded.uc_aplicado, uc_aplicado_hidro = excluded.uc_aplicado_hidro, factor_sim = excluded.factor_sim, longitud = excluded.longitud, copia_piso = excluded.copia_piso, copiado_de_plan = excluded.copiado_de_plan, copiado_de_id = excluded.copiado_de_id, bajante_externo_id = excluded.bajante_externo_id, angulo = excluded.angulo, canal_flow_dir = excluded.canal_flow_dir, updated_at = now()
    returning id, client_id)
  select client_id, id from ins;

  delete from public.cf_planos_bajantes where plano_id = p_plano_id and client_id not in (select client_id from _baj_map);

  delete from public.cf_planos_areas where plano_id = p_plano_id;
  insert into public.cf_planos_areas (plano_id, user_id, client_id, pts, color, label, label_x, label_y, label_angle, label_moved, area_m2, net, altura_m)
  select p_plano_id, uid, r.client_id, coalesce(r.pts, '[]'::jsonb), r.color, r.label, r.label_x, r.label_y, r.label_angle, coalesce(r.label_moved, false), r.area_m2, r.net, r.altura_m
  from jsonb_populate_recordset(null::public.cf_planos_areas, coalesce(p_data->'areas','[]'::jsonb)) r;

  delete from public.cf_planos_dimensiones where plano_id = p_plano_id;
  insert into public.cf_planos_dimensiones (plano_id, user_id, client_id, x1, y1, x2, y2, l, lbl_x, lbl_y)
  select p_plano_id, uid, r.client_id, coalesce(r.x1, 0), coalesce(r.y1, 0), coalesce(r.x2, 0), coalesce(r.y2, 0), coalesce(r.l, 0), r.lbl_x, r.lbl_y
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
  insert into public.cf_planos_fantasmas_entrepisos (plano_id, user_id, id_cliente, red, codigo, x, y, d_nominal, direccion, direccion_padre, piso, plano_origen_id, bajante_origen_id, bajante_destino_id, layout)
  select p_plano_id, uid, r.id_cliente, r.red, r.codigo, coalesce(r.x, 0), coalesce(r.y, 0), r.d_nominal, r.direccion, r.direccion_padre, r.piso, r.plano_origen_id, r.bajante_origen_id, r.bajante_destino_id, r.layout
  from jsonb_populate_recordset(null::public.cf_planos_fantasmas_entrepisos, coalesce(p_data->'fantasmas_entrepisos','[]'::jsonb)) r;

  -- Rebuild de conexiones: elimina las que tocan bajantes de ESTE plano y las recrea
  -- desde recibe_de_ids/alimenta_ids/descarga_en_id del payload (cross-plano no resuelve
  -- contra _baj_map → se omite, igual que en el cliente).
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

-- ── save_proyecto_core: proyecto_general + pisos + materiales + profundidades + criterios ──
create or replace function public.save_proyecto_core(p_proyecto_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_proyecto_core_impl(p_proyecto_id, p_data);
end;
$$;

create or replace function public.save_proyecto_core_impl(p_proyecto_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = p_proyecto_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_data->'pisos','[]'::jsonb)) > 100 then raise exception 'demasiados_pisos'; end if;
  if (select coalesce(sum(jsonb_array_length(v.value)), 0) from jsonb_each(coalesce(p_data->'mats','{}'::jsonb)) v) > 1000 then raise exception 'demasiados_materiales'; end if;
  if jsonb_array_length(coalesce(p_data->'profs','[]'::jsonb)) > 500 then raise exception 'demasiadas_profundidades'; end if;
  if jsonb_array_length(coalesce(p_data->'crits','[]'::jsonb)) > 500 then raise exception 'demasiados_criterios'; end if;
  -- Tomba anti-vaciado: un core con 0 pisos sobre un proyecto que sí tiene = defecto de origen.
  if jsonb_array_length(coalesce(p_data->'pisos','[]'::jsonb)) = 0
     and exists (select 1 from public.cf_pisos where proyecto_id = p_proyecto_id) then
    raise exception 'pisos_vacios_no_permitidos';
  end if;
  if p_data ? 'proyecto_general' then
    insert into public.cf_proyecto_general (proyecto_id, user_id, nombre, dir, ciudad, pais, uso, empresa, p_red, dot, mat_af, mat_ac, mat_rci, mat_san, mat_ll, mat_ven, mat_gas, altitud, p_atm, pobl_fija, pobl_flot, area_piscina, area_verdes, c_escorrentia, pendiente_san, updated_at)
    select p_proyecto_id, uid, r.nombre, r.dir, r.ciudad, r.pais, r.uso, r.empresa, r.p_red, r.dot, r.mat_af, r.mat_ac, r.mat_rci, r.mat_san, r.mat_ll, r.mat_ven, r.mat_gas, r.altitud, r.p_atm, r.pobl_fija, r.pobl_flot, r.area_piscina, r.area_verdes, r.c_escorrentia, r.pendiente_san, now()
    from jsonb_populate_recordset(null::public.cf_proyecto_general, jsonb_build_array(p_data->'proyecto_general')) r
    on conflict (proyecto_id) do update set
      nombre = excluded.nombre, dir = excluded.dir, ciudad = excluded.ciudad, pais = excluded.pais, uso = excluded.uso, empresa = excluded.empresa, p_red = excluded.p_red, dot = excluded.dot, mat_af = excluded.mat_af, mat_ac = excluded.mat_ac, mat_rci = excluded.mat_rci, mat_san = excluded.mat_san, mat_ll = excluded.mat_ll, mat_ven = excluded.mat_ven, mat_gas = excluded.mat_gas, altitud = excluded.altitud, p_atm = excluded.p_atm, pobl_fija = excluded.pobl_fija, pobl_flot = excluded.pobl_flot, area_piscina = excluded.area_piscina, area_verdes = excluded.area_verdes, c_escorrentia = excluded.c_escorrentia, pendiente_san = excluded.pendiente_san, updated_at = now();
  end if;
  delete from public.cf_pisos where proyecto_id = p_proyecto_id;
  insert into public.cf_pisos (proyecto_id, user_id, n, npt, ok, tipo, h)
  select p_proyecto_id, uid, r.n, r.npt, coalesce(r.ok, false), r.tipo, r.h
  from jsonb_populate_recordset(null::public.cf_pisos, coalesce(p_data->'pisos','[]'::jsonb)) r;
  delete from public.cf_materiales_proyecto where proyecto_id = p_proyecto_id;
  insert into public.cf_materiales_proyecto (proyecto_id, user_id, categoria, client_id, val, orden)
  select p_proyecto_id, uid, m.categoria, it.item->>'id', it.item->>'val', it.orden
  from jsonb_each(coalesce(p_data->'mats','{}'::jsonb)) as m(categoria, items)
  cross join lateral jsonb_array_elements(m.items) with ordinality as it(item, orden);
  delete from public.cf_profundidades_proyecto where proyecto_id = p_proyecto_id;
  insert into public.cf_profundidades_proyecto (proyecto_id, user_id, client_id, red, col, prof, norma, nota, orden)
  select p_proyecto_id, uid, r.client_id, r.red, r.col, r.prof, r.norma, r.nota, coalesce(r.orden, 0)
  from jsonb_populate_recordset(null::public.cf_profundidades_proyecto, coalesce(p_data->'profs','[]'::jsonb)) r;
  delete from public.cf_criterios_proyecto where proyecto_id = p_proyecto_id;
  insert into public.cf_criterios_proyecto (proyecto_id, user_id, client_id, red, param, val, uni, norma, art, cumple, nota, orden)
  select p_proyecto_id, uid, r.client_id, r.red, r.param, r.val, r.uni, r.norma, r.art, r.cumple, r.nota, coalesce(r.orden, 0)
  from jsonb_populate_recordset(null::public.cf_criterios_proyecto, coalesce(p_data->'crits','[]'::jsonb)) r;
end;
$$;

-- ── save_planos_meta: reemplazo de metadatos (blindado: lista vacía = no-op) ──
create or replace function public.save_planos_meta(p_proyecto_id uuid, p_planos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_planos_meta_impl(p_proyecto_id, p_planos);
end;
$$;

create or replace function public.save_planos_meta_impl(p_proyecto_id uuid, p_planos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = p_proyecto_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_planos,'[]'::jsonb)) > 500 then raise exception 'demasiados_planos'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_planos,'[]'::jsonb)) x
             join public.cf_planos pl on pl.id = (x->>'id')::bigint
             where pl.user_id <> uid) then
    raise exception 'no_autorizado';
  end if;
  -- Lista vacía = no-op (un fallo de carga no debe vaciar cf_planos; incidente 2026-09-18).
  if p_planos is null or jsonb_array_length(p_planos) = 0 then
    return;
  end if;
  delete from public.cf_planos pl
  where pl.proyecto_id = p_proyecto_id
    and pl.id not in (select (x->>'id')::bigint from jsonb_array_elements(p_planos) x);
  insert into public.cf_planos (id, proyecto_id, user_id, name, nivel, scale, status, origen_x_px, origen_y_px, factor_x, factor_y, cal_global, defined_scale, updated_at)
  select r.id, p_proyecto_id, uid, coalesce(r.name, ''), r.nivel, r.scale, coalesce(r.status, 'pending'), r.origen_x_px, r.origen_y_px, r.factor_x, r.factor_y, r.cal_global, r.defined_scale, now()
  from jsonb_populate_recordset(null::public.cf_planos, p_planos) r
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id, name = excluded.name, nivel = excluded.nivel, scale = excluded.scale, status = excluded.status, origen_x_px = excluded.origen_x_px, origen_y_px = excluded.origen_y_px, factor_x = excluded.factor_x, factor_y = excluded.factor_y, cal_global = excluded.cal_global, defined_scale = excluded.defined_scale, updated_at = now();
end;
$$;

-- ── delete_plano_meta: borra UN plano (y cascada sus colecciones) ──
create or replace function public.delete_plano_meta(p_plano_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.delete_plano_meta_impl(p_plano_id);
end;
$$;

create or replace function public.delete_plano_meta_impl(p_plano_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  delete from public.cf_planos where id = p_plano_id and user_id = uid;
end;
$$;

-- ── Campos 1:1 por proyecto (upserts parciales) ─────────────────────────────

create or replace function public.save_redes_activas(p_proyecto_id uuid, p_redes text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_redes_activas_impl(p_proyecto_id, p_redes);
end;
$$;

create or replace function public.save_redes_activas_impl(p_proyecto_id uuid, p_redes text[])
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = p_proyecto_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_proyecto_general (proyecto_id, user_id, redes_activas, updated_at)
  values (p_proyecto_id, uid, p_redes, now())
  on conflict (proyecto_id) do update set redes_activas = excluded.redes_activas, updated_at = now();
end;
$$;

create or replace function public.save_gas_datos(p_proyecto_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_gas_datos_impl(p_proyecto_id, p_datos);
end;
$$;

create or replace function public.save_gas_datos_impl(p_proyecto_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = p_proyecto_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_gas_datos_proyecto (proyecto_id, user_id, altitud, presion_atm, temperatura, presion_min, densidad_relativa, updated_at)
  select p_proyecto_id, uid, r.altitud, r.presion_atm, r.temperatura, r.presion_min, r.densidad_relativa, now()
  from jsonb_populate_recordset(null::public.cf_gas_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    altitud = excluded.altitud, presion_atm = excluded.presion_atm, temperatura = excluded.temperatura, presion_min = excluded.presion_min, densidad_relativa = excluded.densidad_relativa, updated_at = now();
end;
$$;

create or replace function public.save_ep_datos(p_proyecto_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_ep_datos_impl(p_proyecto_id, p_datos);
end;
$$;

create or replace function public.save_ep_datos_impl(p_proyecto_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = p_proyecto_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_ep_datos_proyecto (proyecto_id, user_id, qac, qasc, hfac, hfacs, hfotros, pred, pmin, pmax, zbomba, ztop, zcis, hfcis, nt, nr, etab, etam, fs, ciclos, alfa, vsuc, vimp, dnsuc, dnimp, pcomercial, modo, dot_l, n_usuarios, dias_aut, bci_l, patm, pv, npshr, updated_at)
  select p_proyecto_id, uid, r.qac, r.qasc, r.hfac, r.hfacs, r.hfotros, r.pred, r.pmin, r.pmax, r.zbomba, r.ztop, r.zcis, r.hfcis, r.nt, r.nr, r.etab, r.etam, r.fs, r.ciclos, r.alfa, r.vsuc, r.vimp, r.dnsuc, r.dnimp, r.pcomercial, r.modo, r.dot_l, r.n_usuarios, r.dias_aut, r.bci_l, r.patm, r.pv, r.npshr, now()
  from jsonb_populate_recordset(null::public.cf_ep_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    qac = excluded.qac, qasc = excluded.qasc, hfac = excluded.hfac, hfacs = excluded.hfacs, hfotros = excluded.hfotros, pred = excluded.pred, pmin = excluded.pmin, pmax = excluded.pmax, zbomba = excluded.zbomba, ztop = excluded.ztop, zcis = excluded.zcis, hfcis = excluded.hfcis, nt = excluded.nt, nr = excluded.nr, etab = excluded.etab, etam = excluded.etam, fs = excluded.fs, ciclos = excluded.ciclos, alfa = excluded.alfa, vsuc = excluded.vsuc, vimp = excluded.vimp, dnsuc = excluded.dnsuc, dnimp = excluded.dnimp, pcomercial = excluded.pcomercial, modo = excluded.modo, dot_l = excluded.dot_l, n_usuarios = excluded.n_usuarios, dias_aut = excluded.dias_aut, bci_l = excluded.bci_l, patm = excluded.patm, pv = excluded.pv, npshr = excluded.npshr, updated_at = now();
end;
$$;

create or replace function public.save_bomba_datos(p_proyecto_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_bomba_datos_impl(p_proyecto_id, p_datos);
end;
$$;

create or replace function public.save_bomba_datos_impl(p_proyecto_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = p_proyecto_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_bomba_datos_proyecto (proyecto_id, user_id, sal_sim, ud_tot, hz, l_imp, d_imp, c_hw, p_desc, eta_b, f_srv, t_cic, h_min, h_max, b_cam, l_cam, npsh, tipo_tuberia, bombas, updated_at)
  select p_proyecto_id, uid, r.sal_sim, r.ud_tot, r.hz, r.l_imp, r.d_imp, r.c_hw, r.p_desc, r.eta_b, r.f_srv, r.t_cic, r.h_min, r.h_max, r.b_cam, r.l_cam, r.npsh, r.tipo_tuberia, r.bombas, now()
  from jsonb_populate_recordset(null::public.cf_bomba_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    sal_sim = excluded.sal_sim, ud_tot = excluded.ud_tot, hz = excluded.hz, l_imp = excluded.l_imp, d_imp = excluded.d_imp, c_hw = excluded.c_hw, p_desc = excluded.p_desc, eta_b = excluded.eta_b, f_srv = excluded.f_srv, t_cic = excluded.t_cic, h_min = excluded.h_min, h_max = excluded.h_max, b_cam = excluded.b_cam, l_cam = excluded.l_cam, npsh = excluded.npsh, tipo_tuberia = excluded.tipo_tuberia, bombas = excluded.bombas, updated_at = now();
end;
$$;

create or replace function public.save_rainwater_overrides(p_proyecto_id uuid, p_bajantes jsonb, p_canales jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_rainwater_overrides_impl(p_proyecto_id, p_bajantes, p_canales);
end;
$$;

create or replace function public.save_rainwater_overrides_impl(p_proyecto_id uuid, p_bajantes jsonb, p_canales jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = p_proyecto_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_bajantes,'[]'::jsonb)) > 1000 then raise exception 'demasiados_overrides_bajantes'; end if;
  if jsonb_array_length(coalesce(p_canales,'[]'::jsonb)) > 1000 then raise exception 'demasiados_overrides_canales'; end if;
  delete from public.cf_anulaciones_bajantes_pluviales where proyecto_id = p_proyecto_id;
  insert into public.cf_anulaciones_bajantes_pluviales (proyecto_id, user_id, id_cliente, bajante, area_parcial, area_otras, area_acumulada, intensidad, coeficiente_c, material_cubierta, R, manning, diam_propuesto)
  select p_proyecto_id, uid, r.id_cliente, r.bajante, coalesce(r.area_parcial, 0), coalesce(r.area_otras, 0), coalesce(r.area_acumulada, 0), coalesce(r.intensidad, 100), coalesce(r.coeficiente_c, 0.0278), coalesce(r.material_cubierta, ''), coalesce(r.R, ''), coalesce(r.manning, 0), coalesce(r.diam_propuesto, 0)
  from jsonb_populate_recordset(null::public.cf_anulaciones_bajantes_pluviales, coalesce(p_bajantes,'[]'::jsonb)) r;
  delete from public.cf_anulaciones_canales_pluviales where proyecto_id = p_proyecto_id;
  insert into public.cf_anulaciones_canales_pluviales (proyecto_id, user_id, id_cliente, sector, area_parcial, area_otras, area_acumulada, intensidad, coeficiente_c, material_cubierta, material_canal, muro_vertical, borde_libre_cm, manning, pendiente, b, h)
  select p_proyecto_id, uid, r.id_cliente, r.sector, coalesce(r.area_parcial, 0), coalesce(r.area_otras, 0), coalesce(r.area_acumulada, 0), coalesce(r.intensidad, 100), coalesce(r.coeficiente_c, 0.0278), coalesce(r.material_cubierta, ''), coalesce(r.material_canal, ''), coalesce(r.muro_vertical, 0), coalesce(r.borde_libre_cm, 10), coalesce(r.manning, 0.011), coalesce(r.pendiente, 0), coalesce(r.b, 0), coalesce(r.h, 0)
  from jsonb_populate_recordset(null::public.cf_anulaciones_canales_pluviales, coalesce(p_canales,'[]'::jsonb)) r;
end;
$$;

-- Campo suelto de cf_proyecto_general (lista blanca; rejillas viaja como jsonb en text).
create or replace function public.save_proyecto_general_campo(
  p_proyecto_id uuid,
  p_campo text,
  p_valor text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  if not exists (select 1 from public.cf_proyectos p
                 where p.id = p_proyecto_id
                   and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))) then
    raise exception 'no_autorizado';
  end if;
  if p_campo not in ('af_alimentacion', 'tanque_npt', 'presion_garantizada', 'rejillas') then
    raise exception 'campo_no_permitido';
  end if;
  insert into public.cf_proyecto_general (proyecto_id, user_id, nombre, updated_at)
  values (p_proyecto_id, uid, '', now())
  on conflict (proyecto_id) do nothing;
  if p_campo = 'rejillas' then
    execute format(
      'update public.cf_proyecto_general set %I = $1::jsonb, updated_at = now() where proyecto_id = $2',
      p_campo
    ) using p_valor, p_proyecto_id;
  else
    execute format(
      'update public.cf_proyecto_general set %I = $1, updated_at = now() where proyecto_id = $2',
      p_campo
    ) using p_valor, p_proyecto_id;
  end if;
end;
$$;

-- ── CRUD de proyectos (ciclo de vida: SOLO el dueño) ────────────────────────

create or replace function public.save_proyecto(p_codigo text, p_nombre text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
  v_proyecto public.cf_proyectos%rowtype;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  if p_codigo is null or btrim(p_codigo) = '' then raise exception 'codigo_requerido'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_codigo) > 50 or char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;
  insert into public.cf_proyectos (user_id, codigo, nombre)
  values (uid, btrim(p_codigo), btrim(p_nombre))
  returning * into v_proyecto;
  return to_jsonb(v_proyecto);
end;
$$;

create or replace function public.update_proyecto_nombre(p_id uuid, p_nombre text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;
  update public.cf_proyectos set nombre = btrim(p_nombre)
  where id = p_id and user_id = uid;
  if not found then raise exception 'no_autorizado'; end if;
end;
$$;

create or replace function public.delete_proyecto(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  delete from public.cf_proyectos where id = p_id and user_id = uid;
  if not found then raise exception 'no_autorizado'; end if;
end;
$$;

-- ── Perfil / colores / catálogo de aparatos (ámbito usuario, sin impl) ───────

create or replace function public.save_perfil(p_perfil jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  insert into public.cf_perfiles (id, nombre, apellido, email, profesion, matricula, telefono, updated_at)
  select uid, r.nombre, r.apellido, r.email, r.profesion, r.matricula, r.telefono, now()
  from jsonb_populate_recordset(null::public.cf_perfiles, jsonb_build_array(coalesce(p_perfil,'{}'::jsonb))) r
  on conflict (id) do update set
    nombre = excluded.nombre, apellido = excluded.apellido, email = excluded.email,
    profesion = excluded.profesion, matricula = excluded.matricula,
    telefono = excluded.telefono, updated_at = now();
end;
$$;

create or replace function public.save_net_colors(p_colors jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_colors is null then raise exception 'payload_requerido'; end if;
  insert into public.cf_perfiles (id, net_colors, updated_at)
  values (uid, p_colors, now())
  on conflict (id) do update set net_colors = excluded.net_colors, updated_at = now();
end;
$$;

create or replace function public.save_aparatos_usuario(p_aps jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if jsonb_array_length(coalesce(p_aps,'[]'::jsonb)) > 1000 then raise exception 'demasiados_aparatos'; end if;
  delete from public.cf_aparatos_usuario where user_id = uid;
  insert into public.cf_aparatos_usuario (user_id, client_id, s, n, g, ucaf, ucac, ud, pmin, pmax, qg, ctrl, blk_ud)
  select uid, r.client_id, r.s, r.n, r.g, r.ucaf, r.ucac, r.ud, r.pmin, r.pmax, r.qg, r.ctrl, coalesce(r.blk_ud, false)
  from jsonb_populate_recordset(null::public.cf_aparatos_usuario, coalesce(p_aps,'[]'::jsonb)) r;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8 · TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Crea la fila de perfil al registrarse un usuario (tabla + meta del signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cf_perfiles (
    id, email, nombre, apellido, profesion, matricula, telefono
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'nombre', ''),
    nullif(new.raw_user_meta_data ->> 'apellido', ''),
    nullif(new.raw_user_meta_data ->> 'profesion', ''),
    nullif(new.raw_user_meta_data ->> 'matricula', ''),
    nullif(new.raw_user_meta_data ->> 'telefono', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Sello de propietario para INSERTs/UPDATEs de MIEMBROS de empresa: si la fila cuelga
-- de un proyecto/plano/bajante cuyo dueño tiene al caller como miembro con escritura,
-- re-sella new.user_id al dueño (el contenido vive en el espacio del dueño).
-- Las casts son ::uuid (cf_proyectos.id es uuid desde 2026-10-05).
create or replace function public.cf_sellar_owner_contenido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_row jsonb := to_jsonb(new);
begin
  if v_row ? 'proyecto_id' then
    select p.user_id into v_owner from public.cf_proyectos p
      where p.id = (v_row->>'proyecto_id')::uuid;
  elsif v_row ? 'plano_id' then
    select p.user_id into v_owner from public.cf_proyectos p
      join public.cf_planos pl on pl.proyecto_id = p.id
      where pl.id = (v_row->>'plano_id')::bigint;
  elsif v_row ? 'bajante_origen_id' then
    select p.user_id into v_owner from public.cf_proyectos p
      join public.cf_planos pl on pl.proyecto_id = p.id
      join public.cf_planos_bajantes b on b.plano_id = pl.id
      where b.id = (v_row->>'bajante_origen_id')::bigint;
  elsif v_row ? 'plano_origen_id' then
    select p.user_id into v_owner from public.cf_proyectos p
      join public.cf_planos pl on pl.proyecto_id = p.id
      where pl.id = (v_row->>'plano_origen_id')::bigint;
  end if;
  if v_owner is not null and new.user_id <> v_owner
     and public.empresa_escritura(v_owner, 'flow') then
    new.user_id := v_owner;
  end if;
  if v_owner is null and (auth.uid() is null or new.user_id <> auth.uid()) then
    raise exception 'sello_sin_owner';
  end if;
  return new;
end;
$$;

revoke all on function public.cf_sellar_owner_contenido() from public, anon, authenticated;

-- Layout por defecto de los fantasmas entre pisos (2 = fantasma+Ldesvio abajo).
create or replace function public.fantasmas_layout_default()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.layout is null then new.layout := 2; end if;
  return new;
end;
$$;

drop trigger if exists fantasmas_layout_default on public.cf_planos_fantasmas_entrepisos;
create trigger fantasmas_layout_default
  before insert on public.cf_planos_fantasmas_entrepisos
  for each row execute function public.fantasmas_layout_default();

-- trg_sellar_owner en las 19 tablas de contenido + catálogo de aparatos por usuario.
do $do$
declare t text;
begin
  foreach t in array array[
    'cf_proyecto_general','cf_pisos','cf_materiales_proyecto','cf_profundidades_proyecto',
    'cf_criterios_proyecto','cf_gas_datos_proyecto','cf_ep_datos_proyecto',
    'cf_bomba_datos_proyecto','cf_anulaciones_bajantes_pluviales',
    'cf_anulaciones_canales_pluviales','cf_planos','cf_planos_ramales','cf_planos_bajantes',
    'cf_planos_areas','cf_planos_dimensiones','cf_planos_anotaciones_texto',
    'cf_planos_lineas_guia','cf_planos_fantasmas_entrepisos','cf_bajante_conexiones'
  ] loop
    execute format('drop trigger if exists trg_sellar_owner on public.%I', t);
    execute format('create trigger trg_sellar_owner before insert or update on public.%I for each row execute function public.cf_sellar_owner_contenido()', t);
  end loop;
end $do$;

drop trigger if exists trg_sellar_owner on public.cf_aparatos_usuario;
create trigger trg_sellar_owner before insert or update on public.cf_aparatos_usuario
  for each row execute function public.cf_sellar_owner_contenido();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9 · RLS DE LAS TABLAS FLOW
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT: dueño o miembro con asiento (empresa_lectura). INSERT/UPDATE: dueño + la fila
-- cuelga de su proyecto/plano (defensa IDOR; las escrituras reales van por RPC con
-- grants de tabla revocados — estas policies son la segunda capa). DELETE: dueño.

-- Per-tabla: tablas por proyecto_id.
do $do$
declare t text;
begin
  foreach t in array array[
    'cf_pisos','cf_proyecto_general','cf_materiales_proyecto','cf_profundidades_proyecto',
    'cf_criterios_proyecto','cf_gas_datos_proyecto','cf_ep_datos_proyecto',
    'cf_bomba_datos_proyecto','cf_anulaciones_bajantes_pluviales','cf_anulaciones_canales_pluviales'
  ] loop
    execute format($q$create policy %I on public.%I for select using (
        (select auth.uid()) = user_id or public.empresa_lectura(user_id, 'flow'))$q$, t || '_propietario_leer', t);
    execute format($q$create policy %I on public.%I for insert with check (
        (select auth.uid()) = user_id
        and exists (select 1 from public.cf_proyectos p where p.id = %I.proyecto_id and p.user_id = (select auth.uid())))$q$,
      t || '_propietario_insertar', t, t);
    execute format($q$create policy %I on public.%I for update using ((select auth.uid()) = user_id) with check (
        (select auth.uid()) = user_id
        and exists (select 1 from public.cf_proyectos p where p.id = %I.proyecto_id and p.user_id = (select auth.uid())))$q$,
      t || '_propietario_actualizar', t, t);
    execute format($q$create policy %I on public.%I for delete using ((select auth.uid()) = user_id)$q$,
      t || '_propietario_eliminar', t);
  end loop;
end $do$;

-- Per-tabla: tablas por plano_id.
do $do$
declare t text;
begin
  foreach t in array array[
    'cf_planos_ramales','cf_planos_bajantes','cf_planos_areas','cf_planos_dimensiones',
    'cf_planos_anotaciones_texto','cf_planos_lineas_guia','cf_planos_fantasmas_entrepisos'
  ] loop
    execute format($q$create policy %I on public.%I for select using (
        (select auth.uid()) = user_id or public.empresa_lectura(user_id, 'flow'))$q$, t || '_propietario_leer', t);
    execute format($q$create policy %I on public.%I for insert with check (
        (select auth.uid()) = user_id
        and exists (select 1 from public.cf_planos pl where pl.id = %I.plano_id and pl.user_id = (select auth.uid())))$q$,
      t || '_propietario_insertar', t, t);
    execute format($q$create policy %I on public.%I for update using ((select auth.uid()) = user_id) with check (
        (select auth.uid()) = user_id
        and exists (select 1 from public.cf_planos pl where pl.id = %I.plano_id and pl.user_id = (select auth.uid())))$q$,
      t || '_propietario_actualizar', t, t);
    execute format($q$create policy %I on public.%I for delete using ((select auth.uid()) = user_id)$q$,
      t || '_propietario_eliminar', t);
  end loop;
end $do$;

-- cf_planos (por proyecto_id).
create policy cf_planos_propietario_leer on public.cf_planos for select using (
  (select auth.uid()) = user_id or public.empresa_lectura(user_id, 'flow'));
create policy cf_planos_propietario_insertar on public.cf_planos for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.cf_proyectos p where p.id = cf_planos.proyecto_id and p.user_id = (select auth.uid())));
create policy cf_planos_propietario_actualizar on public.cf_planos for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.cf_proyectos p where p.id = cf_planos.proyecto_id and p.user_id = (select auth.uid())));
create policy cf_planos_propietario_eliminar on public.cf_planos for delete using ((select auth.uid()) = user_id);

-- cf_bajante_conexiones (sin proyecto propio: las dos bajantes deben ser del dueño).
create policy cf_bajante_conexiones_propietario_leer on public.cf_bajante_conexiones for select using (
  (select auth.uid()) = user_id or public.empresa_lectura(user_id, 'flow'));
create policy cf_bajante_conexiones_propietario_insertar on public.cf_bajante_conexiones for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.cf_planos_bajantes bo where bo.id = cf_bajante_conexiones.bajante_origen_id and bo.user_id = (select auth.uid()))
  and exists (select 1 from public.cf_planos_bajantes bd where bd.id = cf_bajante_conexiones.bajante_destino_id and bd.user_id = (select auth.uid())));
create policy cf_bajante_conexiones_propietario_actualizar on public.cf_bajante_conexiones for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.cf_planos_bajantes bo where bo.id = cf_bajante_conexiones.bajante_origen_id and bo.user_id = (select auth.uid()))
  and exists (select 1 from public.cf_planos_bajantes bd where bd.id = cf_bajante_conexiones.bajante_destino_id and bd.user_id = (select auth.uid())));
create policy cf_bajante_conexiones_propietario_eliminar on public.cf_bajante_conexiones for delete using ((select auth.uid()) = user_id);

-- cf_aparatos_usuario: con acceso de empresa en las 4 operaciones (escritura directa
-- del catálogo compartido; el trigger trg_sellar_owner re-sella al dueño).
drop policy if exists "aparatos_usuario_owner_select" on public.cf_aparatos_usuario;
create policy "aparatos_usuario_owner_select" on public.cf_aparatos_usuario for select
  using ((select auth.uid()) = user_id or public.empresa_lectura(user_id, 'flow'));
create policy "aparatos_usuario_owner_insert" on public.cf_aparatos_usuario for insert
  with check ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'flow'));
create policy "aparatos_usuario_owner_update" on public.cf_aparatos_usuario for update
  using ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'flow'))
  with check ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'flow'));
create policy "aparatos_usuario_owner_delete" on public.cf_aparatos_usuario for delete
  using ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'flow'));

alter table public.cf_proyectos enable row level security;
create policy cf_proyectos_propietario_leer on public.cf_proyectos for select using (
  (select auth.uid()) = user_id or public.empresa_lectura(user_id, 'flow'));
create policy cf_proyectos_propietario_insertar on public.cf_proyectos for insert with check ((select auth.uid()) = user_id);
create policy cf_proyectos_propietario_actualizar on public.cf_proyectos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cf_proyectos_propietario_eliminar on public.cf_proyectos for delete using ((select auth.uid()) = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10 · GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Flow: lecturas directas con RLS; ESCRITURAS solo vía RPC (grants de tabla revocados).

revoke all on table
  public.cf_proyectos, public.cf_perfiles, public.cf_pisos, public.cf_proyecto_general,
  public.cf_materiales_proyecto, public.cf_profundidades_proyecto, public.cf_criterios_proyecto,
  public.cf_planos, public.cf_planos_ramales, public.cf_planos_bajantes,
  public.cf_bajante_conexiones, public.cf_planos_areas, public.cf_planos_dimensiones,
  public.cf_planos_anotaciones_texto, public.cf_planos_lineas_guia,
  public.cf_planos_fantasmas_entrepisos, public.cf_gas_datos_proyecto,
  public.cf_ep_datos_proyecto, public.cf_bomba_datos_proyecto,
  public.cf_anulaciones_bajantes_pluviales, public.cf_anulaciones_canales_pluviales,
  public.cf_aparatos_usuario
from anon;
revoke insert, update, delete on table
  public.cf_proyectos, public.cf_perfiles, public.cf_pisos, public.cf_proyecto_general,
  public.cf_materiales_proyecto, public.cf_profundidades_proyecto, public.cf_criterios_proyecto,
  public.cf_planos, public.cf_planos_ramales, public.cf_planos_bajantes,
  public.cf_bajante_conexiones, public.cf_planos_areas, public.cf_planos_dimensiones,
  public.cf_planos_anotaciones_texto, public.cf_planos_lineas_guia,
  public.cf_planos_fantasmas_entrepisos, public.cf_gas_datos_proyecto,
  public.cf_ep_datos_proyecto, public.cf_bomba_datos_proyecto,
  public.cf_anulaciones_bajantes_pluviales, public.cf_anulaciones_canales_pluviales,
  public.cf_aparatos_usuario
from authenticated;

-- Grants de RPCs: wrappers y funciones de usuario ejecutables por authenticated;
-- impls y funciones de sistema revocadas para todos; service-only a service_role.
revoke execute on function
  public.get_plano_data(bigint), public.get_proyecto_data(uuid),
  public.save_plano_data(bigint, jsonb), public.save_proyecto_core(uuid, jsonb),
  public.save_planos_meta(uuid, jsonb), public.save_redes_activas(uuid, text[]),
  public.save_gas_datos(uuid, jsonb), public.save_ep_datos(uuid, jsonb),
  public.save_bomba_datos(uuid, jsonb), public.save_rainwater_overrides(uuid, jsonb, jsonb),
  public.save_proyecto_general_campo(uuid, text, text), public.delete_plano_meta(bigint),
  public.update_proyecto_nombre(uuid, text), public.delete_proyecto(uuid),
  public.save_perfil(jsonb), public.save_net_colors(jsonb), public.save_aparatos_usuario(jsonb),
  public.suscripciones_habilitadas(), public.acceso_modulo(uuid, text),
  public.obtener_catalogo(), public.mis_accesos(), public.mis_miembros(bigint),
  public.asignar_puesto(bigint, text), public.quitar_puesto(bigint, uuid),
  public.cambiar_permiso_miembro(bigint, uuid, boolean),
  public.empresa_lectura(uuid, text), public.empresa_escritura(uuid, text),
  public.activar_suscripciones(text, text), public.intenciones_recientes(uuid),
  public.handle_new_user(), public.fantasmas_layout_default(),
  public.save_plano_data_impl(bigint, jsonb), public.save_proyecto_core_impl(uuid, jsonb),
  public.save_planos_meta_impl(uuid, jsonb), public.save_redes_activas_impl(uuid, text[]),
  public.save_gas_datos_impl(uuid, jsonb), public.save_ep_datos_impl(uuid, jsonb),
  public.save_bomba_datos_impl(uuid, jsonb), public.save_rainwater_overrides_impl(uuid, jsonb, jsonb),
  public.delete_plano_meta_impl(bigint)
from public, anon, authenticated;

grant execute on function
  public.get_plano_data(bigint), public.get_proyecto_data(uuid),
  public.save_plano_data(bigint, jsonb), public.save_proyecto_core(uuid, jsonb),
  public.save_planos_meta(uuid, jsonb), public.save_redes_activas(uuid, text[]),
  public.save_gas_datos(uuid, jsonb), public.save_ep_datos(uuid, jsonb),
  public.save_bomba_datos(uuid, jsonb), public.save_rainwater_overrides(uuid, jsonb, jsonb),
  public.save_proyecto_general_campo(uuid, text, text), public.delete_plano_meta(bigint),
  public.update_proyecto_nombre(uuid, text), public.delete_proyecto(uuid),
  public.save_perfil(jsonb), public.save_net_colors(jsonb), public.save_aparatos_usuario(jsonb),
  public.suscripciones_habilitadas(), public.acceso_modulo(uuid, text),
  public.obtener_catalogo(), public.mis_accesos(), public.mis_miembros(bigint),
  public.asignar_puesto(bigint, text), public.quitar_puesto(bigint, uuid),
  public.cambiar_permiso_miembro(bigint, uuid, boolean),
  public.empresa_lectura(uuid, text), public.empresa_escritura(uuid, text)
to authenticated;

grant execute on function public.activar_suscripciones(text, text) to service_role;
grant execute on function public.intenciones_recientes(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11 · STORAGE (bucket de PDFs de planos)
-- ═══════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('plan_pdfs', 'plan_pdfs', false)
on conflict (id) do nothing;

-- Dueño: primer segmento de la ruta = su uuid (carpeta por usuario).
drop policy if exists "plan_pdfs_owner_select" on storage.objects;
drop policy if exists "plan_pdfs_owner_insert" on storage.objects;
drop policy if exists "plan_pdfs_owner_update" on storage.objects;
drop policy if exists "plan_pdfs_owner_delete" on storage.objects;
create policy "plan_pdfs_owner_select" on storage.objects for select
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_insert" on storage.objects for insert
  with check (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_update" on storage.objects for update
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_delete" on storage.objects for delete
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Empresa: el miembro con asiento lee TODO el bucket del dueño; escribe solo con
-- puede_editar. Borrar PDF queda exclusivo del dueño.
drop policy if exists pdfs_empresa_leer on storage.objects;
create policy pdfs_empresa_leer on storage.objects for select to authenticated
  using (bucket_id = 'plan_pdfs'
         and public.empresa_lectura(public.uuid_seguro((storage.foldername(name))[1]), 'flow'));
drop policy if exists pdfs_empresa_escribir on storage.objects;
create policy pdfs_empresa_escribir on storage.objects for insert to authenticated
  with check (bucket_id = 'plan_pdfs'
         and public.empresa_escritura(public.uuid_seguro((storage.foldername(name))[1]), 'flow'));
drop policy if exists pdfs_empresa_actualizar on storage.objects;
create policy pdfs_empresa_actualizar on storage.objects for update to authenticated
  using (bucket_id = 'plan_pdfs'
         and public.empresa_escritura(public.uuid_seguro((storage.foldername(name))[1]), 'flow'))
  with check (bucket_id = 'plan_pdfs'
         and public.empresa_escritura(public.uuid_seguro((storage.foldername(name))[1]), 'flow'));

notify pgrst, 'reload schema';
