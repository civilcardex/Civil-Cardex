/**
 * Copia el dibujo COMPLETO de un piso a otro (trazos + conteos de aparatos + datos hidro) al asignar un plano a un nivel vacío.
 * Ej: replicar la red af (Agua Fria) del Piso 1 en el Piso 2 con un clic, sin redibujar.
 *
 * Fachada (des-monolitización 2026-11-13): la implementación vive en copyPlan/ —
 * copyPlan.ts (orquestador), types.ts (contratos), renumber.ts (renumeración de ids),
 * references.ts (remapeo de referencias/libros), geometry.ts (calibración y transformación),
 * phantoms.ts (clones del anillo y XFG residuales), storeKeys.ts (conteos en storage) y
 * persist.ts (guardado + eventos). Re-exporta TODO con los mismos nombres: los consumidores
 * siguen importando de aquí.
 */
export * from './copyPlan/index.ts';
