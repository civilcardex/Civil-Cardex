-- Per-ramal aparato/UD counts (e.g. { "lavamanos": 2, "sifon": 1" }) were only ever kept in
-- localStorage (APARATOS_BY_TRAMO_KEY), never synced to the DB — reopening a plano on another
-- device/session showed the aparatos panel empty for every ramal, and the value was lost if
-- localStorage got cleared. Mirrors the shape already stored client-side, keyed by aparato id.
alter table public.planos_ramales add column fixtures jsonb;
