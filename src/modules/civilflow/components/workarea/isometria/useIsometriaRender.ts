import { useEffect, type RefObject } from 'react';
import { NETS } from '../../../lib/PlanoEngine/PlanoState';
import { loadPlanCrop } from '../../../utils/planCrop';
import { parseDescargaEnId } from '../../../utils/parseDescargaEnId';
import { project, ISO_SCALE, type IsoRamal, type IsoBajante } from './geometry';
import type { IsoCanvas, IsoSegment } from './useIsometriaInteraction';
import type { PlanItem } from '../../../context/PlansContext';

interface IsoPt {
  sx: number;
  sy: number;
}

function shadeHex(col: string, f: number): string {
  const n = parseInt(col.replace('#', ''), 16);
  if (!Number.isFinite(n)) return col;
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function hexA(col: string, a: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(col)) return col;
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Orthographic screen-space unit vectors for the world axes at a given iso point — one step is
 *  ONE WORLD METER (ISO_SCALE iso units), so callers can size things in meters directly. */
function isoAxisVecs(
  proj: (x: number, y: number, z: number) => IsoPt,
  bx: number,
  by: number,
  z: number,
): { vX: IsoPt; vY: IsoPt; vZ: IsoPt } {
  const O = proj(bx, by, z);
  const pX = proj(bx + ISO_SCALE, by, z);
  const pY = proj(bx, by + ISO_SCALE, z);
  const pZ = proj(bx, by, z + ISO_SCALE);
  return {
    vX: { sx: pX.sx - O.sx, sy: pX.sy - O.sy },
    vY: { sx: pY.sx - O.sx, sy: pY.sy - O.sy },
    vZ: { sx: pZ.sx - O.sx, sy: pZ.sy - O.sy },
  };
}

/**
 * Draws a SOLID isometric cuboid (all 6 faces, painter-sorted) with its base centered at
 * (bx, by, z), footprint w x d and height h — dims in world meters. Used for
 * calentador/contador fixtures so they read as closed 3D equipment.
 */
function drawIsoCuboid(
  ctx: CanvasRenderingContext2D,
  proj: (x: number, y: number, z: number) => IsoPt,
  bx: number,
  by: number,
  z: number,
  w: number,
  d: number,
  h: number,
  fill: string,
  stroke: string,
  hl = false,
): void {
  const { vX, vY, vZ } = isoAxisVecs(proj, bx, by, z);
  const O = proj(bx, by, z);
  const P = (dx: number, dy: number, dz: number): IsoPt => ({
    sx: O.sx + vX.sx * dx + vY.sx * dy + vZ.sx * dz,
    sy: O.sy + vX.sy * dx + vY.sy * dy + vZ.sy * dz,
  });
  const o0 = P(0, 0, 0);
  const px = P(w, 0, 0);
  const py = P(0, d, 0);
  const pxy = P(w, d, 0);
  const t0 = P(0, 0, h);
  const tx = P(w, 0, h);
  const ty = P(0, d, h);
  const txy = P(w, d, h);
  // All 6 faces; painter-sorted by average screen y (in this ortho projection a lower-on-screen
  // face is in front — see project(): larger sy = closer to the camera), so back faces are
  // covered by front faces no matter the rotZ/rotX — the box always reads as closed/solid.
  const faces: { pts: IsoPt[]; shade: number }[] = [
    { pts: [o0, px, pxy, py], shade: 0.42 },
    { pts: [t0, tx, txy, ty], shade: 1 },
    { pts: [o0, px, tx, t0], shade: 0.8 },
    { pts: [py, pxy, txy, ty], shade: 0.55 },
    { pts: [o0, py, ty, t0], shade: 0.68 },
    { pts: [px, pxy, txy, tx], shade: 0.88 },
  ];
  faces.sort(
    (a, b) =>
      a.pts.reduce((s, p) => s + p.sy, 0) / a.pts.length -
      b.pts.reduce((s, p) => s + p.sy, 0) / b.pts.length,
  );
  const quad = (pts: IsoPt[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    ctx.lineTo(pts[1].sx, pts[1].sy);
    ctx.lineTo(pts[2].sx, pts[2].sy);
    ctx.lineTo(pts[3].sx, pts[3].sy);
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = hl ? 2.4 : 1.2;
  for (const f of faces) {
    ctx.fillStyle = shadeHex(fill, f.shade);
    quad(f.pts);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

interface UseIsometriaRenderParams {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  planImagesRef: RefObject<Map<number, { img: HTMLCanvasElement; w: number; h: number }>>;
  dataByNet: Record<string, { ramales: IsoRamal[]; bajantes: IsoBajante[] }>;
  activeNets: Set<string>;
  profByNet: Record<string, number>;
  nptMap: Record<number, number>;
  pisos: unknown;
  rotZ: number;
  rotX: number;
  scaleZ: number;
  zoom: number;
  offX: number;
  offY: number;
  size: { w: number; h: number };
  selTramo: string | null;
  showPlanos: boolean;
  confirmedPlanos: PlanItem[];
  renderTick: number;
  getIsoCoords: (px: number, py: number, nivel: number) => { x: number; y: number };
  getZPix: (zMm: number, nivel?: number) => number;
}

export function useIsometriaRender({
  canvasRef,
  planImagesRef,
  dataByNet,
  activeNets,
  profByNet,
  nptMap,
  pisos,
  rotZ,
  rotX,
  scaleZ,
  zoom,
  offX,
  offY,
  size,
  selTramo,
  showPlanos,
  confirmedPlanos,
  renderTick,
  getIsoCoords,
  getZPix,
}: UseIsometriaRenderParams) {
  useEffect(() => {
    const canvas = canvasRef.current as IsoCanvas | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = size.w,
      H = size.h;
    const dpr = devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(0, 0, W, H);
    const planCrop = loadPlanCrop();

    const cx = W / 2,
      cy = H / 2;

    const segments: IsoSegment[] = [];

    // Draw planos as semi-transparent background sheets
    if (showPlanos && planImagesRef.current.size > 0) {
      for (const [planId, planData] of planImagesRef.current) {
        const plan = confirmedPlanos.find((p) => p.id === planId);
        if (!plan || plan.nivel == null) continue;
        const z = nptMap[plan.nivel] || 0;
        const z_pix = getZPix(z, plan.nivel);
        const img = planData.img;
        const imgW = planData.w;
        const imgH = planData.h;
        const scale = 1.5;
        const pageW = imgW / scale;
        const pageH = imgH / scale;
        // Crop is normalized (0-1) against the FULL page — only the visible sub-rect of the
        // source image is drawn, warped to its correct real-world position within the same
        // (uncropped) coordinate frame used by all network elements.
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

    // Draw each active network
    for (const [netId, netData] of Object.entries(dataByNet)) {
      if (!activeNets.has(netId)) continue;
      const netColor = NETS.find((n) => n.id === netId)?.col || '#888';
      const prof = profByNet[netId] ?? 0;

      ctx.strokeStyle = netColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      // Canals render FIRST as background troughs (open channel at floor level) so the ll
      // ramales and any bajante inside them draw on top — mirroring the plano, where the canal
      // rectangle is the backdrop and bajantes read as normal bajantes over it.
      const projPt = (px: number, py: number, pz: number) =>
        project(px, py, pz, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
      for (const b of netData.bajantes) {
        if (b._isCrossFloorGhost || b.tipo !== 'canal') continue;
        const baseM = (b.base || 0) / 100;
        const altM = (b.altura || 0) / 100;
        if (baseM <= 0.001 || altM <= 0.001) continue;
        const selKey = `${netId}:${b.planId}:${b.id}`;
        const isSel = selKey === selTramo;
        const hl = isSel ? '#FFEB3B' : netColor;
        const zC = (nptMap[b.planNivel] || 0) - prof * 1000;
        const zPixC = getZPix(zC, b.planNivel);
        const iso0 = getIsoCoords(b.x, b.y, b.planNivel);
        const pA = projPt(iso0.x, iso0.y, zPixC);
        const pB = projPt(iso0.x + baseM * ISO_SCALE, iso0.y, zPixC);
        const pC = projPt(iso0.x + baseM * ISO_SCALE, iso0.y + altM * ISO_SCALE, zPixC);
        const pD = projPt(iso0.x, iso0.y + altM * ISO_SCALE, zPixC);
        const wall = Math.min(altM, 0.6);
        const pAw = projPt(iso0.x, iso0.y, zPixC + wall * ISO_SCALE);
        const pBw = projPt(iso0.x + baseM * ISO_SCALE, iso0.y, zPixC + wall * ISO_SCALE);
        const pCw = projPt(
          iso0.x + baseM * ISO_SCALE,
          iso0.y + altM * ISO_SCALE,
          zPixC + wall * ISO_SCALE,
        );
        const pDw = projPt(iso0.x, iso0.y + altM * ISO_SCALE, zPixC + wall * ISO_SCALE);
        const quad = (a: IsoPt, b2: IsoPt, c2: IsoPt, d2: IsoPt) => {
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b2.sx, b2.sy);
          ctx.lineTo(c2.sx, c2.sy);
          ctx.lineTo(d2.sx, d2.sy);
          ctx.closePath();
        };
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = hl;
        ctx.lineWidth = 1.2;
        // Opening face (plan symbol: white rectangle)
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        quad(pA, pB, pC, pD);
        ctx.fill();
        ctx.stroke();
        // Inner 25% line, same position as the plano glyph
        const m1 = projPt(iso0.x, iso0.y + altM * 0.25 * ISO_SCALE, zPixC);
        const m2 = projPt(iso0.x + baseM * ISO_SCALE, iso0.y + altM * 0.25 * ISO_SCALE, zPixC);
        ctx.beginPath();
        ctx.moveTo(m1.sx, m1.sy);
        ctx.lineTo(m2.sx, m2.sy);
        ctx.stroke();
        // Trough walls + bottom (translucent), giving the channel its depth
        ctx.fillStyle = hexA(netColor, 0.18);
        quad(pAw, pBw, pCw, pDw);
        ctx.fill();
        quad(pA, pB, pBw, pAw);
        ctx.fill();
        ctx.stroke();
        quad(pB, pC, pCw, pBw);
        ctx.fill();
        ctx.stroke();
        quad(pC, pD, pDw, pCw);
        ctx.fill();
        ctx.stroke();
        quad(pD, pA, pAw, pDw);
        ctx.fill();
        ctx.stroke();
        if (isSel) {
          // Selected: thicker yellow outline on the opening face + code label above it
          ctx.lineWidth = 2.5;
          quad(pA, pB, pC, pD);
          ctx.stroke();
          const rectCenter = projPt(
            iso0.x + (baseM * ISO_SCALE) / 2,
            iso0.y + (altM * ISO_SCALE) / 2,
            zPixC,
          );
          const topSy = Math.min(pA.sy, pB.sy, pC.sy, pD.sy);
          ctx.fillStyle = '#FFEB3B';
          ctx.font = 'bold 11px Geist,monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(b.code || b.id, rectCenter.sx, topSy - 6);
        }
        ctx.restore();
      }

      for (const r of netData.ramales) {
        // `prof` (Parámetros de Diseño > Materiales por red > "Profundidad de instalación
        // respecto a NPT") is stored NEGATIVE for below-slab (e.g. sanitaria -0.70). In this
        // projection a MORE POSITIVE z renders LOWER on screen (see project() in geometry.ts:
        // y2 grows with z at the default rotX=-45°), so a negative depth must be SUBTRACTED to
        // push the trace down — adding it (the old behavior) pushed traces up instead.
        const z = (nptMap[r.planNivel] || 0) - prof * 1000;
        const z_pix = getZPix(z, r.planNivel);
        const pts = r.pts;
        if (pts.length < 2) continue;
        const selKey = `${netId}:${r.planId}:${r.id}`;
        const isSel = selKey === selTramo;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const iso = getIsoCoords(pts[i][0], pts[i][1], r.planNivel);
          const pr = project(iso.x, iso.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
          if (i === 0) ctx.moveTo(pr.sx, pr.sy);
          else ctx.lineTo(pr.sx, pr.sy);
        }
        ctx.strokeStyle = isSel ? '#FFEB3B' : netColor;
        ctx.lineWidth = isSel ? 3.5 : 2;
        ctx.stroke();

        for (let i = 1; i < pts.length; i++) {
          const iso1 = getIsoCoords(pts[i - 1][0], pts[i - 1][1], r.planNivel);
          const iso2 = getIsoCoords(pts[i][0], pts[i][1], r.planNivel);
          const a = project(iso1.x, iso1.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
          const b = project(iso2.x, iso2.y, z_pix, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
          segments.push({
            sx1: a.sx,
            sy1: a.sy,
            sx2: b.sx,
            sy2: b.sy,
            z: z_pix,
            id: selKey,
            label: r.label || r.id,
            isBaj: false,
            netId,
          });
        }

        if (isSel) {
          const midI = Math.floor(pts.length / 2);
          const isoMid = getIsoCoords(pts[midI][0], pts[midI][1], r.planNivel);
          const mp = project(
            isoMid.x,
            isoMid.y,
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
          ctx.fillStyle = '#FFEB3B';
          ctx.font = 'bold 11px Geist,monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const lbl = `${r.label || r.id} L=${r.totalL}m`;
          ctx.fillText(lbl, mp.sx, mp.sy - 8);
        }
      }

      for (const b of netData.bajantes) {
        // A CrossFloorGhost is only ever consulted as a lookup (which real target does this
        // source connect to, on which floor) — see the `netData.bajantes.find` calls below. It no
        // longer needs any visual representation of its own: the real source-to-target connector
        // now anchors directly on the real target bajante's own position, so drawing the ghost's
        // default single-floor stub here on top of that just left an orphaned extra riser segment
        // sitting at the ghost's (= the source's raw) coordinates, unconnected to anything.
        if (b._isCrossFloorGhost) continue;

        // Calentador/contador render as 3D equipment boxes on the floor instead of a riser stub.
        if (b.tipo === 'calentador' || b.tipo === 'contador') {
          const selKey = `${netId}:${b.planId}:${b.id}`;
          const isSel = selKey === selTramo;
          const zB = (nptMap[b.planNivel] || 0) - prof * 1000;
          const zPixB = getZPix(zB, b.planNivel);
          const isoB = getIsoCoords(b.x, b.y, b.planNivel);
          const dims =
            b.tipo === 'calentador' ? { w: 0.5, d: 0.5, h: 0.5 } : { w: 0.25, d: 0.25, h: 0.25 };
          drawIsoCuboid(
            ctx,
            projPt,
            isoB.x,
            isoB.y,
            zPixB,
            dims.w,
            dims.d,
            dims.h,
            netColor,
            isSel ? '#FFEB3B' : netColor,
            isSel,
          );
          if (isSel) {
            const topC = projPt(isoB.x, isoB.y, zPixB + dims.h * ISO_SCALE);
            ctx.fillStyle = '#FFEB3B';
            ctx.font = 'bold 11px Geist,monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(b.code || b.id, topC.sx, topC.sy - 6);
          }
          continue;
        }

        // Canals were already drawn in the background pass above.
        if (b.tipo === 'canal') continue;

        const profB = profByNet[b.net] ?? 0;
        const currentZ = nptMap[b.planNivel] || 0;
        let targetZ = currentZ;

        // Resolve the REAL target bajante for a bajante-to-bajante association via its
        // CrossFloorGhost (applyBajanteAssociation always writes one, on the target's own floor,
        // recording ghost.targetBajanteId) — the ghost's OWN (x,y) mirrors the SOURCE's raw
        // coordinates and is only useful here to find which floor/bajante it points at, never as
        // the connector's own anchor: the two ends below are both forced onto the REAL target
        // bajante's own (x,y), producing one straight vertical run (same x,y throughout, only z
        // differs) that lands exactly on the target bajante's own drawn position, matching how a
        // riser diagram is meant to read regardless of any incidental offset in the source's raw
        // plan coordinates. `_isCrossFloorGhost` bajantes never resolve their own reverse-pointing
        // descargaEnId here — that would draw this same connection a second time, from the other end.
        let targetRamal = null;
        let targetBajante = null;
        if (b.descargaEnId && !b._isCrossFloorGhost) {
          const ownRef = `${b.planId}|${b.id}`;
          const ghost = netData.bajantes.find(
            (bb) => bb._isCrossFloorGhost && bb.descargaEnId === ownRef,
          );
          if (ghost?.targetBajanteId) {
            targetBajante =
              netData.bajantes.find(
                (bb) =>
                  !bb._isCrossFloorGhost &&
                  bb.id === ghost.targetBajanteId &&
                  bb.planId === ghost.planId,
              ) || null;
          }
          if (targetBajante) {
            targetZ = nptMap[targetBajante.planNivel] || 0;
          } else {
            // Defensive fallback for stale/incomplete data missing its ghost.
            const parts = parseDescargaEnId(b.descargaEnId, b.planId);
            const targetPlanId = parts[0];
            const targetId = parts[1];
            targetRamal = netData.ramales.find(
              (rr) => rr.id === targetId && String(rr.planId) === String(targetPlanId),
            );
            if (targetRamal) {
              targetZ = nptMap[targetRamal.planNivel] || 0;
            } else {
              targetBajante =
                netData.bajantes.find(
                  (bb) =>
                    !bb._isCrossFloorGhost &&
                    bb.id === targetId &&
                    String(bb.planId) === String(targetPlanId),
                ) || null;
              if (targetBajante) {
                targetZ = nptMap[targetBajante.planNivel] || 0;
              }
            }
          }
        }

        const lo = Math.min(currentZ, targetZ);
        const hi = Math.max(currentZ, targetZ);
        const isSube = b.direccion === 'sube' || b.tipo === 'montante';
        // Same sign fix as the ramal z above: profB is negative-for-below, so subtract it.
        const baseZ = (lo === hi ? (isSube ? lo : lo - 1000) : lo) - profB * 1000;
        const cimaZ = (lo === hi ? (isSube ? hi + 1000 : hi) : hi) - profB * 1000;

        let targetPt: number[] | null = null;
        let targetPlanNivel: number | null = null;
        if (targetRamal && targetRamal.pts.length > 0) {
          // Nearest endpoint of the target ramal to the bajante's own (x,y) — not always pts[0],
          // which could be the far end of a long ramal and point the connector the wrong way.
          const distToFirst = Math.hypot(targetRamal.pts[0][0] - b.x, targetRamal.pts[0][1] - b.y);
          const distToLast = Math.hypot(
            targetRamal.pts[targetRamal.pts.length - 1][0] - b.x,
            targetRamal.pts[targetRamal.pts.length - 1][1] - b.y,
          );
          targetPt =
            distToFirst <= distToLast
              ? targetRamal.pts[0]
              : targetRamal.pts[targetRamal.pts.length - 1];
          targetPlanNivel = targetRamal.planNivel;
        } else if (targetBajante) {
          targetPt = [targetBajante.x, targetBajante.y];
          targetPlanNivel = targetBajante.planNivel;
        }
        // When the target is a real bajante, the WHOLE segment — both ends, not just the one at
        // the target's own floor — is projected using the target bajante's own (x,y). That makes
        // the connector a single straight vertical run (one x,y throughout, only z differs),
        // landing exactly on the target bajante's own drawn position regardless of any offset in
        // the source's raw plan coordinates (a Ldesvio deviation, or simply two independently
        // drawn floors) — the isometric riser is meant to show connectivity, not the source's
        // real, incidental 2D routing detail.
        const hasBajanteTarget = !!targetBajante && targetPt != null && targetPlanNivel !== null;

        const baseZ_pix = getZPix(baseZ, b.planNivel);
        const cimaZ_pix = getZPix(cimaZ, b.planNivel);
        const ownIso = getIsoCoords(b.x, b.y, b.planNivel);
        // getIsoCoords converts raw plan-pixel coordinates to real-world iso position using
        // THAT FLOOR's OWN scale/origen calibration (each PDF plan is calibrated independently
        // — see IsometriaTab.tsx's getIsoCoords). Re-interpreting the target's raw px under the
        // SOURCE floor's calibration (as this used to do for whichever end sat at the source's
        // own z) silently applied the wrong scale/origin to that end, bending an otherwise
        // straight vertical run into a diagonal even when both bajantes sit at the exact same
        // drawn position on their own respective floors. Both ends must resolve through the
        // TARGET's own calibration — only Z (baseZ_pix/cimaZ_pix, computed per-floor separately
        // above) is meant to differ between the two ends.
        const targetIso =
          hasBajanteTarget && targetPt && targetPlanNivel !== null
            ? getIsoCoords(targetPt[0], targetPt[1], targetPlanNivel)
            : null;
        const baseIso = !hasBajanteTarget ? ownIso : targetIso!;
        const cimaIso = !hasBajanteTarget ? ownIso : targetIso!;
        const pBase = project(
          baseIso.x,
          baseIso.y,
          baseZ_pix,
          rotZ,
          rotX,
          scaleZ,
          zoom,
          offX,
          offY,
          cx,
          cy,
        );
        const pCima = project(
          cimaIso.x,
          cimaIso.y,
          cimaZ_pix,
          rotZ,
          rotX,
          scaleZ,
          zoom,
          offX,
          offY,
          cx,
          cy,
        );
        const selKey = `${netId}:${b.planId}:${b.id}`;
        const isSel = selKey === selTramo;

        ctx.beginPath();
        ctx.moveTo(pBase.sx, pBase.sy);
        ctx.lineTo(pCima.sx, pCima.sy);
        ctx.strokeStyle = isSel ? '#FFEB3B' : netColor;
        ctx.lineWidth = isSel ? 3.5 : 2;
        ctx.stroke();

        // Circle + direction indicator at floor level (pBase for sube, pCima for baja)
        const isSubeDir = b.direccion === 'sube' || b.tipo === 'montante';
        const floorPt = isSubeDir ? pBase : pCima;
        const circR = 6 * zoom;
        ctx.save();
        ctx.strokeStyle = netColor;
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#14161a';
        ctx.beginPath();
        ctx.arc(floorPt.sx, floorPt.sy, circR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Direction triangle inside circle
        ctx.fillStyle = netColor;
        ctx.beginPath();
        const triS = circR * 0.5;
        const dirY = isSubeDir ? -1 : 1;
        ctx.moveTo(floorPt.sx, floorPt.sy + dirY * triS);
        ctx.lineTo(floorPt.sx - triS, floorPt.sy - dirY * triS * 0.3);
        ctx.lineTo(floorPt.sx + triS, floorPt.sy - dirY * triS * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        segments.push({
          sx1: pBase.sx,
          sy1: pBase.sy,
          sx2: pCima.sx,
          sy2: pCima.sy,
          z: (baseZ_pix + cimaZ_pix) / 2,
          id: selKey,
          label: b.code || b.id,
          isBaj: true,
          netId,
        });

        if (targetPt && targetPlanNivel !== null && !targetBajante) {
          const rIso = getIsoCoords(targetPt[0], targetPt[1], targetPlanNivel);
          const rZ_pix = getZPix(targetZ - profB * 1000, targetPlanNivel);
          const rProj = project(
            rIso.x,
            rIso.y,
            rZ_pix,
            rotZ,
            rotX,
            scaleZ,
            zoom,
            offX,
            offY,
            cx,
            cy,
          );
          const connectionPoint = targetZ === lo ? pBase : pCima;
          const dConn = Math.hypot(rProj.sx - connectionPoint.sx, rProj.sy - connectionPoint.sy);
          if (dConn > 2) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(connectionPoint.sx, connectionPoint.sy);
            ctx.lineTo(rProj.sx, rProj.sy);
            ctx.strokeStyle = '#0ECC7A';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
          }
        }

        if (isSel) {
          const mid = { sx: (pBase.sx + pCima.sx) / 2, sy: (pBase.sy + pCima.sy) / 2 };
          const dInches = b.dNominal ? Math.round(Number(b.dNominal) / 25.4) : 0;
          const lbl1 = dInches > 0 ? `${b.code || b.id}:${dInches}"` : `${b.code || b.id}`;
          const dirText = b.direccion === 'sube' ? 'Sube' : b.direccion === 'baja' ? 'Baja' : '';
          ctx.fillStyle = '#FFEB3B';
          ctx.font = 'bold 11px Geist,monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(lbl1, mid.sx, mid.sy - 8);
          if (dirText) {
            ctx.font = '10px Geist,monospace';
            ctx.fillText(dirText, mid.sx, mid.sy - 8 + 13);
          }
        }
      }
    }

    // Axis indicator (bottom-left)
    const axCx = 50,
      axCy = H - 50;
    const axLen = 25;
    const axisColors = ['#ff4444', '#44ff44', '#4488ff'];
    const axisLabels = ['X', 'Y', 'Z'];
    const axisDirs: [number, number, number][] = [
      [axLen, 0, 0],
      [0, axLen, 0],
      [0, 0, axLen],
    ];
    for (let i = 0; i < 3; i++) {
      const from = project(
        0,
        0,
        0,
        rotZ,
        rotX,
        scaleZ,
        zoom,
        offX - cx + axCx,
        offY - cy + axCy,
        0,
        0,
      );
      const to = project(
        axisDirs[i][0],
        axisDirs[i][1],
        axisDirs[i][2],
        rotZ,
        rotX,
        scaleZ,
        zoom,
        offX - cx + axCx,
        offY - cy + axCy,
        0,
        0,
      );
      ctx.beginPath();
      ctx.moveTo(from.sx, from.sy);
      ctx.lineTo(to.sx, to.sy);
      ctx.strokeStyle = axisColors[i];
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = axisColors[i];
      ctx.font = 'bold 10px Geist,monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(axisLabels[i], to.sx, to.sy - 3);
    }
    ctx.fillStyle = '#5a6a6b';
    ctx.font = '9px Geist,monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${rotX}°/${rotZ}° z${scaleZ.toFixed(1)}`, 6, 6);

    // Store segments for hit testing
    canvas.__isoSegments = segments;
    canvas.__isoCx = W / 2;
    canvas.__isoCy = H / 2;
  }, [
    canvasRef,
    planImagesRef,
    dataByNet,
    activeNets,
    profByNet,
    nptMap,
    pisos,
    rotZ,
    rotX,
    scaleZ,
    zoom,
    offX,
    offY,
    size,
    selTramo,
    showPlanos,
    confirmedPlanos,
    renderTick,
    getIsoCoords,
    getZPix,
  ]);
}
