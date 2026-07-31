-- Defense-in-depth: RLS already blocks anon on every user table (auth.uid() is null for
-- anon, never equals user_id), but Supabase grants anon CRUD by default on new public tables.
-- Revoking closes the surface entirely instead of relying on RLS alone. `authenticated` keeps
-- its grants — RLS still scopes it per-row.
-- Correr en el SQL Editor del proyecto knswtfckzodiuiladmbt.

revoke all on table public.proyectos, public.perfiles, public.pisos,
  public.proyecto_general, public.materiales_proyecto, public.profundidades_proyecto,
  public.criterios_proyecto, public.planos, public.planos_ramales, public.planos_bajantes,
  public.bajante_conexiones, public.planos_areas, public.planos_dimensiones,
  public.planos_anotaciones_texto, public.planos_lineas_guia, public.planos_cross_floor_ghosts
  from anon;

-- Catalog tables: policy already requires auth.role() = 'authenticated', but anon still has
-- the default INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES grants underneath it (no insert/
-- update policy exists to block writes at the RLS layer — only the missing grant does today).
revoke all on table public.redes, public.aparatos_ud_base_global, public.aparatos_catalogo_global
  from anon;

revoke execute on function public.get_plano_data(bigint) from anon;
revoke execute on function public.get_proyecto_data(bigint) from anon;
