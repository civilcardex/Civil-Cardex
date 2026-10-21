// Hub de asociación de bajantes entre pisos (des-monolitización 2026-10-06): la
// implementación vive en bajanteAssocShared/Clear/Apply/Heal — este archivo solo
// re-exporta la superficie pública (los tests y consumidores importan de aquí).
export {
  setBajanteDesplazamientoInStorage,
  areEndpointsAligned,
  upstreamRamalIdsForBajante,
  collectSourceAgg,
  trazaDeUltimoGrupo,
  estamparAsocsClearedTs,
} from './bajanteAssocShared.ts';
export { clearBajanteAssociation } from './bajanteAssociationClear.ts';
export { applyBajanteAssociation } from './bajanteAssociationApply';
export { healHerenciaInvertida } from './bajanteAssociationHeal.ts';
export type {
  AssocEndpoint,
  InheritPoolRamal,
  InheritPoolBajante,
  CollectedAgg,
} from './bajanteAssocShared.ts';
