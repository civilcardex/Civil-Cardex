import { project } from '../geometry';
import type { PlanItem } from '../../../../context/PlansContext.tsx';
import type { PlanCrop } from '../../../../utils/planoCrop.ts';
import type { VistaIso } from './isoView.ts';

/** Pase 1 de la isometría: pinta las láminas de fondo (el PDF de cada piso) como imágenes
 * semitransparentes acostadas en el piso que les corresponde (NPT, nivel de piso topográfico),
 * con su etiqueta (P1, S2, C). Va PRIMERO para que toda tubería de red quede dibujada encima.
 * Ej: con 2 pisos cargados, la lámina del P1 se ve tenue detrás de sus ramales de af (Agua Fría). */
export function pintaLaminasFondo(args: {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  planImages: Map<number, { img: HTMLCanvasElement; w: number; h: number }>;
  confirmedPlanos: PlanItem[];
  pisosVisibles: Set<number> | null;
  nptMap: Record<number, number>;
  planCrop: PlanCrop | null;
  vista: VistaIso;
  getIsoCoords: (px: number, py: number, nivel: number) => { x: number; y: number };
  getZPix: (zMm: number, nivel?: number) => number;
}): void {
  const {
    ctx,
    dpr,
    planImages,
    confirmedPlanos,
    pisosVisibles,
    nptMap,
    planCrop,
    vista,
    getIsoCoords,
    getZPix,
  } = args;
  if (planImages.size === 0) return;
  const { rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy } = vista;
  // Dibuja los planos como láminas de fondo semitransparentes
  for (const [planId, planData] of planImages) {
    const plan = confirmedPlanos.find((p) => p.id === planId);
    if (!plan || plan.nivel == null) continue;
    // Piso oculto (orig. usuario): el chip quita el PLANO COMPLETO — lámina PDF incluida,
    // no solo sus elementos.
    if (pisosVisibles && !pisosVisibles.has(Number(plan.nivel))) continue;
    const z = nptMap[plan.nivel] || 0;
    const z_pix = getZPix(z, plan.nivel);
    const img = planData.img;
    const imgW = planData.w;
    const imgH = planData.h;
    const scale = 1.5;
    const pageW = imgW / scale;
    const pageH = imgH / scale;
    // El recorte (crop) está normalizado (0-1) respecto a la PÁGINA COMPLETA — solo se dibuja
    // el sub-rectángulo visible de la imagen origen, deformado hacia su posición real correcta
    // dentro del mismo marco de coordenadas (sin recortar) que usan todos los elementos de red.
    const crop = planCrop || { x: 0, y: 0, w: 1, h: 1 };
    const cx0 = crop.x * pageW,
      cy0 = crop.y * pageH;
    const cx1 = (crop.x + crop.w) * pageW,
      cy1 = (crop.y + crop.h) * pageH;
    const tl_iso = getIsoCoords(cx0, cy0, plan.nivel);
    const tr_iso = getIsoCoords(cx1, cy0, plan.nivel);
    const bl_iso = getIsoCoords(cx0, cy1, plan.nivel);
    const label_iso = getIsoCoords((cx0 + cx1) / 2, cy0 - 30, plan.nivel);

    const tl = project(tl_iso.x, tl_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
    const tr = project(tr_iso.x, tr_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
    const bl = project(bl_iso.x, bl_iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
    const srcX = crop.x * imgW,
      srcY = crop.y * imgH;
    const srcW = crop.w * imgW,
      srcH = crop.h * imgH;
    const ax = ((tr.sx - tl.sx) / srcW) * dpr;
    const ay = ((tr.sy - tl.sy) / srcW) * dpr;
    const bx = ((bl.sx - tl.sx) / srcH) * dpr;
    const by = ((bl.sy - tl.sy) / srcH) * dpr;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.setTransform(ax, ay, bx, by, tl.sx * dpr, tl.sy * dpr);
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#5a6a6b';
    ctx.lineWidth = 1 / (zoom || 1);
    ctx.strokeRect(0.5, 0.5, srcW - 1, srcH - 1);
    ctx.restore();
    const midPt = project(
      label_iso.x,
      label_iso.y,
      z_pix,
      rotZ,
      rotX,
      scaleZ,
      zoom,
      offX,
      offY,
      cx,
      cy,
    );
    ctx.save();
    ctx.fillStyle = '#5a6a6bcc';
    ctx.font = `bold ${Math.max(10, 11 * zoom)}px Geist,monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const pisoLabel =
      plan.nivel < 0 ? `S${Math.abs(plan.nivel)}` : plan.nivel === 99 ? 'C' : `P${plan.nivel}`;
    ctx.fillText(pisoLabel, midPt.sx, midPt.sy);
    ctx.restore();
  }
}
