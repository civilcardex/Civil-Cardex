import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { diametroManning } from './calcSanitaryCore';
import { chequeoBajanteLluvia } from './calcRainwater';
import { calcHydraulicCheck } from './hydraulicCheck';
import { DIAM_OPTIONS } from '../constants';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { distToPolyline } from '../lib/shared/geometry';
import type { DrawingData, RawElement } from './drawingSync';

interface BajanteRaw extends RawElement { x?: number; y?: number }
interface AreaRaw { areaM2?: number }
export interface BajanteLl { bajante?: string; id?: string; areaAcumulada?: number; intensidad?: number; coeficienteC?: number }

// Which downpipe codes feed into each ramal — same geometric-proximity BFS used by the
// DisenoLluvias table, shared with the memoria export so both report the same associations.
export function buildLlBajanteAssociations(tramosLl: Tramo[], plans: PlanItem[]): Record<string, string[]> {
  const calculoMap: Record<string, string[]> = {};

  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { continue; } }

    const ramales = (data.ramales || []).filter((r) => r.net === 'll');
    const bajantes = (data.bajantes || []).filter((b): b is BajanteRaw => b.net === 'll');

    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const rKey = `${r.id}-${plan.id}`;

      const checkEndpoint = (pt: number[]) => {
        for (const b of bajantes) {
          const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
          const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
          if (isExplicit) {
            const otherPt = pt === pEnd ? pStart : pEnd;
            const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
            if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
            continue;
          }
          if (dist < 2.0) {
            return { type: 'bajante' as const, id: b.id };
          }
        }
        let bestRx: RawElement | null = null;
        let minDist = Infinity;
        for (const rx of ramales) {
          if (rx.id === r.id) continue;
          if (!rx.pts || rx.pts.length < 2) continue;
          const dist = distToPolyline(pt, rx.pts);
          if (dist < 2.0 && dist < minDist) {
            minDist = dist;
            bestRx = rx;
          }
        }
        if (bestRx) {
          return { type: 'ramal' as const, id: bestRx.id };
        }
        return null;
      };

      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null
      );

      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
        if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
      }
    }
  }

  const ramalToBajantes: Record<string, string[]> = {};
  const bajanteKeys = tramosLl.filter(t => t.esBajante && t._key).map(t => ({ key: t._key!, code: t.code || t.id }));

  for (const b of bajanteKeys) {
    const queue = [b.key];
    const visited = new Set<string>();
    visited.add(b.key);

    while (queue.length > 0) {
      const node = queue.shift()!;
      const children = calculoMap[node] || [];
      for (const child of children) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
          if (!ramalToBajantes[child]) ramalToBajantes[child] = [];
          if (!ramalToBajantes[child].includes(b.code)) {
            ramalToBajantes[child].push(b.code);
          }
        }
      }
    }
  }

  return ramalToBajantes;
}

// Caudal (LPS) arriving at each tramo — own runoff for a downpipe, accumulated area's runoff
// for a collector ramal via its associated downpipes. Shared with the memoria export.
export function computeLlQMap(
  tramosLl: Tramo[],
  plans: PlanItem[],
  bajantesLl: BajanteLl[],
  associations: Record<string, string[]>
): Record<string, number> {
  const areaAcumMap: Record<string, number> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<(DrawingData & { areas?: AreaRaw[] }) | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData & { areas?: AreaRaw[] } = raw as DrawingData & { areas?: AreaRaw[] };
    if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { continue; } }
    const totalArea = (data.areas || []).reduce((s, a) => s + (a.areaM2 || 0), 0);
    areaAcumMap[String(plan.nivel)] = totalArea;
  }

  const ownQMap: Record<string, number> = {};
  for (const t of tramosLl) {
    if (!t._key) continue;
    let ownQ = 0;
    if (t.caudal != null && t.caudal > 0) {
      ownQ = t.caudal;
    } else if (t.area_m2 && t.area_m2 > 0) {
      const manual = bajantesLl.find(b =>
        b.bajante === t.id || b.bajante === t.code || b.id === t.id || b.id === t.code
      );
      const int = manual?.intensidad ?? 100;
      const coef = manual?.coeficienteC ?? 0.0278;
      ownQ = t.area_m2 * int * coef / 100;
    } else {
      ownQ = t.qLps || 0;
    }
    ownQMap[t._key] = ownQ;
  }

  const totalQMap: Record<string, number> = {};
  for (const t of tramosLl) {
    if (!t._key) continue;

    let total = 0;
    if (t.tipo === 'ramal' && !t.esBajante) {
      const associatedCodes = associations[t._key] || [];
      for (const code of associatedCodes) {
        const bajante = bajantesLl.find(b => b.bajante === code || b.id === code);
        const trBaj = tramosLl.find(tb => tb.code === code || tb.id === code);

        const areaAcum = areaAcumMap[String(trBaj?.piso)] || bajante?.areaAcumulada || 0;

        if (bajante) {
          const Q = chequeoBajanteLluvia({ areaAcumulada: areaAcum, intensidad: bajante.intensidad ?? 100, coeficienteC: bajante.coeficienteC ?? 0.0278 }).Q;
          total += Q;
        } else if (trBaj) {
          const Q = chequeoBajanteLluvia({ areaAcumulada: areaAcum, intensidad: 100, coeficienteC: 0.0278 }).Q;
          total += Q;
        }
      }
      if (total === 0 && t.qLps) {
        total = t.qLps;
      }
    } else {
      total = ownQMap[t._key] || 0;
    }
    totalQMap[t._key] = total;
  }
  return totalQMap;
}

export function getTributarioIds(tramos: Array<{ recibeDe?: string[]; descripcion?: string; id: string }>): Set<string> {
  const tribSet = new Set<string>();
  for (const t of tramos) {
    if (t.recibeDe) {
      for (const id of t.recibeDe) tribSet.add(id);
    }
    if (t.descripcion) {
      const ids = t.descripcion.split('+').map(s => s.trim()).filter(Boolean);
      for (const id of ids) tribSet.add(id);
    }
  }
  return tribSet;
}

export interface LlRow {
  tKey: string; id: string; piso: number; desde?: string; hasta?: string;
  bajantesAsociadas: string[];
  Q: number; n: number; sVal: number;
  DcalcPulg: number; DdisPulg: number; DintMm: number;
  Qo: number; Vo: number; qqo: number; Vreal: number; chequeoV: string;
  Yc: number; Yn: number; Froude: number; tipoFlujo: string; Ymax: number; chequeoYn: string;
  fuerzaTractiva: number; chequeoFT: string;
}

// Per-tramo hydraulic design row for aguas lluvias — same formulas as DisenoLluvias's table.
export function computeLlRows(
  displayTramos: Tramo[],
  qMap: Record<string, number>,
  associations: Record<string, string[]>
): LlRow[] {
  return displayTramos.toSorted((a, b) => (a.piso || 0) - (b.piso || 0)).map(t => {
    const tKey = t._key ?? '';
    const n = t.nmaning ?? 0;
    const sVal = t.sPercent ?? 0;
    const S = sVal != null && sVal > 0 ? sVal / 100 : null;
    const Q = qMap[tKey] || 0;
    const dSel = DIAM_OPTIONS.find(d => d.pulg === (t.diamDisPulg || 0)) || null;
    let DcalcPulg = 0;
    const DdisPulg = dSel ? dSel.pulg : 0;
    const DintMm = dSel ? dSel.mm : 0;
    let Qo = 0, Vo = 0, qqo = 0;
    let Vreal = 0, chequeoV = '—';
    let Yc = 0, Yn = 0, Froude = 0, tipoFlujo = '—', Ymax = 0, chequeoYn = '—';
    let fuerzaTractiva = 0, chequeoFT = '—';
    if (Q > 0 && S != null && S > 0 && n != null && n > 0) {
      DcalcPulg = Math.round(diametroManning(Q / 1000, n, S) * 1000 / 25.4 * 100) / 100;
    }
    if (Q > 0 && S != null && S > 0 && n != null && n > 0 && DintMm > 0) {
      const hc = calcHydraulicCheck({ Q, S, n, DintMm });
      Qo = hc.Qo; Vo = hc.Vo; qqo = hc.qqo;
      Vreal = hc.Vreal; chequeoV = hc.chequeoV;
      Yc = hc.Yc; Yn = hc.Yn; Froude = hc.Froude; tipoFlujo = hc.tipoFlujo;
      Ymax = hc.Ymax; chequeoYn = hc.chequeoYn; fuerzaTractiva = hc.fuerzaTractiva; chequeoFT = hc.chequeoFT;
    }
    return {
      tKey, id: t.id || tKey, piso: t.piso, desde: t.desde, hasta: t.hasta,
      bajantesAsociadas: associations[tKey] || [],
      Q, n, sVal, DcalcPulg, DdisPulg, DintMm,
      Qo, Vo, qqo, Vreal, chequeoV,
      Yc, Yn, Froude, tipoFlujo, Ymax, chequeoYn,
      fuerzaTractiva, chequeoFT,
    };
  });
}
