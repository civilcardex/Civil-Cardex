-- ══════════════════════════════════════════════════════════════════════════════════
-- Límites anti cost-DoS (auditoría 2026-10-27, hallazgos H-1/H-2) — V4.
-- V1 falló con «ancla de save_plano_data no calza»: el ancla era el texto EXACTO de las
-- migraciones del repo, pero el cuerpo VIVO de la BD difiere (linaje aplicado a mano).
-- V2: anclas por REGEX insensible a mayúsculas y tolerante a espacios.
-- V3: ancla universal tras el primer `begin` + verificación dura de una sola inserción.
-- V4 (auditoría de la V3): (a) la firma ya no se resuelve con '::regprocedure' a pelo —
--     el cast LANZA si no existe y mataba el diagnóstico previsto (check is null = código
--     muerto); (b) los guards usan referencias POSICIONALES $2 — un nombre de parámetro
--     divergente compila (plpgsql es lazy) y revienta en la 1ª llamada real; (c) el ancla
--     `begin` se valida FUERA de comentarios (-- y /* */) antes de insertar; (d) cada
--     parche se COMPILE-CHEQUEA en una copia __check antes de tocar el RPC vivo
--     (misma técnica de 20261020000000); (e) el cap de cantidad se PLEGA dentro de las
--     policies INSERT existentes — las permissive se combinan con OR y una policy cap
--     aparte jamás se evalúa si otra policy pasa.
-- NOTA: la V1 fallida hizo ROLLBACK de todo el batch — el bucket y el statement_timeout
-- no quedaron aplicados; esta versión se corre COMPLETA de nuevo (todo idempotente).
-- ══════════════════════════════════════════════════════════════════════════════════

-- ── 1) Bucket plan_pdfs acotado (tamaño + tipo declarado) ────────────────────────
-- ponytail: el mime-type declarado es client-controlled; la app fuerza
-- application/pdf al materializar el blob (useWorkAreaState) — defensa en profundidad.
update storage.buckets
   set file_size_limit = 26214400,           -- 25 MB (PDF de plano grande)
       allowed_mime_types = '{application/pdf}'
 where id = 'plan_pdfs';

-- ── 2) Timeout de statement para el rol de app ──────────────────────────────────
alter role authenticated set statement_timeout = '8s';
-- PostgREST cachea los settings de rol: sin este notify el default puede no regir
-- hasta un reload manual. TOPE BLANDO GLOBAL — medir un save_plano_data de plano
-- grande (payload ~2 MB) tras aplicar: si una operación legítima lo excede, subir.
notify pgrst, 'reload config';

-- ── 3) Guard de BYTES por payload en los 3 RPCs de escritura ────────────────────
-- Los caps de elementos (6000 ramales…) cuentan filas, no bytes: un pts inflado por
-- ramal colaba MBs. 2 MB ≈ plano grande real con margen ×10 (1 MB la lista de planos).
-- El guard se inserta tras el PRIMER `begin` del cuerpo: uid ya está declarado en el
-- DECLARE y octet_length(NULL)=NULL no dispara el tope (el chequeo de null original
-- corre después, sin cambio de resultado). Guards POSICIONALES ($2 = el jsonb en las
-- dos firmas; save_proyecto usa (select auth.uid()) autocontenido) — inmunes a que el
-- cuerpo vivo use otros nombres de parámetro.
do $patch$
declare
  r record;
  def text;
  nuevo text;
  ocurrencias int;
  pos_begin int;
  prefijo text;
  sin_lineas text;
begin
  for r in
    select * from (values
      ('public.save_plano_data(bigint,jsonb)',
       'save_plano_data',
       'if octet_length($2::text) > 2097152 then raise exception ''payload_demasiado_grande''; end if;',
       'payload_demasiado_grande'),
      ('public.save_planos_meta(uuid,jsonb)',
       'save_planos_meta',
       'if octet_length($2::text) > 1048576 then raise exception ''payload_demasiado_grande''; end if;',
       'payload_demasiado_grande'),
      ('public.save_proyecto(text,text)',
       'save_proyecto',
       -- Autocontenido (select auth.uid()), NO la variable uid del DECLARE: si el cuerpo
       -- vivo es un wrapper fino que delega al impl, uid no existe y el guard rompería
       -- la función en su primera llamada (plpgsql compila lazy — el create no lo detecta).
       'if (select count(*) from public.cf_proyectos where user_id = (select auth.uid())) >= 200 then raise exception ''demasiados_proyectos''; end if;',
       'demasiados_proyectos')
    ) as t(firma, nombre, guard, marca)
  loop
    -- Firma viva por pg_proc: el cast '::regprocedure' LANZA si la firma no existe
    -- (nunca devuelve null) — se captura y se convierte en el diagnóstico previsto.
    def := null;
    begin
      def := pg_get_functiondef(r.firma::regprocedure);
    exception when others then
      def := null;
    end;
    if def is null then
      raise exception
        '[limites] % no existe con la firma exacta %. Diagnóstico: select proname, pg_get_function_identity_arguments(oid) from pg_proc where proname = ''%'' and pronamespace = ''public''::regnamespace;',
        r.nombre, r.firma, r.nombre;
    end if;
    if strpos(def, r.marca) > 0 then
      raise notice '[limites] % ya tiene el guard (skip)', r.nombre;
      continue;
    end if;
    -- Localizar el primer `begin` y verificar que NO cae dentro de un comentario:
    -- el ancla sola podía insertar el guard dentro de un `-- begin` o de un bloque
    -- /* */: función válida, guard inerte, verificación de ocurrencias en verde.
    pos_begin := regexp_instr(def, '\mbegin\M', 1, 1, false, 'i');
    if pos_begin is null then
      raise exception '[limites] % sin begin localizable — pegar el cuerpo vivo y revisar', r.nombre;
    end if;
    prefijo := substring(def from 1 for pos_begin - 1);
    -- a) línea-comment: la línea donde cae el begin empieza por -- o /*
    if regexp_match(
         right(prefijo, coalesce(nullif(position(chr(10) in reverse(prefijo)), 0) - 1, length(prefijo))),
         '^\s*(--|/\*)'
       ) is not null then
      raise exception '[limites] %: el primer begin cae dentro de un comentario — pegar el cuerpo vivo y revisar ancla', r.nombre;
    end if;
    -- b) bloque /* */ abierto: el nº de aperturas debe igualar los cierres en el prefijo
    sin_lineas := regexp_replace(prefijo, '--[^\n]*', '', 'g');
    if (length(sin_lineas) - length(replace(sin_lineas, '/*', '')))
       <> (length(sin_lineas) - length(replace(sin_lineas, '*/', ''))) then
      raise exception '[limites] %: el primer begin cae dentro de un comentario de bloque — pegar el cuerpo vivo y revisar ancla', r.nombre;
    end if;
    nuevo := regexp_replace(def, '\mbegin\M', 'begin ' || r.guard, 1, 1, 'i');
    if nuevo = def then
      raise exception '[limites] % sin begin sustituible', r.nombre;
    end if;
    -- Verificación dura: exactamente UNA inserción del guard.
    ocurrencias := (length(nuevo) - length(replace(nuevo, r.guard, ''))) / length(r.guard);
    if ocurrencias <> 1 then
      raise exception '[limites] %: el guard quedó % veces (esperaba 1) — aborto sin tocar',
        r.nombre, ocurrencias;
    end if;
    -- Compile-check en una copia __check ANTES de tocar la real: un cuerpo mal parcheado
    -- (variable inexistente, guard comentado) falla AQUÍ — aborta sin dejar el RPC vivo
    -- roto (plpgsql valida los statements del body al crear si check_function_bodies=on).
    begin
      execute regexp_replace(
        nuevo,
        'function\s+public\.' || r.nombre || '\s*\(',
        'function public.' || r.nombre || '__check(',
        1, 1, 'i');
    exception when others then
      raise exception
        '[limites] %: el cuerpo parcheado NO compila (%). Diagnóstico: select pg_get_functiondef(''%''::regprocedure);',
        r.nombre, sqlerrm, r.firma;
    end;
    execute 'drop function if exists ' || replace(r.firma, r.nombre, r.nombre || '__check');
    execute nuevo;
    raise notice '[limites] parcheado: %', r.nombre;
  end loop;
end;
$patch$;

-- ── 4) Cap de CANTIDAD de PDFs por carpeta de usuario ───────────────────────────
-- file_size_limit acota el tamaño por archivo, no cuántos: 25 MB × N subidas sigue
-- siendo cost-DoS. IMPORTANTE: las policies PERMISSIVE de INSERT se combinan con OR —
-- una policy cap APARTE jamás se evalúa si otra policy pasa (quedaban vivas
-- plan_pdfs_owner_insert de 20260730000002 y pdfs_empresa_escribir de 20261005000000).
-- El tope se PLEGA dentro de AMBAS (drop+create con el MISMO nombre: sin bypass OR).
-- El conteo ve la carpeta destino porque el SELECT policies del bucket ya autorizan
-- la carpeta propia (owner) o la del dueño (miembro con asiento, pdfs_empresa_leer).
-- ponytail: tope BLANDO — dos inserts concurrentes con 499 pasan ambos (TOCTOU
-- aceptado; un trigger en storage.objects es complejo y frágil). count(*) por INSERT
-- es O(objetos del usuario) — con el tope de 500 y el índice del bucket es aceptable.
-- OJO: si 20260730000002 re-corre (runner de Supabase Preview), recrea
-- plan_pdfs_owner_insert SIN el cap — re-aplicar esta sección después.
drop policy if exists "plan_pdfs_owner_insert" on storage.objects;
create policy "plan_pdfs_owner_insert" on storage.objects for insert
  with check (bucket_id = 'plan_pdfs'
              and (storage.foldername(name))[1] = auth.uid()::text
              and (select count(*) from storage.objects o
                   where o.bucket_id = 'plan_pdfs'
                     and o.name like (split_part(name, '/', 1) || '/%')) < 500);

drop policy if exists pdfs_empresa_escribir on storage.objects;
create policy pdfs_empresa_escribir on storage.objects for insert to authenticated
  with check (bucket_id = 'plan_pdfs'
         and public.empresa_escritura(public.uuid_seguro((storage.foldername(name))[1]), 'flow')
         and (select count(*) from storage.objects o
              where o.bucket_id = 'plan_pdfs'
                and o.name like (split_part(name, '/', 1) || '/%')) < 500);
