// Barrel de la copia de dibujo entre pisos: la fachada copyDrawingFromPlan.ts re-exporta desde
// aquí la MISMA superficie pública del monolito original (función + 4 tipos) — los módulos
// internos (renumber/references/geometry/phantoms/storeKeys/persist) no son API.
export { copyDrawingFromPlan } from './copyPlan.ts';
export type { CopySourceSelection, CopyAlineacion, CopyResult, CopyOpciones } from './types.ts';
