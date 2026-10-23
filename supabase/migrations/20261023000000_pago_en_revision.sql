-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261023000000 — Estado 'revision' para pagos con monto insuficiente
--
-- ls-webhook es fail-closed: si el total de la orden LS es MENOR al monto esperado
-- (p. ej. un cupón aplicado en el checkout) NO activa la suscripción. Antes la fila
-- quedaba 'pendiente' para siempre — dinero cobrado sin activación y sin rastro
-- operable. Ahora el webhook la marca 'revision' y verificar-pago la reporta al
-- cliente para que contacte soporte (activación manual del dueño).
--
-- ⚠️ APLICAR EN SQL EDITOR. Re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- El nombre del CHECK es estable (app_pagos_periodo_check patrón): se borra CUALQUIER
-- check sobre estado y se recrea con el valor nuevo.
do $do$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.app_pagos'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table public.app_pagos drop constraint %I', c.conname);
  end loop;
end $do$;
alter table public.app_pagos
  add constraint app_pagos_estado_check
  check (estado in ('pendiente', 'aprobado', 'revision'));

-- Las filas ya atrapadas en el hueco viejo (monto insuficiente previo a este fix):
-- quedaron 'pendiente' sin webhook futuro → se marcan para revisión manual.
update public.app_pagos set estado = 'revision'
 where estado = 'pendiente' and created_at < now() - interval '1 day';

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.app_pagos'::regclass and contype = 'c';
