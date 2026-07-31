-- Fixes Supabase database-linter WARNs (excluding auth_leaked_password_protection, which is
-- an Auth setting, not SQL — enable it manually in Dashboard > Authentication > Policies).
-- Correr en el SQL Editor del proyecto knswtfckzodiuiladmbt.

-- =========================================================================
-- 1. anon/authenticated_security_definer_function_executable
--    handle_new_user() is SECURITY DEFINER and only meant to run via the
--    on_auth_user_created trigger (system-invoked, unaffected by these
--    revokes) — it was never meant to be callable directly over
--    /rest/v1/rpc/handle_new_user by anon or authenticated clients.
-- =========================================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- =========================================================================
-- 2. auth_rls_initplan
--    Every owner-scoped policy re-evaluates auth.uid()/auth.role() per row.
--    Wrapping in (select ...) lets Postgres evaluate it once per query
--    (InitPlan) instead of once per row. ALTER POLICY keeps the same
--    policy (name, table, command) and just redefines its expression.
-- =========================================================================

-- perfiles (auth.uid() = id, not user_id)
alter policy "perfiles_owner_select" on public.perfiles using ((select auth.uid()) = id);
alter policy "perfiles_owner_insert" on public.perfiles with check ((select auth.uid()) = id);
alter policy "perfiles_owner_update" on public.perfiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy "perfiles_owner_delete" on public.perfiles using ((select auth.uid()) = id);

-- Every other owner-scoped table follows the same auth.uid() = user_id shape.
do $$
declare
  t text;
  owner_tables text[] := array[
    'proyectos', 'pisos', 'proyecto_general', 'materiales_proyecto',
    'profundidades_proyecto', 'criterios_proyecto', 'planos', 'planos_ramales',
    'planos_bajantes', 'bajante_conexiones', 'planos_areas', 'planos_dimensiones',
    'planos_anotaciones_texto', 'planos_lineas_guia', 'planos_cross_floor_ghosts'
  ];
begin
  foreach t in array owner_tables loop
    execute format(
      'alter policy %I on public.%I using ((select auth.uid()) = user_id)',
      t || '_owner_select', t
    );
    execute format(
      'alter policy %I on public.%I with check ((select auth.uid()) = user_id)',
      t || '_owner_insert', t
    );
    execute format(
      'alter policy %I on public.%I using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_owner_update', t
    );
    execute format(
      'alter policy %I on public.%I using ((select auth.uid()) = user_id)',
      t || '_owner_delete', t
    );
  end loop;
end $$;

-- Read-all catalog tables (auth.role() = 'authenticated')
alter policy "redes_read_all" on public.redes using ((select auth.role()) = 'authenticated');
alter policy "aparatos_ud_base_global_read_all" on public.aparatos_ud_base_global using ((select auth.role()) = 'authenticated');
alter policy "aparatos_catalogo_global_read_all" on public.aparatos_catalogo_global using ((select auth.role()) = 'authenticated');
