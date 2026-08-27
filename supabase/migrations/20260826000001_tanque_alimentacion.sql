-- Tanque alto alimentación + NPT salida tanque
-- Persiste la selección de "Cómo alimentar la red" (af) y el NPT de salida del tanque alto
alter table public.cf_proyecto_general
  add column if not exists af_alimentacion text,
  add column if not exists tanque_npt text;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='proyecto_general') then
    execute 'alter table public.proyecto_general add column if not exists af_alimentacion text';
    execute 'alter table public.proyecto_general add column if not exists tanque_npt text';
  end if;
end $$;
