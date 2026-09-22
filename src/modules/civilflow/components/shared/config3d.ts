/** Config compartida de los visores 3D (aparatos/epc/rci) — una sola fuente: desincronizar
 *  tipografía o FOV entre visores rompe encuadres y consistencia visual en silencio. */

/** Fuente monoespaciada de overlays/etiquetas/botones de los visores 3D. */
export const MONO_3D = "'Geist', monospace";

/** FOV de la cámara persp de los visores 3D (los encuadres derivan su tan(half-fov) de aquí). */
export const FOV_3D = 50;
