-- Área Otras en overrides de lluvias (orig. usuario): subcolumna editable con default 0 en
-- las tablas de chequeo de bajantes/canales; TOTAL = area_parcial + area_otras alimenta el
-- caudal real. El RPC save_rainwater_overrides se re-crea con area_otras en su lista de
-- columnas (jsonb_populate_recordset rellena por nombre de columna).

ALTER TABLE public.cf_anulaciones_bajantes_pluviales
  ADD COLUMN IF NOT EXISTS area_otras numeric NOT NULL DEFAULT 0;

ALTER TABLE public.cf_anulaciones_canales_pluviales
  ADD COLUMN IF NOT EXISTS area_otras numeric NOT NULL DEFAULT 0;

create or replace function public.save_rainwater_overrides(p_proyecto_id bigint, p_bajantes jsonb, p_canales jsonb)
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
