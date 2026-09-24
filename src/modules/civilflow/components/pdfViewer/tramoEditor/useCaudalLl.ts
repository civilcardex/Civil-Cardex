import { TRAZOS_PREFIX } from '../../../constants/storage-keys';
import { loadFromStorage } from '../../../services/storageService';
import { buildLlBajanteAssociations } from '../../../utils/rainwaterRows';
import { chequeoBajanteLluvia } from '../../../utils/calcRainwater';
import type { DrawingData } from '../../../utils/drawingSync';

/** Caudal (LPS) del ramal/bajante de aguas lluvias seleccionado — lee DIRECTO el doc de
 *  trazos del piso cargado (sin contexts, que en el visor pueden no estar sincronizados):
 *  bajante → Q de su área (I=100, C=0.0278); ramal → Σ Q de los bajantes que le drenan
 *  (misma BFS de proximidad que Diseño de red lluvias). null si no aplica o Q = 0. */
export function useCaudalLl(
  selElement: { id?: string; tipo?: string } | null,
  activeNet: string,
  loadedPlanId?: string | number | null,
): number | null {
  {
    if (activeNet !== 'll' || !selElement?.id) return null;
    const planId = String(loadedPlanId ?? '');
    if (!planId) return null;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + planId, null);
    if (!raw) return null;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    const bajLl = (data.bajantes || []).filter(
      (
        b,
      ): b is DrawingData['bajantes'] extends (infer T)[] | undefined
        ? T & { area_m2?: number }
        : never => b.net === 'll' && b.tipo === 'bajante',
    );
    const qDe = (b: { area_m2?: number }): number =>
      chequeoBajanteLluvia({ areaAcumulada: b.area_m2 || 0, intensidad: 100, coeficienteC: 0.0278 })
        .Q;

    if (selElement.tipo === 'bajante') {
      const b = bajLl.find((x) => x.id === selElement.id);
      if (!b) return null;
      const q = qDe(b);
      return q > 0 ? q : null;
    }

    // Ramal: asociaciones ramal→bajantes del propio doc (BFS de proximidad compartida).
    const miniTramos = bajLl.map((b) => ({
      id: b.id,
      code: b.code || b.id,
      _key: `${b.id}-${planId}`,
      esBajante: true,
    }));
    const assoc = buildLlBajanteAssociations(
      miniTramos as never,
      [{ id: planId, nivel: 0 }] as never,
    );
    const codes = assoc[`${selElement.id}-${planId}`] || [];
    let q = 0;
    for (const code of codes) {
      const b = bajLl.find((x) => (x.code || x.id) === code);
      if (b) q += qDe(b);
    }
    return q > 0 ? q : null;
  }
}
