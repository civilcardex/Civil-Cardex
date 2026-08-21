-- =========================================================================
-- CivilFlow/CM — índices sobre columnas de claves foráneas sin cobertura
--
-- Silencia los INFO `unindexed_foreign_keys` del Security Advisor añadiendo
-- índice a la columna FK en tablas que carecían de él (mayormente user_id,
-- net, active_net, plano_origen_id, cargo_id, proveedor_id). Idempotente.
-- =========================================================================

-- cf_anulaciones_*
create index if not exists idx_cf_anulaciones_bajantes_pluviales_user on public.cf_anulaciones_bajantes_pluviales(user_id);
create index if not exists idx_cf_anulaciones_canales_pluviales_user on public.cf_anulaciones_canales_pluviales(user_id);

-- cf_bajante_conexiones (ya tiene origen/destino; falta user_id)
create index if not exists idx_cf_bajante_conexiones_user on public.cf_bajante_conexiones(user_id);

-- cf_*_datos_proyecto
create index if not exists idx_cf_bomba_datos_proyecto_user on public.cf_bomba_datos_proyecto(user_id);
create index if not exists idx_cf_ep_datos_proyecto_user on public.cf_ep_datos_proyecto(user_id);
create index if not exists idx_cf_gas_datos_proyecto_user on public.cf_gas_datos_proyecto(user_id);

-- cf_*_proyecto
create index if not exists idx_cf_criterios_proyecto_user on public.cf_criterios_proyecto(user_id);
create index if not exists idx_cf_materiales_proyecto_user on public.cf_materiales_proyecto(user_id);
create index if not exists idx_cf_profundidades_proyecto_user on public.cf_profundidades_proyecto(user_id);

-- cf_pisos / cf_proyecto_general
create index if not exists idx_cf_pisos_user on public.cf_pisos(user_id);
create index if not exists idx_cf_proyecto_general_user on public.cf_proyecto_general(user_id);

-- cf_planos (active_net FK → cf_redes); proyecto_id/user_id ya indexados
create index if not exists idx_cf_planos_active_net on public.cf_planos(active_net);

-- cf_planos_* (net FK → cf_redes, y user_id)
create index if not exists idx_cf_planos_areas_net on public.cf_planos_areas(net);
create index if not exists idx_cf_planos_areas_user on public.cf_planos_areas(user_id);
-- NOTA: ramales/bajantes ya tienen un índice COMPUESTO (plano_id, net) llamado
-- idx_cf_planos_{ramales,bajantes}_net. La FK sobre `net` necesita un índice que
-- empiece por `net` (el compuesto no la cubre), así que usamos nombre distinto
-- (_net_fk) para que no colisione.
create index if not exists idx_cf_planos_bajantes_net_fk on public.cf_planos_bajantes(net);
create index if not exists idx_cf_planos_bajantes_user on public.cf_planos_bajantes(user_id);
create index if not exists idx_cf_planos_anotaciones_texto_user on public.cf_planos_anotaciones_texto(user_id);
create index if not exists idx_cf_planos_dimensiones_user on public.cf_planos_dimensiones(user_id);
create index if not exists idx_cf_planos_lineas_guia_net on public.cf_planos_lineas_guia(net);
create index if not exists idx_cf_planos_lineas_guia_user on public.cf_planos_lineas_guia(user_id);
create index if not exists idx_cf_planos_ramales_net_fk on public.cf_planos_ramales(net);
create index if not exists idx_cf_planos_ramales_user on public.cf_planos_ramales(user_id);

-- cf_planos_fantasmas_entrepisos (red, plano_origen_id, user_id)
create index if not exists idx_cf_planos_fantasmas_entrepisos_red on public.cf_planos_fantasmas_entrepisos(red);
create index if not exists idx_cf_planos_fantasmas_entrepisos_plano_origen on public.cf_planos_fantasmas_entrepisos(plano_origen_id);
create index if not exists idx_cf_planos_fantasmas_entrepisos_user on public.cf_planos_fantasmas_entrepisos(user_id);

-- cm_* FKs sin cobertura
create index if not exists idx_cm_cuadrilla_integrantes_cargo on public.cm_cuadrilla_integrantes(cargo_id);
create index if not exists idx_cm_cuadrilla_integrantes_user on public.cm_cuadrilla_integrantes(user_id);
create index if not exists idx_cm_insumos_proveedor on public.cm_insumos(proveedor_id);