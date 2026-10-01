-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261001000000 — Periodo SEMESTRAL + descuentos acumulativos por módulo
--
-- Modelo nuevo de precios (página /pricing):
--   • mensual:  $60.000/módulo      (sin descuento base, +10% por módulo adicional)
--   • semestral: $360.000/6 meses   (base 10% desde el 1er módulo, +10% por adicional)
--   • anual:    $720.000/12 meses   (base 15% desde el 1er módulo, +10% por adicional)
--
-- Cambios BD:
--   1. app_precios: columna precio_semestral_centavos (+ backfill 6× mensual).
--   2. RPC obtener_catalogo(): devuelve los 3 precios.
--   3. CHECK periodo en app_pagos/app_suscripciones: acepta 'semestral'.
--   4. RPC activar_suscripciones(): 'semestral' → +6 meses.
--
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable (idempotente).
-- ⚠️ Después: re-deploy de la edge function `crear-intencion-pago`
--    (supabase functions deploy crear-intencion-pago).
-- ✅ Precios definitivos incluidos (UPDATE activo): la BD queda 60k/360k/720k,
--    igual a los literales del cliente y la edge function.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) app_precios: columna semestral ═════════════════════════════════════════════════
alter table public.app_precios
  add column if not exists precio_semestral_centavos bigint;

-- Backfill inicial = 6× mensual; el UPDATE de abajo impone de inmediato los precios definitivos.
update public.app_precios
   set precio_semestral_centavos = precio_mensual_centavos * 6
 where precio_semestral_centavos is null;

alter table public.app_precios
  alter column precio_semestral_centavos set not null;

-- ── Precios DEFINITIVOS del nuevo modelo: UPDATE obligatorio, NUNCA opcional ────────────
-- Los literales de src/lib/suscripciones/catalogo.ts y supabase/functions/_shared/wompi.ts
-- (contra los que se prueba el test de paridad) YA anuncian 60k/360k/720k: si el backfill
-- quedara 6× mensual viejo, /pricing mostraría un precio y Wompi cobraría otro. Idempotente.
update public.app_precios
   set precio_mensual_centavos   = 6000000,   -- $60.000
       precio_semestral_centavos = 36000000,  -- $360.000 (6 meses)
       precio_anual_centavos     = 72000000   -- $720.000 (12 meses)
 where modulo in ('flow', 'manage');

-- ═══ 2) obtener_catalogo(): los 3 precios ══════════════════════════════════════════════
create or replace function public.obtener_catalogo()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    jsonb_object_agg(
      modulo,
      jsonb_build_object(
        'id', modulo,
        'precioMensualCentavos', precio_mensual_centavos,
        'precioSemestralCentavos', precio_semestral_centavos,
        'precioAnualCentavos', precio_anual_centavos
      )
    ),
    '{}'::jsonb
  )
  from public.app_precios;
$$;
-- Misma firma → los grants vigentes se conservan; re-emitidos por claridad.
revoke execute on function public.obtener_catalogo() from public, anon;
grant execute on function public.obtener_catalogo() to authenticated;

-- ═══ 3) CHECK periodo: + 'semestral' ═══════════════════════════════════════════════════
-- El nombre del constraint es automático y puede seguir con el prefijo cf_ viejo tras el
-- rename → se borra CUALQUIER check sobre la columna y se recrea con nombre nuevo.
do $do$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.app_pagos'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%periodo%'
  loop
    execute format('alter table public.app_pagos drop constraint %I', c.conname);
  end loop;
end $do$;
alter table public.app_pagos
  add constraint app_pagos_periodo_check
  check (periodo in ('mensual', 'semestral', 'anual'));

do $do$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.app_suscripciones'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%periodo%'
  loop
    execute format('alter table public.app_suscripciones drop constraint %I', c.conname);
  end loop;
end $do$;
alter table public.app_suscripciones
  add constraint app_suscripciones_periodo_check
  check (periodo in ('mensual', 'semestral', 'anual'));

-- ═══ 4) activar_suscripciones(): 'semestral' → +6 meses ════════════════════════════════
-- Cuerpo = vigente de 20260928000004 con el case de v_delta extendido.
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
  set estado = 'aprobado', wompi_txn_id = p_txn_id, aprobado_at = now()
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

-- ═══ 5) Verificación de VALOR: la migración FALLA si los precios quedaron a medias ═════
do $do$
begin
  if (select precio_semestral_centavos from public.app_precios where modulo = 'flow')
     is distinct from 36000000
  or (select precio_mensual_centavos from public.app_precios where modulo = 'flow')
     is distinct from 6000000
  or (select precio_anual_centavos from public.app_precios where modulo = 'flow')
     is distinct from 72000000 then
    raise exception 'precios_sin_migrar_al_modelo_nuevo';
  end if;
end $do$;

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- (El DO-block anterior ya aborta la migración si los precios no son 60k/360k/720k;
--  estos SELECTs quedan como verificación manual adicional.)
-- select modulo, precio_mensual_centavos, precio_semestral_centavos, precio_anual_centavos
--   from public.app_precios;                                   -- 3 columnas pobladas
-- select public.obtener_catalogo();                            -- jsonb con precioSemestralCentavos
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid in ('public.app_pagos'::regclass, 'public.app_suscripciones'::regclass)
--    and contype = 'c';                                        -- incluye 'semestral'
-- select prosrc like '%6 months%' from pg_proc
--  where proname = 'activar_suscripciones';                    -- true
