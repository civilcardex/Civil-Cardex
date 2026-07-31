-- Trigger: crear la fila de public.perfiles cuando se registra un usuario.
-- Ya aplicado contra knswtfckzodiuiladmbt.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (
    id, email, nombre, apellido, profesion, matricula, telefono
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'nombre', ''),
    nullif(new.raw_user_meta_data ->> 'apellido', ''),
    nullif(new.raw_user_meta_data ->> 'profesion', ''),
    nullif(new.raw_user_meta_data ->> 'matricula', ''),
    nullif(new.raw_user_meta_data ->> 'telefono', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill: crear la fila para usuarios ya registrados antes de este trigger.
insert into public.perfiles (id, email, nombre, apellido, profesion, matricula, telefono)
select
  u.id, u.email,
  nullif(u.raw_user_meta_data ->> 'nombre', ''),
  nullif(u.raw_user_meta_data ->> 'apellido', ''),
  nullif(u.raw_user_meta_data ->> 'profesion', ''),
  nullif(u.raw_user_meta_data ->> 'matricula', ''),
  nullif(u.raw_user_meta_data ->> 'telefono', '')
from auth.users u
on conflict (id) do nothing;
