-- =========================================================================
-- CivilFlow — esquema normalizado (proyecto Supabase nuevo)
-- Ya aplicado contra knswtfckzodiuiladmbt. Se conserva aquí como registro
-- versionado — no volver a correr contra esa base (create table fallaría
-- por duplicado).
-- =========================================================================

create extension if not exists pgcrypto;

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  apellido text,
  email text,
  profesion text,
  matricula text,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.perfiles enable row level security;
create policy "perfiles_owner_select" on public.perfiles for select using ((select auth.uid()) = id);
create policy "perfiles_owner_insert" on public.perfiles for insert with check ((select auth.uid()) = id);
create policy "perfiles_owner_update" on public.perfiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "perfiles_owner_delete" on public.perfiles for delete using ((select auth.uid()) = id);

create table public.proyectos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  created_at timestamptz not null default now()
);
create index idx_proyectos_user_id on public.proyectos(user_id);

alter table public.proyectos enable row level security;
create policy "proyectos_owner_select" on public.proyectos for select using ((select auth.uid()) = user_id);
create policy "proyectos_owner_insert" on public.proyectos for insert with check ((select auth.uid()) = user_id);
create policy "proyectos_owner_update" on public.proyectos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "proyectos_owner_delete" on public.proyectos for delete using ((select auth.uid()) = user_id);

create table public.redes (
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
alter table public.redes enable row level security;
create policy "redes_read_all" on public.redes for select using ((select auth.role()) = 'authenticated');

insert into public.redes (id, lbl, col, uc_type, bm_type, bm_pfx, bm_ico, emoji, name) values
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

create table public.pisos (
  id bigint generated always as identity primary key,
  proyecto_id bigint not null references public.proyectos(id) on delete cascade,
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
create index idx_pisos_proyecto_id on public.pisos(proyecto_id);

alter table public.pisos enable row level security;
create policy "pisos_owner_select" on public.pisos for select using ((select auth.uid()) = user_id);
create policy "pisos_owner_insert" on public.pisos for insert with check ((select auth.uid()) = user_id);
create policy "pisos_owner_update" on public.pisos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "pisos_owner_delete" on public.pisos for delete using ((select auth.uid()) = user_id);

create table public.proyecto_general (
  proyecto_id bigint primary key references public.proyectos(id) on delete cascade,
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
  -- "Redes activas" / "Equipos activos" toggle state from InfoTab (useWorkAreaState.ts) — a
  -- single Set<string> of net ids shared by both UI cards (equipos are just ep/bom entries in
  -- the same set). Previously localStorage-only; project-scoped like everything else here.
  redes_activas text[],
  updated_at timestamptz not null default now()
);

alter table public.proyecto_general enable row level security;
create policy "proyecto_general_owner_select" on public.proyecto_general for select using ((select auth.uid()) = user_id);
create policy "proyecto_general_owner_insert" on public.proyecto_general for insert with check ((select auth.uid()) = user_id);
create policy "proyecto_general_owner_update" on public.proyecto_general for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "proyecto_general_owner_delete" on public.proyecto_general for delete using ((select auth.uid()) = user_id);

create table public.materiales_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id bigint not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null,
  client_id text not null,
  val text not null,
  orden integer not null default 0,
  unique (proyecto_id, categoria, client_id)
);
create index idx_materiales_proyecto_proyecto_id on public.materiales_proyecto(proyecto_id);
create index idx_materiales_proyecto_categoria on public.materiales_proyecto(proyecto_id, categoria);

alter table public.materiales_proyecto enable row level security;
create policy "materiales_proyecto_owner_select" on public.materiales_proyecto for select using ((select auth.uid()) = user_id);
create policy "materiales_proyecto_owner_insert" on public.materiales_proyecto for insert with check ((select auth.uid()) = user_id);
create policy "materiales_proyecto_owner_update" on public.materiales_proyecto for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "materiales_proyecto_owner_delete" on public.materiales_proyecto for delete using ((select auth.uid()) = user_id);

create table public.profundidades_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id bigint not null references public.proyectos(id) on delete cascade,
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
create index idx_profundidades_proyecto_proyecto_id on public.profundidades_proyecto(proyecto_id);

alter table public.profundidades_proyecto enable row level security;
create policy "profundidades_proyecto_owner_select" on public.profundidades_proyecto for select using ((select auth.uid()) = user_id);
create policy "profundidades_proyecto_owner_insert" on public.profundidades_proyecto for insert with check ((select auth.uid()) = user_id);
create policy "profundidades_proyecto_owner_update" on public.profundidades_proyecto for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profundidades_proyecto_owner_delete" on public.profundidades_proyecto for delete using ((select auth.uid()) = user_id);

create table public.criterios_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id bigint not null references public.proyectos(id) on delete cascade,
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
create index idx_criterios_proyecto_proyecto_id on public.criterios_proyecto(proyecto_id);

alter table public.criterios_proyecto enable row level security;
create policy "criterios_proyecto_owner_select" on public.criterios_proyecto for select using ((select auth.uid()) = user_id);
create policy "criterios_proyecto_owner_insert" on public.criterios_proyecto for insert with check ((select auth.uid()) = user_id);
create policy "criterios_proyecto_owner_update" on public.criterios_proyecto for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "criterios_proyecto_owner_delete" on public.criterios_proyecto for delete using ((select auth.uid()) = user_id);

create table public.aparatos_ud_base_global (
  id text primary key,
  nombre text not null,
  ud numeric not null
);
alter table public.aparatos_ud_base_global enable row level security;
create policy "aparatos_ud_base_global_read_all" on public.aparatos_ud_base_global for select using ((select auth.role()) = 'authenticated');

create table public.aparatos_catalogo_global (
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
alter table public.aparatos_catalogo_global enable row level security;
create policy "aparatos_catalogo_global_read_all" on public.aparatos_catalogo_global for select using ((select auth.role()) = 'authenticated');

create table public.planos (
  id bigint primary key,
  proyecto_id bigint not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  piso_id bigint references public.pisos(id) on delete set null,
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
  active_net text references public.redes(id),
  zoom numeric not null default 1,
  off_x numeric not null default 0,
  off_y numeric not null default 0,
  ts timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_planos_proyecto_id on public.planos(proyecto_id);
create index idx_planos_piso_id on public.planos(piso_id);
create index idx_planos_user_id on public.planos(user_id);

alter table public.planos enable row level security;
create policy "planos_owner_select" on public.planos for select using ((select auth.uid()) = user_id);
create policy "planos_owner_insert" on public.planos for insert with check ((select auth.uid()) = user_id);
create policy "planos_owner_update" on public.planos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planos_owner_delete" on public.planos for delete using ((select auth.uid()) = user_id);

create table public.planos_ramales (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  net text not null references public.redes(id),
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
  bilateral_crossings jsonb,
  bilateral_pair_ids text[],
  trib_reversed boolean,
  acc_med jsonb,
  caudal numeric,
  lvert text,
  merges_from text[],
  sifon_label_ini numeric[],
  sifon_label_fin numeric[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_planos_ramales_plano_id on public.planos_ramales(plano_id);
create index idx_planos_ramales_net on public.planos_ramales(plano_id, net);

alter table public.planos_ramales enable row level security;
create policy "planos_ramales_owner_select" on public.planos_ramales for select using ((select auth.uid()) = user_id);
create policy "planos_ramales_owner_insert" on public.planos_ramales for insert with check ((select auth.uid()) = user_id);
create policy "planos_ramales_owner_update" on public.planos_ramales for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planos_ramales_owner_delete" on public.planos_ramales for delete using ((select auth.uid()) = user_id);

create table public.planos_bajantes (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  net text not null references public.redes(id),
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
  base numeric,
  altura numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_planos_bajantes_plano_id on public.planos_bajantes(plano_id);
create index idx_planos_bajantes_net on public.planos_bajantes(plano_id, net);

alter table public.planos_bajantes enable row level security;
create policy "planos_bajantes_owner_select" on public.planos_bajantes for select using ((select auth.uid()) = user_id);
create policy "planos_bajantes_owner_insert" on public.planos_bajantes for insert with check ((select auth.uid()) = user_id);
create policy "planos_bajantes_owner_update" on public.planos_bajantes for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planos_bajantes_owner_delete" on public.planos_bajantes for delete using ((select auth.uid()) = user_id);

create table public.bajante_conexiones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bajante_origen_id bigint not null references public.planos_bajantes(id) on delete cascade,
  bajante_destino_id bigint not null references public.planos_bajantes(id) on delete cascade,
  tipo text not null check (tipo in ('recibe','alimenta','descarga')),
  created_at timestamptz not null default now(),
  unique (bajante_origen_id, bajante_destino_id, tipo)
);
create index idx_bajante_conexiones_origen on public.bajante_conexiones(bajante_origen_id);
create index idx_bajante_conexiones_destino on public.bajante_conexiones(bajante_destino_id);

alter table public.bajante_conexiones enable row level security;
create policy "bajante_conexiones_owner_select" on public.bajante_conexiones for select using ((select auth.uid()) = user_id);
create policy "bajante_conexiones_owner_insert" on public.bajante_conexiones for insert with check ((select auth.uid()) = user_id);
create policy "bajante_conexiones_owner_update" on public.bajante_conexiones for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bajante_conexiones_owner_delete" on public.bajante_conexiones for delete using ((select auth.uid()) = user_id);

create table public.planos_areas (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  pts jsonb not null default '[]'::jsonb,
  color text,
  label text,
  label_x numeric,
  label_y numeric,
  label_angle numeric,
  area_m2 numeric,
  net text references public.redes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_planos_areas_plano_id on public.planos_areas(plano_id);

alter table public.planos_areas enable row level security;
create policy "planos_areas_owner_select" on public.planos_areas for select using ((select auth.uid()) = user_id);
create policy "planos_areas_owner_insert" on public.planos_areas for insert with check ((select auth.uid()) = user_id);
create policy "planos_areas_owner_update" on public.planos_areas for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planos_areas_owner_delete" on public.planos_areas for delete using ((select auth.uid()) = user_id);

create table public.planos_dimensiones (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos(id) on delete cascade,
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
create index idx_planos_dimensiones_plano_id on public.planos_dimensiones(plano_id);

alter table public.planos_dimensiones enable row level security;
create policy "planos_dimensiones_owner_select" on public.planos_dimensiones for select using ((select auth.uid()) = user_id);
create policy "planos_dimensiones_owner_insert" on public.planos_dimensiones for insert with check ((select auth.uid()) = user_id);
create policy "planos_dimensiones_owner_update" on public.planos_dimensiones for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planos_dimensiones_owner_delete" on public.planos_dimensiones for delete using ((select auth.uid()) = user_id);

create table public.planos_anotaciones_texto (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos(id) on delete cascade,
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
create index idx_planos_anotaciones_texto_plano_id on public.planos_anotaciones_texto(plano_id);

alter table public.planos_anotaciones_texto enable row level security;
create policy "planos_anotaciones_texto_owner_select" on public.planos_anotaciones_texto for select using ((select auth.uid()) = user_id);
create policy "planos_anotaciones_texto_owner_insert" on public.planos_anotaciones_texto for insert with check ((select auth.uid()) = user_id);
create policy "planos_anotaciones_texto_owner_update" on public.planos_anotaciones_texto for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planos_anotaciones_texto_owner_delete" on public.planos_anotaciones_texto for delete using ((select auth.uid()) = user_id);

create table public.planos_lineas_guia (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  net text references public.redes(id),
  pts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_planos_lineas_guia_plano_id on public.planos_lineas_guia(plano_id);

alter table public.planos_lineas_guia enable row level security;
create policy "planos_lineas_guia_owner_select" on public.planos_lineas_guia for select using ((select auth.uid()) = user_id);
create policy "planos_lineas_guia_owner_insert" on public.planos_lineas_guia for insert with check ((select auth.uid()) = user_id);
create policy "planos_lineas_guia_owner_update" on public.planos_lineas_guia for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planos_lineas_guia_owner_delete" on public.planos_lineas_guia for delete using ((select auth.uid()) = user_id);

create table public.planos_cross_floor_ghosts (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  net text references public.redes(id),
  code text,
  x numeric not null,
  y numeric not null,
  d_nominal text,
  direccion text check (direccion in ('sube','baja')),
  parent_direccion text check (parent_direccion in ('sube','baja')),
  piso text,
  source_plano_id bigint references public.planos(id) on delete cascade,
  source_bajante_id text,
  target_bajante_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, client_id)
);
create index idx_planos_cross_floor_ghosts_plano_id on public.planos_cross_floor_ghosts(plano_id);

alter table public.planos_cross_floor_ghosts enable row level security;
create policy "planos_cross_floor_ghosts_owner_select" on public.planos_cross_floor_ghosts for select using ((select auth.uid()) = user_id);
create policy "planos_cross_floor_ghosts_owner_insert" on public.planos_cross_floor_ghosts for insert with check ((select auth.uid()) = user_id);
create policy "planos_cross_floor_ghosts_owner_update" on public.planos_cross_floor_ghosts for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planos_cross_floor_ghosts_owner_delete" on public.planos_cross_floor_ghosts for delete using ((select auth.uid()) = user_id);

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
    'cross_floor_ghosts', coalesce((
      select jsonb_agg(to_jsonb(c) - 'id' - 'plano_id' - 'user_id' order by c.id)
      from public.planos_cross_floor_ghosts c where c.plano_id = p_plano_id
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
    'planos_meta', coalesce((
      select jsonb_agg(to_jsonb(pl) - 'proyecto_id' - 'user_id' - 'piso_id' order by pl.id)
      from public.planos pl where pl.proyecto_id = p_proyecto_id
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_plano_data(bigint) to authenticated;
grant execute on function public.get_proyecto_data(bigint) to authenticated;
