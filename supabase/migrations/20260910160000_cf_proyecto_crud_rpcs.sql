-- Los RPCs save_proyecto / update_proyecto_nombre / delete_proyecto quedaron apuntando a
-- public.proyectos cuando la tabla se renombró a cf_proyectos (20260814000002) — borrar un
-- proyecto fallaba con "relation public.proyectos does not exist" y solo se quitaba de la
-- lista local (orig. usuario: el botón de eliminar no borraba en la BD).
-- UP
create or replace function public.save_proyecto(p_codigo text, p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
  v_proyecto public.cf_proyectos%rowtype;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_codigo is null or btrim(p_codigo) = '' then raise exception 'codigo_requerido'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_codigo) > 50 or char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;
  insert into public.cf_proyectos (user_id, codigo, nombre)
  values (uid, btrim(p_codigo), btrim(p_nombre))
  returning * into v_proyecto;
  return to_jsonb(v_proyecto);
end;
$$;

create or replace function public.update_proyecto_nombre(p_id bigint, p_nombre text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;
  update public.cf_proyectos set nombre = btrim(p_nombre)
  where id = p_id and user_id = uid;
  if not found then raise exception 'no_autorizado: el proyecto no pertenece al usuario'; end if;
end;
$$;

create or replace function public.delete_proyecto(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  delete from public.cf_proyectos where id = p_id and user_id = uid;
  if not found then raise exception 'no_autorizado: el proyecto no pertenece al usuario'; end if;
end;
$$;

-- DOWN
-- (revertir a los cuerpos con public.proyectos de 20260813000002, solo si se deshace el rename)
