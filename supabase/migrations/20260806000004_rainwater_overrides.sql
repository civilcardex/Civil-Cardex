-- =========================================================================
-- CivilFlow — persistencia de overrides manuales de drenaje pluvial
-- (rainwater_bajantes_overrides / rainwater_canales_overrides)
--
-- Gap 5 de la auditoría de persistencia: RainwaterContext guardaba las filas
-- editadas a mano (bajantes LL y canales LL) solo en estado React — se
-- perdían al recargar/reabrir el proyecto, aunque los valores autocalculados
-- siempre se regeneraban del dibujo. Estas tablas persisten SOLO los
-- overrides manuales; lo autocalculado sigue derivándose del dibujo en cada
-- render (canalesLlAuto). La clave natural es `bajante`/`sector` (los ids
-- BLL-n/CLL-n son efímeros, dependen del largo de la lista).
-- =========================================================================

create table public.rainwater_bajantes_overrides (
  id bigint generated always as identity primary key,
  proyecto_id bigint not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  bajante text not null,
  area_parcial numeric not null default 0,
  area_acumulada numeric not null default 0,
  intensidad numeric not null default 100,
  coeficiente_c numeric not null default 0.0278,
  R text not null default '',
  manning numeric not null default 0,
  diam_propuesto numeric not null default 0,
  unique (proyecto_id, client_id)
);
create index idx_rainwater_baj_overrides_proyecto on public.rainwater_bajantes_overrides(proyecto_id);

create table public.rainwater_canales_overrides (
  id bigint generated always as identity primary key,
  proyecto_id bigint not null references public.proyectos(id) on delete cascade,
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
  unique (proyecto_id, client_id)
);
create index idx_rainwater_canales_overrides_proyecto on public.rainwater_canales_overrides(proyecto_id);

alter table public.rainwater_bajantes_overrides enable row level security;
create policy "rainwater_bajantes_owner_select" on public.rainwater_bajantes_overrides for select using ((select auth.uid()) = user_id);
create policy "rainwater_bajantes_owner_insert" on public.rainwater_bajantes_overrides for insert with check ((select auth.uid()) = user_id);
create policy "rainwater_bajantes_owner_update" on public.rainwater_bajantes_overrides for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rainwater_bajantes_owner_delete" on public.rainwater_bajantes_overrides for delete using ((select auth.uid()) = user_id);

alter table public.rainwater_canales_overrides enable row level security;
create policy "rainwater_canales_owner_select" on public.rainwater_canales_overrides for select using ((select auth.uid()) = user_id);
create policy "rainwater_canales_owner_insert" on public.rainwater_canales_overrides for insert with check ((select auth.uid()) = user_id);
create policy "rainwater_canales_owner_update" on public.rainwater_canales_overrides for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rainwater_canales_owner_delete" on public.rainwater_canales_overrides for delete using ((select auth.uid()) = user_id);

-- Defense-in-depth, mismo criterio que 20260731000003_revoke_anon_grants.sql.
revoke all on table public.rainwater_bajantes_overrides, public.rainwater_canales_overrides from anon;
