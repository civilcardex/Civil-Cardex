// Hub de compatibilidad: el código vive en 5 hermanos (queries, desvio, herencia, equipos,
// live). Importadores y tests no cambian.
export { bombsImmediateLowerFloor, bajantesImmediateUpperFloor } from './pumpQueries.ts';
export type { BombaRow, BajanteSuperiorRow } from './pumpQueries.ts';
export {
  asociarBomba,
  sincronizarDesvioBomba,
  desasociarBombaEnTrazos,
  quitarBomba,
} from './pumpBypass';
export { mapUdBombaDesdeTrazos, propagarHerenciaBomba } from './pumpInheritance';
export { udsDeMapa, equiposBombaDesdeTrazos } from './pumpEquipment';
export type { EquipoBomba } from './pumpEquipment';
export { aggBajanteAsociado } from './pumpAssocLive';
export type { AsocLiveBaj } from './pumpAssocLive';
