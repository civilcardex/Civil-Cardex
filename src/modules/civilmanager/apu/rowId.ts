/**
 * Identidad perezosa de fila: se asigna una vez al objeto (viaja en el jsonb persistido) y
 * sobrevive a inserciones/borrados — key={i} desalineaba inputs al eliminar una fila previa.
 * Compartida por las 3 secciones APU (Análisis de Precios Unitarios). Ej: fila 3 borrada -> las demás conservan su _fid.
 */
export function filaId(r: unknown): string {
  const o = r as { _fid?: string };
  if (!o._fid) o._fid = `f${Math.random().toString(36).slice(2, 10)}`;
  return o._fid;
}
