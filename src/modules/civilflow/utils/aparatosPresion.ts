/** Fachada de la propagación de presión (des-monolitización 2026-10-19).
 *
 * La implementación vive en `propagation/` (un módulo por fase: reading, tributaries,
 * edges, upMontante, folding, dfs, fittings, writing + books con los lectores públicos).
 * ponytail: los importadores fueron rewirados directo a `propagation/` — este facade
 * queda como puerta de entrada documental (guardia G1/G2 de architecture.test.ts).
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
