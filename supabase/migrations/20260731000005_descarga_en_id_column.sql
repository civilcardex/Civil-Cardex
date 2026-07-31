-- Fixes cross-floor bajante connections silently disappearing after the Supabase migration:
-- descargaEnId (same-floor id OR the "planId|bajanteId" cross-floor composite string) was never
-- persisted at all — syncBajanteConexiones only normalizes same-plano recibe/alimenta links,
-- deliberately skipping descargaEnId when it can't resolve against this plano's own client_id
-- map (the cross-floor case, by definition, points at a different plano). Storing it verbatim
-- as text (same pattern as ramales.padre) fixes it without needing cross-plano FK resolution.
-- Correr en el SQL Editor del proyecto knswtfckzodiuiladmbt.

alter table public.planos_bajantes
  add column if not exists descarga_en_id text;
