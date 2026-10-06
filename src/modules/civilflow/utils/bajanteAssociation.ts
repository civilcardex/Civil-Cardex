// Hub de asociación de bajantes entre pisos (des-monolitización 2026-10-06): la
// implementación vive en bajanteAssocShared/Clear/Apply/Heal — este archivo solo
// re-exporta la superficie pública (los tests y consumidores importan de aquí).
export {
  setBajanteDesplazamientoInStorage,
  areEndpointsAligned,
  upstreamRamalIdsForBajante,
  collectSourceAgg,
  estamparAsocsClearedTs,
} from './bajanteAssocShared';
export { clearBajanteAssociation } from './bajanteAssociationClear';
export { applyBajanteAssociation } from './bajanteAssociationApply';
export { healHerenciaInvertida } from './bajanteAssociationHeal';
export type {
  AssocEndpoint,
  InheritPoolRamal,
  InheritPoolBajante,
  CollectedAgg,
} from './bajanteAssocShared';
