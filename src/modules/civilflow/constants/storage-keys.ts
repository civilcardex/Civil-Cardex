/** Claves de almacenamiento del área de trabajo CivilFlow: el dibujo por piso, los libros de
 *  aparatos y las preferencias del visor. OJO: loadFromStorage/saveToStorage añaden el prefijo
 *  'civilflow_' al guardar; las claves que YA lo traen se usan con localStorage crudo. */

/** Prefijo lógico del doc de dibujo de cada piso (todo lo dibujado: ramales, bajantes,
 *  fantasmas…). Con el 'civilflow_' de saveToStorage resulta la clave real TRAZOS_PLAN_PREFIX
 *  ('civilflow_trazos_<planoId>'). */
export const TRAZOS_PREFIX = 'trazos_';
/** Accesorios de gas contados por tramo (codos, tees…): tramo → accesorio → cantidad. */
export const GAS_ACC_KEY = 'gas_accesorios';
/** Libro maestro de aparatos: tramo (`<red>_<id>_<plano>`) → aparato → cantidad. Lo leen
 *  paneles, tablas y la propagación (loadAll en components/fixturesStorage). */
export const APARATOS_BY_TRAMO_KEY = 'aparatos_by_tramo_v2';
/** Libro de herencia de uniones/montantes de la propagación (af = Agua Fría, ac = Agua
 *  Caliente, gas) — qué aparatos heredó cada clave. */
export const APARATOS_HEREDADOS_KEY = 'aparatos_heredados_v1';
/** Libro de plegado de tributarios de la propagación (qué plegó cada clave). */
export const APARATOS_HEREDADOS_TRIB_KEY = 'aparatos_heredados_trib_v1';
/** Respaldo de conteos limpiados por fase A sin campo de aparato (recuperación manual desde
 *  DevTools: copiar el valor a `aparatos_by_tramo_v2` si una limpieza fue ilegítima). */
export const APARATOS_RESIDUO_BAK_KEY = 'aparatos_residuo_bak_v1';
/** Foto de lo PROPIO (sin herencia) de cada clave espejo de un bajante entre pisos. El libro
 *  `ucAplicado` del doc dice cuánto se heredó; esta foto dice cuánto era del usuario — así el
 *  espejo nunca confunde su propia herencia con un conteo manual aunque el doc venga atrasado.
 *  Ej: si el doc perdió el libro, la foto evita que el próximo pase sume la herencia otra vez. */
export const APARATOS_PROPIO_KEY = 'aparatos_propio_v1';
/** Marcadores de bajadas receptoras de la propagación (persistente — la bajada sigue
 *  siendo receptora aunque su disco se llene). Libro COMPARTIDO entre redes af/ac/gas:
 *  las claves llevan prefijo de red y la poda es per-net. */
export const BAJADAS_RECEPTORAS_KEY = 'bajadas_receptoras_v1';
/** Datos generales del diseño de gas: altitud (m), patm, temperatura, presión mínima y densidad
 *  relativa (pantalla GasDatosGenerales). */
export const GAS_DATOS_KEY = 'gas_datos_generales';
/** Ficha hidráulica por tramo (v3): accesorios, Lh (longitud equivalente de accesorios, en m) y
 *  nSalidas — la consume el dimensionamiento de af (Agua Fria)/ac (Agua Caliente). */
export const HYDRO_DATA_STORAGE_KEY = 'tramo_hidro_data_v3';
/** Blob de sync hidráulico (af/ac): qué aparatos hay en cada tramo de cada piso; Informes y los
 *  paneles lo leen sin recorrer el dibujo. */
export const HYDRO_SYNC_KEY = 'dibujo_hidro_v1';
/** Blob de sync sanitario (san/ll/vent): el mismo espejo de aparatos para las redes de desague. */
export const SAN_SYNC_KEY = 'dibujo_sanitario_v1';
/** Catálogo de aparatos del usuario (APS): array {id, ud} con las UD (Unidades de Desague) que
 *  gasta cada aparato (ApparatusContext lo carga/guarda). */
export const APS_STORAGE_KEY = 'aps_v5';

/** Metadatos de los pisos del proyecto: id, nombre, origen de calibración, npt (nivel de piso
 *  topografico) y escala de cada lámina. */
export const PLANS_META_KEY = 'plans_meta';
/** Recorte vigente de la lámina en el visor {x, y, w, h} en px (sin clave = sin recorte). */
export const PLAN_CROP_KEY = 'plan_crop_v1';
/** Redes activas del proyecto (ids) — el workarea las guarda y el visor decide con ellas qué
 *  redes dibujar (useActiveNetsVisibility). */
export const ACTIVE_NETS_KEY = 'active_nets';

/** Familias de red que comparten motor de conteo: hidráulicas (af/ac, cuentan UC)… */
export const HYDRO_FAMILIES = new Set(['af', 'ac']);
/** …y sanitarias (san/ll/vent, cuentan UD (Unidades de Desague)). */
export const SAN_FAMILIES = new Set(['san', 'll', 'vent']);

/** Prefijo del color elegido por red — clave CRUDA (ya con 'civilflow_'): 'civilflow_net_<red>'. */
export const NET_COLOR_PREFIX = 'civilflow_net_';
/** Clave REAL del doc de dibujo por piso (con 'civilflow_' ya incluido): sirve para enumerar
 *  pisos leyendo localStorage crudo. */
export const TRAZOS_PLAN_PREFIX = 'civilflow_trazos_';

/** Id del último piso abierto en el visor — para reabrir el mismo piso al volver. */
export const VISOR_ACTIVE_PLAN_ID_KEY = 'civilflow_visor_activePlanId';
/** Índice del piso activo dentro de la lista de planos (par del VISOR_ACTIVE_PLAN_ID_KEY). */
export const VISOR_ACTIVE_INDEX_KEY = 'civilflow_visor_activeIndex';
/** Tipo de tramo elegido para dibujar en el visor (p. ej. 'ramal') — sessionStorage. */
export const VISOR_TIPO_TRAMO_KEY = 'civilflow_visor_tipoTramo';
/** ¿Snap (imán a rejilla/elementos) encendido en el visor? — sessionStorage ('true'/'false'). */
export const VISOR_SNAP_ON_KEY = 'civilflow_visor_snapOn';
/** ¿Cuadrícula visible en el visor? — sessionStorage ('true'/'false'). */
export const VISOR_GRID_ON_KEY = 'civilflow_visor_gridOn';

/** Redes colapsadas en la vista isométrica (array de ids de red) — localStorage crudo. */
export const ISO_COLLAPSED_KEY = 'civilflow_iso_collapsed';

/** Id del último proyecto abierto — el workarea lo reabre al entrar y lo limpia si ya no existe. */
export const ACTIVE_PROYECTO_ID_KEY = 'civilflow_active_proyecto_id';

/** Pestaña a abrir en el visor (p. ej. 'planos') — sessionStorage: traspasa la intención entre
 *  pantallas (el visor la lee una vez y la borra). */
export const OPEN_TAB_KEY = 'openTab';

/** Prefijo del espejo local de overrides ll (se sufija con el proyecto). */
export const LL_OVERRIDES_MIRROR_KEY = 'll_overrides_mirror_';

/** Nombre del evento window que avisa que cambió la lista de redes activas (no es clave de
 *  storage; el visor lo escucha para refrescar visibilidad). */
export const NETS_CHANGED_EVENT = 'civilflow_nets_changed';
/** Chequeos persistidos de las redes de presión (af/ac) que escribe la página de diseño:
 *  `{af: {keyTramo: {velCumple, presionOk, qLps}}, ac: {...}}` — Informes los lee sin
 *  visitar la página (gate global). Se invalida por red cuando un diámetro cambia desde
 *  las tablas (writeDiametroToDrawing). */
export const CHEQUEOS_PRESION_KEY = 'chequeos_presion_v1';
/** Redes ocultadas en el visor (ids) — no se dibujan hasta reactivarlas. */
export const PDF_HIDDEN_NETS_KEY = 'pdf_hidden_nets';
/** Redes bloqueadas en el visor (ids): se ven pero el motor las marca no editables. */
export const PDF_LOCKED_NETS_KEY = 'pdf_locked_nets';
