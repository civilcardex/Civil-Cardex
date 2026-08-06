import type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes';

interface LocalGhostDrawingData {
  ts?: number;
  crossFloorGhosts?: CrossFloorGhost[];
  [key: string]: unknown;
}

// Completa los datos que le faltan a los fantasmas al cargar un piso: si un fantasma no sabe la
// dirección de su bajante padre o su diámetro (porque se guardó antes de que existieran esos
// campos, o porque el padre cambió después), se busca al padre en su piso y se copian los
// valores actuales — así la etiqueta del fantasma siempre muestra información al día.
export function enrichCrossFloorGhosts(ghosts: CrossFloorGhost[]): CrossFloorGhost[] {
  if (!ghosts.length) return ghosts;
  const cache: Record<string, LocalGhostDrawingData> = {};
  const loadPlan = (planId: string): LocalGhostDrawingData => {
    if (cache[planId]) return cache[planId];
    try {
      const raw = JSON.parse(localStorage.getItem('civilflow_' + 'trazos_' + planId) || '{}');
      cache[planId] = raw;
      return raw;
    } catch {
      cache[planId] = {};
      return cache[planId];
    }
  };
  let changed = false;
  const out: CrossFloorGhost[] = [];
  for (const g of ghosts) {
    let next: CrossFloorGhost = g;
    const needsDir = !g.parentDireccion && (g.sourcePlanId || '').length > 0;
    const needsDiam = !g.dNominal && (g.sourcePlanId || '').length > 0;
    if (needsDir || needsDiam) {
      const data = loadPlan(g.sourcePlanId) as LocalGhostDrawingData & {
        bajantes?: { id?: string; direccion?: string; dNominal?: string }[];
      };
      const b = (data.bajantes || []).find((bb) => bb.id === g.sourceBajanteId);
      if (b) {
        const patch: Partial<CrossFloorGhost> = {};
        if (needsDir && (b.direccion === 'sube' || b.direccion === 'baja')) {
          patch.parentDireccion = b.direccion;
        }
        if (needsDiam && typeof b.dNominal === 'string') {
          patch.dNominal = b.dNominal;
        }
        if (Object.keys(patch).length) {
          next = { ...g, ...patch };
          changed = true;
        }
      }
    }
    out.push(next);
  }
  return changed ? out : ghosts;
}
