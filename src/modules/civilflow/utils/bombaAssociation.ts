// Hub de compatibilidad: el código vive en 5 hermanos (queries, desvio, herencia, equipos,
// live). Importadores y tests no cambian.
export { bombsImmediateLowerFloor, bajantesImmediateUpperFloor } from './bombaQueries';
export type { BombaRow, BajanteSuperiorRow } from './bombaQueries';
export {
  asociarBomba,
  sincronizarDesvioBomba,
  limpiarArtefactosDesvioBomba,
  desasociarBombaEnTrazos,
  quitarBomba,
} from './bombaDesvio';
export { mapUdBombaDesdeTrazos, propagarHerenciaBomba } from './bombaHerencia';
export { udsDeMapa, equiposBombaDesdeTrazos } from './bombaEquipos';
export type { EquipoBomba } from './bombaEquipos';
export { aggBajanteAsociado } from './bombaAsocLive';
export type { AsocLiveBaj } from './bombaAsocLive';
