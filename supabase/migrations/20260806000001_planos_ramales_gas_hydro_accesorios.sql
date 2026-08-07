-- =========================================================================
-- CivilFlow — persistencia de accesorios hidrosanitarios (hydro_accesorios)
-- y de gas (gas_accesorios) en planos_ramales
--
-- Gap 4 de la auditoría de persistencia: FixturesPanel (HYDRO_DATA_STORAGE_KEY)
-- y FixturesPanel/GasDesign (GAS_ACC_KEY) guardaban los accesorios solo en
-- localStorage, bajo la clave compuesta `${net}_${ramalId}_${planId}`. Con esta
-- migración, cada ramal persiste su mapa propio en la misma fila donde ya vive
-- `fixtures` (ver 20260805000001_ramal_fixtures_column.sql). El cliente adjunta
-- los mapas antes de sincronizar y los devuelve a localStorage al cargar;
-- localStorage queda como caché en vivo y la fuente de verdad es la BD.
-- =========================================================================

alter table public.planos_ramales
  add column hydro_accesorios jsonb not null default '{}'::jsonb,
  add column gas_accesorios jsonb not null default '{}'::jsonb;
