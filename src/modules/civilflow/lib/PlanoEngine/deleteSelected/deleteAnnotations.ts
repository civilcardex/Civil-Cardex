/** Borrado de ANOTACIONES en deleteSelected (ruta individual): textos, áreas, cotas y
 *  líneas guía. Son borrados simples — quitar del arreglo, avisar y repintar; solo las
 *  áreas renumeran (compacta A1..N). Ej: borrar un área renumera las restantes igual que
 *  ramales/tributarios (PUNTO 4, orig. usuario). */
import type { IPlanoEngineCore } from '../PlanoState.ts';

/** Devuelve true si el seleccionado vivo era un texto y quedó borrado (el pipeline corta ahí). */
export function borrarTextoIndividual(engine: IPlanoEngineCore): boolean {
  const idxT = engine.textAnnots.findIndex((t) => t.id === engine.selId);
  if (idxT < 0) return false;
  const deletedId = engine.textAnnots[idxT].id;
  engine.textAnnots.splice(idxT, 1);
  engine.selId = null;
  engine._emitSelect(null);
  engine._emitDelete([deletedId]);
  engine.render();
  engine._markDirty();
  return true;
}

/** Devuelve true si el seleccionado vivo era un área: la borra y RENUMERA las restantes. */
export function borrarAreaIndividual(engine: IPlanoEngineCore): boolean {
  const idxA = engine.areas.findIndex((a) => a.id === engine.selId);
  if (idxA < 0) return false;
  const deletedId = engine.areas[idxA].id;
  engine.areas.splice(idxA, 1);
  // PUNTO 4 (orig. usuario): borrar un área RENUMERA las restantes (compacta), igual que
  // ramales/tributarios.
  engine._renumberAreas();
  engine.selId = null;
  engine._emitSelect(null);
  engine._emitDelete([deletedId]);
  engine.render();
  engine._markDirty();
  return true;
}

/** Devuelve true si el seleccionado vivo era una cota (dimensión) y quedó borrada. */
export function borrarDimIndividual(engine: IPlanoEngineCore): boolean {
  const idxD = engine.dims.findIndex((d) => d.id === engine.selId);
  if (idxD < 0) return false;
  const deletedId = engine.dims[idxD].id;
  engine.dims.splice(idxD, 1);
  engine.selId = null;
  engine._emitSelect(null);
  engine._emitDelete([deletedId]);
  engine.render();
  engine._markDirty();
  return true;
}

/** Devuelve true si el seleccionado vivo era una línea guía y quedó borrada. */
export function borrarGuiaIndividual(engine: IPlanoEngineCore): boolean {
  const idxG = engine.guideLines.findIndex((g) => g.id === engine.selId);
  if (idxG < 0) return false;
  const deletedId = engine.guideLines[idxG].id;
  engine.guideLines.splice(idxG, 1);
  engine.selId = null;
  engine._emitSelect(null);
  engine._emitDelete([deletedId]);
  engine.render();
  engine._markDirty();
  return true;
}
