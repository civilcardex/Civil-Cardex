-- Limpieza de esquema + fix de escrituras rotas (auditoría 2026-09-15).
-- 1) RPC save_proyecto_general_campo: af_alimentacion/tanque_npt/presion_garantizada se
--    guardaban con UPDATE DIRECTO sobre cf_proyecto_general, pero 20260813000003 revocó
--    INSERT/UPDATE/DELETE a authenticated (escrituras solo vía SECURITY DEFINER) → los 3
--    saves fallaban con permission denied en silencio desde entonces.
-- 2) drop de tablas de staging one-time (legacy_*) y de RPC fantasma (nunca creado).
-- Idempotente. APLICAR EN SQL EDITOR. El diagnóstico de políticas RLS duplicadas va en
-- comentario al final (limpieza manual dirigida solo si muestra duplicados).
-- UP

create or replace function public.save_proyecto_general_campo(
  p_proyecto_id bigint,
  p_campo text,
  p_valor text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  -- Whitelist cerrada: solo estos 3 campos se escriben por esta vía (los demás van por
  -- save_proyecto_core). Cualquier otro nombre rechaza.
  if p_campo not in ('af_alimentacion', 'tanque_npt', 'presion_garantizada') then
    raise exception 'campo_no_permitido';
  end if;
  -- Cascarón si el proyecto aún no tiene fila en cf_proyecto_general (el UPDATE de abajo
  -- con 0 filas sería un no-op silencioso).
  insert into public.cf_proyecto_general (proyecto_id, user_id, nombre, updated_at)
  values (p_proyecto_id, uid, '', now())
  on conflict (proyecto_id) do nothing;
  -- UPDATE dinámico: el nombre de columna sale de la whitelist (identificador citado con %I).
  execute format(
    'update public.cf_proyecto_general set %I = $1, updated_at = now() where proyecto_id = $2',
    p_campo
  ) using p_valor, p_proyecto_id;
end;
$$;

grant execute on function public.save_proyecto_general_campo(bigint, text, text) to authenticated;
revoke execute on function public.save_proyecto_general_campo(bigint, text, text) from public, anon;

-- Staging one-time de la migración de datos legacy (20260730000003): nunca creadas por
-- migraciones; si alguien las creó a mano para esa corrida, ya no se necesitan.
drop table if exists public.legacy_plano_trazos;
drop table if exists public.legacy_proyecto_data;
drop table if exists public.legacy_proyectos;

-- RPC fantasma: ninguna migración lo crea; el bloque condicional de 20260814000002 era no-op.
drop function if exists public.get_proyecto_data_ep_bomba(bigint);

-- DIAGNÓSTICO de políticas RLS duplicadas (correr a mano; solo cf_anulaciones_* tuvo
-- duplicados históricos y 20260814000003 ya los reconstruyó):
--   select tablename, cmd, policyname from pg_policies
--   where schemaname = 'public' order by tablename, cmd, policyname;
-- Dos policies permissivas con mismo (tablename, cmd, roles) hacen OR entre sí: si aparecen
-- dos que expresan la misma regla de dueño, drop de la más vieja.

-- DOWN
drop function if exists public.save_proyecto_general_campo(bigint, text, text);
