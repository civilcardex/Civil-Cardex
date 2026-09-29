-- RENAME familia de suscripciones: prefijo cf_ (CivilFlow) → app_ (toda la app).
--
-- cf_suscripciones → app_suscripciones
-- cf_pagos         → app_pagos
-- cf_app_config    → app_config
--
-- El sistema de suscripciones es de TODOS los módulos (flow + manage); el prefijo cf_
-- era el dominio de CivilFlow. app_precios (20260928000003) ya nació con el nombre bueno.
--
-- ⚠️ APLICAR EN SQL EDITOR (después de 20260928000003). Re-ejecutable.
--
-- Los cuerpos plpgsql NO se reescriben solos con un alter rename: los 3 RPCs que leen
-- estas tablas se recrean aquí con los nombres nuevos (copian los cuerpos vigentes de
-- 20260924000000/20260928000001). Policies, RLS, grants e índices viajan con el rename.

-- ═══ 1) Tablas ════════════════════════════════════════════════════════════════════════
alter table if exists public.cf_suscripciones rename to app_suscripciones;
alter table if exists public.cf_pagos rename to app_pagos;
alter table if exists public.cf_app_config rename to app_config;

-- ═══ 2) RPCs que las leen — cuerpos vigentes con nombres nuevos ═══════════════════════

-- suscripciones_habilitadas: el interruptor global (era cf_app_config).
create or replace function public.suscripciones_habilitadas()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select valor from public.app_config where clave = 'suscripciones_activas'),
    false
  );
$$;

-- acceso_modulo: el candado de USO que invocan los wrappers y las policies de cm_proyectos
-- (por eso authenticated conserva EXECUTE — sin él las policies fallan).
create or replace function public.acceso_modulo(p_uid uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.suscripciones_habilitadas()
    or exists (
      select 1 from public.app_suscripciones s
      where s.user_id = p_uid
        and s.modulo = p_modulo
        and s.estado = 'activa'
        and s.fecha_fin > now()
    );
$$;

-- activar_suscripciones: idempotencia FOR UPDATE + rowcount (ronda 6) sobre app_pagos.
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

  v_delta := case v_pago.periodo when 'anual' then interval '12 months' else interval '1 month' end;
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

-- intenciones_recientes (cota #3) leía cf_pagos.
create or replace function public.intenciones_recientes(p_uid uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*)
  from public.app_pagos
  where user_id = p_uid
    and estado = 'pendiente'
    and created_at > now() - interval '1 hour';
$$;

-- ═══ 3) Grants (re-emitidos por claridad; el rename ya los viaja) ══════════════════════
revoke execute on function public.activar_suscripciones(text, text) from public, anon, authenticated;
grant execute on function public.activar_suscripciones(text, text) to service_role;

revoke execute on function public.intenciones_recientes(uuid) from public, anon;
grant execute on function public.intenciones_recientes(uuid) to service_role;

revoke all on public.app_suscripciones, public.app_pagos from anon, authenticated;
revoke insert, update, delete on public.app_suscripciones, public.app_pagos from anon;
revoke select on public.app_pagos, public.app_suscripciones from anon;
revoke all on public.app_config from anon, authenticated;

grant select on public.app_suscripciones to authenticated; -- lectura propia (RLS owner-only)
grant select on public.app_pagos to authenticated;         -- idem

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- select table_name from information_schema.tables
--  where table_schema='public' and (table_name like 'cf_sus%' or table_name like 'cf_pagos%' or table_name like 'cf_app%');
--  → 0 filas (todo renombrado).
-- select public.suscripciones_habilitadas();             -- false (flag apagado)
-- select public.acceso_modulo(auth.uid(), 'flow');       -- true (flag apagado)
