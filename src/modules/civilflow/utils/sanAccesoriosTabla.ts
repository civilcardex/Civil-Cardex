/** Fachada de la tabla de accesorios (des-monolitización 2026-10-19).
 *
 * La implementación vive en `accessoriesTable/` (un bloque por módulo: catalogo, coleccion,
 * yees, conteo, bushing, filas).
 *
 * ponytail: esta fachada NO tiene importadores (el consumidor real es el hub
 * `sanAccesoriosFilas.ts`). Existe SOLO como contrato del guard G2 de
 * architecture.test.ts. Si algún día se borra, hay que quitar también sus entradas.
 */
export { computeAccesoriosTable } from './accessoriesTable/index';
