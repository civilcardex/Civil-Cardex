-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261004000000 — Suscripciones EMPRESARIALES por puesto (asientos)
--
-- Modelo: el dueño compra N puestos por módulo (app_suscripciones.puestos, la fila ya es
-- por usuario+módulo). Asigna miembros por correo (solo usuarios registrados, lookup en
-- auth.users desde RPC SECURITY DEFINER) con permiso puede_editar por miembro.
-- acceso_modulo() deja pasar a los MIEMBROS de suscripciones vigentes → todos los candados
-- (wrappers CF, policies CM) heredan sin cambios.
--
-- Descuento por volumen (2-4:10%, 5-9:15%, 10-24:20%, 25+: negociado) vive en el CÓDIGO
-- de precios (catalog.ts / _shared/lemon.ts); la BD solo guarda lo pagado.
--
-- Sigue DESHABILITADO: app_config('suscripciones_activas', false) → acceso_modulo true
-- para todos. Migración inofensiva sin suscripciones en producción.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ═══ 1) Puestos ═════════════════════════════════════════════════════════════════════════
alter table public.app_suscripciones
  add column if not exists puestos int not null default 1;
alter table public.app_suscripciones
  drop constraint if exists app_suscripciones_puestos_check;
alter table public.app_suscripciones
  add constraint app_suscripciones_puestos_check check (puestos >= 1);

-- El pago guarda el desglose {"flow":3,"manage":5}; activar_suscripciones lo reparte.
alter table public.app_pagos
  add column if not exists puestos_por_modulo jsonb not null default '{}'::jsonb;

-- ═══ 2) Miembros de una suscripción empresarial ═════════════════════════════════════════
create table if not exists public.app_suscripciones_miembros (
  id bigint generated always as identity primary key,
  suscripcion_id bigint not null references public.app_suscripciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asignado_por uuid not null references auth.users(id) on delete cascade,
  puede_editar boolean not null default true,
  created_at timestamptz not null default now(),
  unique (suscripcion_id, user_id)
);
alter table public.app_suscripciones_miembros enable row level security;
drop policy if exists app_suscripciones_miembros_leer on public.app_suscripciones_miembros;
create policy app_suscripciones_miembros_leer on public.app_suscripciones_miembros
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.app_suscripciones s
      where s.id = suscripcion_id and s.user_id = (select auth.uid())
    )
  );
revoke insert, update, delete on public.app_suscripciones_miembros from authenticated;
create index if not exists app_suscripciones_miembros_usuario_idx
  on public.app_suscripciones_miembros (user_id);
create index if not exists app_suscripciones_miembros_suscripcion_idx
  on public.app_suscripciones_miembros (suscripcion_id);

-- ═══ 3) acceso_modulo: los MIEMBROS de una suscripción vigente también entran ═══════════
create or replace function public.acceso_modulo(p_uid uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.suscripciones_habilitadas()
    or exists (
      select 1 from public.app_suscripciones s
      where s.user_id = p_uid and s.modulo = p_modulo
        and s.estado = 'activa' and s.fecha_fin > now()
    )
    or exists (
      select 1 from public.app_suscripciones_miembros m
      join public.app_suscripciones s on s.id = m.suscripcion_id
      where m.user_id = p_uid and s.modulo = p_modulo
        and s.estado = 'activa' and s.fecha_fin > now()
    );
$$;

-- ═══ 4) Helpers de compartición (los usa la migración de escritura compartida) ══════════
-- Lectura: soy el dueño, o soy miembro VIGENTE de su suscripción del módulo.
create or replace function public.empresa_lectura(p_owner uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid())
    or exists (
      select 1 from public.app_suscripciones_miembros m
      join public.app_suscripciones s on s.id = m.suscripcion_id
      where m.user_id = (select auth.uid()) and s.user_id = p_owner
        and s.modulo = p_modulo and s.estado = 'activa' and s.fecha_fin > now()
    );
$$;

-- Escritura: lectura + el miembro tiene puede_editar.
create or replace function public.empresa_escritura(p_owner uuid, p_modulo text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid())
    or exists (
      select 1 from public.app_suscripciones_miembros m
      join public.app_suscripciones s on s.id = m.suscripcion_id
      where m.user_id = (select auth.uid()) and s.user_id = p_owner
        and s.modulo = p_modulo and m.puede_editar
        and s.estado = 'activa' and s.fecha_fin > now()
    );
$$;

-- ═══ 5) activar_suscripciones: reparte puestos del pago a cada fila de módulo ═══════════
create or replace function public.activar_suscripciones(p_referencia text, p_txn_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pago public.app_pagos%rowtype;
  v_mod text;
  v_delta interval;
  v_puestos int;
begin
  -- FOR UPDATE: la segunda tx concurrente ESPERA aquí y al re-evaluar lee 'aprobado' → return.
  select * into v_pago from public.app_pagos where referencia = p_referencia for update;
  if not found then raise exception 'pago_no_encontrado'; end if;
  if v_pago.estado = 'aprobado' then return; end if;

  update public.app_pagos
  set estado = 'aprobado', txn_id = p_txn_id, aprobado_at = now()
  where id = v_pago.id and estado = 'pendiente';
  -- Cierre definitivo del race aunque alguien quite el FOR UPDATE.
  if not found then return; end if;

  v_delta := case v_pago.periodo
               when 'anual' then interval '12 months'
               when 'semestral' then interval '6 months'
               else interval '1 month'
             end;
  foreach v_mod in array v_pago.modulos loop
    v_puestos := greatest(coalesce((v_pago.puestos_por_modulo ->> v_mod)::int, 1), 1);
    insert into public.app_suscripciones (user_id, modulo, periodo, fecha_fin, puestos)
    values (v_pago.user_id, v_mod, v_pago.periodo, now() + v_delta, v_puestos)
    on conflict (user_id, modulo) do update
      set periodo = excluded.periodo,
          estado = 'activa',
          puestos = excluded.puestos,
          updated_at = now(),
          -- Renovar antes de vencer no pierde días: suma desde la vigencia actual.
          fecha_fin = greatest(now(), public.app_suscripciones.fecha_fin) + v_delta;
  end loop;
end;
$$;
-- Misma firma → grants vigentes se conservan; re-emitidos por claridad.
revoke execute on function public.activar_suscripciones(text, text) from public, anon, authenticated;
grant execute on function public.activar_suscripciones(text, text) to service_role;

-- ═══ 6) RPCs de gestión del equipo (el dueño administra desde /empresa) ═════════════════
-- SECURITY DEFINER con check de propiedad interno — patrón WARN-aceptado del repo.
-- El lookup de email es auth.users (email unique); cf_perfiles.email NO es unique.

create or replace function public.asignar_puesto(p_suscripcion_id bigint, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_sus public.app_suscripciones%rowtype;
  v_miembro_id uuid;
  v_usados int;
  v_email text := btrim(coalesce(p_email, ''));
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  -- FOR UPDATE: serializa asignaciones concurrentes — cierre del race de sobrecupo.
  select * into v_sus from public.app_suscripciones
    where id = p_suscripcion_id and user_id = uid
    for update;
  if not found then raise exception 'no_autorizado'; end if;
  if v_sus.estado <> 'activa' or v_sus.fecha_fin <= now() then
    raise exception 'suscripcion_vencida';
  end if;
  if v_email = '' or char_length(v_email) > 200 then raise exception 'email_invalido'; end if;

  select u.id into v_miembro_id from auth.users u where lower(u.email) = lower(v_email);
  if v_miembro_id is null then raise exception 'usuario_no_encontrado'; end if;
  if v_miembro_id = uid then raise exception 'no_puedes_asignarte'; end if;
  if exists (select 1 from public.app_suscripciones_miembros
             where suscripcion_id = v_sus.id and user_id = v_miembro_id) then
    raise exception 'ya_es_miembro';
  end if;
  select count(*) into v_usados from public.app_suscripciones_miembros
    where suscripcion_id = v_sus.id;
  if v_usados >= v_sus.puestos then raise exception 'sin_puestos_disponibles'; end if;

  insert into public.app_suscripciones_miembros (suscripcion_id, user_id, asignado_por, puede_editar)
  values (v_sus.id, v_miembro_id, uid, true);
  return jsonb_build_object('user_id', v_miembro_id, 'email', v_email, 'puede_editar', true);
end;
$$;

create or replace function public.quitar_puesto(p_suscripcion_id bigint, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.app_suscripciones
                 where id = p_suscripcion_id and user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  delete from public.app_suscripciones_miembros
    where suscripcion_id = p_suscripcion_id and user_id = p_user_id;
end;
$$;

create or replace function public.cambiar_permiso_miembro(
  p_suscripcion_id bigint, p_user_id uuid, p_puede_editar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if not exists (select 1 from public.app_suscripciones
                 where id = p_suscripcion_id and user_id = uid) then
    raise exception 'no_autorizado';
  end if;
  update public.app_suscripciones_miembros set puede_editar = coalesce(p_puede_editar, true)
    where suscripcion_id = p_suscripcion_id and user_id = p_user_id;
  if not found then raise exception 'miembro_no_encontrado'; end if;
end;
$$;

create or replace function public.mis_miembros(p_suscripcion_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', m.user_id, 'email', u.email,
           'puede_editar', m.puede_editar, 'asignado_en', m.created_at
         ) order by m.created_at), '[]'::jsonb)
  from public.app_suscripciones_miembros m
  join auth.users u on u.id = m.user_id
  where m.suscripcion_id = p_suscripcion_id
    and exists (select 1 from public.app_suscripciones s
                where s.id = m.suscripcion_id and s.user_id = (select auth.uid()));
$$;

grant execute on function
  public.asignar_puesto(bigint, text),
  public.quitar_puesto(bigint, uuid),
  public.cambiar_permiso_miembro(bigint, uuid, boolean),
  public.mis_miembros(bigint)
to authenticated;

-- ═══ VERIFICACIÓN ══════════════════════════════════════════════════════════════════════
-- select column_name from information_schema.columns
--  where table_name='app_suscripciones' and column_name='puestos';        -- 1 fila
-- select public.acceso_modulo('<uid_miembro>', 'flow');                   -- true con asiento
-- select public.empresa_lectura('<owner>','flow');                        -- true siendo miembro
