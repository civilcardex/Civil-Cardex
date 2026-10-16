import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { DIAM_OPTIONS_SAN } from '../constants';
import { writeDiametroToDrawing } from '../utils/writeDiameterToDrawing';
import {
  INODORO_APP_ID,
  sanDiamAllowedForApparatus,
  SAN_INODORO_MIN_MSG,
  sanMaxFeederDiam,
  sanFeederMinMsg,
} from '../utils/sanitaryDiamCompat';
import { parseBajanteKey } from '../utils/drawingWrites/diametros';
import { avisarDiametroInvalido } from '../utils/diametroValidation';

/** Datos que necesita el cambio de diámetro sanitario (antes vivían dentro de SanitaryDesign). */
export interface SanDiamChangeCtx {
  tramosSan: Tramo[];
  /** Mapa `padre → hijos`: el PADRE es el ramal de aguas abajo (el que recibe) y los HIJOS
   *  los que le entregan. El recorrido de propagación camina por esta cadena. */
  fullChildrenMap: Record<string, string[]> | null;
  plans: PlanItem[];
  updTramoSan: (id: string, field: string, val: string | number | boolean) => void;
}

/** Cambia el diámetro de un tramo sanitario desde la tabla: respeta el mínimo del inodoro,
 *  no baja por debajo del mayor hijo que le descarga, escribe el cambio en el dibujo y
 *  propaga el mayor valor aguas abajo. */
export function aplicarCambioDiametroSan(
  tramoId: string,
  newPulg: number,
  ctx: SanDiamChangeCtx,
): void {
  const { tramosSan, fullChildrenMap, plans, updTramoSan } = ctx;
  const opt = DIAM_OPTIONS_SAN.find((o) => o.pulg === newPulg);
  if (opt) {
    // Ítem 6/7/8: regla central (inodoro → 4" mínimo). Bloqueo directo en UI sin esperar al write.
    if (newPulg > 0 && !sanDiamAllowedForApparatus(newPulg, INODORO_APP_ID)) {
      const [ramalId, planId] = parseBajanteKey(tramoId);
      const key = `san_${ramalId}_${planId}`;
      try {
        const counts = JSON.parse(localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '{}');
        if ((counts[key]?.['san'] || 0) > 0) {
          if (avisarDiametroInvalido(SAN_INODORO_MIN_MSG)) return;
        }
      } catch (_e) {
        void _e;
      }
    }
    // Invariante sanitario en AMBAS direcciones, contra el mapa de conectividad (hijos =
    // quien me descarga; padres = a quien yo descargo). Bloqueo con alerta, igual que dibujo.
    if (newPulg > 0 && fullChildrenMap) {
      // _key real es `${id}-${planId}` (buildTramos) — un único formato para todas las lookups.
      const findTramo = (k: string) =>
        tramosSan.find((t) => (t._key || (t.planId ? `${t.id}-${t.planId}` : '')) === k);
      const self = findTramo(tramoId);
      const keys = [tramoId];
      if (self) {
        if (self._key && !keys.includes(self._key)) keys.push(self._key);
        const planKey = self.planId ? `${self.id}-${self.planId}` : '';
        if (planKey && !keys.includes(planKey)) keys.push(planKey);
      }
      // Bajada: el mayor hijo ramal que me descarga fija el mínimo.
      const childKeys = keys.flatMap((k) => fullChildrenMap[k] || []);
      const feeder = sanMaxFeederDiam(childKeys, findTramo);
      if (feeder && newPulg < feeder.pulg) {
        if (avisarDiametroInvalido(sanFeederMinMsg(feeder.label, feeder.pulg))) return;
      }
      // Subida libre: el alimentador puede superar al receptor — el motor propaga el
      // mayor aguas abajo automáticamente (sin alerta, orig. usuario).
    }
    const res = writeDiametroToDrawing(tramoId, 'san', opt.label, plans);
    if (!res.ok && res.reason === 'accessory-larger') {
      if (
        avisarDiametroInvalido(
          `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
        )
      )
        return;
    }
    updTramoSan(tramoId, 'diamDisPulg', newPulg);

    // ponytail: propagate larger diameter downstream (same maxDiametroLabel logic as drawing).
    // fullChildrenMap is parent(downstream) -> children(upstream); reverse to find downstream parents of a node.
    // BFS over reverse graph handles multiple levels and bajante hops.
    if (newPulg > 0 && fullChildrenMap) {
      const reverse: Record<string, string[]> = {};
      for (const [parent, children] of Object.entries(fullChildrenMap)) {
        for (const child of children) {
          if (!reverse[child]) reverse[child] = [];
          if (!reverse[child].includes(parent)) reverse[child].push(parent);
        }
      }
      const visited = new Set<string>([tramoId]);
      const queue: string[] = [...(reverse[tramoId] || [])];
      // Mismo formato que el findTramo de arriba: `_key` con fallback `${id}-${planId}`
      // (el fallback `${id}-${piso}` divergía cuando piso ≠ planId).
      const findTramo = (k: string) =>
        tramosSan.find((t) => (t._key || (t.planId ? `${t.id}-${t.planId}` : '')) === k);
      while (queue.length > 0) {
        const curKey = queue.shift()!;
        if (visited.has(curKey)) continue;
        visited.add(curKey);
        const t = findTramo(curKey);
        const isRamal = !!t && t.tipo === 'ramal' && !t.esBajante;
        if (isRamal) {
          const curPulg = t!.diamDisPulg || 0;
          if (newPulg > curPulg) {
            const dRes = writeDiametroToDrawing(curKey, 'san', opt.label, plans);
            if (dRes.ok || dRes.reason !== 'accessory-larger') {
              updTramoSan(curKey, 'diamDisPulg', newPulg);
            }
            if (!dRes.ok && dRes.reason === 'accessory-larger') {
              continue;
            }
          }
        }
        for (const nxt of reverse[curKey] || []) {
          if (!visited.has(nxt)) queue.push(nxt);
        }
      }
    }
  }
}
