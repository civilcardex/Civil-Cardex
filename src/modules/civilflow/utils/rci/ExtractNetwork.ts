/**
 * Maquinaria de extracción de UNA red RCI (Red Contra Incendio) desde los trazos de un piso:
 * contactos geométricos (tolerancias del motor de dibujo), caminata del tronco desde el
 * montante, nudos con letras, reparto de accesorios y filas R/T del estado del motor.
 * La API pública vive en extract.ts (extraerGris/mezclarOverrides); esto es el interior.
 * Ej: extraerRedDePiso(piso, 5.3, avisos).red.raiz = 'C' (la derivación del montante).
 *
 * Fachada (des-monolitización 2026-11-12): la implementación vive en extractNetwork/ —
 * types.ts (formas del extractor), puras.ts (tolerancias, geometría y decisión de conexión)
 * y pipeline.ts (derivación, tronco, nudos y filas R/T). Re-exporta los mismos nombres
 * públicos de siempre: los consumidores siguen importando de aquí.
 */
export { TECHO_DEF, ALT_DERIV_DEF, MAT_DEF } from './extractNetwork/puras.ts';
export type { AvisoRci } from './extractNetwork/types.ts';
export { extraerRedDePiso } from './extractNetwork/pipeline.ts';
