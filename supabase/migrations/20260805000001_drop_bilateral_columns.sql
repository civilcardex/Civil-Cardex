-- CivilFlow — elimina las columnas del tee de salida bilateral de planos_ramales
-- (doctrina 2026-08-05: el cruce bilateral se calcula en vivo, no se persiste).
-- UP:

ALTER TABLE planos_ramales DROP COLUMN IF EXISTS bilateral_crossings;
ALTER TABLE planos_ramales DROP COLUMN IF EXISTS bilateral_pair_ids;

-- DOWN (rollback)
-- ALTER TABLE planos_ramales ADD COLUMN bilateral_crossings jsonb;
-- ALTER TABLE planos_ramales ADD COLUMN bilateral_pair_ids text[];
