-- =========================================================================
-- CivilFlow — persistencia de bomba sumergible trituradora (bomba_datos_proyecto)
--
-- Gap B de la auditoría de persistencia: BombaARDesign tenía los 15 inputs
-- en useState puro (se perdían al recargar/navegar) y escribía
-- 'civilflow_memoria_bomba_data' en localStorage sin releerlo jamás. Tabla
-- 1:1 con proyectos, patrón gas_datos_proyecto (20260806000003): proyecto_id
-- como PK que también referencia a proyectos, sin PK sustituta, RLS owner y
-- revoke anon. Columnas en snake_case = inputs de BombaARDesign.tsx.
-- Vacías por defecto; los valores por defecto los resuelve el cliente
-- (inputs de memoria/caché o vacíos).
-- =========================================================================

create table public.bomba_datos_proyecto (
  proyecto_id bigint primary key references public.proyectos(id) on delete cascade,
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
  updated_at timestamptz not null default now()
);

alter table public.bomba_datos_proyecto enable row level security;
create policy "bomba_datos_proyecto_owner_select" on public.bomba_datos_proyecto for select using ((select auth.uid()) = user_id);
create policy "bomba_datos_proyecto_owner_insert" on public.bomba_datos_proyecto for insert with check ((select auth.uid()) = user_id);
create policy "bomba_datos_proyecto_owner_update" on public.bomba_datos_proyecto for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bomba_datos_proyecto_owner_delete" on public.bomba_datos_proyecto for delete using ((select auth.uid()) = user_id);

-- Defense-in-depth, mismo criterio que 20260731000003_revoke_anon_grants.sql.
revoke all on table public.bomba_datos_proyecto from anon;
