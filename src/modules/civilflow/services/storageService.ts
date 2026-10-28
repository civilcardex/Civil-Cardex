// Hub de persistencia (des-monolitización 2026-10-06): la implementación vive en
// services/storage/ — este archivo re-exporta la superficie pública (16+ consumidores y
// tests importan de aquí).
export {
  loadFromStorage,
  saveToStorage,
  removeFromStorage,
  saveTrazosLocales,
  localGanaABdPorTs,
  getActiveProyectoId,
  setActiveProyectoId,
  loadPlanTrazos,
  savePlanTrazos,
  type PlanTrazos,
} from './storage/localStorage.ts';
export {
  emitBdSaveError,
  trazosDocHasContent,
  trazosLocalGanaABdVacia,
  trazosBdGanaALocalVacia,
  saveTrazosToDB,
  loadTrazosFromDB,
} from './storage/strokesDb';
