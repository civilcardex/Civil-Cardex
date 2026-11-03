-- =========================================================================
-- CivilFlow — árbitro de concurrencia para save_rci_datos (p_cliente_ts)
--
-- Síntoma (review R8): saveRciDatos era un upsert CIEGO — dos sesiones con
-- el mismo proyecto abierto (o dos pestañas) y la última en guardar pisaba
-- la versión de la otra sin preguntar, aunque la suya partiera de un blob
-- viejo ("mayor ts gana" se aplicaba en todo el resto del proyecto —
-- save_proyecto / planos / trazos — menos aquí).
--
-- FIX (patrón del árbitro del repo, "mayor gana", conservado simple):
--   - el RPC gana un parámetro OPCIONAL p_cliente_ts (timestamptz, default
--     null): con null escribe igual (compatibilidad con el cliente viejo y
--     con el primer guardado sin lectura previa),
--   - con ts, el upsert SOLO pisa si el updated_at de la fila es null o
--     anterior/equal al del cliente (p_cliente_ts >= updated_at); si el
--     remoto es MÁS NUEVO, la escritura se salta y el RPC lanza 'rci_stale'
--     (el cliente la distingue de un fallo real: devError, sin alarma al
--     canal de guardados),
--   - el wrapper/impl devuelven el updated_at EFECTIVO (timestamptz): el
--     cliente lo recuerda para el próximo guardado — todos los ts viven en
--     el servidor, el reloj del cliente no entra a la ecuación.
-- Cambio de firma (return void → timestamptz + parámetro nuevo) → DROP +
-- CREATE (CREATE OR REPLACE no puede cambiar tipo de retorno ni args).
-- El cuerpo es el de 20261102000000 con las 2 adiciones — ninguna otra
-- migración lo ha tocado desde entonces.
-- ⚠️ APLICAR EN SQL EDITOR (el cliente tolera el RPC viejo: data null se
-- interpreta como guardado exitoso sin árbitro).
-- =========================================================================

drop function if exists public.save_rci_datos(uuid, jsonb);
drop function if exists public.save_rci_datos_impl(uuid, jsonb);

create function public.save_rci_datos_impl(
  p_proyecto_id uuid,
  p_datos jsonb,
  p_cliente_ts timestamptz default null
)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_ts timestamptz;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (
    select 1 from public.cf_proyectos p
    where p.id = p_proyecto_id
      and (p.user_id = uid or public.empresa_escritura(p.user_id, 'flow'))
  ) then
    raise exception 'no_autorizado';
  end if;
  -- Árbitro: el WHERE del do-update deja la escritura en no-op cuando el remoto es más
  -- nuevo que lo que vio el cliente → RETURNING no devuelve filas → v_ts null → rci_stale.
  insert into public.cf_rci_datos_proyecto (proyecto_id, user_id, datos, updated_at)
  values (p_proyecto_id, uid, coalesce(p_datos, '{}'::jsonb), now())
  on conflict (proyecto_id) do update set
    datos = excluded.datos, updated_at = now()
    where p_cliente_ts is null
       or cf_rci_datos_proyecto.updated_at is null
       or p_cliente_ts >= cf_rci_datos_proyecto.updated_at
  returning updated_at into v_ts;
  if v_ts is null then
    raise exception 'rci_stale: otra sesión guardó una versión más nueva del diseño RCI; recarga para verla';
  end if;
  return v_ts;
end;
$$;

-- Wrapper delgado: única superficie PostgREST, con candado de USO (acceso_modulo
-- devuelve true con suscripciones_activas=false — sin cambio hasta activar).
create function public.save_rci_datos(
  p_proyecto_id uuid,
  p_datos jsonb,
  p_cliente_ts timestamptz default null
)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_ts timestamptz;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  v_ts := public.save_rci_datos_impl(p_proyecto_id, p_datos, p_cliente_ts);
  return v_ts;
end;
$$;

-- Grants: impl inaccesible (solo el wrapper SECURITY DEFINER lo llama),
-- wrapper al usuario — igual que el par original de 20261102000000.
revoke all on function public.save_rci_datos_impl(uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.save_rci_datos(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.save_rci_datos(uuid, jsonb, timestamptz) to authenticated;

comment on function public.save_rci_datos(uuid, jsonb, timestamptz) is
  'CivilFlow: guarda el estado RCI con árbitro de concurrencia — p_cliente_ts null escribe siempre; con ts, solo pisa si el updated_at de la fila es anterior. Devuelve el updated_at efectivo (null + excepcion rci_stale si el remoto era mas nuevo).';

notify pgrst, 'reload schema';
