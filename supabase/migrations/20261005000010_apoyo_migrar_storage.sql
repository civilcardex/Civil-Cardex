-- Apoyo para scripts/migrar-storage-uuid.mjs: lista de proyectos con carpeta legacy
-- pendiente de mover en Storage. Se aplica ANTES de correr el script; se elimina en
-- 20261005000011 junto con la columna legacy_num (correr el script ANTES).
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable.
-- El script corre con service_role (bypassa RLS): la RPC no necesita grants a usuarios.

create or replace function public.get_proyectos_para_migrar_storage()
returns table (id uuid, user_id uuid, legacy_num bigint, codigo text)
language sql stable security invoker set search_path = public as $$
  select p.id, p.user_id, p.legacy_num, p.codigo
  from public.cf_proyectos p
  where p.legacy_num is not null
$$;
