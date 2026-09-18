-- save_planos_meta blindado + delete_plano_meta explícito.
--
-- Incidente 2026-09-18: cf_planos se vació porque el autosave de PlansContext (debounce 1.2 s)
-- puede dispararse con la lista de planos vacía (caché local vacía / get_proyecto_data que
-- falla una vez) y el RPC interpretaba lista vacía como "borra todo el proyecto".
-- Los PDFs (bucket plan_pdfs) y las tablas de dibujo (cf_planos_ramales, ...) no se tocan:
-- no hay FK a cf_planos, así que nada cascadó — solo desapareció la lista del proyecto.
--
-- Cambios:
--  1) save_planos_meta: lista vacía = no-op (jamás destructiva). La limpieza legítima de un
--     plano eliminado la hace el nuevo delete_plano_meta, llamado por removePlan.
--  2) delete_plano_meta(p_plano_id): borra UNA fila de cf_planos si pertenece al usuario.
-- Re-ejecutable.

create or replace function public.save_planos_meta(p_proyecto_id bigint, p_planos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  if jsonb_array_length(coalesce(p_planos,'[]'::jsonb)) > 500 then raise exception 'demasiados_planos'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_planos,'[]'::jsonb)) x join public.cf_planos pl on pl.id = (x->>'id')::bigint where pl.user_id <> uid) then
    raise exception 'no_autorizado';
  end if;
  -- Lista vacía = no-op: el autosave del cliente dispara con la lista que tenga en memoria y
  -- un estado vacío (caché local vacía, carga que falla) NUNCA debe poder vaciar el proyecto.
  if p_planos is null or jsonb_array_length(p_planos) = 0 then
    return;
  end if;
  delete from public.cf_planos pl where pl.proyecto_id = p_proyecto_id and pl.id not in (select (x->>'id')::bigint from jsonb_array_elements(p_planos) x);
  insert into public.cf_planos (id, proyecto_id, user_id, name, nivel, scale, status, origen_x_px, origen_y_px, factor_x, factor_y, cal_global, defined_scale, updated_at)
  select r.id, p_proyecto_id, uid, coalesce(r.name, ''), r.nivel, r.scale, coalesce(r.status, 'pending'), r.origen_x_px, r.origen_y_px, r.factor_x, r.factor_y, r.cal_global, r.defined_scale, now()
  from jsonb_populate_recordset(null::public.cf_planos, p_planos) r
  on conflict (id) do update set
    proyecto_id = excluded.proyecto_id, name = excluded.name, nivel = excluded.nivel, scale = excluded.scale, status = excluded.status, origen_x_px = excluded.origen_x_px, origen_y_px = excluded.origen_y_px, factor_x = excluded.factor_x, factor_y = excluded.factor_y, cal_global = excluded.cal_global, defined_scale = excluded.defined_scale, updated_at = now();
end;
$$;

-- Borra UN plano de cf_planos (dueño-only). Lo llama removePlan junto con deletePlanPDF.
create or replace function public.delete_plano_meta(p_plano_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  delete from public.cf_planos where id = p_plano_id and user_id = uid;
end;
$$;

revoke all on function public.save_planos_meta(bigint, jsonb) from public, anon;
revoke all on function public.delete_plano_meta(bigint) from public, anon;
grant execute on function public.save_planos_meta(bigint, jsonb) to authenticated;
grant execute on function public.delete_plano_meta(bigint) to authenticated;
