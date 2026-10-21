/** Fachada de la propagación de presión (des-monolitización 2026-10-19).
 *
 * La implementación vive en `propagation/` (un módulo por fase: reading, tributaries,
 * edges, upMontante, folding, dfs, fittings, writing + books con los lectores públicos).
 *
 * ponytail: esta fachada NO tiene importadores (los importadores fueron rewirados
 * directo a `propagation/`). Existe SOLO como contrato del guard G2 de
 * architecture.test.ts, que verifica que la API pública de la propagación no se rompa.
 * Si algún día se borra, hay que quitar también sus entradas del guard.
 */
export {
  propagarAparatosPresion,
  esRedAparatosPresion,
  esReceptorPropagacion,
  leerHeredadosPresion,
  leerFoldTribPresion,
  leerLibrosPresion,
  udPropiaDe,
  diagUltimaPropagacion,
} from './propagation';
