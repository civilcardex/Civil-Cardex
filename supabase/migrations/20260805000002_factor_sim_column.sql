-- Heater simultaneity factor (factorSim) lived only in the heater-selection screen's component
-- state — changing it did not survive a reload and never followed the user to another device.
-- Persist it on the calentador bajante row, mirroring the existing capacidad column.
alter table public.planos_bajantes add column factor_sim numeric;
