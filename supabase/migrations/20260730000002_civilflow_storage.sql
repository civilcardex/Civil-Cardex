-- =========================================================================
-- CivilFlow — bucket de storage plan_pdfs + políticas RLS
-- Ya aplicado contra knswtfckzodiuiladmbt.
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('plan_pdfs', 'plan_pdfs', false)
on conflict (id) do nothing;

-- Políticas idempotentes (drop-if-exists): el runner de migraciones de Supabase Preview
-- re-ejecuta este archivo cuando el estado del branch lo pide — 42710 rompe el deploy
-- (falla observada 2026-10-01). El drop matchea SOLO estos 4 nombres dueño: las policies
-- vigentes de empresa (pdfs_empresa_*, 20261005000000) no se tocan.
drop policy if exists "plan_pdfs_owner_select" on storage.objects;
drop policy if exists "plan_pdfs_owner_insert" on storage.objects;
drop policy if exists "plan_pdfs_owner_update" on storage.objects;
drop policy if exists "plan_pdfs_owner_delete" on storage.objects;
create policy "plan_pdfs_owner_select" on storage.objects for select
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_insert" on storage.objects for insert
  with check (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_update" on storage.objects for update
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_delete" on storage.objects for delete
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
