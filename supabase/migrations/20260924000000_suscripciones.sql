-- =========================================================================
-- Suscripciones por módulo (flow / manage) — Wompi + vencimiento manual.
--
-- DESHABILITADO POR DEFECTO: cf_app_config.suscripciones_activas = false.
-- Con el flag apagado, acceso_modulo() devuelve true para todo el mundo →
-- save_proyecto y la política INSERT de cm_proyectos no bloquean a nadie.
-- Este deploy es seguro sin credenciales de Wompi.
--
-- ACTIVACIÓN (cuando existan las credenciales):
--   1) update public.cf_app_config set valor = true where clave = 'suscripciones_activas';
--   2) VITE_SUSCRIPCIONES=true en el deploy del frontend (Vercel).
--   3) supabase secrets set WOMPI_PUBLICO WOMPI_PRIVADO WOMPI_INTEGRIDAD WOMPI_EVENTOS
--      y desplegar supabase/functions (crear-intencion-pago, wompi-verify, wompi-webhook).
--   4) Revisar precios en src/lib/suscripciones/catalogo.ts (y su copia en
--      supabase/functions/_shared/wompi.ts).
-- =========================================================================

-- --------------------------------------------------------------------------
-- Config de flags de la app. Sin RLS policies: nadie la lee directo desde el
-- cliente (solo las funciones SECURITY DEFINER de abajo).
-- --------------------------------------------------------------------------
create table if not exists public.cf_app_config (
  clave text primary key,
  valor boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.cf_app_config (clave, valor) values ('suscripciones_activas', false)
on conflict (clave) do nothing;
revoke all on public.cf_app_config from anon, authenticated;

-- --------------------------------------------------------------------------
-- cf_suscripciones: una fila por (usuario, módulo). Renovar = extender fecha_fin.
-- Verificación mensual/anual = comparar fecha_fin contra now(); no hay cron.
-- --------------------------------------------------------------------------
create table if not exists public.cf_suscripciones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null check (modulo in ('flow', 'manage')),
  periodo text not null check (periodo in ('mensual', 'anual')),
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz not null,
  estado text not null default 'activa' check (estado in ('activa', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, modulo)
);
alter table public.cf_suscripciones enable row level security;
drop policy if exists cf_suscripciones_propietario_leer on public.cf_suscripciones;
create policy cf_suscripciones_propietario_leer on public.cf_suscripciones
  for select using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.cf_suscripciones from authenticated;
create index if not exists cf_suscripciones_usuario_idx on public.cf_suscripciones (user_id);

-- --------------------------------------------------------------------------
-- cf_pagos: ledger de pagos (intención de compra + resultado Wompi).
-- Escrituras solo desde las edge functions con service role (bypassa RLS).
-- --------------------------------------------------------------------------
create table if not exists public.cf_pagos (
  id bigint generated always as identity primary key,
  referencia text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  modulos text[] not null check (array_length(modulos, 1) >= 1),
  periodo text not null check (periodo in ('mensual', 'anual')),
  monto_centavos bigint not null check (monto_centavos > 0),
  moneda text not null default 'COP',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado')),
  wompi_txn_id text unique,
  created_at timestamptz not null default now(),
  aprobado_at timestamptz
);
alter table public.cf_pagos enable row level security;
drop policy if exists cf_pagos_propietario_leer on public.cf_pagos;
create policy cf_pagos_propietario_leer on public.cf_pagos
  for select using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.cf_pagos from authenticated;
create index if not exists cf_pagos_usuario_idx on public.cf_pagos (user_id);

-- --------------------------------------------------------------------------
-- Funciones de acceso.
-- --------------------------------------------------------------------------
create or replace function public.suscripciones_habilitadas()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select valor from public.cf_app_config where clave = 'suscripciones_activas'),
    false
  );
$$;

-- Flag apagado → acceso total (comportamiento actual, sin suscripciones).
create or replace function public.acceso_modulo(p_uid uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.suscripciones_habilitadas()
    or exists (
      select 1 from public.cf_suscripciones s
      where s.user_id = p_uid
        and s.modulo = p_modulo
        and s.estado = 'activa'
        and s.fecha_fin > now()
    );
$$;

-- Concesión de suscripciones a partir de un pago. Idempotente: si el pago ya
-- está aprobado no vuelve a extender nada (la llaman wompi-verify Y el webhook).
create or replace function public.activar_suscripciones(p_referencia text, p_txn_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pago public.cf_pagos%rowtype;
  v_mod text;
  v_delta interval;
begin
  select * into v_pago from public.cf_pagos where referencia = p_referencia;
  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado = 'aprobado' then return; end if;

  update public.cf_pagos
    set estado = 'aprobado', wompi_txn_id = p_txn_id, aprobado_at = now()
    where id = v_pago.id and estado = 'pendiente';

  v_delta := case v_pago.periodo when 'anual' then interval '12 months' else interval '1 month' end;
  foreach v_mod in array v_pago.modulos loop
    insert into public.cf_suscripciones (user_id, modulo, periodo, fecha_fin)
    values (v_pago.user_id, v_mod, v_pago.periodo, now() + v_delta)
    on conflict (user_id, modulo) do update
      set periodo = excluded.periodo,
          estado = 'activa',
          updated_at = now(),
          -- Renovar antes de vencer no pierde días: suma desde la vigencia actual.
          fecha_fin = greatest(now(), public.cf_suscripciones.fecha_fin) + v_delta;
  end loop;
end;
$$;

-- activar_suscripciones solo la llaman las edge functions (service role).
revoke execute on function public.activar_suscripciones(text, text) from public, anon, authenticated;
grant execute on function public.activar_suscripciones(text, text) to service_role;

-- --------------------------------------------------------------------------
-- Candados server-side (ambos pasan siempre con el flag apagado).
-- --------------------------------------------------------------------------

-- CivilFlow: creación de proyectos vía RPC (única vía de escritura).
create or replace function public.save_proyecto(p_codigo text, p_nombre text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
  v_proyecto public.cf_proyectos%rowtype;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  if p_codigo is null or btrim(p_codigo) = '' then raise exception 'codigo_requerido'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_codigo) > 50 or char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;
  insert into public.cf_proyectos (user_id, codigo, nombre)
  values (uid, btrim(p_codigo), btrim(p_nombre))
  returning * into v_proyecto;
  return to_jsonb(v_proyecto);
end;
$$;

-- CivilManager: la inserción directa es la única vía → el candado va en la policy.
drop policy if exists cm_proyectos_propietario_insertar on public.cm_proyectos;
create policy cm_proyectos_propietario_insertar on public.cm_proyectos for insert
  with check (
    (select auth.uid()) = user_id
    and public.acceso_modulo((select auth.uid()), 'manage')
  );
