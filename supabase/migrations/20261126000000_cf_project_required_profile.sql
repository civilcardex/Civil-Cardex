begin;

-- El proyecto y su perfil inicial se crean juntos; no se rellenan registros históricos.
drop function if exists public.save_proyecto(text, text);

create function public.save_proyecto(p_codigo text, p_nombre text, p_pais text, p_uso text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  proyecto public.cf_proyectos%rowtype;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  if coalesce(btrim(p_codigo), '') = '' then raise exception 'codigo_requerido'; end if;
  if coalesce(btrim(p_nombre), '') = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_codigo) > 50 or char_length(p_nombre) > 200 then
    raise exception 'texto_demasiado_largo';
  end if;
  if p_pais is null or p_pais not in ('Colombia', 'Perú', 'Ecuador', 'Chile', 'Argentina', 'Bolivia') then
    raise exception 'pais_invalido';
  end if;
  if p_uso is null or p_uso not in ('Vivienda unifamiliar', 'Vivienda multifamiliar', 'Comercial', 'Institucional', 'Mixto') then
    raise exception 'uso_invalido';
  end if;

  insert into public.cf_proyectos (user_id, codigo, nombre)
  values (uid, btrim(p_codigo), btrim(p_nombre))
  returning * into proyecto;

  insert into public.cf_proyecto_general (proyecto_id, user_id, nombre, pais, uso)
  values (proyecto.id, uid, proyecto.nombre, p_pais, p_uso);

  return to_jsonb(proyecto);
end;
$$;

revoke all on function public.save_proyecto(text, text, text, text) from public, anon;
grant execute on function public.save_proyecto(text, text, text, text) to authenticated;

-- Permite elegir material antes de generar pisos, sin enviar un snapshot vacío de niveles.
create or replace function public.save_cf_network_material(p_proyecto_id uuid, p_red text, p_material text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  owner_id uuid;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(uid, 'flow') then raise exception 'suscripcion_requerida'; end if;
  select p.user_id into owner_id from public.cf_proyectos p where p.id = p_proyecto_id;
  if owner_id is null or (owner_id <> uid and not coalesce(public.empresa_escritura(owner_id, 'flow'), false)) then
    raise exception 'no_autorizado';
  end if;
  if p_material is null or not coalesce(
    (p_red = 'rci' and p_material in ('Acero SCH 10', 'Acero SCH 40', 'PVC C900 RDE 14', 'PVC C900 RDE 18', 'CPVC SDR 13,5')) or
    (p_red = 'gas' and p_material in ('Acero HG', 'A.C.', 'Cobre rígido', 'Cobre flexible', 'PE al PE', 'PEAD')), false
  ) then raise exception 'material_invalido'; end if;

  insert into public.cf_proyecto_general (proyecto_id, user_id, mat_rci, mat_gas)
  values (p_proyecto_id, owner_id, case when p_red = 'rci' then p_material else '' end,
          case when p_red = 'gas' then p_material else '' end)
  on conflict (proyecto_id) do update set
    mat_rci = case when p_red = 'rci' then excluded.mat_rci else cf_proyecto_general.mat_rci end,
    mat_gas = case when p_red = 'gas' then excluded.mat_gas else cf_proyecto_general.mat_gas end,
    updated_at = now();
end;
$$;

revoke all on function public.save_cf_network_material(uuid, text, text) from public, anon;
grant execute on function public.save_cf_network_material(uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
