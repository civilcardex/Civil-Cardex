-- Fixes the reverse pointer of a cross-floor bajante association (the TARGET side's origenId)
-- silently disappearing after any Supabase-backed reload: bajanteToRow/rowToBajante in
-- storageService.ts map every bajante field except origenId, so a target bajante loaded from
-- the DB comes back without it. Without the pointer, dragging that bajante never reaches
-- updateCrossFloorLdesvioFarEndpoint in handleDragUp.ts and the source floor's Ldesvio detour
-- ramal keeps its old far endpoint.
-- Correr en el SQL Editor del proyecto knswtfckzodiuiladmbt.

alter table public.planos_bajantes
  add column if not exists origen_id text;
