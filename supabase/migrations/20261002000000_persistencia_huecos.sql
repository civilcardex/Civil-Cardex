-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261002000000 — Huecos de persistencia (auditoría 2026-10-02): columnas, NO tablas nuevas
--
--   1. cm_presupuestos: tipo_precio_formulario + alarmas_precio_faltante — existían en el
--      tipo Presupuesto del cliente (types.ts) pero sin columna en BD ni en la whitelist
--      del upsert → se perdían al recargar desde BD (solo sobrevivían en el blob IndexedDB).
--   2. cf_proyecto_general: rejillas jsonb — overrides NTC 3631 + tipo de gas (natural/glp):
--      el único dataset de usuario de civilflow que vivía SOLO en localStorage
--      (civilflow_rejillas_overrides_v1 / civilflow_rejillas_gas).
--   3. save_proyecto_general_campo: whitelist + 'rejillas' con rama ::jsonb. Cuerpo vigente
--      de 20260915000000 extendido — create or replace = auto-suficiente aunque esa
--      migración no se haya aplicado. Grants re-emitidos por claridad.
--
-- La lectura NO requiere RPC nuevo: get_proyecto_data ya devuelve la fila completa de
-- cf_proyecto_general con to_jsonb(pg) → la columna nueva viaja sola.
--
-- Idempotente. APLICAR EN SQL EDITOR. No requiere re-deploy de edge functions.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) Columnas nuevas ═════════════════════════════════════════════════════════════════
alter table public.cm_presupuestos
  add column if not exists tipo_precio_formulario jsonb;
alter table public.cm_presupuestos
  add column if not exists alarmas_precio_faltante jsonb;
alter table public.cf_proyecto_general
  add column if not exists rejillas jsonb;

-- ═══ 2) save_proyecto_general_campo: whitelist + 'rejillas' ═════════════════════════════
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
  -- Whitelist cerrada: 3 campos históricos (text/num) + 'rejillas' (blob jsonb NTC 3631).
  -- Cualquier otro nombre rechaza.
  if p_campo not in ('af_alimentacion', 'tanque_npt', 'presion_garantizada', 'rejillas') then
    raise exception 'campo_no_permitido';
  end if;
  -- Cascarón si el proyecto aún no tiene fila en cf_proyecto_general.
  insert into public.cf_proyecto_general (proyecto_id, user_id, nombre, updated_at)
  values (p_proyecto_id, uid, '', now())
  on conflict (proyecto_id) do nothing;
  -- 'rejillas' es jsonb: el parámetro text necesita cast explícito (no hay assignment cast
  -- text→jsonb); los 3 campos históricos reciben el text tal cual como siempre.
  if p_campo = 'rejillas' then
    execute format(
      'update public.cf_proyecto_general set %I = $1::jsonb, updated_at = now() where proyecto_id = $2',
      p_campo
    ) using p_valor, p_proyecto_id;
  else
    execute format(
      'update public.cf_proyecto_general set %I = $1, updated_at = now() where proyecto_id = $2',
      p_campo
    ) using p_valor, p_proyecto_id;
  end if;
end;
$$;

grant execute on function public.save_proyecto_general_campo(bigint, text, text) to authenticated;
revoke execute on function public.save_proyecto_general_campo(bigint, text, text) from public, anon;

-- ═══ VERIFICACIÓN ═══════════════════════════════════════════════════════════════════════
-- select table_name, column_name, data_type from information_schema.columns
--  where table_name in ('cm_presupuestos', 'cf_proyecto_general')
--    and column_name in ('tipo_precio_formulario', 'alarmas_precio_faltante', 'rejillas');
-- select prosrc like '%rejillas%' from pg_proc
--  where proname = 'save_proyecto_general_campo';                     -- true
-- select proacl from pg_proc where proname = 'save_proyecto_general_campo';  -- solo authenticated
