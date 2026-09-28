-- RESTAURA GATING DE USO + RAINWATER CORRECTO + LAYOUT DEFAULT (auditoría ronda 7).
--
-- Cierra 3 roturas del incidente de re-aplicación de esquema viejo:
--   R-1: las reparaciones 20260925000000/01 recrearon los 9 RPCs de contenido como CUERPOS
--        DIRECTOS con grant a authenticated — el candado acceso_modulo (20260924000001,
--        decisión "bloquear USO") quedó anulado. Además los *_impl del 24 divergieron en
--        silencio (dos copias vivas de cada body).
--   R-2: save_rainwater_overrides quedó en la versión PODRIDA del 14-ago (sin area_otras ni
--        coalesces de 20260917000000): cada guardado reseteaba Área Otras a 0.
--   R-4: cliente viejo manda fantasma SIN clave layout → NULL en BD → migrador lo re-procesa
--        como legacy → borra XFG real + LD_ (mismo incidente de Ldesvios, por una pestaña
--        sin refrescar). Se blinda con TRIGGER (cubre cualquier escritor futuro).
--
-- ESTRATEGIA: renombrar el CUERPO VIVO de cada RPC a _impl (no copiar cuerpos desde el repo
-- — la reparación anterior falló exactamente por copiar versiones podridas) y crear wrapper
-- con candado. Re-ejecutable (drop-if-exists antes del rename).
-- ⚠️ APLICAR EN SQL EDITOR.

-- ═══ A1 · wrapper+impl para los 9 RPCs de contenido ═══════════════════════════════════
do $do$
declare
  f record;
  args text;
  call_args text;
  args_types text;
begin
  for f in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'save_plano_data','save_proyecto_core','save_redes_activas',
        'save_gas_datos','save_ep_datos','save_bomba_datos',
        'save_planos_meta','save_rainwater_overrides','delete_plano_meta'
      )
  loop
    args := f.args;
    -- Dos derivadas de la firma `p_id bigint, p_d jsonb`:
    --   call_args = nombres solos (la LLAMADA no lleva tipos: `p_id, p_d`).
    --   args_types = tipos solos (regprocedure SÓLO acepta tipos: `bigint, jsonb` — con
    --     nombres lanza "invalid type name", el error 42601 de la corrida anterior).
    select string_agg(split_part(trim(param), ' ', 1), ', ' order by ord),
           string_agg(split_part(trim(param), ' ', 2), ',' order by ord)
    into call_args, args_types
    from unnest(string_to_array(args, ',')) with ordinality as t(param, ord);

    -- IDEMPOTENTE: si ya se renombró (re-corrida tras error a medias), el nombre público
    -- es el wrapper — re-renombrarlo a _impl crearía recursión wrapper→impl→wrapper.
    if to_regprocedure(format('public.%I(%s)', f.proname, args_types)) is not null
       and to_regprocedure(format('public.%I_impl(%s)', f.proname, args_types)) is null then
      execute format('drop function if exists public.%I_impl(%s)', f.proname, args_types);
      execute format('alter function public.%I(%s) rename to %I_impl', f.proname, args_types, f.proname);
    end if;
    -- wrapper delgado: única superficie PostgREST, con candado de USO.
    execute format($q$create or replace function public.%I(%s)
      returns void language plpgsql security definer set search_path = public as $w$
      begin
        if auth.uid() is null then raise exception 'no_autenticado'; end if;
        if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
        perform public.%I_impl(%s);
      end;
      $w$
      $q$, f.proname, args, f.proname, call_args);
  end loop;
end;
$do$;

-- Grants: impls inaccesibles (solo el wrapper SECURITY DEFINER los llama), wrappers al usuario.
revoke all on function
  public.save_plano_data_impl(bigint, jsonb),
  public.save_proyecto_core_impl(bigint, jsonb),
  public.save_redes_activas_impl(bigint, text[]),
  public.save_gas_datos_impl(bigint, jsonb),
  public.save_ep_datos_impl(bigint, jsonb),
  public.save_bomba_datos_impl(bigint, jsonb),
  public.save_planos_meta_impl(bigint, jsonb),
  public.save_rainwater_overrides_impl(bigint, jsonb, jsonb),
  public.delete_plano_meta_impl(bigint)
from public, anon, authenticated;
revoke all on function
  public.save_plano_data(bigint, jsonb),
  public.save_proyecto_core(bigint, jsonb),
  public.save_redes_activas(bigint, text[]),
  public.save_gas_datos(bigint, jsonb),
  public.save_ep_datos(bigint, jsonb),
  public.save_bomba_datos(bigint, jsonb),
  public.save_planos_meta(bigint, jsonb),
  public.save_rainwater_overrides(bigint, jsonb, jsonb),
  public.delete_plano_meta(bigint)
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
  public.delete_plano_meta(bigint)
to authenticated;

-- ═══ A2 · save_rainwater_overrides_impl = cuerpo CORRECTO (20260917000000) ═════════════
-- El rename de arriba tomó el cuerpo vivo, que para este RPC es la versión podrida del
-- 14-ago (la reparación copió la fuente equivocada): sin area_otras ni coalesces — cada
-- guardado reseteaba Área Otras a 0. Sobrescribir el impl con la versión buena.
create or replace function public.save_rainwater_overrides_impl(p_proyecto_id bigint, p_bajantes jsonb, p_canales jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_bajantes,'[]'::jsonb)) > 1000 then raise exception 'demasiados_overrides_bajantes'; end if;
  if jsonb_array_length(coalesce(p_canales,'[]'::jsonb)) > 1000 then raise exception 'demasiados_overrides_canales'; end if;
  delete from public.cf_anulaciones_bajantes_pluviales where proyecto_id = p_proyecto_id;
  insert into public.cf_anulaciones_bajantes_pluviales (proyecto_id, user_id, id_cliente, bajante, area_parcial, area_otras, area_acumulada, intensidad, coeficiente_c, R, manning, diam_propuesto)
  select p_proyecto_id, uid, r.id_cliente, r.bajante, coalesce(r.area_parcial, 0), coalesce(r.area_otras, 0), coalesce(r.area_acumulada, 0), coalesce(r.intensidad, 100), coalesce(r.coeficiente_c, 0.0278), coalesce(r.R, ''), coalesce(r.manning, 0), coalesce(r.diam_propuesto, 0)
  from jsonb_populate_recordset(null::public.cf_anulaciones_bajantes_pluviales, coalesce(p_bajantes,'[]'::jsonb)) r;
  delete from public.cf_anulaciones_canales_pluviales where proyecto_id = p_proyecto_id;
  insert into public.cf_anulaciones_canales_pluviales (proyecto_id, user_id, id_cliente, sector, area_parcial, area_otras, area_acumulada, intensidad, coeficiente_c, manning, pendiente, b, h)
  select p_proyecto_id, uid, r.id_cliente, r.sector, coalesce(r.area_parcial, 0), coalesce(r.area_otras, 0), coalesce(r.area_acumulada, 0), coalesce(r.intensidad, 100), coalesce(r.coeficiente_c, 0.0278), coalesce(r.manning, 0.011), coalesce(r.pendiente, 0), coalesce(r.b, 0), coalesce(r.h, 0)
  from jsonb_populate_recordset(null::public.cf_anulaciones_canales_pluviales, coalesce(p_canales,'[]'::jsonb)) r;
end;
$$;

-- ═══ A3 · layout NULL → 2 (TRIGGER, cubre cualquier escritor futuro) ══════════════════
-- Cliente viejo sin la clave layout inserta NULL → el migrador de carga re-procesaría el
-- ghost como legacy y borraría XFG+LD_. En vez de parchear el body de 100 líneas del RPC
-- (se vuelve a copiar en la próxima reparación y se pierde), un BEFORE INSERT impone el
-- default en la TABLA: todo ghost sin layout es post-renombre = layout 2.
create or replace function public.fantasmas_layout_default()
returns trigger language plpgsql as $$
begin
  if new.layout is null then new.layout := 2; end if;
  return new;
end;
$$;

drop trigger if exists fantasmas_layout_default on public.cf_planos_fantasmas_entrepisos;
create trigger fantasmas_layout_default
  before insert on public.cf_planos_fantasmas_entrepisos
  for each row execute function public.fantasmas_layout_default();

-- ═══ A4 · higiene de grants ═══════════════════════════════════════════════════════════
-- Ledger de pagos: un anónimo no tiene vía legítima de lectura (RLS owner-only ya filtra;
-- superficie gratis). Corregido también el comentario-"patrón" de 20260925000003 en el repo.
revoke select on public.cf_pagos, public.cf_suscripciones from anon;

-- ═══ VERIFICACIÓN (correr a mano tras aplicar) ════════════════════════════════════════
-- 1) impls inaccesibles (9 filas, ninguna con authenticated):
--    select proname, proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname like '%\_impl';
-- 2) gating vivo (con suscripciones_activas=false devuelve true — sin cambio hasta activar):
--    select public.acceso_modulo(auth.uid(), 'flow');
-- 3) area_otras persiste: guardar overrides desde la app → recargar → valor intacto.
