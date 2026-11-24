alter table public.app_pagos add column if not exists paddle_customer_id text check (paddle_customer_id ~ '^ctm_[a-z0-9]{26}$');

create index if not exists app_pagos_portal_idx
  on public.app_pagos (user_id, aprobado_at desc, id desc)
  where estado = 'aprobado' and paddle_customer_id is not null;

-- La orden ya tiene el ID (identificador) que devolvió Paddle al crear el checkout.
-- Ej: repetir el webhook del mismo pago conserva los puestos y la misma fecha de fin.
create or replace function public.confirmar_pago_paddle(
  p_referencia text, p_txn_id text, p_customer_id text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pago public.app_pagos%rowtype;
begin
  select * into v_pago
  from public.app_pagos
  where referencia = p_referencia and txn_id = p_txn_id
  for update;

  if not found or v_pago.estado not in ('pendiente', 'aprobado') then
    return;
  end if;

  if v_pago.estado = 'pendiente' then
    perform public.activar_suscripciones(p_referencia, p_txn_id);
  end if;

  update public.app_pagos
  set paddle_customer_id = p_customer_id
  where id = v_pago.id and estado = 'aprobado' and paddle_customer_id is null;
end;
$$;

revoke execute on function public.confirmar_pago_paddle(text, text, text)
  from public, anon, authenticated;
grant execute on function public.confirmar_pago_paddle(text, text, text) to service_role;
