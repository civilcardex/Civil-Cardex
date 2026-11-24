-- Guardar la lista de planos no modifica el reloj que protege los trazos.
-- Conserva las firmas, los permisos y los controles de pertenencia del RPC instalado.
do $$
declare
  v_func regprocedure := coalesce(
    to_regprocedure('public.save_planos_meta_impl(uuid,jsonb)'),
    to_regprocedure('public.save_planos_meta(uuid,jsonb)')
  );
  v_def text;
  v_antiguo constant text := 'defined_scale = excluded.defined_scale, updated_at = now()';
  v_nuevo constant text := 'defined_scale = excluded.defined_scale';
begin
  if v_func is null then
    raise exception 'save_planos_meta no encontrado';
  end if;
  v_def := pg_get_functiondef(v_func);
  if strpos(v_def, v_antiguo) = 0 then
    raise exception 'save_planos_meta: revisar la definición instalada antes de cambiar el reloj';
  end if;
  execute replace(v_def, v_antiguo, v_nuevo);
end;
$$;
