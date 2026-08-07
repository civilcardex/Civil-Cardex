-- =========================================================================
-- CivilFlow — persistencia del catálogo de aparatos por usuario
-- (aparatos_usuario)
--
-- Gap 1 de la auditoría de persistencia: ApparatusContext guardaba el
-- catálogo de aparatos solo en localStorage (APS_STORAGE_KEY) y se perdía
-- fuera del equipo/sesión. Esta tabla replica la forma de
-- aparatos_catalogo_global (que queda como catálogo base para usuarios sin
-- filas propias) más user_id/client_id; `aps_v5` de localStorage pasa a ser
-- caché en vivo y la BD la fuente de verdad. Se guarda el snapshot completo
-- del catálogo (borra-e-inserta por usuario), así el catálogo base se copia
-- a la fila del usuario en cuanto este lo modifica.
--
-- aparatos_ud_base_global ya existe (20260730000001, policy read para
-- authenticated) — ApparatusContext lo usa como base UD; sin cambios acá.
-- =========================================================================

create table public.aparatos_usuario (
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
create index idx_aparatos_usuario_user_id on public.aparatos_usuario(user_id);

alter table public.aparatos_usuario enable row level security;
create policy "aparatos_usuario_owner_select" on public.aparatos_usuario for select using ((select auth.uid()) = user_id);
create policy "aparatos_usuario_owner_insert" on public.aparatos_usuario for insert with check ((select auth.uid()) = user_id);
create policy "aparatos_usuario_owner_update" on public.aparatos_usuario for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "aparatos_usuario_owner_delete" on public.aparatos_usuario for delete using ((select auth.uid()) = user_id);

-- Defense-in-depth, mismo criterio que 20260731000003_revoke_anon_grants.sql.
revoke all on table public.aparatos_usuario from anon;
