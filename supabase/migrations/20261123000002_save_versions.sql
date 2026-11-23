-- Mantiene las firmas anteriores y devuelve el reloj comprometido a los clientes nuevos.

create or replace function public.cm_proyectos_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

create or replace function public.cm_save_state_versioned(
  p_proyecto_id uuid, p_state jsonb, p_updated_at timestamptz
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_version timestamptz;
begin
  if p_updated_at is null then raise exception 'version_requerida'; end if;
  perform public.cm_save_state(p_proyecto_id, p_state, p_updated_at);
  select updated_at into strict v_version from public.cm_proyectos where id = p_proyecto_id;
  return to_jsonb(v_version) #>> '{}';
end;
$$;

create or replace function public.save_plano_data_versioned(
  p_plano_id bigint, p_data jsonb, p_updated_at timestamptz
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_version timestamptz;
  v_previous timestamptz;
begin
  if v_uid is null then raise exception 'no_autenticado'; end if;
  if public.acceso_modulo(v_uid, 'flow') is not true then raise exception 'suscripcion_requerida'; end if;

  select p.updated_at into v_previous
    from public.cf_planos p
    where p.id = p_plano_id
      and (p.user_id = v_uid or public.empresa_escritura(p.user_id, 'flow'))
    for update;
  if not found then raise exception 'plano_no_encontrado_o_sin_acceso'; end if;
  if p_updated_at is not null and v_previous is distinct from p_updated_at then
    raise exception 'conflicto_concurrencia';
  end if;
  perform public.save_plano_data_impl(p_plano_id, p_data);
  update public.cf_planos
    set updated_at = greatest(clock_timestamp(), v_previous + interval '1 microsecond')
    where id = p_plano_id returning updated_at into strict v_version;
  return to_jsonb(v_version) #>> '{}';
end;
$$;

create or replace function public.save_plano_data(
  p_plano_id bigint, p_data jsonb, p_updated_at timestamptz default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.save_plano_data_versioned(p_plano_id, p_data, p_updated_at);
end;
$$;

revoke all on function public.cm_save_state_versioned(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.cm_save_state_versioned(uuid, jsonb, timestamptz) to authenticated;
revoke all on function public.save_plano_data_versioned(bigint, jsonb, timestamptz) from public, anon;
grant execute on function public.save_plano_data_versioned(bigint, jsonb, timestamptz) to authenticated;
