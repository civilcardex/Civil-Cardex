import { TRAZOS_PREFIX } from '../../../constants/storage-keys';
import { loadFromStorage } from '../../../services/storageService';
import { loadPDF } from '../../../services/idbStorage';
import { getPdfjs } from '../../../utils/lazyPdfjs';
import type { PlanoRamal, PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import type { CrossFloorGhost } from '../../../utils/associateBajanteAcrossFloors';
import type { PlanItem } from '../../../context/PlansContext';

interface ProjPt {
  sx: number;
  sy: number;
}

export type IsoRamal = PlanoRamal & { planNivel: number; planId: string };
export type IsoBajante = PlanoBajante & {
  planNivel: number;
  planId: string;
  _isCrossFloorGhost?: boolean;
  targetBajanteId?: string;
};

function project(
  x: number,
  y: number,
  z: number,
  rotZDeg: number,
  rotXDeg: number,
  scaleZ: number,
  zoom: number,
  offX: number,
  offY: number,
  cx: number,
  cy: number,
): ProjPt {
  const rZ = (rotZDeg * Math.PI) / 180;
  const rX = (rotXDeg * Math.PI) / 180;
  const x1 = x * Math.cos(rZ) - y * Math.sin(rZ);
  const y1 = x * Math.sin(rZ) + y * Math.cos(rZ);
  const y2 = y1 * Math.cos(rX) - z * scaleZ * Math.sin(rX);
  return { sx: x1 * zoom + offX + cx, sy: y2 * zoom + offY + cy };
}

interface StoredDrawing {
  scaleM?: number;
  origen?: { x_px: number; y_px: number };
  ramales?: PlanoRamal[];
  bajantes?: PlanoBajante[];
  crossFloorGhosts?: CrossFloorGhost[];
}

function readDrawingAll(plans: PlanItem[], netIds: string[]) {
  const dataByNet: Record<string, { ramales: IsoRamal[]; bajantes: IsoBajante[] }> = {};
  for (const nid of netIds) dataByNet[nid] = { ramales: [], bajantes: [] };
  const scaleMap: Record<number, number> = {};
  const origenMap: Record<number, { x_px: number; y_px: number }> = {};
  // Ghosts are collected separately and turned into drawable (but connector-line-suppressed —
  // see the `_isCrossFloorGhost` flag and useIsometriaRender.ts) synthetic bajante entries below.
  // The ghost's position is the actual intended visual anchor for the cross-floor connection —
  // possibly deliberately offset from the real target via a Ldesvio deviation — so the real
  // source bajante's connector must reach exactly THIS point, not some other bajante/ramal found
  // by independently resolving descargaEnId. The ghost itself never draws its own copy of that
  // same line (that would be the same connection rendered twice, once from each end).
  const ghostsByNet: Record<
    string,
    Array<CrossFloorGhost & { planNivel: number; planId: string }>
  > = {};
  for (const nid of netIds) ghostsByNet[nid] = [];
  for (const plan of plans) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<StoredDrawing | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    const data: StoredDrawing | null =
      typeof raw === 'string'
        ? (() => {
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          })()
        : raw;
    if (!data) continue;
    if (data.scaleM) scaleMap[plan.nivel] = data.scaleM;
    if (data.origen) origenMap[plan.nivel] = data.origen;
    for (const netId of netIds) {
      for (const r of data.ramales || []) {
        if (r.net === netId && r.tipo === 'ramal')
          dataByNet[netId].ramales.push({ ...r, planNivel: plan.nivel, planId: String(plan.id) });
      }
      for (const b of data.bajantes || []) {
        if (b.net === netId)
          dataByNet[netId].bajantes.push({ ...b, planNivel: plan.nivel, planId: String(plan.id) });
      }
      // Cross-floor ghosts: held back until the second pass below (see ghostsByNet comment).
      for (const g of data.crossFloorGhosts || []) {
        if (g.net !== netId) continue;
        ghostsByNet[netId].push({ ...g, planNivel: plan.nivel, planId: String(plan.id) });
      }
    }
  }

  for (const netId of netIds) {
    for (const g of ghostsByNet[netId]) {
      dataByNet[netId].bajantes.push({
        id: g.id,
        net: g.net,
        tipo: 'bajante',
        code: g.code,
        x: g.x,
        y: g.y,
        pisoBase: '',
        pisoCima: '',
        nptBase: 0,
        nptCima: 0,
        hVert: 0,
        dNominal: g.dNominal,
        recibeDeIds: [],
        alimentaIds: [],
        descargaEnId: `${g.sourcePlanId}|${g.sourceBajanteId}`,
        ucAcum: 0,
        ucExtra: 0,
        area_m2: 0,
        desplazamientos: {},
        lblOffX: 0,
        lblOffY: 0,
        labelAngle: 0,
        labelX: 0,
        labelY: 0,
        direccion: g.direccion,
        planNivel: g.planNivel,
        planId: g.planId,
        _isCrossFloorGhost: true,
        targetBajanteId: g.targetBajanteId,
      });
    }
  }

  return { dataByNet, scaleMap, origenMap };
}

async function loadPlanImage(
  plan: PlanItem,
): Promise<{ nivel: number; img: HTMLCanvasElement; w: number; h: number } | null> {
  try {
    const file = await loadPDF(plan.id);
    if (!file) return null;
    const buf = await file.arrayBuffer();
    const pdfjsLib = await getPdfjs();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 1.5 });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width);
    c.height = Math.floor(vp.height);
    await page.render({ canvas: c, viewport: vp }).promise;
    return { nivel: plan.nivel as number, img: c, w: vp.width, h: vp.height };
  } catch {
    return null;
  }
}

export { project, readDrawingAll, loadPlanImage };
export type { ProjPt };
