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

/** Vectores unitarios ortográficos en espacio de pantalla para los ejes del mundo en un punto iso
 *  dado — cada paso equivale a UN METRO MUNDIAL (ISO_SCALE unidades iso), de modo que el código
 *  que lo invoca puede dimensionar elementos directamente en metros. */
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
 * Dibuja un cuboide isométrico SÓLIDO (las 6 caras, ordenadas por profundidad de pintado) con su
 * base centrada en (bx, by, z), huella w x d y altura h — dimensiones en metros mundiales. Se usa
 * para los equipos calentador/contador, para que se lean como equipos 3D cerrados.
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
  // Las 6 caras; ordenadas por pintado según el promedio de y en pantalla (en esta proyección
  // ortográfica una cara más abajo en pantalla queda al frente — ver project(): sy mayor = más
  // cerca de la cámara), de modo que las caras traseras quedan cubiertas por las delanteras sin
  // importar rotZ/rotX — la caja siempre se lee como cerrada/sólida.
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

    // Dibuja los planos como láminas de fondo semitransparentes
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

    // Los canales se dibujan PRIMERO, en un pase propio ANTES de todas las redes: la cara blanca
    // opaca de la canaleta taparía cualquier bajante dibujado después del pase de su red
    // (ac/af/gas van antes que ll en el orden alfabético de redes, y un bajante de esas redes
    // puede quedar dentro del canal). Así, cualquier bajante/ramal que caiga dentro del canal se
    // dibuja encima — igual que en el plano, donde el rectángulo del canal es el fondo.
    const projPtCanal = (px: number, py: number, pz: number) =>
      project(px, py, pz, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
    for (const [netId, netData] of Object.entries(dataByNet)) {
      if (!activeNets.has(netId)) continue;
      const netColorCanal = NETS.find((n) => n.id === netId)?.col || '#888';
      const profCanal = profByNet[netId] ?? 0;
      for (const b of netData.bajantes) {
        if (b._isCrossFloorGhost || b.tipo !== 'canal') continue;
        const baseM = (b.base || 0) / 100;
        const altM = (b.altura || 0) / 100;
        const longM = (b.longitud || 0) / 100;
        if (longM <= 0.001 || baseM <= 0.001 || altM <= 0.001) continue;
        const selKey = `${netId}:${b.planId}:${b.id}`;
        const isSel = selKey === selTramo;
        const hl = isSel ? '#FFEB3B' : netColorCanal;
        const zC = (nptMap[b.planNivel] || 0) - profCanal * 1000;
        const zPixC = getZPix(zC, b.planNivel);
        const iso0 = getIsoCoords(b.x, b.y, b.planNivel);
        // Esquinas superiores del rectángulo de abertura (símbolo en planta)
        const pA = projPtCanal(iso0.x, iso0.y, zPixC);
        const pB = projPtCanal(iso0.x + longM * ISO_SCALE, iso0.y, zPixC);
        const pC = projPtCanal(iso0.x + longM * ISO_SCALE, iso0.y + baseM * ISO_SCALE, zPixC);
        const pD = projPtCanal(iso0.x, iso0.y + baseM * ISO_SCALE, zPixC);
        // Altura de pared (editable)
        const wall = altM;
        const bottomZ = zPixC + wall * ISO_SCALE;
        // Vértices del corte escalonado (muesca en el extremo izquierdo, sobre la pared trasera)
        // La muesca rebaja el borde superior de la pared trasera (lateral del canal) en el
        // extremo izquierdo: ocupa el 30% del ancho de la base y baja al 50% de la altura de
        // pared. Crea una cara escalonada vertical en ángulo recto visible desde el lateral.
        const notchH = wall * 0.25 * ISO_SCALE; // profundidad de la muesca EXTERIOR (somera, 25%)
        const notchZ = zPixC + notchH; // nivel del escalón
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = hl;
        ctx.lineWidth = 1.2;
        const quad = (a: IsoPt, b2: IsoPt, c2: IsoPt, d2: IsoPt) => {
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b2.sx, b2.sy);
          ctx.lineTo(c2.sx, c2.sy);
          ctx.lineTo(d2.sx, d2.sy);
          ctx.closePath();
        };
        // Perfil hueco rectangular SIN TAPA con muesca escalonada en ángulo recto por ABAJO:
        //   - Pared trasera: flotante — la muesca le quita el tramo inferior (zB..zM) a lo largo
        //     de TODO el canal, dejando solo la mitad superior (zM..zT)
        //   - Cara del escalón: vertical en ángulo recto que sube desde el piso hasta la base de
        //     la pared trasera flotante, a todo lo largo (el corte visible desde los laterales)
        //   - Pared delantera y piso completos
        ctx.fillStyle = hexA(netColorCanal, 0.18);
        const pN = (px: number, py: number, pz: number) => projPtCanal(px, py, pz);
        const xL = iso0.x;
        const xR = iso0.x + longM * ISO_SCALE;
        const yB = iso0.y;
        const yF = iso0.y + baseM * ISO_SCALE;
        const zT = zPixC;
        const zM = notchZ; // nivel del escalón
        const zB = bottomZ;
        // Región de las muescas: corren a TODO lo largo del canal (en X). Las muescas se ven como
        // ESCALONES que BAJAN hacia el centro del canal: la muesca exterior (junto a cada pared,
        // 15% del ancho) es somera — se quita POR ABAJO el 25% de la altura (zB..zM) y la pared
        // flota desde ahí; la muesca interior escalonada (10% del ancho, arranca donde termina la
        // exterior) es más profunda — se quita hasta el 75% de la altura (zB..zM2). El piso
        // (nivel zB) queda solo en la franja central.
        const nY = baseM * 0.15 * ISO_SCALE; // ancho de la muesca exterior (somera)
        const nY2 = baseM * 0.1 * ISO_SCALE; // ancho de la muesca interior (profunda)
        const zM2 = zPixC + wall * 0.75 * ISO_SCALE; // nivel del escalón interior (profundo, 75%)
        const yB2 = yB + nY; // extremo interior de la muesca trasera exterior
        const yB3 = yB + nY + nY2; // extremo interior de la muesca trasera interior
        const yF2 = yF - nY; // extremo interior de la muesca delantera exterior
        const yF3 = yF - nY - nY2; // extremo interior de la muesca delantera interior

        // Piso (base inferior) — solo la franja central fuera de las muescas
        quad(pN(xL, yB3, zB), pN(xR, yB3, zB), pN(xR, yF3, zB), pN(xL, yF3, zB));
        ctx.fill();
        ctx.stroke();

        // Pared trasera — flotante: solo la mitad superior (zM..zT), a todo lo largo del canal
        quad(pN(xL, yB, zM), pN(xR, yB, zM), pN(xR, yB, zT), pN(xL, yB, zT));
        ctx.fill();
        ctx.stroke();
        // Superficie del escalón trasero exterior (horizontal, techo de la muesca, zM)
        quad(pN(xL, yB, zM), pN(xR, yB, zM), pN(xR, yB2, zM), pN(xL, yB2, zM));
        ctx.fill();
        ctx.stroke();
        // Pared vertical del escalón trasero (entre el nivel zM y el nivel zM2, en yB2)
        quad(pN(xL, yB2, zM2), pN(xR, yB2, zM2), pN(xR, yB2, zM), pN(xL, yB2, zM));
        ctx.fill();
        ctx.stroke();
        // Superficie del escalón trasero interior (horizontal, techo de la muesca interior, zM2)
        quad(pN(xL, yB2, zM2), pN(xR, yB2, zM2), pN(xR, yB3, zM2), pN(xL, yB3, zM2));
        ctx.fill();
        ctx.stroke();
        // Cara del escalón trasero interior (del piso zB al nivel zM2, en yB3)
        quad(pN(xL, yB3, zB), pN(xR, yB3, zB), pN(xR, yB3, zM2), pN(xL, yB3, zM2));
        ctx.fill();
        ctx.stroke();

        // Pared delantera — flotante (espejo de la trasera): solo la mitad superior (zM..zT)
        quad(pN(xL, yF, zM), pN(xR, yF, zM), pN(xR, yF, zT), pN(xL, yF, zT));
        ctx.fill();
        ctx.stroke();
        // Superficie del escalón delantero exterior (zM)
        quad(pN(xL, yF2, zM), pN(xR, yF2, zM), pN(xR, yF, zM), pN(xL, yF, zM));
        ctx.fill();
        ctx.stroke();
        // Pared vertical del escalón delantero (entre zM y zM2, en yF2)
        quad(pN(xL, yF2, zM2), pN(xR, yF2, zM2), pN(xR, yF2, zM), pN(xL, yF2, zM));
        ctx.fill();
        ctx.stroke();
        // Superficie del escalón delantero interior (zM2)
        quad(pN(xL, yF3, zM2), pN(xR, yF3, zM2), pN(xR, yF2, zM2), pN(xL, yF2, zM2));
        ctx.fill();
        ctx.stroke();
        // Cara del escalón delantero interior (del piso zB al nivel zM2, en yF3)
        quad(pN(xL, yF3, zB), pN(xR, yF3, zB), pN(xR, yF3, zM2), pN(xL, yF3, zM2));
        ctx.fill();
        ctx.stroke();

        // Cara del extremo izquierdo (perfil escalonado con las muescas por abajo) — wireframe
        ctx.beginPath();
        ctx.moveTo(pN(xL, yB, zM).sx, pN(xL, yB, zM).sy);
        ctx.lineTo(pN(xL, yB, zT).sx, pN(xL, yB, zT).sy);
        ctx.lineTo(pN(xL, yF, zT).sx, pN(xL, yF, zT).sy);
        ctx.lineTo(pN(xL, yF, zM).sx, pN(xL, yF, zM).sy);
        ctx.lineTo(pN(xL, yF2, zM).sx, pN(xL, yF2, zM).sy);
        ctx.lineTo(pN(xL, yF2, zM2).sx, pN(xL, yF2, zM2).sy);
        ctx.lineTo(pN(xL, yF3, zM2).sx, pN(xL, yF3, zM2).sy);
        ctx.lineTo(pN(xL, yF3, zB).sx, pN(xL, yF3, zB).sy);
        ctx.lineTo(pN(xL, yB3, zB).sx, pN(xL, yB3, zB).sy);
        ctx.lineTo(pN(xL, yB3, zM2).sx, pN(xL, yB3, zM2).sy);
        ctx.lineTo(pN(xL, yB2, zM2).sx, pN(xL, yB2, zM2).sy);
        ctx.lineTo(pN(xL, yB2, zM).sx, pN(xL, yB2, zM).sy);
        ctx.closePath();
        ctx.stroke();

        // Cara del extremo derecho (perfil escalonado, espejo) — wireframe
        ctx.beginPath();
        ctx.moveTo(pN(xR, yB, zM).sx, pN(xR, yB, zM).sy);
        ctx.lineTo(pN(xR, yB, zT).sx, pN(xR, yB, zT).sy);
        ctx.lineTo(pN(xR, yF, zT).sx, pN(xR, yF, zT).sy);
        ctx.lineTo(pN(xR, yF, zM).sx, pN(xR, yF, zM).sy);
        ctx.lineTo(pN(xR, yF2, zM).sx, pN(xR, yF2, zM).sy);
        ctx.lineTo(pN(xR, yF2, zM2).sx, pN(xR, yF2, zM2).sy);
        ctx.lineTo(pN(xR, yF3, zM2).sx, pN(xR, yF3, zM2).sy);
        ctx.lineTo(pN(xR, yF3, zB).sx, pN(xR, yF3, zB).sy);
        ctx.lineTo(pN(xR, yB3, zB).sx, pN(xR, yB3, zB).sy);
        ctx.lineTo(pN(xR, yB3, zM2).sx, pN(xR, yB3, zM2).sy);
        ctx.lineTo(pN(xR, yB2, zM2).sx, pN(xR, yB2, zM2).sy);
        ctx.lineTo(pN(xR, yB2, zM).sx, pN(xR, yB2, zM).sy);
        ctx.closePath();
        ctx.stroke();

        // Abertura superior (borde del perfil hueco, sin relleno) — contorno fino
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexA(netColorCanal, 0.9);
        quad(pA, pB, pC, pD);
        ctx.stroke();
        if (isSel) {
          // Seleccionado: contorno amarillo más grueso en la cara de apertura + etiqueta de
          // código encima
          ctx.lineWidth = 2.5;
          quad(pA, pB, pC, pD);
          ctx.stroke();
          const rectCenter = projPtCanal(
            iso0.x + (longM * ISO_SCALE) / 2,
            iso0.y + (baseM * ISO_SCALE) / 2,
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
    }

    // Dibuja cada red activa
    for (const [netId, netData] of Object.entries(dataByNet)) {
      if (!activeNets.has(netId)) continue;
      const netColor = NETS.find((n) => n.id === netId)?.col || '#888';
      const prof = profByNet[netId] ?? 0;

      ctx.strokeStyle = netColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      const projPt = (px: number, py: number, pz: number) =>
        project(px, py, pz, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy);
      for (const r of netData.ramales) {
        // `prof` (Parámetros de Diseño > Materiales por red > "Profundidad de instalación
        // respecto a NPT") se guarda NEGATIVO para instalaciones bajo losa (p. ej. sanitaria
        // -0.70). En esta proyección un z MÁS POSITIVO se renderiza MÁS ABAJO en pantalla (ver
        // project() en geometry.ts: y2 crece con z en el rotX=-45° por defecto), por lo que una
        // profundidad negativa debe RESTARSE para empujar el trazo hacia abajo — sumarla (el
        // comportamiento anterior) empujaba los trazos hacia arriba.
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
        // Un CrossFloorGhost solo se consulta como referencia (a qué bajante real se conecta este
        // origen y en qué piso) — ver las llamadas a `netData.bajantes.find` más abajo. Ya no
        // necesita representación visual propia: el conector real origen→destino ahora se ancla
        // directamente sobre la posición del bajante destino real, así que dibujar aquí el stub
        // de un solo piso del ghost solo dejaba un segmento de bajante huérfano en las coordenadas
        // del ghost (= las crudas del origen), sin conectar con nada.
        if (b._isCrossFloorGhost) continue;

        // Calentador/contador se renderizan como cajas de equipo 3D en el piso, en lugar de un
        // stub de bajante.
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

        // Los canales ya se dibujaron en la pasada de fondo anterior.
        if (b.tipo === 'canal') continue;

        const profB = profByNet[b.net] ?? 0;
        const currentZ = nptMap[b.planNivel] || 0;
        let targetZ = currentZ;

        // Resuelve el bajante destino REAL para una asociación bajante-a-bajante a través de su
        // CrossFloorGhost (applyBajanteAssociation siempre crea uno, en el propio piso del
        // destino, registrando ghost.targetBajanteId) — el (x,y) PROPIO del ghost refleja las
        // coordenadas crudas del ORIGEN y aquí solo sirve para localizar a qué piso/bajante
        // apunta, nunca como ancla del conector: los dos extremos de abajo se fuerzan sobre el
        // (x,y) del bajante destino REAL, produciendo un recorrido vertical único y recto (mismo
        // x,y en todo el tramo, solo cambia z) que cae exactamente sobre la posición dibujada del
        // destino, como debe leerse un diagrama de bajante sin importar el desfase incidental en
        // las coordenadas crudas del plano de origen. Los bajantes `_isCrossFloorGhost` nunca
        // resuelven aquí su propio descargaEnId inverso — eso dibujaría esta misma conexión una
        // segunda vez, desde el otro extremo.
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
            // Respaldo defensivo para datos incompletos/desactualizados que no tienen ghost.
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
        // nptMap usa z NEGATIVO para los pisos (P1=-2700, P2=-5400...) y la proyección renderiza
        // un z más negativo MÁS ARRIBA en pantalla. Por eso el stub de una bajante sin destino
        // debe extenderse hacia el z MÁS NEGATIVO (SUBE = hacia arriba) y hacia el menos negativo
        // (BAJA = hacia abajo). El signo anterior estaba invertido: dibujaba la bajante sube
        // colgando hacia abajo y la baja hacia arriba. Misma corrección de signo que en el z del
        // ramal: profB es negativo para bajo losa, por lo que se resta.
        const baseZ = (lo === hi ? (isSube ? lo : lo + 1000) : lo) - profB * 1000;
        const cimaZ = (lo === hi ? (isSube ? lo - 1000 : lo) : hi) - profB * 1000;

        let targetPt: number[] | null = null;
        let targetPlanNivel: number | null = null;
        if (targetRamal && targetRamal.pts.length > 0) {
          // Extremo del ramal destino más cercano al (x,y) propio de la bajante — no siempre es
          // pts[0], que podría ser el extremo lejano de un ramal largo y orientar mal el conector.
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
        // Cuando el destino es una bajante real, TODO el segmento — ambos extremos, no solo el
        // del piso propio del destino — se proyecta con el (x,y) de la bajante destino. Eso hace
        // del conector un único recorrido vertical recto (un solo x,y en todo el tramo, solo
        // cambia z), que cae exactamente sobre la posición dibujada del destino sin importar el
        // desfase en las coordenadas crudas del plano de origen (una desviación Ldesvio, o
        // simplemente dos pisos dibujados por separado) — la bajante isométrica debe mostrar
        // conectividad, no el detalle real e incidental del recorrido 2D del origen.
        const hasBajanteTarget = !!targetBajante && targetPt != null && targetPlanNivel !== null;

        const baseZ_pix = getZPix(baseZ, b.planNivel);
        const cimaZ_pix = getZPix(cimaZ, b.planNivel);
        const ownIso = getIsoCoords(b.x, b.y, b.planNivel);
        // getIsoCoords convierte las coordenadas crudas en píxeles de plano a posición iso del
        // mundo real usando la calibración de escala/origen PROPIA DE ESE PISO (cada PDF de plano
        // se calibra de forma independiente — ver getIsoCoords en IsometriaTab.tsx). Reinterpretar
        // los px crudos del destino bajo la calibración del piso del ORIGEN (como se hacía antes
        // para el extremo que quedaba en el z propio del origen) aplicaba silenciosamente la
        // escala/origen equivocada a ese extremo, torciendo un recorrido vertical recto en una
        // diagonal aunque ambas bajantes estuvieran exactamente en la misma posición dibujada en
        // sus respectivos pisos. Ambos extremos deben resolverse con la calibración del DESTINO —
        // solo Z (baseZ_pix/cimaZ_pix, calculados por piso por separado arriba) debe diferir entre
        // los dos extremos.
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

        // Círculo + indicador de dirección en el PISO PROPIO de la bajante (currentZ), no en el
        // extremo del destino ni en el del stub: para una bajante SUBE es el extremo inferior del
        // recorrido y para una BAJA el superior, y con ghost/destino en otro piso el símbolo
        // sigue presidiendo su propio piso (el círculo se desliza por la línea del conector hasta
        // la altura de currentZ).
        const floorZ_pix = getZPix(currentZ - profB * 1000, b.planNivel);
        const floorIso = targetIso ?? ownIso;
        const floorPt = project(
          floorIso.x,
          floorIso.y,
          floorZ_pix,
          rotZ,
          rotX,
          scaleZ,
          zoom,
          offX,
          offY,
          cx,
          cy,
        );
        const circR = 6 * zoom;
        ctx.save();
        ctx.strokeStyle = netColor;
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#14161a';
        ctx.beginPath();
        ctx.arc(floorPt.sx, floorPt.sy, circR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Triángulo de dirección dentro del círculo
        ctx.fillStyle = netColor;
        ctx.beginPath();
        const triS = circR * 0.5;
        const isSubeDir = b.direccion === 'sube' || b.tipo === 'montante';
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

    // Indicador de ejes (esquina inferior izquierda)
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

    // Guarda los segmentos para la prueba de aciertos (hit testing)
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
