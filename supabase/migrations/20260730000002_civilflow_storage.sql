-- =========================================================================
-- CivilFlow — bucket de storage plan_pdfs + políticas RLS
-- Ya aplicado contra knswtfckzodiuiladmbt.
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('plan_pdfs', 'plan_pdfs', false)
on conflict (id) do nothing;

create policy "plan_pdfs_owner_select" on storage.objects for select
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_insert" on storage.objects for insert
  with check (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_update" on storage.objects for update
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plan_pdfs_owner_delete" on storage.objects for delete
  using (bucket_id = 'plan_pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
