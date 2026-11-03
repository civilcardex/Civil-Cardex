-- =========================================================================
-- CivilFlow — persistencia del diseño RCI (rci_datos_proyecto)
--
-- Fase 5 del plan RCI: el estado del motor (RciState — gris extraído del
-- plano + amarillos digitados) vivía solo en localStorage/sesión y se
-- perdía entre sesiones. Tabla 1:1 con proyectos, patrón
-- ep_datos_proyecto (20260807000001): proyecto_id como PK que también
-- referencia a proyectos, sin PK sustituta, RLS owner y revoke anon.
-- Diferencia clave: RciState es un estado anidado grande (redes por piso,
-- ramales, tramos, montantes, bomba, verificaciones) → NO se explota en
-- columnas; viaja completo en `datos jsonb` y el cliente lo hidrata.
-- Adaptado al estado ACTUAL de la BD (convenciones posteriores al patrón):
--   - prefijo cf_ (20260814000002 renombró todas las tablas de contenido),
--   - proyecto_id uuid → cf_proyectos(id) (20261005000007 pasó la PK de
--     proyectos a uuid y remapeó todas las hijas),
--   - escrituras SOLO vía RPC SECURITY DEFINER (20260813000003 revocó
--     insert/update/delete directos a authenticated; 20260928000001 partió
--     cada RPC en wrapper con candado acceso_modulo + *_impl),
--   - sharing empresarial (20261005000000): SELECT con empresa_lectura +
--     trigger trg_sellar_owner re-sella user_id al dueño.
-- updated_at: lo pone el impl (now() en insert y update), mismo mecanismo
-- que save_gas_datos — ni trigger ni cliente lo mandan.
-- ⚠️ APLICAR EN SQL EDITOR (el cliente tolera la tabla ausente: sin
-- aplicar, la app sigue funcionando sin persistencia RCI).
-- =========================================================================

-- Guard temprano: si cf_proyectos no existe, esta BD no recibió la ola
-- 20260814 (cf_prefix) → es otro proyecto o uno sin migrar. Fallar AQUÍ con
-- mensaje claro, no con un 42P01 críptico a mitad de la migración.
do $$ begin
  if to_regclass('public.cf_proyectos') is null then
    raise exception 'cf_proyectos no existe en esta BD: la app (VITE_SUPABASE_URL) apunta a otro proyecto, o este no recibió la ola de migraciones 20260814 (cf_prefix). Corre esta migración en el proyecto que usa la app.';
  end if;
end $$;

create table public.cf_rci_datos_proyecto (
  proyecto_id uuid primary key references public.cf_proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice de la FK, mismo criterio que idx_cf_ep_datos_proyecto_user (20260814000005).
create index if not exists idx_cf_rci_datos_proyecto_user on public.cf_rci_datos_proyecto(user_id);

alter table public.cf_rci_datos_proyecto enable row level security;

-- Policies: el ESTADO FINAL de ep (base 20260807000001 + ownership de
-- 20260813000001 en insert/update + empresa_lectura del SELECT por
-- 20261005000000). Delete queda owner-only (el sharing es de edición, no
-- de ciclo de vida).
create policy "rci_datos_proyecto_owner_select" on public.cf_rci_datos_proyecto for select using (
  (select auth.uid()) = user_id or public.empresa_lectura(user_id, 'flow')
);
create policy "rci_datos_proyecto_propietario_insertar" on public.cf_rci_datos_proyecto for insert with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.cf_proyectos p where p.id = cf_rci_datos_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "rci_datos_proyecto_propietario_actualizar" on public.cf_rci_datos_proyecto for update using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.cf_proyectos p where p.id = cf_rci_datos_proyecto.proyecto_id and p.user_id = (select auth.uid()))
);
create policy "rci_datos_proyecto_owner_delete" on public.cf_rci_datos_proyecto for delete using ((select auth.uid()) = user_id);

-- Defense-in-depth, mismo criterio que 20260731000003_revoke_anon_grants.sql
-- y 20260813000003_rls_write_lockdown.sql (las escrituras van SOLO por RPC).
revoke all on table public.cf_rci_datos_proyecto from anon;
revoke insert, update, delete on table public.cf_rci_datos_proyecto from authenticated;

-- ═══ RPC de escritura: wrapper con candado de USO + impl con guard ════════
-- Estructura idéntica a save_gas_datos (20260925000001) partida en
-- wrapper+impl (20260928000001), con el guard de empresa YA operado (la
-- cirugía de 20261005000000 convirtió `p.user_id = uid)` en la forma de
-- abajo en TODOS los impls vivos — aquí nace directamente operado).
create or replace function public.save_rci_datos_impl(p_proyecto_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (
    select 1 from public.cf_proyectos p
    where p.id = p_proyecto_id
      and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))
  ) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_rci_datos_proyecto (proyecto_id, user_id, datos, updated_at)
  values (p_proyecto_id, uid, coalesce(p_datos, '{}'::jsonb), now())
  on conflict (proyecto_id) do update set
    datos = excluded.datos, updated_at = now();
end;
$$;

-- Wrapper delgado: única superficie PostgREST, con candado de USO (acceso_modulo
-- devuelve true con suscripciones_activas=false — sin cambio hasta activar).
create or replace function public.save_rci_datos(p_proyecto_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_rci_datos_impl(p_proyecto_id, p_datos);
end;
$$;

-- Grants: impl inaccesible (solo el wrapper SECURITY DEFINER lo llama),
-- wrapper al usuario — igual que save_gas_datos_impl/save_gas_datos.
revoke all on function public.save_rci_datos_impl(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_rci_datos(uuid, jsonb) from public, anon;
grant execute on function public.save_rci_datos(uuid, jsonb) to authenticated;

-- Sharing empresarial: los INSERT/UPDATE de un miembro-editor quedan a nombre
-- del DUEÑO (mismo trigger que el resto de las tablas de contenido, agregado
-- a cf_ep_datos_proyecto et al. por 20261005000000).
drop trigger if exists trg_sellar_owner on public.cf_rci_datos_proyecto;
create trigger trg_sellar_owner before insert or update on public.cf_rci_datos_proyecto
  for each row execute function public.cf_sellar_owner_contenido();

comment on table public.cf_rci_datos_proyecto is
  'CivilFlow: estado completo del diseño RCI (RciState — geometria gris extraida del plano + amarillos digitados) por proyecto, 1:1 con cf_proyectos. El cliente lo hidrata; las escrituras van por save_rci_datos.';

notify pgrst, 'reload schema';
