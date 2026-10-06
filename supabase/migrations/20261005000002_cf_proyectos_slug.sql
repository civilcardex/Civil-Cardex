-- Slug uuid por proyecto de Civil Flow (identificador tipo Civil Manager para deep-links:
-- /civilflowareatrabajo/<slug>). La PK bigint y las RPCs quedan INTACTAS — el slug es una
-- columna secundaria de identidad/URL, no llave de relaciones. Re-ejecutable.
-- ⚠️ APLICAR EN SQL EDITOR.

alter table public.cf_proyectos add column if not exists slug uuid;

-- Proyectos existentes: slug propio (el default cubre los nuevos).
update public.cf_proyectos set slug = gen_random_uuid() where slug is null;

alter table public.cf_proyectos alter column slug set default gen_random_uuid();
alter table public.cf_proyectos alter column slug set not null;

alter table public.cf_proyectos drop constraint if exists cf_proyectos_slug_key;
alter table public.cf_proyectos add constraint cf_proyectos_slug_key unique (slug);
