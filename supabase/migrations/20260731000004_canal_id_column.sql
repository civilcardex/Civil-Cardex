-- Adds persistence for rainwater-bajante <-> canal recolectora association
-- (canalAssociation.ts). Correr en el SQL Editor del proyecto knswtfckzodiuiladmbt.

alter table public.planos_bajantes
  add column if not exists canal_id text;
