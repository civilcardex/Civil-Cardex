-- ═══════════════════════════════════════════════════════════════════════
-- CIVILFLOW · CONSOLIDADO DEL ESQUEMA FINAL (estructura recreable)
-- Derivado a mano de supabase/migrations/*.sql (115 archivos; corte en -- DOWN,
-- renames en cadena aplicados; PATCH del DO $$ de 20261005000007 incluido:
-- proyecto_id/id uuid en las hijas cf_* y cf_proyectos).
--
-- Alcance: CREATE TABLE con columnas finales + PK/FK/UNIQUE/CHECK inline +
-- índices FK/consulta + RLS enable por tabla.
-- NO INCLUIDO (viven en sus migraciones): RPCs SECURITY DEFINER, policies finas
-- (DO dinámico), triggers, grants, edge functions, datos.
--
-- Regenerar: tras cada migración nueva, actualizar a mano (checklist de
-- cobertura: src/lib/database.types.ts — 42 tablas activas).
--
-- Orden interno: CM (Civil Manager) → Fundación CF → Persistencia CF →
-- RCI → Suscripciones/Empresa → Índices.
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- CIVILFLOW · CONSOLIDADO DEL ESQUEMA FINAL (estructura recreable)
-- Derivado a mano de supabase/migrations/*.sql (115 archivos, corte en -- DOWN,
-- renames en cadena aplicados, PATCH del DO $$ de 20261005000007 incluido).
-- Alcance: CREATE TABLE + PK/FK/UNIQUE/CHECK inline + índices FK + RLS enable.
-- NO INCLUIDO (viven en sus migraciones): RPCs SECURITY DEFINER, policies finas,
-- triggers, grants, datos.
-- Cobertura: 42 tablas activas (checklist contra src/lib/database.types.ts).
-- ═══════════════════════════════════════════════════════════════════════

-- ══ CIVIL MANAGER (cm_*) ══

-- ── cm_proyectos
create table public.cm_proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cm_proyectos enable row level security;

-- ── cm_factores_prestacionales
create table public.cm_factores_prestacionales (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  factor numeric not null default 0,
  tipo text not null check (tipo in ('prestaciones','seguridad_social','parafiscales','otros')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cm_factores_prestacionales enable row level security;

-- ── cm_cargos
create table public.cm_cargos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  descripcion text not null default '',
  num_salarios_base numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cm_cargos enable row level security;

-- ── cm_proveedores
create table public.cm_proveedores (
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
  updated_at timestamptz not null default now()
);
alter table public.cm_proveedores enable row level security;

-- ── cm_cuadrillas
create table public.cm_cuadrillas (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  descripcion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cm_cuadrillas enable row level security;

-- ── cm_cuadrilla_integrantes
create table public.cm_cuadrilla_integrantes (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  cuadrilla_id text not null references public.cm_cuadrillas(id) on delete cascade,
  cargo_id text not null references public.cm_cargos(id) on delete restrict,
  cantidad numeric(6 not null default 1 check (cantidad >= 0),
  created_at timestamptz not null default now()
);
alter table public.cm_cuadrilla_integrantes enable row level security;

-- ── cm_equipos
create table public.cm_equipos (
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
  updated_at timestamptz not null default now()
);
alter table public.cm_equipos enable row level security;

-- ── cm_insumos
create table public.cm_insumos (
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
  updated_at timestamptz not null default now()
);
alter table public.cm_insumos enable row level security;

-- ── cm_apus
create table public.cm_apus (
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
  updated_at timestamptz not null default now()
);
alter table public.cm_apus enable row level security;

-- ── cm_presupuestos
create table public.cm_presupuestos (
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
  insumos_snap jsonb not null default '[]'::jsonb,
  equipos_snap jsonb not null default '[]'::jsonb,
  cuadrillas_snap jsonb not null default '[]'::jsonb,
  perfil_pais_snap jsonb
);
alter table public.cm_presupuestos enable row level security;

-- ── cm_config
create table public.cm_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  config_listas jsonb not null default '{}'::jsonb,
  categorias_apu jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cm_config enable row level security;

-- ══ FUNDACIÓN CF (perfiles, proyecto, catálogos globales) ══

-- ── cf_perfiles
create table public.cf_perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  apellido text,
  email text,
  profesion text,
  matricula text,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  net_colors jsonb not null default '{}'::jsonb
);
alter table public.cf_perfiles enable row level security;

-- ── cf_proyectos
create table public.cf_proyectos (
  id uuid not null default gen_random_uuid() primary key,
  proyecto_num bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  slug text,
  created_at timestamptz not null default now()
);
alter table public.cf_proyectos enable row level security;

-- ── cf_redes
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
alter table public.cf_redes enable row level security;

-- ── cf_pisos
create table public.cf_pisos (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  n integer not null,
  npt numeric,
  ok boolean not null default false,
  tipo text not null check (tipo in ('sotano','piso','cubierta')),
  h numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cf_pisos enable row level security;

-- ── cf_proyecto_general
create table public.cf_proyecto_general (
  proyecto_id uuid primary key references public.proyectos(id) on delete cascade,
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
  updated_at timestamptz not null default now(),
  presion_garantizada text,
  rejillas jsonb
);
alter table public.cf_proyecto_general enable row level security;

-- ── cf_materiales_proyecto
create table public.cf_materiales_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null,
  client_id text not null,
  val text not null,
  orden integer not null default 0
);
alter table public.cf_materiales_proyecto enable row level security;

-- ── cf_profundidades_proyecto
create table public.cf_profundidades_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  red text not null,
  col text,
  prof numeric,
  norma text,
  nota text,
  orden integer not null default 0
);
alter table public.cf_profundidades_proyecto enable row level security;

-- ── cf_criterios_proyecto
create table public.cf_criterios_proyecto (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
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
  orden integer not null default 0
);
alter table public.cf_criterios_proyecto enable row level security;

-- ── cf_aparatos_ud_base_global
create table public.cf_aparatos_ud_base_global (
  id text primary key,
  nombre text not null,
  ud numeric not null
);
alter table public.cf_aparatos_ud_base_global enable row level security;

-- ── cf_aparatos_catalogo_global
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

-- ── cf_aparatos_usuario
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
  blk_ud boolean not null default false
);
alter table public.cf_aparatos_usuario enable row level security;

-- ══ PLANOS Y PERSISTENCIA CF (visores) ══

-- ── cf_planos
create table public.cf_planos (
  id bigint primary key,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
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
  updated_at timestamptz not null default now(),
  line_width numeric not null default 1
);
alter table public.cf_planos enable row level security;

-- ══ PLANOS Y PERSISTENCIA CF (visores) ══

-- ── cf_planos_ramales
create table public.cf_planos_ramales (
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
  diam_pulg numeric,
  trib_reversed boolean,
  acc_med jsonb,
  caudal numeric,
  lvert text,
  merges_from text[],
  sifon_label_ini numeric[],
  sifon_label_fin numeric[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fixtures jsonb,
  show_length boolean default true,
  show_name boolean default true,
  show_guide boolean default true,
  show_flow_dir boolean default true,
  show_mat_diam_pend boolean default true,
  label_moved boolean default false,
  yee_doble jsonb,
  copia_piso boolean,
  sin_acc_med_interior boolean,
  es_canal_id text
);
alter table public.cf_planos_ramales enable row level security;

-- ══ PLANOS Y PERSISTENCIA CF (visores) ══

-- ── cf_planos_bajantes
create table public.cf_planos_bajantes (
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
  canal_id text,
  descarga_en_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  origen_id text,
  factor_sim numeric,
  longitud numeric,
  label_moved boolean default false,
  caja_origen_id text,
  bomba_en_id text,
  fixtures jsonb not null default '{}',
  uc_aplicado jsonb,
  uc_aplicado_hidro jsonb,
  copia_piso boolean,
  copiado_de_plan text,
  copiado_de_id text,
  bajante_externo_id text,
  angulo numeric,
  canal_flow_dir text,
  asoc_links jsonb not null default '{}'::jsonb,
  alt_deriv numeric
);
alter table public.cf_planos_bajantes enable row level security;

-- ── cf_bajante_conexiones
create table public.cf_bajante_conexiones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bajante_origen_id bigint not null references public.planos_bajantes(id) on delete cascade,
  bajante_destino_id bigint not null references public.planos_bajantes(id) on delete cascade,
  tipo text not null check (tipo in ('recibe','alimenta','descarga')),
  created_at timestamptz not null default now()
);
alter table public.cf_bajante_conexiones enable row level security;

-- ══ PLANOS Y PERSISTENCIA CF (visores) ══

-- ── cf_planos_areas
create table public.cf_planos_areas (
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
  label_moved boolean default false,
  altura_m numeric,
  es_rect_fuego boolean not null default false
);
alter table public.cf_planos_areas enable row level security;

-- ══ PLANOS Y PERSISTENCIA CF (visores) ══

-- ── cf_planos_dimensiones
create table public.cf_planos_dimensiones (
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
  updated_at timestamptz not null default now()
);
alter table public.cf_planos_dimensiones enable row level security;

-- ══ PLANOS Y PERSISTENCIA CF (visores) ══

-- ── cf_planos_anotaciones_texto
create table public.cf_planos_anotaciones_texto (
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
  updated_at timestamptz not null default now()
);
alter table public.cf_planos_anotaciones_texto enable row level security;

-- ══ PLANOS Y PERSISTENCIA CF (visores) ══

-- ── cf_planos_lineas_guia
create table public.cf_planos_lineas_guia (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  net text references public.redes(id),
  pts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  es_muro boolean not null default false
);
alter table public.cf_planos_lineas_guia enable row level security;

-- ══ PLANOS Y PERSISTENCIA CF (visores) ══

-- ── cf_planos_fantasmas_entrepisos
create table public.cf_planos_fantasmas_entrepisos (
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
  layout int
);
alter table public.cf_planos_fantasmas_entrepisos enable row level security;

-- ── cf_gas_datos_proyecto
create table public.cf_gas_datos_proyecto (
  proyecto_id uuid primary key references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  altitud text not null default '',
  presion_atm text not null default '',
  temperatura text not null default '',
  presion_min text not null default '',
  densidad_relativa text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cf_gas_datos_proyecto enable row level security;

-- ── cf_ep_datos_proyecto
create table public.cf_ep_datos_proyecto (
  proyecto_id uuid primary key references public.proyectos(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dot_l text,
  n_usuarios numeric,
  dias_aut numeric,
  bci_l numeric,
  patm numeric,
  pv numeric,
  npshr numeric,
  extra jsonb
);
alter table public.cf_ep_datos_proyecto enable row level security;

-- ── cf_bomba_datos_proyecto
create table public.cf_bomba_datos_proyecto (
  proyecto_id uuid primary key references public.proyectos(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tipo_tuberia text not null default '',
  bombas jsonb not null default '{}'
);
alter table public.cf_bomba_datos_proyecto enable row level security;

-- ══ LLUVIAS / ANULACIONES ══

-- ── cf_anulaciones_bajantes_pluviales
create table public.cf_anulaciones_bajantes_pluviales (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  bajante text not null,
  area_parcial numeric not null default 0,
  area_acumulada numeric not null default 0,
  intensidad numeric not null default 100,
  coeficiente_c numeric not null default 0.0278,
  R text NOT NULL DEFAULT '',
  manning numeric not null default 0,
  diam_propuesto numeric not null default 0,
  area_otras numeric NOT NULL DEFAULT 0,
  material_cubierta text NOT NULL DEFAULT ''
);
alter table public.cf_anulaciones_bajantes_pluviales enable row level security;

-- ── cf_anulaciones_canales_pluviales
create table public.cf_anulaciones_canales_pluviales (
  id bigint generated always as identity primary key,
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  sector text not null,
  area_parcial numeric not null default 0,
  area_acumulada numeric not null default 0,
  intensidad numeric not null default 100,
  coeficiente_c numeric not null default 0.0278,
  manning numeric not null default 0.011,
  pendiente numeric not null default 0,
  b numeric not null default 0,
  h numeric not null default 0,
  area_otras numeric NOT NULL DEFAULT 0,
  material_cubierta text NOT NULL DEFAULT '',
  material_canal text NOT NULL DEFAULT '',
  muro_vertical numeric NOT NULL DEFAULT 0,
  borde_libre_cm numeric NOT NULL DEFAULT 10
);
alter table public.cf_anulaciones_canales_pluviales enable row level security;

-- ══ SUSCRIPCIONES Y EMPRESA (app_*) ══

-- ── app_config
create table public.app_config (
  clave text primary key,
  valor boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

-- ── app_suscripciones
create table public.app_suscripciones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null check (modulo in ('flow', 'manage')),
  periodo text not null check (periodo in ('mensual', 'anual')),
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  puestos int not null default 1
);
alter table public.app_suscripciones enable row level security;

-- ── app_pagos
create table public.app_pagos (
  id bigint generated always as identity primary key,
  referencia text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  modulos text[] not null check (array_length(modulos, 1) >= 1),
  periodo text not null check (periodo in ('mensual', 'anual')),
  monto_centavos bigint not null check (monto_centavos > 0),
  moneda text not null default 'COP',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado')),
  txn_id text unique,
  created_at timestamptz not null default now(),
  aprobado_at timestamptz,
  puestos_por_modulo jsonb not null default '{}'::jsonb
);
alter table public.app_pagos enable row level security;

-- ── app_precios
create table public.app_precios (
  modulo text primary key check (modulo in ('flow',
  precio_mensual_centavos bigint not null,
  precio_anual_centavos bigint not null,
  updated_at timestamptz not null default now(),
  precio_semestral_centavos bigint not null
);
alter table public.app_precios enable row level security;

-- ── app_suscripciones_miembros
create table public.app_suscripciones_miembros (
  id bigint generated always as identity primary key,
  suscripcion_id bigint not null references public.app_suscripciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asignado_por uuid not null references auth.users(id) on delete cascade,
  puede_editar boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.app_suscripciones_miembros enable row level security;

-- ══ RCI ══

-- ── cf_rci_datos_proyecto
create table public.cf_rci_datos_proyecto (
  proyecto_id uuid primary key references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cf_rci_datos_proyecto enable row level security;


-- ── Índices FK y de consulta (20260814000005 + 20261005000024)
create index if not exists idx_cf_anulaciones_bajantes_pluviales_user on public.cf_anulaciones_bajantes_pluviales(user_id);
create index if not exists idx_cf_anulaciones_canales_pluviales_user on public.cf_anulaciones_canales_pluviales(user_id);
create index if not exists idx_cf_bajante_conexiones_user on public.cf_bajante_conexiones(user_id);
create index if not exists idx_cf_bomba_datos_proyecto_user on public.cf_bomba_datos_proyecto(user_id);
create index if not exists idx_cf_ep_datos_proyecto_user on public.cf_ep_datos_proyecto(user_id);
create index if not exists idx_cf_gas_datos_proyecto_user on public.cf_gas_datos_proyecto(user_id);
create index if not exists idx_cf_criterios_proyecto_user on public.cf_criterios_proyecto(user_id);
create index if not exists idx_cf_materiales_proyecto_user on public.cf_materiales_proyecto(user_id);
create index if not exists idx_cf_profundidades_proyecto_user on public.cf_profundidades_proyecto(user_id);
create index if not exists idx_cf_pisos_user on public.cf_pisos(user_id);
create index if not exists idx_cf_proyecto_general_user on public.cf_proyecto_general(user_id);
create index if not exists idx_cf_planos_active_net on public.cf_planos(active_net);
create index if not exists idx_cf_planos_areas_net on public.cf_planos_areas(net);
create index if not exists idx_cf_planos_areas_user on public.cf_planos_areas(user_id);
create index if not exists idx_cf_planos_bajantes_net_fk on public.cf_planos_bajantes(net);
create index if not exists idx_cf_planos_bajantes_user on public.cf_planos_bajantes(user_id);
create index if not exists idx_cf_planos_anotaciones_texto_user on public.cf_planos_anotaciones_texto(user_id);
create index if not exists idx_cf_planos_dimensiones_user on public.cf_planos_dimensiones(user_id);
create index if not exists idx_cf_planos_lineas_guia_net on public.cf_planos_lineas_guia(net);
create index if not exists idx_cf_planos_lineas_guia_user on public.cf_planos_lineas_guia(user_id);
create index if not exists idx_cf_planos_ramales_net_fk on public.cf_planos_ramales(net);
create index if not exists idx_cf_planos_ramales_user on public.cf_planos_ramales(user_id);
create index if not exists idx_cf_planos_fantasmas_entrepisos_red on public.cf_planos_fantasmas_entrepisos(red);
create index if not exists idx_cf_planos_fantasmas_entrepisos_plano_origen on public.cf_planos_fantasmas_entrepisos(plano_origen_id);
create index if not exists idx_cf_planos_fantasmas_entrepisos_user on public.cf_planos_fantasmas_entrepisos(user_id);
create index if not exists idx_cm_cuadrilla_integrantes_cargo on public.cm_cuadrilla_integrantes(cargo_id);
create index if not exists idx_cm_cuadrilla_integrantes_user on public.cm_cuadrilla_integrantes(user_id);
create index if not exists idx_cm_insumos_proveedor on public.cm_insumos(proveedor_id);
