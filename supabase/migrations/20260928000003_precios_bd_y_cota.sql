-- CATÁLOGO ÚNICO en BD (auditoría ronda 8, deuda #4) + COTA de intenciones (deuda #3).
--
-- #4: los precios vivían en 2 archivos (cliente src/lib/suscripciones/catalogo.ts y edge
-- supabase/functions/_shared/wompi.ts) copiados a mano. Drift = UI dice $19.900 y el
-- servidor cobra otro valor. Ahora la ÚNICA verdad es app_precios: el edge la lee al crear
-- la intención y el cliente vía RPC obtener_catalogo. Cambiar precio = UPDATE en SQL Editor,
-- sin deploy. Los literales de ambos archivos quedan como fallback/bootstrap (test de
-- paridad sigue como red).
-- #3: cota dura GLOBAL de intenciones por usuario/hora (la BD es una — no se diluye entre
-- instancias del runtime como un contador in-memory).
-- ⚠️ APLICAR EN SQL EDITOR.

-- ═══ 1) app_precios ═══════════════════════════════════════════════════════════════════
create table if not exists public.app_precios (
  modulo text primary key check (modulo in ('flow', 'manage')),
  precio_mensual_centavos bigint not null,
  precio_anual_centavos bigint not null,
  updated_at timestamptz not null default now()
);

-- Seed con los precios vigentes (los mismos literales de ambos archivos hoy).
insert into public.app_precios (modulo, precio_mensual_centavos, precio_anual_centavos)
values
  ('flow',   1990000, 19900000),
  ('manage', 1990000, 19900000)
on conflict (modulo) do nothing;

-- RLS: solo el service_role (edge) escribe; el cliente lee vía RPC.
alter table public.app_precios enable row level security;

-- ═══ 2) RPC obtener_catalogo (cliente autenticado) ════════════════════════════════════
create or replace function public.obtener_catalogo()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    jsonb_object_agg(
      modulo,
      jsonb_build_object(
        'id', modulo,
        'precioMensualCentavos', precio_mensual_centavos,
        'precioAnualCentavos', precio_anual_centavos
      )
    ),
    '{}'::jsonb
  )
  from public.app_precios;
$$;

revoke execute on function public.obtener_catalogo() from public, anon;
grant execute on function public.obtener_catalogo() to authenticated;

-- ═══ 3) Cota de intenciones: helper reutilizable por crear-intencion-pago ═════════════
-- Global (una BD): cuenta intents pendientes del usuario en la última hora; >20 → abuso.
create or replace function public.intenciones_recientes(p_uid uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*)
  from public.app_pagos
  where user_id = p_uid
    and estado = 'pendiente'
    and created_at > now() - interval '1 hour';
$$;

revoke execute on function public.intenciones_recientes(uuid) from public, anon;
grant execute on function public.intenciones_recientes(uuid) to service_role;

-- ═══ VERIFICACIÓN ═════════════════════════════════════════════════════════════════════
-- select * from public.app_precios;                       -- 2 filas
-- select public.obtener_catalogo();                      -- JSON con ambos módulos
