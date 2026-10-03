-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261005000002 — Hardening del linter (ronda 2026-10-03): search_path + revokes anon
--
--   1. uuid_seguro (lint 0011): solo hace un cast ::uuid — sin tablas → search_path = ''
--      (vacío es el máximo hardening; nada que resolver).
--   2. Los 6 RPCs de la familia EMPRESA (20261004000000/05000000) eran ejecutables por
--      anon (default privileges). Sus guards internos ya devolvían error/false para anon
--      (sin fuga de info — verificado), pero el cliente solo los llama autenticado y las
--      policies los invocan como authenticated → revoke de anon = superficie mínima.
--   3. NO se toca el grant de authenticated: policies RLS y storage policies invocan
--      empresa_lectura/escritura como el rol del usuario (quitarlo rompería las policies).
--   4. Los demás WARNs authenticated_security_definer = patrón wrapper+guard documentado
--      en AGENTS.md (Security Notes) — sin acción.
--
-- Idempotente. APLICAR EN SQL EDITOR.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) uuid_seguro con search_path fijo (lint 0011) ════════════════════════════════════
create or replace function public.uuid_seguro(t text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- ═══ 2) Revokes de anon en la familia empresa (mantener authenticated) ══════════════════
revoke execute on function public.empresa_lectura(uuid, text) from public, anon;
revoke execute on function public.empresa_escritura(uuid, text) from public, anon;
revoke execute on function public.asignar_puesto(bigint, text) from public, anon;
revoke execute on function public.quitar_puesto(bigint, uuid) from public, anon;
revoke execute on function public.cambiar_permiso_miembro(bigint, uuid, boolean) from public, anon;
revoke execute on function public.mis_miembros(bigint) from public, anon;

-- ═══ VERIFICACIÓN ═══════════════════════════════════════════════════════════════════════
-- select proconfig, prosecdef from pg_proc where proname = 'uuid_seguro';
--   → {search_path=""} | false
-- select has_function_privilege('anon', 'public.mis_miembros(1)', 'execute');   → false
-- select has_function_privilege('authenticated', 'public.mis_miembros(1)', 'execute'); → true
-- select has_function_privilege('authenticated', 'public.empresa_lectura(null::uuid,'x')', 'execute'); → true
