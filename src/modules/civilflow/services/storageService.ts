// Hub de persistencia (des-monolitización 2026-10-06): la implementación vive en
// services/storage/ — este archivo re-exporta la superficie pública (16+ consumidores y
// tests importan de aquí).
export {
  loadFromStorage,
  saveToStorage,
  removeFromStorage,
  saveTrazosLocales,
  getActiveProyectoId,
  loadPlanTrazos,
  savePlanTrazos,
  type PlanTrazos,
} from './storage/localStorage';
export {
  emitBdSaveError,
  trazosDocHasContent,
  trazosLocalGanaABdVacia,
  saveTrazosToDB,
  loadTrazosFromDB,
} from './storage/trazosDb';
