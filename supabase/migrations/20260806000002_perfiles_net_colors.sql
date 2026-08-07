-- =========================================================================
-- CivilFlow — persistencia de colores de redes en perfiles.net_colors
--
-- Gap 2 de la auditoría de persistencia: ActiveNetsCard guardaba cada color
-- solo en localStorage (NET_COLOR_PREFIX + netId, clave no scoped a proyecto)
-- y useWorkAreaState/PdfViewer lo restauraban al montar. Con esta migración
-- el mapa completo { netId: color } vive en perfiles.net_colors; el cliente
-- lo upserta en cada cambio y lo usa como fuente de verdad al hidratar,
-- dejando localStorage como caché en vivo (mismo patrón que redes_activas en
-- proyecto_general, pero a nivel de usuario porque los colores son globales
-- a la sesión, no a un proyecto).
-- =========================================================================

alter table public.perfiles
  add column net_colors jsonb not null default '{}'::jsonb;
