// Barrel de la asociación entre pisos: la fachada bajanteAssocShared.ts re-exporta TODO desde
// aquí, así los consumidores (apply/clear/heal, espejos, fixtures) no saben del split interno.
export type {
  StoredBajanteDesp,
  AssocEndpoint,
  InheritPoolRamal,
  InheritPoolBajante,
  CollectedAgg,
} from './types.ts';
export { isAligned, areEndpointsAligned, adoptarDiametroDelSuperior } from './puras.ts';
export {
  trazaDeUltimoGrupo,
  GEO_TOL_BAJANTE,
  idsServidosPorBajante,
  upstreamRamalIdsForBajante,
  collectSourceAgg,
} from './graph.ts';
export {
  setBajanteDesplazamientoInStorage,
  registrarLdesvioComoAsociado,
  desasociarLdesvioDeBajante,
  readBajanteLink,
  resolveLinkRoles,
  estamparAsocsClearedTs,
} from './storage.ts';
