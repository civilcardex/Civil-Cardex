// Hub del sync de dibujo (des-monolitización 2026-10-06): la implementación vive en
// drawingSyncTypes/Builders/Gc/Io — este archivo re-exporta la superficie pública
// (~35 consumidores y 7 tests importan de aquí). El estado mutable vive SOLO en Gc.
export type { RawElement, DrawingData, SyncPlanInput } from './drawingSyncTypes';
export { hasNumericPlanSuffix, isOrphanKey } from './drawingSyncBuilders';
export {
  setSyncLoadedLiveIds,
  markPlanTrazosFresh,
  reanclarClavesDesdeTrazosLocales,
} from './drawingSyncGc';
export {
  buildSyncData,
  writeHydroDrawingSync,
  readHydroDrawingSync,
  writeSanDrawingSync,
  readSanDrawingSync,
} from './drawingSyncIo';
