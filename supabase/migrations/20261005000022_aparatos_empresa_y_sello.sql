-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261005000004 — Aparatos_usuario compartido: lectura de empresa + sellado por trigger
--
-- El service (apparatusService) filtra el snapshot por el dueño del proyecto activo, pero
-- la policy era owner-only (20260806000005) y el save no se re-sellaba → el miembro veía
-- el catálogo global y sus edits desaparecían al recargar. Alinea la tabla con el resto:
--   1. Policy SELECT: dueño o miembro vigente (empresa_lectura).
--   2. aparatos_usuario entra al foreach del trigger trg_sellar_owner — PERO el trigger
--      vive en 20261005000000 con su lista de tablas; aquí se recrea el trigger con la
--      lista ampliada (re-emitir el CREATE TRIGGER idéntico + la tabla nueva).
-- Requiere 20261005000000. Re-ejecutable.
--
-- NOTA física: 20260814000002 renombró la tabla a cf_aparatos_usuario (los NOMBRES de las
-- policies viajaron con el rename); aquí se opera sobre el nombre cf_. Y como la tabla no
-- lleva proyecto_id/plano_id, cf_sellar_owner_contenido no puede resolver owner desde la
-- fila → el re-sellado no dispara: el trigger actúa de candado fail-closed (solo pasa un
-- user_id = auth.uid(); un INSERT/UPDATE directo con user_id ajeno → sello_sin_owner).
-- La escritura real sigue siendo el RPC save_aparatos_usuario (SECURITY DEFINER, sella
-- user_id = auth.uid()); las policies son defense-in-depth (el DML directo de
-- authenticated ya estaba revocado en 20260813000003).
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) Policies owner-only → dueño o miembro vigente (espejo de 20261005000000) ════════
-- Mismos nombres de policy que 20260806000005 (drop + re-create; el rename no los tocó).
drop policy if exists "aparatos_usuario_owner_select" on public.cf_aparatos_usuario;
create policy "aparatos_usuario_owner_select" on public.cf_aparatos_usuario for select
  using ((select auth.uid()) = user_id or public.empresa_lectura(user_id, 'flow'));

drop policy if exists "aparatos_usuario_owner_insert" on public.cf_aparatos_usuario;
create policy "aparatos_usuario_owner_insert" on public.cf_aparatos_usuario for insert
  with check ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'flow'));

drop policy if exists "aparatos_usuario_owner_update" on public.cf_aparatos_usuario;
create policy "aparatos_usuario_owner_update" on public.cf_aparatos_usuario for update
  using ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'flow'))
  with check ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'flow'));

drop policy if exists "aparatos_usuario_owner_delete" on public.cf_aparatos_usuario;
create policy "aparatos_usuario_owner_delete" on public.cf_aparatos_usuario for delete
  using ((select auth.uid()) = user_id or public.empresa_escritura(user_id, 'flow'));

-- ═══ 2) trg_sellar_owner sobre cf_aparatos_usuario (faltaba en la lista de 20261005000000)
-- CREATE TRIGGER idéntico al del foreach de 20261005000000, solo para esta tabla: drop + create
-- (PG no soporta create trigger if not exists; el drop-if-exists hace la re-ejecución segura).
drop trigger if exists trg_sellar_owner on public.cf_aparatos_usuario;
create trigger trg_sellar_owner before insert or update on public.cf_aparatos_usuario
  for each row execute function public.cf_sellar_owner_contenido();

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- 1) select policyname, qual from pg_policies where tablename = 'cf_aparatos_usuario';  -- 4 filas con empresa_*
-- 2) select tgrelid::regclass from pg_trigger where tgname = 'trg_sellar_owner'
--     and tgrelid = 'public.cf_aparatos_usuario'::regclass;                             -- 1 fila
