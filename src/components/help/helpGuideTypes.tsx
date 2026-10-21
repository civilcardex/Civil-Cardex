// Guía contextual del panel de AYUDA (orig. usuario: "que sea algo guía para saber para qué
// funciona cada parte de la pestaña"). Contenido derivado del inventario funcional real de
// cada pestaña/visor — cada ítem es un elemento de UI con su propósito. Claves:
//   cf:<tab> · cf:iso:<sub> · cm:catalogos:<tab> · cm:<seccion>

export interface GuiaItem {
  nombre: string;
  desc: string;
}

export interface GuiaGrupo {
  titulo: string;
  items: GuiaItem[];
}

export type GUIA_TYPE = Record<string, GuiaGrupo[]>;

/** Icono material por grupo de ayuda (búsqueda por palabra en el título; primer match manda).
 *  AyudaPanel lo muestra junto al chevron — sin esto el modal se veía plano. */
const ICONOS_POR_TITULO: Array<[string, string]> = [
  // Primero: matchea antes que 'panel derecho' — icono propio del grupo "Panel derecho por elemento".
  ['por elemento', 'category'],
  ['herramienta', 'construction'],
  ['panel derecho', 'tune'],
  ['menú contextual', 'mouse'],
  ['redes', 'layers'],
  ['redes activa', 'layers'],
  ['barra superior', 'web_asset'],
  ['calibra', 'straighten'],
  ['subir', 'upload'],
  ['requisito', 'checklist'],
  ['origen', 'location_searching'],
  ['recorte', 'crop'],
  ['isometría', 'view_in_ar'],
  ['detalle', '3d_rotation'],
  ['bomba', 'heat_pump'],
  ['equipo de presión', 'compress'],
  ['contra incendio', 'fire_extinguisher'],
  ['material', 'inventory_2'],
  ['catálogo', 'book_2'],
  ['aparato', 'plumbing'],
  ['gasodom', 'cooking'],
  ['sanitaria', 'water_drop'],
  ['lluvia', 'rainy'],
  ['agua fría', 'ac_unit'],
  ['agua caliente', 'hot_tub'],
  ['equipo', 'precision_manufacturing'],
  ['gas', 'propane_tank'],
  ['informe', 'description'],
  ['memoria', 'article'],
  ['anexo', 'attach_file'],
  ['plano', 'map'],
  ['norma', 'gavel'],
  ['criterio', 'tune'],
  ['identificación', 'badge'],
  ['generador', 'layers'],
  ['área', 'select_all'],
  ['texto', 'title'],
  ['medir', 'rule'],
  ['guía', 'grid_on'],
  ['contador', 'speed'],
  ['caja', 'inbox'],
  ['borrador', 'delete'],
  ['snap', 'magnet'],
  ['grilla', 'grid_4x4'],
  ['guardar', 'save'],
  ['ajustar', 'fit_screen'],
  ['nivel', 'swap_vert'],
  ['copiar', 'content_copy'],
  ['dato', 'table_rows'],
  ['elemento', 'list_alt'],
  ['ramal', 'spline'],
  ['bajante', 'arrow_downward'],
  ['origen', 'arrow_upward'],
  ['bomba', 'heat_pump'],
  ['cámara', 'photo_camera'],
  ['potencia', 'bolt'],
  ['diámetro', 'radio_button_checked'],
  ['cisterna', 'water_tank'],
  ['setpoint', 'thermostat'],
  ['verificación', 'verified'],
  ['cómo funciona', 'info'],
  ['factor', 'calculate'],
  ['país', 'public'],
  ['salario', 'payments'],
  ['cargo', 'group'],
  ['insumo', 'forklift'],
  ['proveedor', 'store'],
  ['presupuesto', 'request_quote'],
  ['apu', 'functions'],
];

/** Icono para un título de grupo (fallback 'help'). */
export function iconoDeGrupo(titulo: string): string {
  const t = titulo.toLowerCase();
  for (const [palabra, icono] of ICONOS_POR_TITULO) {
    if (t.includes(palabra)) return icono;
  }
  return 'help';
}
