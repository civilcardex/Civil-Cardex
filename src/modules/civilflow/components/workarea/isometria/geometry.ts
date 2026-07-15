import { TRAZOS_PREFIX } from "../../../constants/storage-keys";
import { loadFromStorage } from "../../../services/storageService";
import { loadPDF } from "../../../services/idbStorage";
import { getPdfjs } from "../../../utils/lazyPdfjs";

interface ProjPt { sx: number; sy: number }

function project(
  x: number, y: number, z: number,
  rotZDeg: number, rotXDeg: number,
  scaleZ: number, zoom: number,
  offX: number, offY: number,
  cx: number, cy: number
): ProjPt {
  const rZ = rotZDeg * Math.PI / 180;
  const rX = rotXDeg * Math.PI / 180;
  const x1 = x * Math.cos(rZ) - y * Math.sin(rZ);
  const y1 = x * Math.sin(rZ) + y * Math.cos(rZ);
  const y2 = y1 * Math.cos(rX) - z * scaleZ * Math.sin(rX);
  return { sx: x1 * zoom + offX + cx, sy: y2 * zoom + offY + cy };
}

function readDrawingAll(plans: any[], netIds: string[]) {
  const dataByNet: Record<string, { ramales: any[]; bajantes: any[] }> = {};
  for (const nid of netIds) dataByNet[nid] = { ramales: [], bajantes: [] };
  const scaleMap: Record<number, number> = {};
  const origenMap: Record<number, { x_px: number; y_px: number }> = {};
  for (const plan of plans) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    const data = (typeof raw === 'string') ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    if (!data) continue;
    if (data.scaleM) scaleMap[plan.nivel] = data.scaleM;
    if (data.origen) origenMap[plan.nivel] = data.origen;
    for (const netId of netIds) {
      for (const r of (data.ramales || [])) {
        if (r.net === netId && r.tipo === 'ramal')
          dataByNet[netId].ramales.push({ ...r, planNivel: plan.nivel, planId: String(plan.id) });
      }
      for (const b of (data.bajantes || [])) {
        if (b.net === netId)
          dataByNet[netId].bajantes.push({ ...b, planNivel: plan.nivel, planId: String(plan.id) });
      }
    }
  }
  return { dataByNet, scaleMap, origenMap };
}

async function loadPlanImage(plan: any): Promise<{ nivel: number; img: HTMLCanvasElement; w: number; h: number } | null> {
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
    return { nivel: plan.nivel, img: c, w: vp.width, h: vp.height };
  } catch {
    return null;
  }
}

export { project, readDrawingAll, loadPlanImage };
export type { ProjPt };
