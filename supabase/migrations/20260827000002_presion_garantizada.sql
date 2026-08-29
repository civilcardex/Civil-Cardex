-- Presión garantizada del operador (PSI) para af_alimentacion = 'red'
alter table public.cf_proyecto_general
  add column if not exists presion_garantizada text;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='proyecto_general') then
    execute 'alter table public.proyecto_general add column if not exists presion_garantizada text';
  end if;
end $$;
