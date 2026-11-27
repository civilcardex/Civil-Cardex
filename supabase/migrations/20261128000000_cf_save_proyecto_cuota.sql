-- H-03 (remediación 2026-11-27): la firma nueva de save_proyecto (20261126000000) sustituyó
-- la anterior en el mismo paso y PERDIÓ la cuota de 200 proyectos propios. Esta migración:
--   1) save_proyecto(text,text,text,text) recupera la cuota, SERIALIZADA con la creación
--      (advisory lock por cuenta: dos creaciones simultáneas no pueden pasar el conteo a la vez).
--   2) save_proyecto(text,text) vuelve a existir como wrapper de TRANSICIÓN (mismos efectos
--      que la firma original de 20260814000006 + cuota) mientras los clientes migran.
-- País/uso siguen obligatorios en la firma nueva; atomicidad proyecto+perfil intacta.

-- ═══ 1) Firma nueva (4 args) con cuota serializada ══════════════════════════════════════
create or replace function public.save_proyecto(p_codigo text, p_nombre text, p_pais text, p_uso text)
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

  -- Cuota SERIALIZADA por cuenta: el lock se toma ANTES del conteo y vive hasta el fin de la
  -- transacción — dos creaciones simultáneas de la misma cuenta entran una a una (H-03).
  perform pg_advisory_xact_lock(hashtextextended('cf_proyectos:' || uid::text, 0));
  if (select count(*) from public.cf_proyectos where user_id = uid) >= 200 then
    raise exception 'demasiados_proyectos';
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

-- ═══ 2) Wrapper de transición (2 args): los mismos efectos de la firma original + cuota ══
create or replace function public.save_proyecto(p_codigo text, p_nombre text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_proyecto public.cf_proyectos%rowtype;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_codigo is null or btrim(p_codigo) = '' then raise exception 'codigo_requerido'; end if;
  if p_nombre is null or btrim(p_nombre) = '' then raise exception 'nombre_requerido'; end if;
  if char_length(p_codigo) > 50 or char_length(p_nombre) > 200 then raise exception 'texto_demasiado_largo'; end if;

  perform pg_advisory_xact_lock(hashtextextended('cf_proyectos:' || uid::text, 0));
  if (select count(*) from public.cf_proyectos where user_id = uid) >= 200 then
    raise exception 'demasiados_proyectos';
  end if;

  insert into public.cf_proyectos (user_id, codigo, nombre)
  values (uid, btrim(p_codigo), btrim(p_nombre))
  returning * into v_proyecto;
  return to_jsonb(v_proyecto);
end;
$$;

revoke all on function public.save_proyecto(text, text) from public, anon;
grant execute on function public.save_proyecto(text, text) to authenticated;
