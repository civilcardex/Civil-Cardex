-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 20261118000001 — concurrencia_cf: control optimistic para save_plano_data
--
-- Quick-win del reporte (escalabilidad): hoy el guardado del plano es last-write-wins —
-- dos pestañas del mismo usuario (o miembro-editor) se pisan trazos en silencio con el
-- autosave de 300 ms. El cliente ahora manda p_updated_at = el updated_at que LEYÓ al
-- cargar el plano (get_plano_data → to_jsonb incluye cf_planos.updated_at); si la BD tiene
-- uno MAYOR → 'conflicto_concurrencia' y el cliente avisa "recarga" en vez de pisar.
--
-- Cirugía de WRAPPER (patrón de 20260924000001, cuerpo copiado VERBATIM + 1 parámetro +
-- 1 guard): el candado acceso_modulo se conserva igual (lección R-1). El _impl NO se toca
-- (cuerpo vivo parcheado N veces — re-emitirlo es el riesgo que no tomamos).
-- p_updated_at default null = sin check → frontend viejo sigue funcionando sin cambios.
-- LOCK de fila (for update) para cerrar la ventana entre guard y escritura del impl.
--
-- CÓMO APLICAR (manual): SQL Editor del proyecto Supabase → pegar COMPLETO → Run.
-- Re-ejecutable. PERO: si la columna updated_at no existiera (instalaciones muy viejas),
-- el exists() falla — cf_planos.updated_at existe desde el esquema inicial 20260730000001.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- El overload viejo (bigint, jsonb) sin guard quedaría como bypass + ambigüedad de
-- resolución en la llamada de 2 args. Fuera (los grants viajan con la función, por eso
-- el wrapper replica revoke/grant para el nombre nuevo).
drop function if exists public.save_plano_data(bigint, jsonb);

create or replace function public.save_plano_data(
  p_plano_id bigint,
  p_data jsonb,
  p_updated_at timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if not public.acceso_modulo(auth.uid(), 'flow') then raise exception 'suscripcion_requerida'; end if;
  -- Concurrencia optimistic: bloquear la fila del plano y comparar relojes ANTES de
  -- delegar al impl. null = sin check (frontend viejo / primer guardado del plano).
  if p_updated_at is not null then
    perform 1
      from public.cf_planos pl
     where pl.id = p_plano_id
       and pl.updated_at is not null
       and pl.updated_at > p_updated_at
       for update;
    if found then raise exception 'conflicto_concurrencia'; end if;
  end if;
  perform public.save_plano_data_impl(p_plano_id, p_data);
end;
$$;

revoke all on function public.save_plano_data(bigint, jsonb, timestamptz) from public, anon;
grant execute on function public.save_plano_data(bigint, jsonb, timestamptz) to authenticated;
