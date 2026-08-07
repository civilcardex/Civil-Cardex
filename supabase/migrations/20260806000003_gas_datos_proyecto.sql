-- =========================================================================
-- CivilFlow — persistencia de datos generales de diseño de gas
-- (gas_datos_proyecto)
--
-- Gap 3 de la auditoría de persistencia: GasDesign guardaba altitud/presión
-- atmosférica/temperatura/presión mínima/densidad relativa solo en
-- localStorage (GAS_DATOS_KEY), y se perdían fuera del equipo/sesión. Tabla
-- 1:1 con proyectos, patrón proyecto_general (ver 20260730000001): proyecto_id
-- como PK que también referencia a proyectos, sin PK sustituta. Columnas
-- vacías por defecto — los valores por defecto reales (GAS_DATOS_DEFAULT en
-- src/modules/civilflow/utils/gasRows.ts) los resuelve el cliente con el
-- fallback de su caché/localStorage cuando la fila no existe.
-- =========================================================================

create table public.gas_datos_proyecto (
  proyecto_id bigint primary key references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  altitud text not null default '',
  presion_atm text not null default '',
  temperatura text not null default '',
  presion_min text not null default '',
  densidad_relativa text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gas_datos_proyecto enable row level security;
create policy "gas_datos_proyecto_owner_select" on public.gas_datos_proyecto for select using ((select auth.uid()) = user_id);
create policy "gas_datos_proyecto_owner_insert" on public.gas_datos_proyecto for insert with check ((select auth.uid()) = user_id);
create policy "gas_datos_proyecto_owner_update" on public.gas_datos_proyecto for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "gas_datos_proyecto_owner_delete" on public.gas_datos_proyecto for delete using ((select auth.uid()) = user_id);

-- Defense-in-depth, mismo criterio que 20260731000003_revoke_anon_grants.sql
-- (RLS ya bloquea a anon, pero Supabase le otorga CRUD por defecto en tablas
-- nuevas del schema public).
revoke all on table public.gas_datos_proyecto from anon;
