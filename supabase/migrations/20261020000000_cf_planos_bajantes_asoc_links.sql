-- ASOCIACIÓN MONTANTE↔RAMAL PERSISTENTE (asoc_links) + RPC que la guarda.
--
-- Síntoma (orig. usuario 2026-10-20): al reabrir el proyecto (otra pestaña / otro equipo) la
-- asociación entre un montante y sus ramales se perdía y había que volver a marcarla a mano;
-- con ella se perdían también los aparatos que ese montante transporta.
--
-- CAUSA RAÍZ: la asociación a mano vive en DOS campos del bajante/montante:
--   - `asocManual`  → el set de enlaces marcados a mano (checkbox "Ramales asociados"),
--   - `recibeDeIds` / `alimentaIds` → ids de RAMAL (un bajante también puede apuntar a otro
--     bajante; ahí el RPC sí resuelve el enlace).
-- El RPC `save_plano_data` sólo reconstruye `cf_bajante_conexiones`, que es un enlace
-- BAJANTE→BAJANTE (se resuelve contra el mapa de bajantes DEL PLANO): un id de RAMAL no
-- existe en ese mapa → el `join` no matchea y el enlace se descarta en silencio. Y no había
-- columna para `asocManual` → se perdía entero. Al recargar, el montante volvía sin ramales:
-- agregado en 0 y "no aparecen los aparatos del montante".
--
-- FIX: columna jsonb `asoc_links` en cf_planos_bajantes = {recibe:[], alimenta:[], manual:[]}
-- (los tres conjuntos completos) + el RPC la escribe. `get_plano_data` ya devuelve
-- `to_jsonb(b)` de la fila → la columna llega sola al cliente sin tocar ese RPC.
--
-- El cliente (trazosDb.ts / planoRowMappers.ts) ya manda y lee `asoc_links`: antes de aplicar
-- esta migración la clave se ignora (jsonb_populate_recordset ignora claves que no son
-- columnas) → nada rompe, la asociación simplemente sigue sin persistir.
--
-- ⚠️ APLICAR EN SQL EDITOR. El SELECT final es el comprobante.

-- ── 1) Columna ────────────────────────────────────────────────────────────────────────
alter table public.cf_planos_bajantes
  add column if not exists asoc_links jsonb not null default '{}'::jsonb;

-- ── 2) RPC: que la columna viaje en el guardado ───────────────────────────────────────
-- Patrón de la casa (ver 20261006000000): leer el cuerpo VIVO (pg_get_functiondef) y parchearlo
-- con contraseñas POSICIONALES (strpos/overlay) en vez de literals: el cuerpo cambia con cada
-- migración que añade columnas (angulo, canal_flow_dir…) y un literal fijo se queda viejo.
-- Verificación dura: si no se pueden colocar las 3 piezas, se aborta la transacción (dejar el
-- cuerpo a medias dejaría el INSERT descuadrado → el RPC roto).
do $$
declare
  r record;
  v_new text;
  i_ins integer;      -- 'insert into ... cf_planos_bajantes ('
  i_close integer;    -- ')' que cierra la lista de columnas
  i_from integer;     -- 'from jsonb_populate_recordset(null::...cf_planos_bajantes'
  i_conf integer;     -- 'do update set' de las bajantes
  v_oc integer;
begin
  for r in
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('save_plano_data', 'save_plano_data_impl')
      and pg_get_function_identity_arguments(p.oid) = 'p_plano_id bigint, p_data jsonb'
  loop
    -- Ya tiene la columna (migración repetida): no se toca.
    if strpos(r.def, 'asoc_links') > 0 then
      raise notice 'save_plano_data: asoc_links ya presente en %', r.proname;
      continue;
    end if;
    -- Wrapper sin el INSERT de bajantes (no toca esas filas): no hay nada que parchear.
    if strpos(r.def, 'cf_planos_bajantes') = 0 then
      raise notice 'save_plano_data: % no escribe cf_planos_bajantes — se omite', r.proname;
      continue;
    end if;
    v_new := r.def;

    -- (1) Lista de columnas del INSERT de bajantes → se añade la columna nueva al final.
    i_ins := strpos(v_new, 'insert into public.cf_planos_bajantes (');
    if i_ins = 0 then i_ins := strpos(v_new, 'insert into cf_planos_bajantes ('); end if;
    if i_ins = 0 then
      raise exception 'save_plano_body_divergio: % — no se encuentra el INSERT de cf_planos_bajantes', r.proname;
    end if;
    -- Suelo del cuerpo vivo (por si divergiera: sale en el output aunque el patch aborte).
    raise notice 'save_plano_data: cuerpo vivo -> %', substr(v_new, i_ins, 260);

    -- Postgres: strpos tiene 2 argumentos → se busca desde i_ins con substr.
    i_close := i_ins + strpos(substr(v_new, i_ins), ')') - 1;
    if i_close = 0 then
      raise exception 'save_plano_body_divergio: % — lista de columnas sin cierre', r.proname;
    end if;
    v_new := substr(v_new, 1, i_close - 1) || ', asoc_links' || substr(v_new, i_close);

    -- (2) Lista de valores → la columna nueva lee del payload (jsonb), con '{}' por defecto.
    i_from := strpos(v_new, 'from jsonb_populate_recordset(null::public.cf_planos_bajantes');
    if i_from = 0 then
      i_from := strpos(v_new, 'from jsonb_populate_recordset(null::cf_planos_bajantes');
    end if;
    if i_from = 0 then
      raise exception 'save_plano_body_divergio: % — no se encuentra el FROM de las bajantes', r.proname;
    end if;
    -- La lista de valores NO termina en coma → la coma va ANTES de la expresión nueva.
    v_new := substr(v_new, 1, i_from - 1) || ', coalesce(r.asoc_links, ''{}''::jsonb)' || substr(v_new, i_from);

    -- (3) Upsert → la columna se actualiza con el valor nuevo (el primero 'do update set'
    --     DESPUÉS del insert de bajantes: el de la cabecera de planos va antes y no se toca).
    i_conf := i_ins + strpos(substr(v_new, i_ins), 'do update set') - 1;
    if i_conf = 0 then
      raise exception 'save_plano_body_divergio: % — no se encuentra el do update set de las bajantes', r.proname;
    end if;
    i_conf := i_conf + length('do update set ');
    v_new := substr(v_new, 1, i_conf - 1) || 'asoc_links = excluded.asoc_links, ' || substr(v_new, i_conf);

    -- Verificación dura: las 3 piezas tienen que estar presentes.
    v_oc := length(v_new) - length(replace(v_new, 'asoc_links', ''));
    if v_oc < 3 * length('asoc_links') then
      raise exception 'save_plano_body_divergio: % — solo % apariciones de asoc_links (se esperaban 3)', r.proname, v_oc;
    end if;

    -- Comprobación previa: se compila una COPIA con otro nombre (si el cuerpo tuviera un error
    -- de sintaxis, el CREATE falla AQUÍ y la función real queda intacta).
    execute replace(v_new, 'public.' || r.proname, 'public.' || r.proname || '__check');
    execute 'drop function if exists public.' || r.proname || '__check';

    execute v_new;
    raise notice 'save_plano_data: asoc_links aplicado en %', r.proname;
    raise notice 'save_plano_data: fragmento -> %', substr(v_new, i_ins, 320);
  end loop;
end $$;

-- ── 3) Comprobante ────────────────────────────────────────────────────────────────────
select p.proname as funcion,
       (length(p.prosrc) - length(replace(p.prosrc, 'asoc_links', ''))) / length('asoc_links') as apariciones,
       case when strpos(p.prosrc, 'asoc_links') > 0 then 'ok' else '⚠ REVISAR' end as estado
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('save_plano_data', 'save_plano_data_impl')
order by 1;

select count(*) as bajantes_con_asoc_links
from public.cf_planos_bajantes
where asoc_links is not null and asoc_links <> '{}'::jsonb;

notify pgrst, 'reload schema';
