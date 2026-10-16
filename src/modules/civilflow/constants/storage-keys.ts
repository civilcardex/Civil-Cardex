export const TRAZOS_PREFIX = 'trazos_';
export const GAS_ACC_KEY = 'gas_accesorios';
export const APARATOS_BY_TRAMO_KEY = 'aparatos_by_tramo_v2';
/** Libro de herencia de uniones/montantes de la propagación af/ac/gas (qué heredó cada clave). */
export const APARATOS_HEREDADOS_KEY = 'aparatos_heredados_v1';
/** Libro de plegado de tributarios de la propagación (qué plegó cada clave). */
export const APARATOS_HEREDADOS_TRIB_KEY = 'aparatos_heredados_trib_v1';
/** Respaldo de conteos limpiados por fase A sin campo de aparato (recuperación manual desde
 *  DevTools: copiar el valor a `aparatos_by_tramo_v2` si una limpieza fue ilegítima). */
export const APARATOS_RESIDUO_BAK_KEY = 'aparatos_residuo_bak_v1';
export const GAS_DATOS_KEY = 'gas_datos_generales';
export const HYDRO_DATA_STORAGE_KEY = 'tramo_hidro_data_v3';
export const HYDRO_SYNC_KEY = 'dibujo_hidro_v1';
export const SAN_SYNC_KEY = 'dibujo_sanitario_v1';
export const APS_STORAGE_KEY = 'aps_v5';

export const PLANS_META_KEY = 'plans_meta';
export const PLAN_CROP_KEY = 'plan_crop_v1';
export const ACTIVE_NETS_KEY = 'active_nets';

export const HYDRO_FAMILIES = new Set(['af', 'ac']);
export const SAN_FAMILIES = new Set(['san', 'll', 'vent']);

export const NET_COLOR_PREFIX = 'civilflow_net_';
export const TRAZOS_PLAN_PREFIX = 'civilflow_trazos_';

export const VISOR_ACTIVE_PLAN_ID_KEY = 'civilflow_visor_activePlanId';
export const VISOR_ACTIVE_INDEX_KEY = 'civilflow_visor_activeIndex';
export const VISOR_TIPO_TRAMO_KEY = 'civilflow_visor_tipoTramo';
export const VISOR_SNAP_ON_KEY = 'civilflow_visor_snapOn';
export const VISOR_GRID_ON_KEY = 'civilflow_visor_gridOn';

export const ISO_COLLAPSED_KEY = 'civilflow_iso_collapsed';

export const ACTIVE_PROYECTO_ID_KEY = 'civilflow_active_proyecto_id';

export const OPEN_TAB_KEY = 'openTab';

/** Prefijo del espejo local de overrides ll (se sufija con el proyecto). */
export const LL_OVERRIDES_MIRROR_KEY = 'll_overrides_mirror_';

export const NETS_CHANGED_EVENT = 'civilflow_nets_changed';
/** Chequeos persistidos de las redes de presión (af/ac) que escribe la página de diseño:
 *  `{af: {keyTramo: {velCumple, presionOk, qLps}}, ac: {...}}` — Informes los lee sin
 *  visitar la página (gate global). Se invalida por red cuando un diámetro cambia desde
 *  las tablas (writeDiametroToDrawing). */
export const CHEQUEOS_PRESION_KEY = 'chequeos_presion_v1';
export const PDF_HIDDEN_NETS_KEY = 'pdf_hidden_nets';
export const PDF_LOCKED_NETS_KEY = 'pdf_locked_nets';
