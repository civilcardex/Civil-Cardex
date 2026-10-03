-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261002000000 — Moneda USD + pivot de pasarela a Lemon Squeezy
--
-- Decisión de producto (2026-10-02): cobro en USD puro vía Lemon Squeezy
-- (checkout hosteado por redirect; Wompi queda fuera). Precios lista por módulo:
--   • mensual:   $25.00 USD
--   • semestral: $150.00 USD (6× mensual; el descuento base −10% lo baja a $135)
--   • anual:     $300.00 USD (12× mensual; el descuento base −15% lo baja a $255)
-- Descuentos: base por periodo (0/10/15%) + 10% acumulativo por módulo adicional.
--
-- La FUENTE de precios es app_precios (obtener_catalogo los sirve al cliente vía
-- sincronizarPreciosBd) — cambiar precio = UPDATE en SQL Editor, sin deploy.
--
-- ⚠️ APLICAR EN SQL EDITOR después de 20261001000000_semestral_descuentos.sql.
-- Re-ejecutable (idempotente). Tablas sin producción (sistema deshabilitado).
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) app_precios → centavos USD ═════════════════════════════════════════════════════
update public.app_precios
   set precio_mensual_centavos   = 2500,   -- $25.00
       precio_semestral_centavos = 15000,  -- $150.00 (6× mensual, sin descuento incluido)
       precio_anual_centavos     = 30000   -- $300.00 (12× mensual, sin descuento incluido)
 where modulo in ('flow', 'manage');

do $do$
begin
  if (select precio_mensual_centavos from public.app_precios where modulo = 'flow')
     is distinct from 2500
  or (select precio_semestral_centavos from public.app_precios where modulo = 'flow')
     is distinct from 15000
  or (select precio_anual_centavos from public.app_precios where modulo = 'flow')
     is distinct from 30000 then
    raise exception 'precios_usd_sin_migrar';
  end if;
end $do$;

-- ═══ 2) app_pagos.moneda → USD ═════════════════════════════════════════════════════════
alter table public.app_pagos alter column moneda set default 'USD';

-- ═══ 3) wompi_txn_id → txn_id (genérico: será el order id de Lemon Squeezy) ════════════
alter table public.app_pagos rename column wompi_txn_id to txn_id;

-- ═══ 4) activar_suscripciones(): mismo cuerpo (FOR UPDATE + rowcount), columna txn_id ══
create or replace function public.activar_suscripciones(p_referencia text, p_txn_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pago public.app_pagos%rowtype;
  v_mod text;
  v_delta interval;
begin
  -- FOR UPDATE: la segunda tx concurrente ESPERA aquí y al re-evaluar lee 'aprobado' → return.
  select * into v_pago from public.app_pagos where referencia = p_referencia for update;
  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado = 'aprobado' then return; end if;

  update public.app_pagos
  set estado = 'aprobado', txn_id = p_txn_id, aprobado_at = now()
  where id = v_pago.id and estado = 'pendiente';
  -- Cierre definitivo del race aunque alguien quite el FOR UPDATE.
  if not found then return; end if;

  v_delta := case v_pago.periodo
               when 'anual' then interval '12 months'
               when 'semestral' then interval '6 months'
               else interval '1 month'
             end;
  foreach v_mod in array v_pago.modulos loop
    insert into public.app_suscripciones (user_id, modulo, periodo, fecha_fin)
    values (v_pago.user_id, v_mod, v_pago.periodo, now() + v_delta)
    on conflict (user_id, modulo) do update
      set periodo = excluded.periodo,
          estado = 'activa',
          updated_at = now(),
          -- Renovar antes de vencer no pierde días: suma desde la vigencia actual.
          fecha_fin = greatest(now(), public.app_suscripciones.fecha_fin) + v_delta;
  end loop;
end;
$$;
-- Misma firma → grants vigentes se conservan; re-emitidos por claridad.
revoke execute on function public.activar_suscripciones(text, text) from public, anon, authenticated;
grant execute on function public.activar_suscripciones(text, text) to service_role;

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- select modulo, precio_mensual_centavos, precio_semestral_centavos, precio_anual_centavos
--   from public.app_precios;                     -- 2500 / 15000 / 30000
-- select column_name from information_schema.columns
--  where table_name = 'app_pagos' and column_name = 'txn_id';   -- 1 fila (renombrada)
