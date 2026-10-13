// ponytail: solo las tablas con acceso directo vía supabase.from — el resto del
// dominio viaja por RPCs (save/get_proyecto_data, save_plano_data). Las 14 keys sin
// lectores (redes, pisos, materiales…) salieron el 2026-10-13 (grep 0 usos).
export const CF_TABLES = {
  perfiles: 'cf_perfiles',
  proyectos: 'cf_proyectos',
  proyectoGeneral: 'cf_proyecto_general',
  aparatosUdBase: 'cf_aparatos_ud_base_global',
  aparatosCatalogo: 'cf_aparatos_catalogo_global',
  aparatosUsuario: 'cf_aparatos_usuario',
  gasDatos: 'cf_gas_datos_proyecto',
  epDatos: 'cf_ep_datos_proyecto',
  bombaDatos: 'cf_bomba_datos_proyecto',
  anulacionesBajantes: 'cf_anulaciones_bajantes_pluviales',
  anulacionesCanales: 'cf_anulaciones_canales_pluviales',
} as const;
