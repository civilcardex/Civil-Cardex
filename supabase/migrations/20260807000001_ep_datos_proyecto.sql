-- =========================================================================
-- CivilFlow — persistencia del equipo de presión (ep_datos_proyecto)
--
-- Gap A de la auditoría de persistencia: PressureEquipmentDesign guardaba
-- los 25 campos del EP solo en localStorage (key global 'ep', no scoped a
-- proyecto) y se mezclaban/perdían fuera del equipo o entre proyectos.
-- Tabla 1:1 con proyectos, patrón gas_datos_proyecto (20260806000003):
-- proyecto_id como PK que también referencia a proyectos, sin PK sustituta,
-- RLS owner y revoke anon. Columnas en snake_case = campos de EPData
-- (src/modules/civilflow/components/ep/EPShared.tsx); modo con CHECK.
-- Columnas vacías por defecto — los valores por defecto reales
-- (EP_DEFAULTS) los resuelve el cliente al hidratar.
-- =========================================================================

create table public.ep_datos_proyecto (
  proyecto_id bigint primary key references public.proyectos(id) on delete cascade,
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
  updated_at timestamptz not null default now()
);

alter table public.ep_datos_proyecto enable row level security;
create policy "ep_datos_proyecto_owner_select" on public.ep_datos_proyecto for select using ((select auth.uid()) = user_id);
create policy "ep_datos_proyecto_owner_insert" on public.ep_datos_proyecto for insert with check ((select auth.uid()) = user_id);
create policy "ep_datos_proyecto_owner_update" on public.ep_datos_proyecto for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ep_datos_proyecto_owner_delete" on public.ep_datos_proyecto for delete using ((select auth.uid()) = user_id);

-- Defense-in-depth, mismo criterio que 20260731000003_revoke_anon_grants.sql.
revoke all on table public.ep_datos_proyecto from anon;
