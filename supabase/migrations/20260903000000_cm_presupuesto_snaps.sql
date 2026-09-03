-- -------------------------------------------------------------------------
-- Brechas del prototipo CIVILMANAGER: snapshots completos por presupuesto y
-- formulario Excel original del cliente adjunto al presupuesto.
-- El RPC cm_get_data devuelve cm_presupuestos con to_jsonb(pp), así que las
-- columnas nuevas viajan solas sin tocar el RPC.
-- -------------------------------------------------------------------------

alter table public.cm_presupuestos add column if not exists insumos_snap jsonb not null default '[]'::jsonb;
alter table public.cm_presupuestos add column if not exists equipos_snap jsonb not null default '[]'::jsonb;
alter table public.cm_presupuestos add column if not exists cuadrillas_snap jsonb not null default '[]'::jsonb;
alter table public.cm_presupuestos add column if not exists perfil_pais_snap jsonb;
alter table public.cm_presupuestos add column if not exists formulario_original jsonb;
