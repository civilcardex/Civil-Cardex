-- Renombra la columna jsonb `v24` de cf_ep_datos_proyecto a `extra` y re-parchea el CUERPO
-- VIVO de save_ep_datos_impl (lección R-1). Los 18 campos que guarda no cambian: solo cambia
-- el nombre del contenedor, porque "V24" era el nombre del HTML de referencia, no un esquema.
-- Aplicar en SQL Editor DESPUÉS de 20261119000000_ep_v24_fields.sql. Idempotente.

do $do$
declare
  v_col text;
  v_src text;
  v_new text;
begin
  -- 1) Columna: renombrar si aún existe la vieja; si no existe ninguna, crearla (migración
  --    anterior no aplicada: el RPC viejo no persiste estos campos todavía).
  select column_name into v_col
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'cf_ep_datos_proyecto'
     and column_name = 'v24';
  if v_col is not null then
    execute 'alter table public.cf_ep_datos_proyecto rename column v24 to extra';
  end if;

  select column_name into v_col
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'cf_ep_datos_proyecto'
     and column_name = 'extra';
  if v_col is null then
    raise exception 'ep_extra_rename: columna_extra_ausente — aplique primero 20261119000000_ep_v24_fields.sql';
  end if;

  -- 2) Cuerpo vivo del upsert. Firma VIGENTE: p_proyecto_id uuid (20261005000009 la convirtió).
  select prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'save_ep_datos_impl'
     and pg_get_function_identity_arguments(p.oid) = 'p_proyecto_id uuid, p_datos jsonb';
  if v_src is null then
    raise exception 'ep_extra_rename: save_ep_datos_impl_no_encontrado';
  end if;

  if strpos(v_src, 'v24') > 0 then
    -- Migración anterior aplicada: solo cambia el token del jsonb.
    v_new := replace(v_src, 'v24', 'extra');
  elsif strpos(v_src, 'extra') > 0 then
    -- Ya parcheado (re-ejecución).
    v_new := v_src;
  else
    -- Cuerpo base sin la columna: misma cirugía con el nombre nuevo.
    v_new := replace(v_src, 'pv, npshr, updated_at)', 'pv, npshr, extra, updated_at)');
    v_new := replace(v_new, 'r.npshr, now()', 'r.npshr, r.extra, now()');
    v_new := replace(v_new, 'npshr = excluded.npshr, updated_at = now();',
                            'npshr = excluded.npshr, extra = excluded.extra, updated_at = now();');
  end if;

  if strpos(v_new, 'npshr, extra, updated_at)') = 0
     or strpos(v_new, 'r.npshr, r.extra, now()') = 0
     or strpos(v_new, 'extra = excluded.extra') = 0 then
    raise exception 'ep_extra_rename: cuerpo divergió';
  end if;

  execute format(
    'create or replace function public.save_ep_datos_impl(p_proyecto_id uuid, p_datos jsonb) returns void language plpgsql security definer set search_path = public as $body$%s$body$',
    v_new);
end $do$;
