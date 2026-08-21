-- =========================================================================
-- Civil Manager — esquema cm_* (independiente de CF)
-- TODAS las tablas de registro son POR PROYECTO: cada fila cuelga de
-- cm_proyectos(id). Solo cm_config (parámetros/listas de cálculo) es global
-- por usuario.
--
-- IDEMPOTENTE: puede reaplicarse sin error (create ... if not exists /
-- drop ... if exists / create or replace).
-- =========================================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- cm_proyectos: proyectos de Civil Manager (landing "Iniciar nuevo proyecto")
-- -------------------------------------------------------------------------
create table if not exists public.cm_proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cm_proyectos_user_id on public.cm_proyectos(user_id);
alter table public.cm_proyectos enable row level security;
drop policy if exists cm_proyectos_propietario_leer on public.cm_proyectos;
create policy cm_proyectos_propietario_leer on public.cm_proyectos for select using ((select auth.uid()) = user_id);
drop policy if exists cm_proyectos_propietario_insertar on public.cm_proyectos;
create policy cm_proyectos_propietario_insertar on public.cm_proyectos for insert with check ((select auth.uid()) = user_id);
drop policy if exists cm_proyectos_propietario_actualizar on public.cm_proyectos;
create policy cm_proyectos_propietario_actualizar on public.cm_proyectos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists cm_proyectos_propietario_eliminar on public.cm_proyectos;
create policy cm_proyectos_propietario_eliminar on public.cm_proyectos for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_proyectos_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_proyectos_updated_at on public.cm_proyectos;
create trigger trg_cm_proyectos_updated_at before update on public.cm_proyectos
for each row execute function public.cm_proyectos_set_updated_at();

-- -------------------------------------------------------------------------
-- Helper RLS: ¿el proyecto pertenece al usuario?
-- -------------------------------------------------------------------------
create or replace function public.cm_proyecto_de_usuario(pid uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.cm_proyectos p where p.id = pid and p.user_id = (select auth.uid()));
$$;

-- -------------------------------------------------------------------------
-- cm_factores_prestacionales (por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_factores_prestacionales (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  factor numeric not null default 0,
  tipo text not null check (tipo in ('prestaciones','seguridad_social','parafiscales','otros')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index if not exists idx_cm_factores_prestacionales_user on public.cm_factores_prestacionales(user_id);
create index if not exists idx_cm_factores_prestacionales_proyecto on public.cm_factores_prestacionales(proyecto_id);
alter table public.cm_factores_prestacionales enable row level security;
drop policy if exists cm_factores_prestacionales_propietario_leer on public.cm_factores_prestacionales;
create policy cm_factores_prestacionales_propietario_leer on public.cm_factores_prestacionales for select using ((select auth.uid()) = user_id);
drop policy if exists cm_factores_prestacionales_propietario_insertar on public.cm_factores_prestacionales;
create policy cm_factores_prestacionales_propietario_insertar on public.cm_factores_prestacionales for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_factores_prestacionales_propietario_actualizar on public.cm_factores_prestacionales;
create policy cm_factores_prestacionales_propietario_actualizar on public.cm_factores_prestacionales for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_factores_prestacionales_propietario_eliminar on public.cm_factores_prestacionales;
create policy cm_factores_prestacionales_propietario_eliminar on public.cm_factores_prestacionales for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_factores_prestacionales_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_factores_prestacionales_updated_at on public.cm_factores_prestacionales;
create trigger trg_cm_factores_prestacionales_updated_at before update on public.cm_factores_prestacionales
for each row execute function public.cm_factores_prestacionales_set_updated_at();

-- -------------------------------------------------------------------------
-- cm_cargos (por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_cargos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  descripcion text not null default '',
  num_salarios_base numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index if not exists idx_cm_cargos_user on public.cm_cargos(user_id);
create index if not exists idx_cm_cargos_proyecto on public.cm_cargos(proyecto_id);
alter table public.cm_cargos enable row level security;
drop policy if exists cm_cargos_propietario_leer on public.cm_cargos;
create policy cm_cargos_propietario_leer on public.cm_cargos for select using ((select auth.uid()) = user_id);
drop policy if exists cm_cargos_propietario_insertar on public.cm_cargos;
create policy cm_cargos_propietario_insertar on public.cm_cargos for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_cargos_propietario_actualizar on public.cm_cargos;
create policy cm_cargos_propietario_actualizar on public.cm_cargos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_cargos_propietario_eliminar on public.cm_cargos;
create policy cm_cargos_propietario_eliminar on public.cm_cargos for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_cargos_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_cargos_updated_at on public.cm_cargos;
create trigger trg_cm_cargos_updated_at before update on public.cm_cargos
for each row execute function public.cm_cargos_set_updated_at();

-- -------------------------------------------------------------------------
-- cm_proveedores (por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_proveedores (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  nit text not null default '',
  contacto text not null default '',
  tel1 text not null default '',
  tel2 text not null default '',
  email text not null default '',
  direccion text not null default '',
  ciudad text not null default '',
  departamento text not null default '',
  tipo text[] not null default '{}',
  notas text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index if not exists idx_cm_proveedores_user on public.cm_proveedores(user_id);
create index if not exists idx_cm_proveedores_proyecto on public.cm_proveedores(proyecto_id);
alter table public.cm_proveedores enable row level security;
drop policy if exists cm_proveedores_propietario_leer on public.cm_proveedores;
create policy cm_proveedores_propietario_leer on public.cm_proveedores for select using ((select auth.uid()) = user_id);
drop policy if exists cm_proveedores_propietario_insertar on public.cm_proveedores;
create policy cm_proveedores_propietario_insertar on public.cm_proveedores for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_proveedores_propietario_actualizar on public.cm_proveedores;
create policy cm_proveedores_propietario_actualizar on public.cm_proveedores for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_proveedores_propietario_eliminar on public.cm_proveedores;
create policy cm_proveedores_propietario_eliminar on public.cm_proveedores for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_proveedores_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_proveedores_updated_at on public.cm_proveedores;
create trigger trg_cm_proveedores_updated_at before update on public.cm_proveedores
for each row execute function public.cm_proveedores_set_updated_at();

-- -------------------------------------------------------------------------
-- cm_cuadrillas (por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_cuadrillas (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  descripcion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index if not exists idx_cm_cuadrillas_user on public.cm_cuadrillas(user_id);
create index if not exists idx_cm_cuadrillas_proyecto on public.cm_cuadrillas(proyecto_id);
alter table public.cm_cuadrillas enable row level security;
drop policy if exists cm_cuadrillas_propietario_leer on public.cm_cuadrillas;
create policy cm_cuadrillas_propietario_leer on public.cm_cuadrillas for select using ((select auth.uid()) = user_id);
drop policy if exists cm_cuadrillas_propietario_insertar on public.cm_cuadrillas;
create policy cm_cuadrillas_propietario_insertar on public.cm_cuadrillas for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_cuadrillas_propietario_actualizar on public.cm_cuadrillas;
create policy cm_cuadrillas_propietario_actualizar on public.cm_cuadrillas for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_cuadrillas_propietario_eliminar on public.cm_cuadrillas;
create policy cm_cuadrillas_propietario_eliminar on public.cm_cuadrillas for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_cuadrillas_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_cuadrillas_updated_at on public.cm_cuadrillas;
create trigger trg_cm_cuadrillas_updated_at before update on public.cm_cuadrillas
for each row execute function public.cm_cuadrillas_set_updated_at();

-- -------------------------------------------------------------------------
-- cm_cuadrilla_integrantes (pivote N:M cuadrilla ↔ cargo, por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_cuadrilla_integrantes (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  cuadrilla_id text not null references public.cm_cuadrillas(id) on delete cascade,
  cargo_id text not null references public.cm_cargos(id) on delete restrict,
  cantidad integer not null default 1 check (cantidad >= 0),
  created_at timestamptz not null default now(),
  unique (cuadrilla_id, cargo_id)
);
create index if not exists idx_cm_cuadrilla_integrantes_cuadrilla on public.cm_cuadrilla_integrantes(cuadrilla_id);
create index if not exists idx_cm_cuadrilla_integrantes_proyecto on public.cm_cuadrilla_integrantes(proyecto_id);
alter table public.cm_cuadrilla_integrantes enable row level security;
drop policy if exists cm_cuadrilla_integrantes_propietario_leer on public.cm_cuadrilla_integrantes;
create policy cm_cuadrilla_integrantes_propietario_leer on public.cm_cuadrilla_integrantes for select using ((select auth.uid()) = user_id);
drop policy if exists cm_cuadrilla_integrantes_propietario_insertar on public.cm_cuadrilla_integrantes;
create policy cm_cuadrilla_integrantes_propietario_insertar on public.cm_cuadrilla_integrantes for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_cuadrilla_integrantes_propietario_actualizar on public.cm_cuadrilla_integrantes;
create policy cm_cuadrilla_integrantes_propietario_actualizar on public.cm_cuadrilla_integrantes for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_cuadrilla_integrantes_propietario_eliminar on public.cm_cuadrilla_integrantes;
create policy cm_cuadrilla_integrantes_propietario_eliminar on public.cm_cuadrilla_integrantes for delete using ((select auth.uid()) = user_id);

-- -------------------------------------------------------------------------
-- cm_equipos (por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_equipos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  tipo text not null default '',
  unidad text not null default '',
  costo_hora numeric not null default 0,
  fecha_cotizacion text not null default '',
  proveedor_id text references public.cm_proveedores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index if not exists idx_cm_equipos_user on public.cm_equipos(user_id);
create index if not exists idx_cm_equipos_proyecto on public.cm_equipos(proyecto_id);
create index if not exists idx_cm_equipos_proveedor on public.cm_equipos(proveedor_id);
alter table public.cm_equipos enable row level security;
drop policy if exists cm_equipos_propietario_leer on public.cm_equipos;
create policy cm_equipos_propietario_leer on public.cm_equipos for select using ((select auth.uid()) = user_id);
drop policy if exists cm_equipos_propietario_insertar on public.cm_equipos;
create policy cm_equipos_propietario_insertar on public.cm_equipos for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_equipos_propietario_actualizar on public.cm_equipos;
create policy cm_equipos_propietario_actualizar on public.cm_equipos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_equipos_propietario_eliminar on public.cm_equipos;
create policy cm_equipos_propietario_eliminar on public.cm_equipos for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_equipos_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_equipos_updated_at on public.cm_equipos;
create trigger trg_cm_equipos_updated_at before update on public.cm_equipos
for each row execute function public.cm_equipos_set_updated_at();

-- -------------------------------------------------------------------------
-- cm_insumos (por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_insumos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  unidad text not null default '',
  origen text not null default '',
  categoria text not null default '',
  subcategoria text not null default '',
  marca_referencia text not null default '',
  costo_unitario numeric not null default 0,
  fecha_cotizacion text not null default '',
  apu_basico_id text,
  proveedor_id text references public.cm_proveedores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index if not exists idx_cm_insumos_user on public.cm_insumos(user_id);
create index if not exists idx_cm_insumos_proyecto on public.cm_insumos(proyecto_id);
create index if not exists idx_cm_insumos_categoria on public.cm_insumos(proyecto_id, categoria);
alter table public.cm_insumos enable row level security;
drop policy if exists cm_insumos_propietario_leer on public.cm_insumos;
create policy cm_insumos_propietario_leer on public.cm_insumos for select using ((select auth.uid()) = user_id);
drop policy if exists cm_insumos_propietario_insertar on public.cm_insumos;
create policy cm_insumos_propietario_insertar on public.cm_insumos for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_insumos_propietario_actualizar on public.cm_insumos;
create policy cm_insumos_propietario_actualizar on public.cm_insumos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_insumos_propietario_eliminar on public.cm_insumos;
create policy cm_insumos_propietario_eliminar on public.cm_insumos for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_insumos_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_insumos_updated_at on public.cm_insumos;
create trigger trg_cm_insumos_updated_at before update on public.cm_insumos
for each row execute function public.cm_insumos_set_updated_at();

-- -------------------------------------------------------------------------
-- cm_apus (por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_apus (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  categoria text not null default '',
  unidad text not null default '',
  fecha_creacion text not null default '',
  es_basico boolean not null default false,
  recursos_mo jsonb not null default '[]'::jsonb,
  recursos_eq jsonb not null default '[]'::jsonb,
  recursos_ins jsonb not null default '[]'::jsonb,
  recursos_transporte jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index if not exists idx_cm_apus_user on public.cm_apus(user_id);
create index if not exists idx_cm_apus_proyecto on public.cm_apus(proyecto_id);
create index if not exists idx_cm_apus_categoria on public.cm_apus(proyecto_id, categoria);
alter table public.cm_apus enable row level security;
drop policy if exists cm_apus_propietario_leer on public.cm_apus;
create policy cm_apus_propietario_leer on public.cm_apus for select using ((select auth.uid()) = user_id);
drop policy if exists cm_apus_propietario_insertar on public.cm_apus;
create policy cm_apus_propietario_insertar on public.cm_apus for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_apus_propietario_actualizar on public.cm_apus;
create policy cm_apus_propietario_actualizar on public.cm_apus for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_apus_propietario_eliminar on public.cm_apus;
create policy cm_apus_propietario_eliminar on public.cm_apus for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_apus_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_apus_updated_at on public.cm_apus;
create trigger trg_cm_apus_updated_at before update on public.cm_apus
for each row execute function public.cm_apus_set_updated_at();

-- -------------------------------------------------------------------------
-- cm_presupuestos (por proyecto)
-- -------------------------------------------------------------------------
create table if not exists public.cm_presupuestos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  entidad text not null default '',
  contrato text not null default '',
  objeto text not null default '',
  plazo text not null default '',
  fecha_creacion text not null default '',
  ciudad text not null default '',
  departamento text not null default '',
  elaborado_por text not null default '',
  activo boolean not null default true,
  con_sub_proyectos boolean not null default false,
  parent_id text,
  estado text not null default 'borrador' check (estado in ('borrador','en_revision','cerrado')),
  fecha_cierre text not null default '',
  observaciones text not null default '',
  items jsonb not null default '[]'::jsonb,
  aiu_override jsonb not null default '{"activo":false,"pct_a":10,"pct_i":3,"pct_u":6,"iva_pct":19}'::jsonb,
  factores_snap jsonb not null default '[]'::jsonb,
  cargos_snap jsonb not null default '[]'::jsonb,
  apus_snap jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index if not exists idx_cm_presupuestos_user on public.cm_presupuestos(user_id);
create index if not exists idx_cm_presupuestos_proyecto on public.cm_presupuestos(proyecto_id);
alter table public.cm_presupuestos enable row level security;
drop policy if exists cm_presupuestos_propietario_leer on public.cm_presupuestos;
create policy cm_presupuestos_propietario_leer on public.cm_presupuestos for select using ((select auth.uid()) = user_id);
drop policy if exists cm_presupuestos_propietario_insertar on public.cm_presupuestos;
create policy cm_presupuestos_propietario_insertar on public.cm_presupuestos for insert with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_presupuestos_propietario_actualizar on public.cm_presupuestos;
create policy cm_presupuestos_propietario_actualizar on public.cm_presupuestos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id));
drop policy if exists cm_presupuestos_propietario_eliminar on public.cm_presupuestos;
create policy cm_presupuestos_propietario_eliminar on public.cm_presupuestos for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_presupuestos_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_presupuestos_updated_at on public.cm_presupuestos;
create trigger trg_cm_presupuestos_updated_at before update on public.cm_presupuestos
for each row execute function public.cm_presupuestos_set_updated_at();

-- -------------------------------------------------------------------------
-- cm_config (global por usuario — parámetros y listas de cálculo)
-- -------------------------------------------------------------------------
create table if not exists public.cm_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  config_listas jsonb not null default '{}'::jsonb,
  categorias_apu jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cm_config enable row level security;
drop policy if exists cm_config_propietario_leer on public.cm_config;
create policy cm_config_propietario_leer on public.cm_config for select using ((select auth.uid()) = user_id);
drop policy if exists cm_config_propietario_insertar on public.cm_config;
create policy cm_config_propietario_insertar on public.cm_config for insert with check ((select auth.uid()) = user_id);
drop policy if exists cm_config_propietario_actualizar on public.cm_config;
create policy cm_config_propietario_actualizar on public.cm_config for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists cm_config_propietario_eliminar on public.cm_config;
create policy cm_config_propietario_eliminar on public.cm_config for delete using ((select auth.uid()) = user_id);
create or replace function public.cm_config_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_cm_config_updated_at on public.cm_config;
create trigger trg_cm_config_updated_at before update on public.cm_config
for each row execute function public.cm_config_set_updated_at();

-- -------------------------------------------------------------------------
-- RPC de lectura: todos los registros del proyecto activo (o todos si null)
-- -------------------------------------------------------------------------
create or replace function public.cm_get_data(p_proyecto_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'proyectos',       coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.cm_proyectos p where p.user_id = auth.uid()), '[]'::jsonb),
    'factores',        coalesce((select jsonb_agg(to_jsonb(f) order by f.codigo) from public.cm_factores_prestacionales f where f.user_id = auth.uid() and (p_proyecto_id is null or f.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'cargos',          coalesce((select jsonb_agg(to_jsonb(c) order by c.codigo) from public.cm_cargos c where c.user_id = auth.uid() and (p_proyecto_id is null or c.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'cuadrillas',      coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'codigo', q.codigo, 'descripcion', q.descripcion, 'integrantes', coalesce((select jsonb_agg(to_jsonb(i) order by i.cargo_id) from public.cm_cuadrilla_integrantes i where i.cuadrilla_id = q.id), '[]'::jsonb)) order by q.codigo) from public.cm_cuadrillas q where q.user_id = auth.uid() and (p_proyecto_id is null or q.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'equipos',         coalesce((select jsonb_agg(to_jsonb(e) order by e.codigo) from public.cm_equipos e where e.user_id = auth.uid() and (p_proyecto_id is null or e.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'insumos',         coalesce((select jsonb_agg(to_jsonb(ii) order by ii.codigo) from public.cm_insumos ii where ii.user_id = auth.uid() and (p_proyecto_id is null or ii.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'proveedores',     coalesce((select jsonb_agg(to_jsonb(pr) order by pr.codigo) from public.cm_proveedores pr where pr.user_id = auth.uid() and (p_proyecto_id is null or pr.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'apus',            coalesce((select jsonb_agg(to_jsonb(a) order by a.codigo) from public.cm_apus a where a.user_id = auth.uid() and (p_proyecto_id is null or a.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'presupuestos',    coalesce((select jsonb_agg(to_jsonb(pp) order by pp.codigo) from public.cm_presupuestos pp where pp.user_id = auth.uid() and (p_proyecto_id is null or pp.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'config',          coalesce((select to_jsonb(cc) - 'user_id' from public.cm_config cc where cc.user_id = auth.uid()), '{}'::jsonb)
  );
$$;
-- RLS ya protege cada select (auth.uid() = user_id); SECURITY INVOKER para que no
-- sea ejecutable como definer. Revocar anon/público.
revoke execute on function public.cm_get_data(uuid) from anon, public;
grant execute on function public.cm_get_data(uuid) to authenticated;