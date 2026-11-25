-- Seguimiento de la migración 20261125000000: un aviso de pago fallido que nunca se
-- reclamó (sin plantilla, con el cron apagado) no puede salir días después del rechazo.
-- La ventana de reintentos de 23 h solo contempla filas YA intentadas; aquí se añade
-- una vigencia propia desde que ocurrió el fallo. Re-ejecutable.

alter table public.app_subscription_emails
  add column if not exists fallo_en timestamptz;

-- Las filas creadas por la migración base nacieron con procesar_desde = fallo + 5 min.
update public.app_subscription_emails
  set fallo_en = procesar_desde - interval '5 minutes'
  where tipo = 'pago_fallido' and fallo_en is null;

create or replace function public.encolar_correo_pago_fallido(
  p_referencia text, p_user_id text, p_txn_id text, p_entorno text
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_pago public.app_pagos%rowtype;
begin
  select * into v_pago from public.app_pagos
  where referencia = p_referencia for update;

  if not found or v_pago.user_id::text is distinct from p_user_id or v_pago.estado <> 'pendiente' then
    return 'ignorado';
  end if;
  if v_pago.txn_id is null then
    return 'sin_vincular';
  end if;
  if v_pago.txn_id is distinct from p_txn_id or v_pago.paddle_entorno is distinct from p_entorno then
    return 'ignorado';
  end if;

  insert into public.app_subscription_emails
    (clave, tipo, entorno, user_id, pago_id, procesar_desde, fallo_en)
  values ('pago_fallido/' || v_pago.id, 'pago_fallido', p_entorno, v_pago.user_id, v_pago.id,
          now() + interval '5 minutes', now())
  on conflict (clave) do nothing;
  return 'aceptado';
end;
$$;

create or replace function public.reclamar_correos_suscripcion(
  p_entorno text, p_usuario_prueba uuid, p_incluir_fallidos boolean
)
returns table (
  clave text, tipo text, intentos integer, email text,
  modulos text[], referencia text, fecha_fin timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  if (p_entorno = 'sandbox' and p_usuario_prueba is not null)
    or (p_entorno = 'production' and p_usuario_prueba is null) then
    insert into public.app_subscription_emails (
      clave, tipo, entorno, user_id, pago_id, suscripcion_id, fecha_fin
    )
    select 'vencimiento/' || s.id || '/' || extract(epoch from s.fecha_fin),
      'vencimiento', p_entorno, s.user_id, p.id, s.id, s.fecha_fin
    from public.app_suscripciones s
    cross join lateral (
      select pago.id, pago.paddle_entorno
      from public.app_pagos pago
      where pago.user_id = s.user_id and pago.estado = 'aprobado' and s.modulo = any(pago.modulos)
      order by pago.aprobado_at desc nulls last, pago.id desc
      limit 1
    ) p
    where s.estado = 'activa' and s.fecha_fin > now() and s.fecha_fin <= now() + interval '7 days'
      and p.paddle_entorno = p_entorno and (p_usuario_prueba is null or s.user_id = p_usuario_prueba)
    on conflict on constraint app_subscription_emails_pkey do nothing;

    return query
    with lote as (
      select c.clave
      from public.app_subscription_emails c
      join auth.users u on u.id = c.user_id and u.email is not null and u.email_confirmed_at is not null
      where c.entorno = p_entorno and c.enviado_en is null and c.procesar_desde <= now()
        and (p_usuario_prueba is null or c.user_id = p_usuario_prueba)
        and (c.primer_intento_en is null or c.primer_intento_en > now() - interval '23 hours')
        and (
          c.tipo = 'pago'
          or (p_incluir_fallidos and c.tipo = 'pago_fallido'
            and (c.fallo_en is null or c.fallo_en > now() - interval '48 hours')
            and exists (
              select 1 from public.app_pagos p where p.id = c.pago_id and p.estado = 'pendiente'
            ))
          or (c.tipo = 'vencimiento' and exists (
            select 1 from public.app_suscripciones s
            where s.id = c.suscripcion_id and s.estado = 'activa'
              and s.fecha_fin = c.fecha_fin and s.fecha_fin > now()
          ))
        )
      order by c.procesar_desde, c.clave
      limit 20
      for update of c skip locked
    ), lote_reservado as (
      update public.app_subscription_emails c
      set intentos = c.intentos + 1, primer_intento_en = coalesce(c.primer_intento_en, now()),
        procesar_desde = now() + interval '5 minutes'
      from lote where c.clave = lote.clave
      returning c.*
    )
    select c.clave, c.tipo, c.intentos, u.email::text,
      case when c.tipo = 'vencimiento' then array[s.modulo] else p.modulos end, p.referencia, c.fecha_fin
    from lote_reservado c
    join public.app_pagos p on p.id = c.pago_id
    join auth.users u on u.id = c.user_id
    left join public.app_suscripciones s on s.id = c.suscripcion_id;
  end if;
end;
$$;

revoke execute on function public.encolar_correo_pago_fallido(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.encolar_correo_pago_fallido(text, text, text, text) to service_role;
revoke execute on function public.reclamar_correos_suscripcion(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reclamar_correos_suscripcion(text, uuid, boolean) to service_role;
