begin;

alter table public.cf_planos_bajantes add column if not exists material text;

-- Seguir las tres anclas de alt_deriv en el cuerpo vigente. Si el entorno
-- no tiene ese antecedente, abortar sin alterar permisos ni el guardado.
do $$
declare
  original text := pg_get_functiondef('public.save_plano_data_impl(bigint,jsonb)'::regprocedure);
  updated text;
begin
  if strpos(original, 'material = coalesce(excluded.material, cf_planos_bajantes.material)') > 0 then
    return;
  end if;
  updated := regexp_replace(original, '(,\s*alt_deriv)\s*\)', '\1, material)');
  if updated = original then raise exception 'save_plano_data: falta columna alt_deriv'; end if;
  original := updated;
  updated := regexp_replace(original, '(r\.alt_deriv)(\s+from\s+jsonb_populate_recordset)', '\1, r.material\2');
  if updated = original then raise exception 'save_plano_data: falta valor alt_deriv'; end if;
  original := updated;
  updated := regexp_replace(original, '(alt_deriv\s*=\s*excluded\.alt_deriv,)','\1 material = coalesce(excluded.material, cf_planos_bajantes.material),');
  if updated = original then raise exception 'save_plano_data: falta upsert alt_deriv'; end if;
  execute updated;
end;
$$;

notify pgrst, 'reload schema';
commit;
