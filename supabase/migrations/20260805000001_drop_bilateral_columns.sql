-- UP: remove tee salida bilateral columns from planos_ramales
ALTER TABLE planos_ramales DROP COLUMN IF EXISTS bilateral_crossings;
ALTER TABLE planos_ramales DROP COLUMN IF EXISTS bilateral_pair_ids;

-- DOWN (rollback)
-- ALTER TABLE planos_ramales ADD COLUMN bilateral_crossings jsonb;
-- ALTER TABLE planos_ramales ADD COLUMN bilateral_pair_ids text[];
