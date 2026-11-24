create table public.app_paddle_customers (
  entorno text not null check (entorno in ('sandbox', 'production')),
  customer_id text not null check (customer_id ~ '^ctm_[a-z0-9]{26}$'),
  email text not null,
  ultimo_evento_en timestamptz not null,
  primary key (entorno, customer_id)
);

create index app_paddle_customers_email_idx on public.app_paddle_customers (entorno, email);

create table public.app_paddle_subscriptions (
  entorno text not null check (entorno in ('sandbox', 'production')),
  subscription_id text not null check (subscription_id ~ '^sub_[a-z0-9]{26}$'),
  customer_id text not null check (customer_id ~ '^ctm_[a-z0-9]{26}$'),
  estado text not null check (estado in ('active', 'trialing', 'past_due', 'paused', 'canceled')),
  articulos jsonb not null check (jsonb_typeof(articulos) = 'array'),
  cambio_programado text,
  cambio_en timestamptz,
  ultimo_evento_en timestamptz not null,
  primary key (entorno, subscription_id)
);

-- La suscripción puede llegar antes del evento del cliente.
create index app_paddle_subscriptions_customer_idx
  on public.app_paddle_subscriptions (entorno, customer_id, ultimo_evento_en desc);

alter table public.app_paddle_customers enable row level security;
alter table public.app_paddle_subscriptions enable row level security;
revoke all on public.app_paddle_customers, public.app_paddle_subscriptions from public, anon, authenticated;
grant select, insert, update on public.app_paddle_customers, public.app_paddle_subscriptions to service_role;

create function public.sincronizar_paddle_cliente(
  p_entorno text, p_customer_id text, p_email text, p_evento_en timestamptz
)
returns void language sql security invoker set search_path = '' as $$
  insert into public.app_paddle_customers as c (entorno, customer_id, email, ultimo_evento_en)
  values (p_entorno, p_customer_id, lower(trim(p_email)), p_evento_en)
  on conflict (entorno, customer_id) do update
    set email = excluded.email, ultimo_evento_en = excluded.ultimo_evento_en
    where c.ultimo_evento_en < excluded.ultimo_evento_en;
$$;

create function public.sincronizar_paddle_suscripcion(
  p_entorno text, p_subscription_id text, p_customer_id text, p_estado text,
  p_articulos jsonb, p_cambio_programado text, p_cambio_en timestamptz, p_evento_en timestamptz
)
returns void language sql security invoker set search_path = '' as $$
  insert into public.app_paddle_subscriptions as s (
    entorno, subscription_id, customer_id, estado, articulos,
    cambio_programado, cambio_en, ultimo_evento_en
  ) values (
    p_entorno, p_subscription_id, p_customer_id, p_estado, p_articulos,
    p_cambio_programado, p_cambio_en, p_evento_en
  )
  on conflict (entorno, subscription_id) do update set
    customer_id = excluded.customer_id, estado = excluded.estado, articulos = excluded.articulos,
    cambio_programado = excluded.cambio_programado, cambio_en = excluded.cambio_en,
    ultimo_evento_en = excluded.ultimo_evento_en
    where s.ultimo_evento_en < excluded.ultimo_evento_en;
$$;

-- Ej: active con cancelación programada conserva acceso hasta cambiar de estado.
create function public.paddle_suscripcion_da_acceso(p_entorno text, p_subscription_id text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.app_paddle_subscriptions
    where entorno = p_entorno and subscription_id = p_subscription_id
      and estado in ('active', 'trialing')
  );
$$;

revoke execute on function public.sincronizar_paddle_cliente(text, text, text, timestamptz),
  public.sincronizar_paddle_suscripcion(text, text, text, text, jsonb, text, timestamptz, timestamptz),
  public.paddle_suscripcion_da_acceso(text, text) from public, anon, authenticated;
grant execute on function public.sincronizar_paddle_cliente(text, text, text, timestamptz),
  public.sincronizar_paddle_suscripcion(text, text, text, text, jsonb, text, timestamptz, timestamptz),
  public.paddle_suscripcion_da_acceso(text, text) to service_role;
