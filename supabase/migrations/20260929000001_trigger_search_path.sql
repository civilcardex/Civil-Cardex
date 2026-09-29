-- Fix lint 0011 (ronda 8): fantasmas_layout_default nació sin search_path fijo — el resto
-- de funciones del esquema sí lo llevan. Un search_path mutable en un trigger permite
-- schema-hijack si alguien planta objetos en un schema previo del path.
-- Re-ejecutable. ⚠️ APLICAR EN SQL EDITOR.

create or replace function public.fantasmas_layout_default()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.layout is null then new.layout := 2; end if;
  return new;
end;
$$;

-- También: intenciones_recientes seguía ejecutable por authenticated — los default
-- privileges de Supabase otorgan EXECUTE a anon/authenticated explícitamente, así que el
-- revoke de `public, anon` de 20260928000004 no la quitaba de ese rol.
revoke execute on function public.intenciones_recientes(uuid) from authenticated;
grant execute on function public.intenciones_recientes(uuid) to service_role;

-- Verificación: el linter debe dejar de listar ambas.
