-- REVOKES de las funciones *_impl (linter 2026-09-24, lint 0029).
--
-- BUG que cierra: 20260924000001 renombró los RPCs de contenido a *_impl y creó wrappers con
-- el candado acceso_modulo. El `alter function rename` VIAJA CON LOS GRANTS: las *_impl
-- conservaban EXECUTE para authenticated de las migraciones anteriores → cualquier usuario
-- podía llamar `save_plano_data_impl` directo por PostgREST y saltarse el gating de USO.
--
-- Quedan solo los wrappers ejecutables (con candado). Re-ejecutable.
-- ⚠️ APLICAR EN SQL EDITOR (requiere 20260924000001 aplicada).

revoke all on function public.save_plano_data_impl(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.save_proyecto_core_impl(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.save_redes_activas_impl(bigint, text[]) from public, anon, authenticated;
revoke all on function public.save_gas_datos_impl(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.save_ep_datos_impl(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.save_bomba_datos_impl(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.save_planos_meta_impl(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.save_rainwater_overrides_impl(bigint, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.delete_plano_meta_impl(bigint) from public, anon, authenticated;
-- save_proyecto_general_campo: SOLO existe si aplicaste 20260915000000 (pendiente en este
-- proyecto → 42883). Revoke condicional; si el impl existe, se revoca.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_proyecto_general_campo_impl'
  ) then
    execute 'revoke all on function public.save_proyecto_general_campo_impl(bigint, text, jsonb) from public, anon, authenticated';
  end if;
  -- Wrapper huérfano: 20260924000001 creó el wrapper aunque el impl no existiera (el DDL no
  -- valida el cuerpo). Sin impl, llamarlo fallaría en runtime — se elimina; si algún día se
  -- aplica 20260915000000, recrear wrapper+impl juntos.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_proyecto_general_campo'
      and not exists (
        select 1 from pg_proc p2 join pg_namespace n2 on n2.oid = p2.pronamespace
        where n2.nspname = 'public' and p2.proname = 'save_proyecto_general_campo_impl'
      )
  ) then
    execute 'drop function public.save_proyecto_general_campo(bigint, text, jsonb)';
  end if;
end
$$;

-- Verificación (debe devolver 10 filas, todas sin 'authenticated' en proacl):
-- select proname, proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and proname like '%\_impl';
