-- ═══════════════════════════════════════════════════════════════════════════════════════
-- save_plano_data: NO insertar fantasmas entrepisos cuyo piso origen ya no existe
-- Fecha: 2026-10-22
--
-- SÍNTOMA: al borrar un plano, el CASCADE limpia la BD pero las cachés locales de los pisos
-- vecinos siguen llevando crossFloorGhosts con su sourcePlanId; el siguiente autosave
-- re-inserta el fantasma huérfano y la FK «planos_fantasmas_entrepisos_plano_origen_id_fkey»
-- revienta el RPC COMPLETO (es transaccional) → el piso entero deja de guardar a la nube
-- ("No se pudo guardar en la nube", y la corrección de escala de un piso nunca persistía).
--
-- QUÉ HACE: parchea POSICIONALMENTE el cuerpo vivo de save_plano_data_impl (el insert de
-- fantasmas gana «where r.plano_origen_id is null or exists (select 1 from cf_planos ...)»).
-- No se copia la firma ni el cuerpo de ninguna migración: se lee pg_get_functiondef de la
-- función VIVA y se re-emplaza una sola ocurrencia del ancla. Antes de tocar la real, el
-- cuerpo parcheado se compila en una copia __check (si el resultado no compila, aborta sin
-- dejar el RPC roto). IDEMPOTENTE: si el cuerpo ya trae el guard (marcador
-- «fantasmas_huerfanos_vivos»), no hace nada.
--
-- ⚠️  APLICAR EN EL SQL EDITOR.
-- ═══════════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_oid oid;
  v_def text;
  v_def_parche text;
  v_check text;
  v_ancla text;
  v_guard text;
  v_n int;
begin
  -- ═══ 1) Localizar el cuerpo vivo (el impl que escribe en cf_planos_fantasmas_entrepisos) ═══
  select p.oid into v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('save_plano_data_impl', 'save_plano_data')
     and p.prosrc like '%cf_planos_fantasmas_entrepisos%'
   order by (p.proname = 'save_plano_data_impl') desc
   limit 1;

  if v_oid is null then
    raise exception '[fantasmas] no se encuentra el cuerpo vivo de save_plano_data (prosrc con cf_planos_fantasmas_entrepisos)';
  end if;

  v_def := pg_get_functiondef(v_oid);

  -- ═══ 2) Idempotencia: el guard ya está ══════════════════════════════════════════════
  if v_def like '%fantasmas_huerfanos_vivos%' then
    raise notice '[fantasmas] el cuerpo vivo ya trae el guard — nada que hacer';
    return;
  end if;

  -- ═══ 3) Ancla: el select del insert de fantasmas termina en «) r;» ══════════════════
  v_ancla := 'from jsonb_populate_recordset(null::public.cf_planos_fantasmas_entrepisos, coalesce(p_data->''fantasmas_entrepisos'',''[]''::jsonb)) r;';
  v_n := (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla);
  if v_n <> 1 then
    raise exception '[fantasmas] el ancla del insert de fantasmas aparece % veces (debe aparecer 1): el cuerpo vivo divergió de lo esperado, auditar antes de re-intentar', v_n;
  end if;

  v_guard := chr(10) ||
    '  where r.plano_origen_id is null' || chr(10) ||
    '     or exists (select 1 from public.cf_planos p where p.id = r.plano_origen_id) /* fantasmas_huerfanos_vivos */;';
  v_def_parche := replace(v_def, v_ancla,
    'from jsonb_populate_recordset(null::public.cf_planos_fantasmas_entrepisos, coalesce(p_data->''fantasmas_entrepisos'',''[]''::jsonb)) r' || v_guard);

  -- ═══ 4) Validar compilando una copia __check (la real queda intacta si esto falla) ═══
  v_check := replace(v_def_parche, 'FUNCTION public.save_plano_data_impl(', 'FUNCTION public.save_plano_data_impl_check(');
  if v_check = v_def_parche then
    v_check := replace(v_def_parche, 'FUNCTION public.save_plano_data(', 'FUNCTION public.save_plano_data_check(');
  end if;
  if v_check = v_def_parche then
    raise exception '[fantasmas] no se pudo derivar la copia __check del cuerpo (nombre de función inesperado en pg_get_functiondef)';
  end if;
  execute v_check;
  execute format('drop function %s', regexp_replace(v_check, '^.*FUNCTION (public\.save_plano_data_[a-z_]+)\(.*$', '\1'));

  -- ═══ 5) Aplicar el parche al cuerpo real ════════════════════════════════════════════
  execute v_def_parche;
  raise notice '[fantasmas] save_plano_data parcheado: los fantasmas con piso origen inexistente se sueltan en el insert';
end;
$$;

-- ═══ Comprobación dura ═════════════════════════════════════════════════════════════════
do $$
declare
  n int;
begin
  select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('save_plano_data', 'save_plano_data_impl')
     and p.prosrc like '%fantasmas_huerfanos_vivos%';
  if n < 1 then
    raise exception '[fantasmas] el parche no quedó aplicado en ninguna función de save_plano_data';
  end if;
  -- La copia __check no debe sobrevivir.
  select count(*) into n
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname like 'save_plano_data%check%';
  if n > 0 then
    raise exception '[fantasmas] quedó la copia __check: eliminarla a mano';
  end if;
end;
$$;

-- ═══ Comprobación manual ═══════════════════════════════════════════════════════════════
-- select pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.proname='save_plano_data_impl';
-- Debe contener «where r.plano_origen_id is null or exists (...) /* fantasmas_huerfanos_vivos */».
