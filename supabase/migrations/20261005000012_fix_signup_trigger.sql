-- FIX registro de usuarios: el trigger handle_new_user insertaba en `public.perfiles`,
-- tabla renombrada a `cf_perfiles` en 20260814000002 — el rename no actualizó el trigger y
-- TODO signup lanzaba 500 (error dentro del trigger). Nadie había registrado una cuenta
-- desde el rename (por eso pasó inadvertido). Re-ejecutable.
-- ⚠️ APLICAR EN SQL EDITOR.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cf_perfiles (
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;
