-- La columna R (coeficiente de lluvia ajustado) definida en 20260806000004_rainwater_overrides.sql
-- falta en algunos entornos tras los renombres a cf_*: la carga de anulaciones pluviales fallaba
-- con "column cf_anulaciones_bajantes_pluviales.R does not exist" (42703). Idempotente.
ALTER TABLE cf_anulaciones_bajantes_pluviales
  ADD COLUMN IF NOT EXISTS R text NOT NULL DEFAULT '';
