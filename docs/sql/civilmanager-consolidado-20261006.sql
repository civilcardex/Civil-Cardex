-- ═══════════════════════════════════════════════════════════════════════════════
-- CIVIL CARDEX — BD COMPLETA DESDE CERO · PARTE 2/2: CIVIL MANAGER
-- ═══════════════════════════════════════════════════════════════════════════════
-- Estado FINAL consolidado de las migraciones cm_* (20260814000001 → 20261005000000).
-- REFERENCIA documental; la fuente aplicada sigue siendo supabase/migrations/.
--
-- REQUIERE la parte 1 (01_civilflow.sql): usa app_config/app_suscripciones/
-- app_suscripciones_miembros/acceso_modulo/empresa_lectura/empresa_escritura.
--
-- Diferencias clave con Civil Flow:
--   · cm_proyectos.id es UUID desde el día uno.
--   · El cliente ESCRIBE directo a las tablas (grants CRUD para authenticated +
--     policies RLS); no hay RPCs de escritura ni wrapper/impl. El cliente sella
--     user_id = dueño del proyecto activo (storage.ts: ownerIdProyectoActivo).
--   · Solo cm_config es por usuario; TODAS las demás tablas cuelgan de cm_proyectos.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1 · PROYECTOS
-- ═══════════════════════════════════════════════════════════════════════════════

create table public.cm_proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cm_proyectos_user_id on public.cm_proyectos(user_id);
alter table public.cm_proyectos enable row level security;

create or replace function public.cm_proyectos_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_cm_proyectos_updated_at on public.cm_proyectos;
create trigger trg_cm_proyectos_updated_at before update on public.cm_proyectos
for each row execute function public.cm_proyectos_set_updated_at();

-- ── Helpers RLS ──────────────────────────────────────────────────────────────

-- ¿El proyecto pertenece al caller? (dueño directo)
create or replace function public.cm_proyecto_de_usuario(pid uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.cm_proyectos p where p.id = pid and p.user_id = (select auth.uid()));
$$;

-- ¿La fila (de proyecto p_owner) es accesible para el caller como miembro?
-- La usan las policies INSERT/UPDATE de las tablas hijas: un miembro solo puede
-- colgar filas de un proyecto cuyo dueño es el user_id sellado en la fila.
create or replace function public.cm_proyecto_de_propietario(p_proyecto_id uuid, p_owner uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.cm_proyectos p
                 where p.id = p_proyecto_id and p.user_id = p_owner);
$$;

-- Policies de cm_proyectos:
--   SELECT: dueño o miembro con asiento vigente (paridad con cf_proyectos).
--   INSERT/UPDATE: dueño + gating de suscripción manage (acceso_modulo).
--   DELETE: dueño (ciclo de vida owner-only, igual que flow).
create policy cm_proyectos_propietario_leer on public.cm_proyectos for select using (
  (select auth.uid()) = user_id or public.empresa_lectura(user_id, 'manage'));
create policy cm_proyectos_propietario_insertar on public.cm_proyectos
  for insert with check (
    (select auth.uid()) = user_id
    and public.acceso_modulo((select auth.uid()), 'manage')
  );
create policy cm_proyectos_propietario_actualizar on public.cm_proyectos
  for update using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.acceso_modulo((select auth.uid()), 'manage')
  );
create policy cm_proyectos_propietario_eliminar on public.cm_proyectos
  for delete using ((select auth.uid()) = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2 · TABLAS HIJAS (todas por proyecto, con trigger updated_at)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Factores prestacionales (prestaciones/seguridad social/parafiscales/otros).
create table public.cm_factores_prestacionales (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  factor numeric not null default 0,
  tipo text not null check (tipo in ('prestaciones','seguridad_social','parafiscales','otros')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index idx_cm_factores_prestacionales_user on public.cm_factores_prestacionales(user_id);
create index idx_cm_factores_prestacionales_proyecto on public.cm_factores_prestacionales(proyecto_id);

create table public.cm_cargos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  descripcion text not null default '',
  num_salarios_base numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index idx_cm_cargos_user on public.cm_cargos(user_id);
create index idx_cm_cargos_proyecto on public.cm_cargos(proyecto_id);

create table public.cm_proveedores (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  nit text not null default '',
  contacto text not null default '',
  tel1 text not null default '',
  tel2 text not null default '',
  email text not null default '',
  direccion text not null default '',
  ciudad text not null default '',
  departamento text not null default '',
  tipo text[] not null default '{}',
  notas text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index idx_cm_proveedores_user on public.cm_proveedores(user_id);
create index idx_cm_proveedores_proyecto on public.cm_proveedores(proyecto_id);

create table public.cm_cuadrillas (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  descripcion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index idx_cm_cuadrillas_user on public.cm_cuadrillas(user_id);
create index idx_cm_cuadrillas_proyecto on public.cm_cuadrillas(proyecto_id);

-- Pivote N:M cuadrilla ↔ cargo (cuántos salarios base de cada cargo integran la cuadrilla).
create table public.cm_cuadrilla_integrantes (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  cuadrilla_id text not null references public.cm_cuadrillas(id) on delete cascade,
  cargo_id text not null references public.cm_cargos(id) on delete restrict,
  cantidad integer not null default 1 check (cantidad >= 0),
  created_at timestamptz not null default now(),
  unique (cuadrilla_id, cargo_id)
);
create index idx_cm_cuadrilla_integrantes_cuadrilla on public.cm_cuadrilla_integrantes(cuadrilla_id);
create index idx_cm_cuadrilla_integrantes_proyecto on public.cm_cuadrilla_integrantes(proyecto_id);
create index idx_cm_cuadrilla_integrantes_cargo on public.cm_cuadrilla_integrantes(cargo_id);
create index idx_cm_cuadrilla_integrantes_user on public.cm_cuadrilla_integrantes(user_id);

create table public.cm_equipos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  tipo text not null default '',
  unidad text not null default '',
  costo_hora numeric not null default 0,
  fecha_cotizacion text not null default '',
  proveedor_id text references public.cm_proveedores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index idx_cm_equipos_user on public.cm_equipos(user_id);
create index idx_cm_equipos_proyecto on public.cm_equipos(proyecto_id);
create index idx_cm_equipos_proveedor on public.cm_equipos(proveedor_id);

create table public.cm_insumos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  unidad text not null default '',
  origen text not null default '',
  categoria text not null default '',
  subcategoria text not null default '',
  marca_referencia text not null default '',
  costo_unitario numeric not null default 0,
  fecha_cotizacion text not null default '',
  apu_basico_id text,
  proveedor_id text references public.cm_proveedores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index idx_cm_insumos_user on public.cm_insumos(user_id);
create index idx_cm_insumos_proyecto on public.cm_insumos(proyecto_id);
create index idx_cm_insumos_categoria on public.cm_insumos(proyecto_id, categoria);
create index idx_cm_insumos_proveedor on public.cm_insumos(proveedor_id);

-- APUs: rendimiento unitario con sus recursos (MO/eq/ins/transporte) como jsonb.
create table public.cm_apus (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  categoria text not null default '',
  unidad text not null default '',
  fecha_creacion text not null default '',
  es_basico boolean not null default false,
  recursos_mo jsonb not null default '[]'::jsonb,
  recursos_eq jsonb not null default '[]'::jsonb,
  recursos_ins jsonb not null default '[]'::jsonb,
  recursos_transporte jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index idx_cm_apus_user on public.cm_apus(user_id);
create index idx_cm_apus_proyecto on public.cm_apus(proyecto_id);
create index idx_cm_apus_categoria on public.cm_apus(proyecto_id, categoria);

-- Presupuestos: items como jsonb + snapshots de catálogos al momento de crear
-- (snap = los precios/factores vivos en ese momento; el presupuesto no cambia si
-- luego editan el catálogo). aiu_override = %AIU e IVA editados a mano.
create table public.cm_presupuestos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.cm_proyectos(id) on delete cascade,
  codigo text not null,
  nombre text not null default '',
  entidad text not null default '',
  contrato text not null default '',
  objeto text not null default '',
  plazo text not null default '',
  fecha_creacion text not null default '',
  ciudad text not null default '',
  departamento text not null default '',
  elaborado_por text not null default '',
  activo boolean not null default true,
  con_sub_proyectos boolean not null default false,
  parent_id text,
  estado text not null default 'borrador' check (estado in ('borrador','en_revision','cerrado')),
  fecha_cierre text not null default '',
  observaciones text not null default '',
  items jsonb not null default '[]'::jsonb,
  aiu_override jsonb not null default '{"activo":false,"pct_a":10,"pct_i":3,"pct_u":6,"iva_pct":19}'::jsonb,
  factores_snap jsonb not null default '[]'::jsonb,
  cargos_snap jsonb not null default '[]'::jsonb,
  apus_snap jsonb not null default '[]'::jsonb,
  insumos_snap jsonb not null default '[]'::jsonb,
  equipos_snap jsonb not null default '[]'::jsonb,
  cuadrillas_snap jsonb not null default '[]'::jsonb,
  perfil_pais_snap jsonb,
  formulario_original jsonb,
  tipo_precio_formulario jsonb,
  alarmas_precio_faltante jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proyecto_id, codigo)
);
create index idx_cm_presupuestos_user on public.cm_presupuestos(user_id);
create index idx_cm_presupuestos_proyecto on public.cm_presupuestos(proyecto_id);

-- Triggers updated_at de las 9 hijas (misma función por tabla).
do $do$
declare t text;
begin
  foreach t in array array[
    'cm_factores_prestacionales','cm_cargos','cm_proveedores','cm_cuadrillas',
    'cm_equipos','cm_insumos','cm_apus','cm_presupuestos'
  ] loop
    execute format($f$create or replace function public.%I_set_updated_at()
      returns trigger language plpgsql set search_path = public as $$
      begin new.updated_at := now(); return new; end; $$;$f$, t);
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.%I_set_updated_at()', t, t, t);
  end loop;
end $do$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3 · CONFIG GLOBAL POR USUARIO
-- ═══════════════════════════════════════════════════════════════════════════════

create table public.cm_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  config_listas jsonb not null default '{}'::jsonb,
  categorias_apu jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cm_config enable row level security;

create or replace function public.cm_config_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_cm_config_updated_at on public.cm_config;
create trigger trg_cm_config_updated_at before update on public.cm_config
for each row execute function public.cm_config_set_updated_at();

create policy cm_config_propietario_leer on public.cm_config for select using ((select auth.uid()) = user_id);
create policy cm_config_propietario_insertar on public.cm_config for insert with check ((select auth.uid()) = user_id);
create policy cm_config_propietario_actualizar on public.cm_config for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cm_config_propietario_eliminar on public.cm_config for delete using ((select auth.uid()) = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4 · RPC DE LECTURA (todo el registro del proyecto en una ida)
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.cm_get_data(p_proyecto_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'proyectos',       coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.cm_proyectos p where p.user_id = auth.uid()), '[]'::jsonb),
    'factores',        coalesce((select jsonb_agg(to_jsonb(f) order by f.codigo) from public.cm_factores_prestacionales f where f.user_id = auth.uid() and (p_proyecto_id is null or f.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'cargos',          coalesce((select jsonb_agg(to_jsonb(c) order by c.codigo) from public.cm_cargos c where c.user_id = auth.uid() and (p_proyecto_id is null or c.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'cuadrillas',      coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'codigo', q.codigo, 'descripcion', q.descripcion, 'integrantes', coalesce((select jsonb_agg(to_jsonb(i) order by i.cargo_id) from public.cm_cuadrilla_integrantes i where i.cuadrilla_id = q.id), '[]'::jsonb)) order by q.codigo) from public.cm_cuadrillas q where q.user_id = auth.uid() and (p_proyecto_id is null or q.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'equipos',         coalesce((select jsonb_agg(to_jsonb(e) order by e.codigo) from public.cm_equipos e where e.user_id = auth.uid() and (p_proyecto_id is null or e.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'insumos',         coalesce((select jsonb_agg(to_jsonb(ii) order by ii.codigo) from public.cm_insumos ii where ii.user_id = auth.uid() and (p_proyecto_id is null or ii.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'proveedores',     coalesce((select jsonb_agg(to_jsonb(pr) order by pr.codigo) from public.cm_proveedores pr where pr.user_id = auth.uid() and (p_proyecto_id is null or pr.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'apus',            coalesce((select jsonb_agg(to_jsonb(a) order by a.codigo) from public.cm_apus a where a.user_id = auth.uid() and (p_proyecto_id is null or a.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'presupuestos',    coalesce((select jsonb_agg(to_jsonb(pp) order by pp.codigo) from public.cm_presupuestos pp where pp.user_id = auth.uid() and (p_proyecto_id is null or pp.proyecto_id = p_proyecto_id)), '[]'::jsonb),
    'config',          coalesce((select to_jsonb(cc) - 'user_id' from public.cm_config cc where cc.user_id = auth.uid()), '{}'::jsonb)
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5 · RLS DE LAS TABLAS HIJAS
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT: dueño o miembro con asiento (empresa_lectura manage).
-- INSERT/UPDATE: (dueño + proyecto suyo) O (miembro con escritura + la fila apunta al
--   dueño correcto vía cm_proyecto_de_propietario — el cliente sella user_id = dueño).
-- DELETE: dueño o miembro con escritura.

do $do$
declare t text;
begin
  foreach t in array array[
    'cm_factores_prestacionales','cm_cargos','cm_proveedores','cm_cuadrillas',
    'cm_cuadrilla_integrantes','cm_equipos','cm_insumos','cm_apus','cm_presupuestos'
  ] loop
    execute format($q$create policy %I on public.%I for select using (
        (select auth.uid()) = user_id or public.empresa_lectura(user_id, 'manage'))$q$, t || '_propietario_leer', t);
    execute format($q$create policy %I on public.%I for insert with check (
        ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id))
        or (public.empresa_escritura(user_id, 'manage')
            and public.cm_proyecto_de_propietario(proyecto_id, user_id)))$q$,
      t || '_propietario_insertar', t);
    execute format($q$create policy %I on public.%I for update using (
        (select auth.uid()) = user_id or public.empresa_escritura(user_id, 'manage'))
      with check (
        ((select auth.uid()) = user_id and public.cm_proyecto_de_usuario(proyecto_id))
        or (public.empresa_escritura(user_id, 'manage')
            and public.cm_proyecto_de_propietario(proyecto_id, user_id)))$q$,
      t || '_propietario_actualizar', t);
    execute format($q$create policy %I on public.%I for delete using (
        (select auth.uid()) = user_id or public.empresa_escritura(user_id, 'manage'))$q$,
      t || '_propietario_eliminar', t);
  end loop;
end $do$;

-- RLS on para las hijas (cm_proyectos/cm_config ya lo tienen).
alter table public.cm_factores_prestacionales enable row level security;
alter table public.cm_cargos enable row level security;
alter table public.cm_proveedores enable row level security;
alter table public.cm_cuadrillas enable row level security;
alter table public.cm_cuadrilla_integrantes enable row level security;
alter table public.cm_equipos enable row level security;
alter table public.cm_insumos enable row level security;
alter table public.cm_apus enable row level security;
alter table public.cm_presupuestos enable row level security;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6 · GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════
-- A diferencia de flow, aquí authenticated ESCRIBE directo (con RLS): el cliente
-- civilmanager hace .from('cm_*').upsert(...). Solo se revoca anon.

revoke all on table
  public.cm_proyectos, public.cm_factores_prestacionales, public.cm_cargos,
  public.cm_proveedores, public.cm_cuadrillas, public.cm_cuadrilla_integrantes,
  public.cm_equipos, public.cm_insumos, public.cm_apus, public.cm_presupuestos,
  public.cm_config
from anon;

revoke execute on function public.cm_get_data(uuid) from public, anon;
grant execute on function public.cm_get_data(uuid) to authenticated;

revoke execute on function public.cm_proyecto_de_usuario(uuid),
  public.cm_proyecto_de_propietario(uuid, uuid)
from public, anon;

notify pgrst, 'reload schema';
