-- MÓDULO EPC — campos de CISTERNA que faltaban (Excel hoja CISTERNA):
--   Volumetría (sección 2): dot_l, n_usuarios, dias_aut, bci_l
--   NPSH/cavitación (sección 3): patm, pv, npshr
-- Re-aplica save_ep_datos con las columnas nuevas. Re-ejecutable.
-- ⚠️ APLICAR EN SQL EDITOR.

alter table public.cf_ep_datos_proyecto add column if not exists dot_l numeric;
alter table public.cf_ep_datos_proyecto add column if not exists n_usuarios numeric;
alter table public.cf_ep_datos_proyecto add column if not exists dias_aut numeric;
alter table public.cf_ep_datos_proyecto add column if not exists bci_l numeric;
alter table public.cf_ep_datos_proyecto add column if not exists patm numeric;
alter table public.cf_ep_datos_proyecto add column if not exists pv numeric;
alter table public.cf_ep_datos_proyecto add column if not exists npshr numeric;

create or replace function public.save_ep_datos(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_ep_datos_proyecto (proyecto_id, user_id, qac, qasc, hfac, hfacs, hfotros, pred, pmin, pmax, zbomba, ztop, zcis, hfcis, nt, nr, etab, etam, fs, ciclos, alfa, vsuc, vimp, dnsuc, dnimp, pcomercial, modo, dot_l, n_usuarios, dias_aut, bci_l, patm, pv, npshr, updated_at)
  select p_proyecto_id, uid, r.qac, r.qasc, r.hfac, r.hfacs, r.hfotros, r.pred, r.pmin, r.pmax, r.zbomba, r.ztop, r.zcis, r.hfcis, r.nt, r.nr, r.etab, r.etam, r.fs, r.ciclos, r.alfa, r.vsuc, r.vimp, r.dnsuc, r.dnimp, r.pcomercial, r.modo, r.dot_l, r.n_usuarios, r.dias_aut, r.bci_l, r.patm, r.pv, r.npshr, now()
  from jsonb_populate_recordset(null::public.cf_ep_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    qac = excluded.qac, qasc = excluded.qasc, hfac = excluded.hfac, hfacs = excluded.hfacs, hfotros = excluded.hfotros, pred = excluded.pred, pmin = excluded.pmin, pmax = excluded.pmax, zbomba = excluded.zbomba, ztop = excluded.ztop, zcis = excluded.zcis, hfcis = excluded.hfcis, nt = excluded.nt, nr = excluded.nr, etab = excluded.etab, etam = excluded.etam, fs = excluded.fs, ciclos = excluded.ciclos, alfa = excluded.alfa, vsuc = excluded.vsuc, vimp = excluded.vimp, dnsuc = excluded.dnsuc, dnimp = excluded.dnimp, pcomercial = excluded.pcomercial, modo = excluded.modo, dot_l = excluded.dot_l, n_usuarios = excluded.n_usuarios, dias_aut = excluded.dias_aut, bci_l = excluded.bci_l, patm = excluded.patm, pv = excluded.pv, npshr = excluded.npshr, updated_at = now();
end;
$$;

revoke all on function public.save_ep_datos(bigint, jsonb) from public, anon;
grant execute on function public.save_ep_datos(bigint, jsonb) to authenticated;
