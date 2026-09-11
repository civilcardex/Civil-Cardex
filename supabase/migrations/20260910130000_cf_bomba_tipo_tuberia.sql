-- Tipo de tubería de la bomba de aguas residuales (orig. usuario): PVC-PR / Acero
-- galvanizado / Acero al carbón. El coeficiente C de Hazen-Williams se deriva del Catálogo
-- Maestro según este valor (lado cliente, matHazenC) — no se almacena.
-- UP
alter table public.cf_bomba_datos_proyecto add column if not exists tipo_tuberia text not null default '';

create or replace function public.save_bomba_datos(p_proyecto_id bigint, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.cf_proyectos p where p.id = p_proyecto_id and p.user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  insert into public.cf_bomba_datos_proyecto (proyecto_id, user_id, sal_sim, ud_tot, hz, l_imp, d_imp, c_hw, p_desc, eta_b, f_srv, t_cic, h_min, h_max, b_cam, l_cam, npsh, tipo_tuberia, updated_at)
  select p_proyecto_id, uid, r.sal_sim, r.ud_tot, r.hz, r.l_imp, r.d_imp, r.c_hw, r.p_desc, r.eta_b, r.f_srv, r.t_cic, r.h_min, r.h_max, r.b_cam, r.l_cam, r.npsh, coalesce(nullif(r.tipo_tuberia, ''), 'PVC-PR'), now()
  from jsonb_populate_recordset(null::public.cf_bomba_datos_proyecto, jsonb_build_array(coalesce(p_datos,'{}'::jsonb))) r
  on conflict (proyecto_id) do update set
    sal_sim = excluded.sal_sim, ud_tot = excluded.ud_tot, hz = excluded.hz, l_imp = excluded.l_imp, d_imp = excluded.d_imp, c_hw = excluded.c_hw, p_desc = excluded.p_desc, eta_b = excluded.eta_b, f_srv = excluded.f_srv, t_cic = excluded.t_cic, h_min = excluded.h_min, h_max = excluded.h_max, b_cam = excluded.b_cam, l_cam = excluded.l_cam, npsh = excluded.npsh, tipo_tuberia = excluded.tipo_tuberia, updated_at = now();
end;
$$;

-- DOWN
alter table public.cf_bomba_datos_proyecto drop column if exists tipo_tuberia;
