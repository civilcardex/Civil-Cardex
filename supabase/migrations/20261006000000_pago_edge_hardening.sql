-- Endurecimiento de las edge functions Lemon Squeezy (auditoría 2026-10-06).
-- C-1: suscripciones_habilitadas() quedó sin EXECUTE para service_role cuando
--      20260924000001 revocó public/anon (los grants a service_role de activar/
--      intenciones sí existían; este fue el olvidado) → crear-checkout devolvía
--      siempre 400 "suscripciones_deshabilitadas" con el error del RPC tragado.
-- I-2: el anti-spam de intenciones era check-then-insert en TS (TOCTOI: N requests
--      paralelas pasaban todas el cap de 5/h). Ahora es UNA RPC atómica: advisory
--      lock por usuario serializa count+insert.

-- ═══ C-1 · EXECUTE del gate para service_role ═══════════════════════════════
grant execute on function public.suscripciones_habilitadas() to service_role;

-- ═══ I-2 · Intención de pago atómica (cap 5/h por usuario, sin carrera) ═════
-- Inserta la fila 'pendiente' SOLO si el usuario no superó el cap. La llamada
-- la hace crear-checkout con service-role (los clientes no tienen EXECUTE).
create or replace function public.registrar_intencion_pago(
  p_uid uuid,
  p_referencia text,
  p_modulos text[],
  p_periodo text,
  p_monto bigint,
  p_puestos jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recientes bigint;
begin
  -- Serializa las intenciones del MISMO usuario (lock suelto al commit): dos
  -- requests paralelas ya no ven ambas el mismo count.
  perform pg_advisory_xact_lock(hashtextextended(p_uid::text, 0));

  select count(*) into v_recientes
  from public.app_pagos
  where user_id = p_uid
    and estado = 'pendiente'
    and created_at > now() - interval '1 hour';
  if v_recientes >= 5 then
    return false;
  end if;

  insert into public.app_pagos
    (referencia, user_id, modulos, periodo, monto_centavos, moneda, estado, puestos_por_modulo)
  values
    (p_referencia, p_uid, p_modulos, p_periodo, p_monto, 'USD', 'pendiente', p_puestos);
  return true;
end;
$$;

revoke execute on function
  public.registrar_intencion_pago(uuid, text, text[], text, bigint, jsonb)
from public, anon;
grant execute on function
  public.registrar_intencion_pago(uuid, text, text[], text, bigint, jsonb)
to service_role;

-- ═══ VERIFICACIÓN ═══════════════════════════════════════════════════════════
-- select has_function_privilege('service_role', 'public.suscripciones_habilitadas()', 'execute');  -- true
-- select has_function_privilege('anon', 'public.registrar_intencion_pago(uuid,text,text[],text,bigint,jsonb)', 'execute');  -- false
