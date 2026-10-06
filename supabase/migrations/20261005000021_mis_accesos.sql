-- mis_accesos: módulos con acceso vigente (propios + asientos de empresa). El cliente
-- (RequireModule vía useSubscriptions) decide con esto — app_suscripciones es owner-only
-- por RLS y no ve los asientos de app_suscripciones_miembros.
create or replace function public.mis_accesos()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct modulo), '{}')
  from (
    select s.modulo from public.app_suscripciones s
      where s.user_id = (select auth.uid()) and s.estado = 'activa' and s.fecha_fin > now()
    union
    select s.modulo from public.app_suscripciones_miembros m
      join public.app_suscripciones s on s.id = m.suscripcion_id
      where m.user_id = (select auth.uid()) and s.estado = 'activa' and s.fecha_fin > now()
  ) a;
$$;
grant execute on function public.mis_accesos() to authenticated;
revoke execute on function public.mis_accesos() from public, anon;

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- select has_function_privilege('anon', 'public.mis_accesos()', 'execute');          → false
-- select has_function_privilege('authenticated', 'public.mis_accesos()', 'execute'); → true
-- select public.mis_accesos();  -- con sesión propia 'flow' + asiento 'manage' → {flow,manage}
