alter table public.app_pagos add column paddle_entorno text
  check (paddle_entorno in ('sandbox', 'production'));

-- Clasifica compras anteriores solo cuando su cliente está identificado en un único entorno.
update public.app_pagos p
set paddle_entorno = c.entorno
from (
  select customer_id, min(entorno) as entorno
  from public.app_paddle_customers
  group by customer_id
  having count(*) = 1
) c
where p.paddle_customer_id = c.customer_id;

create table public.app_subscription_emails (
  clave text primary key,
  tipo text not null check (tipo in ('pago', 'vencimiento')),
  entorno text not null check (entorno in ('sandbox', 'production')),
  user_id uuid not null references auth.users(id) on delete cascade,
  pago_id bigint not null references public.app_pagos(id) on delete cascade,
  suscripcion_id bigint references public.app_suscripciones(id) on delete cascade,
  fecha_fin timestamptz,
  intentos integer not null default 0,
  primer_intento_en timestamptz,
  procesar_desde timestamptz not null default now(),
  enviado_en timestamptz,
  proveedor_id text
);

alter table public.app_subscription_emails enable row level security;
revoke all on public.app_subscription_emails from public, anon, authenticated;
grant select, update on public.app_subscription_emails to service_role;

create index app_subscription_emails_pending_idx
  on public.app_subscription_emails (entorno, procesar_desde, clave) where enviado_en is null;
create index app_suscripciones_vencimientos_idx
  on public.app_suscripciones (fecha_fin) where estado = 'activa';
create index app_pagos_email_reciente_idx
  on public.app_pagos (user_id, aprobado_at desc, id desc) where estado = 'aprobado';

create function public.encolar_correo_pago()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_subscription_emails (clave, tipo, entorno, user_id, pago_id)
  values ('pago/' || new.id, 'pago', new.paddle_entorno, new.user_id, new.id)
  on conflict (clave) do nothing;
  return new;
end;
$$;

create trigger app_pagos_encolar_correo
after update of estado on public.app_pagos
for each row when (
  old.estado is distinct from new.estado and new.estado = 'aprobado' and new.paddle_entorno is not null
)
execute function public.encolar_correo_pago();

create function public.reclamar_correos_suscripcion(p_entorno text, p_usuario_prueba uuid)
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
        and (c.tipo = 'pago' or exists (
          select 1 from public.app_suscripciones s
          where s.id = c.suscripcion_id and s.estado = 'activa'
            and s.fecha_fin = c.fecha_fin and s.fecha_fin > now()
        ))
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
      case when c.tipo = 'pago' then p.modulos else array[s.modulo] end, p.referencia, c.fecha_fin
    from lote_reservado c
    join public.app_pagos p on p.id = c.pago_id
    join auth.users u on u.id = c.user_id
    left join public.app_suscripciones s on s.id = c.suscripcion_id;
  end if;
end;
$$;

revoke execute on function public.encolar_correo_pago(),
  public.reclamar_correos_suscripcion(text, uuid) from public, anon, authenticated;
grant execute on function public.reclamar_correos_suscripcion(text, uuid) to service_role;
