-- SUSCRIPCIONES ronda 2 (auditoría 2026-09-24): race de doble activación + gating de USO.
--
-- 1) activar_suscripciones: el check-then-act sin lock permitía N llamadas concurrentes
--    (wompi-verify paralelas con la misma referencia) leer todas 'pendiente' → cada una
--    extendía fecha_fin → pagar 1 mes regalaba N meses. Fix: FOR UPDATE + rowcount.
-- 2) GATING DE USO (decisión usuario): el candado de BD cubría solo CREACIÓN (save_proyecto);
--    los RPCs de contenido (trazos/planos/redes/overrides) validaban solo propiedad → un
--    usuario vencido seguía editando proyectos existentes vía PostgREST. Ahora TODO write RPC
--    de flow exige acceso_modulo(uid,'flow') y las policies de escritura de cm_proyectos
--    exigen acceso_modulo(uid,'manage').
--    SIN CAMBIO con el flag apagado: acceso_modulo devuelve true para todos si
--    suscripciones_habilitadas() = false (comportamiento idéntico hasta activar).
-- 3) Patrón rename+wrapper: los cuerpos vigentes NO se copian (riesgo de divergencia entre
--    las 4 versiones históricas de save_plano_data) — cada RPC original pasa a <nombre>_impl
--    y un wrapper delgado hace el check. Re-ejecutable (guard por pg_proc).
-- 4) Menores: revokes anon de tablas nuevas + revoke execute PUBLIC de acceso_modulo/
--    suscripciones_habilitadas (sondeo).
--
-- ⚠️ APLICAR EN SQL EDITOR. Requiere 20260924000000 aplicada antes.

-- ═══ 1) RACE: activar_suscripciones con lock pesimista ══════════════════════════════
create or replace function public.activar_suscripciones(p_referencia text, p_txn_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pago public.cf_pagos%rowtype;
  v_mod text;
  v_delta interval;
begin
  -- FOR UPDATE: la segunda tx concurrente ESPERA aquí, y al re-evaluar lee 'aprobado' →
  -- return. Sin el lock, N verify paralelas pasaban todas el check de estado y cada una
  -- sumaba su delta a fecha_fin (1 pago = N períodos).
  select * into v_pago from public.cf_pagos where referencia = p_referencia for update;
  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado = 'aprobado' then return; end if;

  update public.cf_pagos
  set estado = 'aprobado', wompi_txn_id = p_txn_id, aprobado_at = now()
  where id = v_pago.id and estado = 'pendiente';
  -- Cierre definitivo del race aunque alguien quite el FOR UPDATE: si el UPDATE no matcheó
  -- (otra tx ya aprobó entre el select y aquí), NO extender nada.
  if not found then return; end if;

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

revoke execute on function public.activar_suscripciones(text, text) from public, anon, authenticated;
grant execute on function public.activar_suscripciones(text, text) to service_role;

-- ═══ 2) Helper de gating (mismo contrato que acceso_modulo, ya existente) ═════════════
-- acesso_modulo(uid, modulo) respeta suscripciones_habilitadas(): false → true para todos.

-- ═══ 3) Rename → *_impl + wrappers con candado (FLOW) ════════════════════════════════
do $$
declare
  f record;
begin
  for f in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'save_plano_data','save_proyecto_core','save_redes_activas',
        'save_gas_datos','save_ep_datos','save_bomba_datos',
        'save_planos_meta','save_rainwater_overrides',
        'delete_plano_meta','save_proyecto_general_campo'
      )
  loop
    execute format('alter function public.%I(%s) rename to %I', f.proname, f.args, f.proname || '_impl');
  end loop;
end;
$$;

-- Wrappers delgados: candado de USO + delegación al impl (los grants del impl viajan con el
-- rename; el wrapper replica revoke/grant para que PostgREST solo exponga el nombre original).
create or replace function public.save_plano_data(p_plano_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_plano_data_impl(p_plano_id, p_data);
end;
$$;

create or replace function public.save_proyecto_core(p_proyecto_id bigint, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_proyecto_core_impl(p_proyecto_id, p_data);
end;
$$;

create or replace function public.save_redes_activas(p_proyecto_id bigint, p_redes text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_redes_activas_impl(p_proyecto_id, p_redes);
end;
$$;

create or replace function public.save_gas_datos(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_gas_datos_impl(p_proyecto_id, p_datos);
end;
$$;

create or replace function public.save_ep_datos(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_ep_datos_impl(p_proyecto_id, p_datos);
end;
$$;

create or replace function public.save_bomba_datos(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_bomba_datos_impl(p_proyecto_id, p_datos);
end;
$$;

create or replace function public.save_planos_meta(p_proyecto_id bigint, p_planos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_planos_meta_impl(p_proyecto_id, p_planos);
end;
$$;

create or replace function public.save_rainwater_overrides(p_proyecto_id bigint, p_bajantes jsonb, p_canales jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_rainwater_overrides_impl(p_proyecto_id, p_bajantes, p_canales);
end;
$$;

create or replace function public.delete_plano_meta(p_plano_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.delete_plano_meta_impl(p_plano_id);
end;
$$;

create or replace function public.save_proyecto_general_campo(p_proyecto_id bigint, p_campo text, p_valor jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  perform public.save_proyecto_general_campo_impl(p_proyecto_id, p_campo, p_valor);
end;
$$;

-- Grants de los wrappers (los impl quedan revocados de public/anon por herencia del rename,
-- y solo los llama el wrapper SECURITY DEFINER):
revoke all on function
  public.save_plano_data(bigint, jsonb),
  public.save_proyecto_core(bigint, jsonb),
  public.save_redes_activas(bigint, text[]),
  public.save_gas_datos(bigint, jsonb),
  public.save_ep_datos(bigint, jsonb),
  public.save_bomba_datos(bigint, jsonb),
  public.save_planos_meta(bigint, jsonb),
  public.save_rainwater_overrides(bigint, jsonb, jsonb),
  public.delete_plano_meta(bigint),
  public.save_proyecto_general_campo(bigint, text, jsonb)
from public, anon;
grant execute on function
  public.save_plano_data(bigint, jsonb),
  public.save_proyecto_core(bigint, jsonb),
  public.save_redes_activas(bigint, text[]),
  public.save_gas_datos(bigint, jsonb),
  public.save_ep_datos(bigint, jsonb),
  public.save_bomba_datos(bigint, jsonb),
  public.save_planos_meta(bigint, jsonb),
  public.save_rainwater_overrides(bigint, jsonb, jsonb),
  public.delete_plano_meta(bigint),
  public.save_proyecto_general_campo(bigint, text, jsonb)
to authenticated;

-- ═══ 4) MANAGE: policies de escritura de cm_proyectos con candado ════════════════════
-- (Las tablas hijas cm_* conservan sus policies por user_id: sin el proyecto padre no se
--  crean filas nuevas desde la app, y cm_get_data no carga nada — deuda documentada para un
--  gating fila-a-fila si se quiere blindaje total contra PostgREST directo.)
drop policy if exists cm_proyectos_propietario_insertar on public.cm_proyectos;
create policy cm_proyectos_propietario_insertar on public.cm_proyectos
  for insert with check (
    (select auth.uid()) = user_id
    and public.acceso_modulo((select auth.uid()), 'manage')
  );

drop policy if exists cm_proyectos_propietario_actualizar on public.cm_proyectos;
create policy cm_proyectos_propietario_actualizar on public.cm_proyectos
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.acceso_modulo((select auth.uid()), 'manage')
  );

drop policy if exists cm_proyectos_propietario_eliminar on public.cm_proyectos;
create policy cm_proyectos_propietario_eliminar on public.cm_proyectos
  for delete using (
    (select auth.uid()) = user_id
    and public.acceso_modulo((select auth.uid()), 'manage')
  );

-- ═══ 5) Menores de seguridad ═════════════════════════════════════════════════════════
revoke insert, update, delete on public.cf_suscripciones, public.cf_pagos from anon;
revoke execute on function public.acceso_modulo(uuid, text) from public, anon;
revoke execute on function public.suscripciones_habilitadas() from public, anon;
grant execute on function public.acceso_modulo(uuid, text) to authenticated;
grant execute on function public.suscripciones_habilitadas() to authenticated;
