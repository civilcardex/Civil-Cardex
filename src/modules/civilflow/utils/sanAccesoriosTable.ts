/** Fachada de la tabla de accesorios (des-monolitización 2026-10-19).
 *
 * La implementación vive en `accessoriesTable/` (un bloque por módulo: catalogo, coleccion,
 * yees, conteo, bushing, filas). Guardia G1/G2 de architecture.test.ts.
 */
export { computeAccesoriosTable } from './accessoriesTable/index';
