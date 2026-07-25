import { NETS } from '../PlanoState';
import { rotatedRectCorners } from '../HitTester';
import type { IPlanoEngineCore } from '../PlanoState';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { parseDescargaEnId } from '../../../utils/parseDescargaEnId';
import { pisoCortoLoose as getPisoCorto } from '../../../constants';
import { TRAZOS_PREFIX } from '../../../constants/storage-keys';
import type { PlanoBajante } from '../PlanoState';

const DIR_MAP: Record<string, string> = { sube: 'Sube', baja: 'Baja', continua: 'Continua' };

function renderBajanteLabel(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  b: PlanoBajante,
  c: { x: number; y: number },
  r: number,
  angle: number,
  offDx: number,
  offDy: number,
  line1: string,
  dirText: string,
  labelBoxProp: '_labelBox' | '_ghostLabelBox',
  alpha: number,
): void {
  const hasDir = !!dirText;

  const labelSizeMul = b.tipo === 'contador' || b.tipo === 'calentador' ? 0.75 : 1;
  // Bajante/montante code label uses the exact same size formula as a ramal's own name label
  // (renderRamales.ts fsName/fsInfo) so the two read as objectively equal in size.
  const fsCode = engine.mm2cvs(engine.MM.lblName * engine.labelScaleM * labelSizeMul);
  const fsDir = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * labelSizeMul);
  const lineH = fsCode + 2;

  ctx.save();
  ctx.font = `bold ${fsCode}px Geist, monospace`;
  const tw1 = ctx.measureText(line1).width;
  const boxW = tw1 + engine.mm2cvs(4);
  const boxH = hasDir ? lineH + 2 + fsDir + engine.mm2cvs(1.5) : lineH + engine.mm2cvs(1);
  const hh2 = boxH / 2;

  const intersection = getLabelIntersection(offDx, offDy, boxW, boxH, angle);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(c.x, c.y);

  const distToLabel = Math.hypot(offDx, offDy);
  let lineStartX = 0,
    lineStartY = 0;
  if (distToLabel > 0.1) {
    const ux = offDx / distToLabel,
      uy = offDy / distToLabel;
    lineStartX = r * ux;
    lineStartY = r * uy;
  }
  ctx.beginPath();
  ctx.moveTo(lineStartX, lineStartY);
  ctx.lineTo(intersection.x, intersection.y);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.8 * engine.zoom;
  ctx.stroke();

  ctx.translate(offDx, offDy);
  ctx.rotate(angle);

  const lbCx = c.x + offDx;
  const lbCy = c.y + offDy;
  const {
    corners: corners2,
    minX,
    minY,
    maxX,
    maxY,
  } = rotatedRectCorners(lbCx, lbCy - 10 + hh2, boxW, boxH, angle, 2);
  b[labelBoxProp] = {
    cx: lbCx,
    cy: lbCy - 10 + hh2,
    w: boxW,
    h: boxH,
    angle,
    minX,
    minY,
    maxX,
    maxY,
    corners: corners2,
  };

  // Deliberately no fill here anymore — labels used to sit on a solid white plate; now they read
  // directly over whatever's underneath (transparent background), per explicit request.
  ctx.beginPath();
  ctx.roundRect(-boxW / 2, -10, boxW, boxH, 0);

  if (b.tipo === 'contador' || b.tipo === 'calentador') {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8 * engine.zoom;
    ctx.stroke();
  }

  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(line1, 0, -10 + engine.mm2cvs(0.5));

  if (dirText) {
    ctx.font = `${fsDir}px Geist, monospace`;
    ctx.fillStyle = '#000';
    ctx.fillText(dirText, 0, -10 + lineH + engine.mm2cvs(1));
  }
  ctx.restore();
  ctx.restore();
}

function getLabelIntersection(
  offDx: number,
  offDy: number,
  boxW: number,
  boxH: number,
  angle: number,
): { x: number; y: number } {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const localStartX = -offDx * cosA - offDy * sinA;
  const localStartY = offDx * sinA - offDy * cosA;

  const xMin = -boxW / 2;
  const xMax = boxW / 2;
  const yMin = -10;
  const yMax = -10 + boxH;

  let tEnter = 0;

  if (localStartX !== 0) {
    const t1 = 1 - xMin / localStartX;
    const t2 = 1 - xMax / localStartX;
    const tMin = Math.min(t1, t2);
    tEnter = Math.max(tEnter, tMin);
  }

  if (localStartY !== 0) {
    const t1 = 1 - yMin / localStartY;
    const t2 = 1 - yMax / localStartY;
    const tMin = Math.min(t1, t2);
    tEnter = Math.max(tEnter, tMin);
  }

  tEnter = Math.max(0, Math.min(1, tEnter));

  const localIntersectX = localStartX * (1 - tEnter);
  const localIntersectY = localStartY * (1 - tEnter);

  const intersectDx = localIntersectX * cosA - localIntersectY * sinA + offDx;
  const intersectDy = localIntersectX * sinA + localIntersectY * cosA + offDy;

  return { x: intersectDx, y: intersectDy };
}

interface OtherFloorBajante {
  planId: string;
  id: string;
  code?: string;
  x: number;
  y: number;
  descargaEnId?: string;
  net?: string;
}

// Read every OTHER floor's persisted bajantes once so the render pass below can draw vertical
// alignment guides to cross-floor associated stacks. Floors share one plane coordinate space (the
// isometry stacks them on it), so toCvs maps an other-floor (x,y) to the correct on-screen spot.
function collectOtherFloorBajantes(engine: IPlanoEngineCore): OtherFloorBajante[] {
  const out: OtherFloorBajante[] = [];
  try {
    // Must match the prefix trazos are actually SAVED under (usePdfAutoSave.ts) — this used to
    // read the old 'civilflow_trazos_' key, which nothing writes to anymore, so cross-floor
    // bajante data here was always stale or empty: other floors' entries in the "Destino"
    // dropdown came and went based on leftover legacy data, and the alignment guide line never
    // saw a freshly-aligned position, so it never shrank away.
    const curKey = TRAZOS_PREFIX + String(engine._loadedPlanId);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(TRAZOS_PREFIX) || k === curKey) continue;
      const planId = k.slice(TRAZOS_PREFIX.length);
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      let data: { bajantes?: OtherFloorBajante[] };
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      for (const ob of data.bajantes || []) {
        if (ob.x == null || ob.y == null) continue;
        out.push({
          planId,
          id: ob.id,
          code: ob.code,
          x: ob.x,
          y: ob.y,
          descargaEnId: ob.descargaEnId,
          net: ob.net,
        });
      }
    }
  } catch {
    /* localStorage unavailable */
  }
  return out;
}

// Shared by the parent bajante's own circle AND its ghost — draws the interior direction glyph
// (arrow up/down, dot, or "continua" arrow) the exact same vector-drawn way in both places.
// Previously the ghost used unicode text glyphs (⬇/•/➜) filled with the net color instead of
// this vector shape in arrowCol (red for bajante, blue for montante), so it never actually looked
// like its parent despite the size/opacity already matching. Caller must already have translated
// ctx to the symbol's local origin (0,0) and rotated as needed.
function drawDireccionSymbol(
  ctx: CanvasRenderingContext2D,
  tipo: string,
  r: number,
  direccion: string | undefined,
): void {
  const arrowCol = tipo === 'bajante' ? '#F04545' : '#3B82F6';
  if (direccion === 'sube') {
    ctx.fillStyle = arrowCol;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (direccion === 'baja') {
    const aS = r * 0.7;
    ctx.strokeStyle = arrowCol;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, -aS * 0.9);
    ctx.lineTo(0, aS * 0.5);
    ctx.stroke();
    ctx.fillStyle = arrowCol;
    ctx.beginPath();
    ctx.moveTo(0, aS * 0.9);
    ctx.lineTo(-aS * 0.4, aS * 0.3);
    ctx.lineTo(aS * 0.4, aS * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (direccion === 'continua') {
    ctx.fillStyle = arrowCol;
    ctx.font = `${r * 1.1}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('➜', 0, 0);
  } else {
    // No direction resolved: default fallback arrow, down for bajante / up for montante.
    const aS = r * 0.7;
    ctx.strokeStyle = arrowCol;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    if (tipo === 'bajante') {
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(0, aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(-aS * 0.4, aS * 0.3);
      ctx.lineTo(aS * 0.4, aS * 0.3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(0, -aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(-aS * 0.4, -aS * 0.3);
      ctx.lineTo(aS * 0.4, -aS * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function renderBajantes(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const otherFloorBajantes = collectOtherFloorBajantes(engine);
  const curPlan = String(engine._loadedPlanId);

  engine.bajantes.forEach((b) => {
    if (engine._hiddenNets.has(b.net)) return;

    // A bajante only gets its solid circle on ITS OWN floor (pisoBase). A displacement entry
    // for the current level doesn't mean anything about which floor it belongs to — it's also
    // how ghosts get positioned on remote floors — so it must never suppress the ghost check.
    const isDirectionGhost = b.pisoBase !== engine.nivelActual?.label;

    const c = engine.toCvs(b.x, b.y);
    // When this bajante is a remote-floor ghost, never draw the thick yellow selection border.
    const sel = b.id === engine.selId && !engine._isGhostSel && !isDirectionGhost;
    // realMmToCanvasPx floors at 1mm paper (see PlanoEngine.ts) — at common architectural
    // scales a 20mm or 10mm real radius both land on that floor and render identically, so
    // halving the mm argument alone is invisible. Halve the resulting px value instead.
    const r = engine.realMmToCanvasPx(20) * 0.6;

    // Item 2: Label angle + snap constraint (Auto-rotation removed as requested)
    const angle = ((b.labelAngle || 0) * Math.PI) / 180;

    b._circ = { x: c.x, y: c.y, r };
    if (isDirectionGhost) return;

    // Vertical-alignment guide: dashed net-color line to the position of any cross-floor bajante
    // this one is explicitly associated with (via descargaEnId, in either direction). Lets the
    // designer slide this floor's bajante until it sits vertically over the other floor's — the
    // line shrinks to nothing once they're aligned.
    if (otherFloorBajantes.length) {
      const netObj = NETS.find((n) => n.id === b.net);
      const guideCol = netObj ? netObj.col : '#e2e2e8';
      const targets: { x: number; y: number }[] = [];
      // forward: this bajante discharges into an element on another floor
      if (b.descargaEnId) {
        const [tp, tid] = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
        if (String(tp) !== curPlan) {
          const t = otherFloorBajantes.find(
            (o) => String(o.planId) === String(tp) && (o.id === tid || o.code === tid),
          );
          if (t) targets.push({ x: Number(t.x), y: Number(t.y) });
        }
      }
      // reverse: a bajante on another floor discharges into this one. `net` is only used as a
      // secondary filter when present on both sides — some persisted records predate that field,
      // and requiring an exact match there silently dropped otherwise-valid matches.
      for (const o of otherFloorBajantes) {
        if (!o.descargaEnId) continue;
        if (o.net && b.net && o.net !== b.net) continue;
        const [tp, tid] = parseDescargaEnId(o.descargaEnId, o.planId);
        if (String(tp) === curPlan && (tid === b.id || (b.code && tid === b.code)))
          targets.push({ x: Number(o.x), y: Number(o.y) });
      }
      for (const t of targets) {
        if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
        const oc = engine.toCvs(t.x, t.y);
        // Fixed screen-pixel tolerance (both oc/c are already in canvas space, post-zoom) so the
        // "close enough, guide gone" feel is the same at any zoom level — 1px was pixel-perfect-only
        // and never actually cleared in practice.
        if (Math.hypot(oc.x - c.x, oc.y - c.y) < 6) continue;
        ctx.save();
        ctx.strokeStyle = guideCol;
        // Tenue on purpose — this is a positioning aid, not a real pipe run, so it should read
        // clearly weaker than the net's actual solid-line color.
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1 * engine.zoom;
        ctx.setLineDash([6 * engine.zoom, 5 * engine.zoom]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(oc.x, oc.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(oc.x, oc.y, r * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw green dashed lines from ramales that feed this bajante (recibeDeIds) — this is a
    // guide for when the bajante sits AWAY from the ramal (e.g. an offset/ghost position), so
    // skip it whenever the bajante/montante's own point already coincides with ANY point of the
    // ramal (not just its two endpoints): a montante created mid-body (createMontanteMidBody)
    // sits on an INTERIOR vertex, not an endpoint, so comparing only against the closest endpoint
    // never matched and always drew a pointless line back from wherever that endpoint was; same
    // fix also covers a ramal arriving at this bajante's ghost/displaced position on this floor.
    if (b.recibeDeIds?.length) {
      const ghostDisp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const bPos = ghostDisp
        ? { x: b.x + ghostDisp.dx, y: b.y + ghostDisp.dy }
        : { x: b.x, y: b.y };
      b.recibeDeIds.forEach((rid: string) => {
        const ram = engine.ramales.find((rr) => rr.id === rid);
        if (ram && ram.pts.length) {
          const touchesDirectly = ram.pts.some(
            ([px, py]) => Math.hypot(px - bPos.x, py - bPos.y) < 1.5,
          );
          if (touchesDirectly) return;
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(rc.x, rc.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    if (b.descargaEnId) {
      const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
      const targetPlanId = parts[0];
      const targetId = parts[1];

      // Only draw line if the target is on the CURRENT floor
      if (String(targetPlanId) === String(engine._loadedPlanId)) {
        // Draw line to target RAMAL
        const ram = engine.ramales.find((rr) => rr.id === targetId);
        if (ram && ram.pts.length) {
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(rc.x, rc.y);
          ctx.stroke();
          ctx.restore();
        }
        // Draw line to target BAJANTE on same floor
        const targetBaj = engine.bajantes.find((bb) => bb.id === targetId);
        if (targetBaj) {
          const tc = engine.toCvs(targetBaj.x, targetBaj.y);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(tc.x, tc.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#ffffff';
    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#475569';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else if (b.tipo === 'contador' && b.net === 'gas') {
      ctx.fillStyle = '#A855F7';
      const devW = r * 2;
      const devH = r * 2.4;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#A855F7';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.stroke();
      const dispW = devW * 0.6;
      const dispH = devH * 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-dispW / 2, -devH / 2 + devH * 0.12, dispW, dispH, 1 * engine.zoom);
      ctx.fill();
    } else if (b.tipo === 'contador') {
      const netObj = NETS.find((n) => n.id === (b.net === 'gas' ? 'gas' : 'af'));
      const col = netObj ? netObj.col : '#4D8FF7';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (b.tipo === 'calentador') {
      const netObj = NETS.find((n) => n.id === (b.net === 'gas' ? 'gas' : 'ac'));
      const col = netObj ? netObj.col : b.net === 'gas' ? '#A855F7' : '#F04545';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else {
      const netObj = NETS.find((n) => n.id === b.net);
      const col = netObj ? netObj.col : '#e2e2e8';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 1.2 : 0.6) * engine.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RP', 0, 0);
    } else if (b.tipo === 'contador' && b.net === 'gas') {
      // Gas meter: no letter, no pipe segments
    } else if (b.tipo === 'contador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', 0, 0);
    } else if (b.tipo === 'calentador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, 0);
    } else {
      drawDireccionSymbol(ctx, b.tipo, r, b.direccion);
    }

    // Yellow selection arrow (same style as ramales)
    const inMultiSel = (engine.multiSel || []).includes(b.id);
    if ((sel || inMultiSel) && !engine._isGhostSel) {
      const arrowR = 8 * engine.zoom;
      const ox = r + 14 * engine.zoom;
      ctx.save();
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // The parent label is drawn EXCEPT when this is a direction-based ghost on a remote floor
    // (pisoBase !== current nivel means the bajante belongs to another floor) — isDirectionGhost
    // computed above; this whole block is unreachable for that case anyway (early return above).
    if (!isDirectionGhost && (b.code || b.code === '')) {
      const lx = b.labelX ?? b.x;
      const ly = b.labelY ?? b.y + 20;
      const offDx = (lx - b.x) * engine.zoom;
      let offDy = (ly - b.y) * engine.zoom;

      // Item 2: Enforce minimum perpendicular offset so label doesn't sit on the ramal
      const minPerpPx = engine.mm2cvs(3);
      if (Math.abs(offDy) < minPerpPx) {
        offDy = offDy >= 0 ? minPerpPx : -minPerpPx;
      }

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const codeStr =
        (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      let diamStr = '';
      if (b.dNominal && b.dNominal !== '0') {
        const v = String(b.dNominal).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = normalizeDnLabel(v);
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = normalizeDnLabel(v);
          }
        }
      } else if (b.diametro) {
        diamStr = normalizeDnLabel(b.diametro.split(' — ')[0]);
      }
      // Bold big line is just the code — mirrors a ramal's own label, which keeps its bold name
      // line to the short code alone and pushes diametro into the smaller info line below.
      const line1 = codeStr || '—';
      const dirWord = DIR_MAP[b.direccion ?? ''] || '';
      const dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
      renderBajanteLabel(ctx, engine, b, c, r, angle, offDx, offDy, line1, dirText, '_labelBox', 1);
    } else {
      b._labelBox = undefined;
    }
  });
}

export function renderGhosts(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const fg = engine.getBajantesFantasma();
  fg.forEach((b) => {
    const net = NETS.find((n) => n.id === b.net);
    const col = net ? net.col : '#e2e2e8';
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    const gx = b.x + (disp ? disp.dx : 0);
    const gy = b.y + (disp ? disp.dy : 0);
    const c = engine.toCvs(gx, gy);
    // realMmToCanvasPx floors at 1mm paper (see PlanoEngine.ts) — at common architectural
    // scales a 20mm or 10mm real radius both land on that floor and render identically, so
    // halving the mm argument alone is invisible. Halve the resulting px value instead.
    const r = engine.realMmToCanvasPx(20) * 0.6;
    b._ghost = { x: c.x, y: c.y, r };

    // Ghost label always horizontal
    const ghostAngle = 0;

    // Ghost circle: same size, color and full opacity as the parent's own circle (per explicit
    // request — the ghost should look exactly like its parent, size and intensity alike).
    // Exception: a ghost with no real displacement on the parent's OWN floor sits at the exact
    // same (x,y) as the parent, which already draws its own solid circle there — skip the extra
    // ring so it doesn't look like an oversized halo. A ghost created by dragging (dx/dy set)
    // is a different point in space even on the parent's own floor, so it must still be drawn.
    const hasDisplacement = !!disp && (Math.abs(disp.dx) >= 1 || Math.abs(disp.dy) >= 1);
    const isOwnFloorGhost = b.pisoBase === engine.nivelActual?.label && !hasDisplacement;
    if (!isOwnFloorGhost) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      // Must match the parent's own non-selected circle stroke exactly (0.6*zoom, set in the
      // default bajante/montante branch above) — this was 1.5, 2.5x thicker than the parent,
      // which is exactly the "ghost looks thicker" complaint.
      ctx.lineWidth = 0.6 * engine.zoom;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
    let ghostDir = b.direccion;
    if (gd && gd.direccion !== undefined) {
      ghostDir = gd.direccion;
    }
    // Same vector-drawn symbol as the parent's own circle (drawDireccionSymbol), not the old
    // unicode-glyph rendering — that was the actual visual mismatch with the parent.
    const skipSymbol = !ghostDir && !!b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    if (!skipSymbol) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(c.x, c.y);
      drawDireccionSymbol(ctx, b.tipo, r, ghostDir);
      ctx.restore();
    }

    // Item 4: Yellow selection arrow for ghost bajante selection
    const inMultiSel = (engine.multiSel || []).includes(b.id);
    const ghostSel = engine.selId === b.id && engine._isGhostSel;
    if (ghostSel || inMultiSel) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ghostAngle);
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      const arrowR = 8 * engine.zoom;
      const ox = r + 14 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Item 6: Ghost label — render for all ghosts
    if (b.code || b.code === '') {
      const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
      let ghostOffX = 0;
      let ghostOffY = 0;
      if (gd?.labelX != null && gd?.labelY != null) {
        ghostOffX = (gd.labelX - gx) * engine.zoom;
        ghostOffY = (gd.labelY - gy) * engine.zoom;
      } else {
        const distPx = engine.mm2cvs(15);
        ghostOffX = distPx * Math.cos(ghostAngle);
        ghostOffY = distPx * Math.sin(ghostAngle);
      }
      const offDx = ghostOffX;
      const offDy = ghostOffY;

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const codeStr =
        (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      const ghostDir = gd?.direccion || b.direccion;
      const ghostDNom = gd?.dNominal || b.dNominal;
      let diamStr = '';
      if (b.diametro) {
        diamStr = normalizeDnLabel(b.diametro.split(' — ')[0]);
      } else if (ghostDNom && ghostDNom !== '0') {
        const v = String(ghostDNom).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = normalizeDnLabel(v);
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = normalizeDnLabel(v);
          }
        }
      }
      const line1 = codeStr || '—';
      const dirWord = DIR_MAP[ghostDir ?? ''] || '';
      const dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
      renderBajanteLabel(
        ctx,
        engine,
        b,
        c,
        r,
        ghostAngle,
        offDx,
        offDy,
        line1,
        dirText,
        '_ghostLabelBox',
        1,
      );
    }
  });
}

// Cross-floor association ghosts (associateBajanteAcrossFloors.ts) — pure positional reference
// markers written directly into this floor's own `crossFloorGhosts` array, separate from
// `bajantes`. Rendered as a dashed circle (distinct from a same-floor fantasma's solid one) with
// the source bajante's code + inherited diameter, so the connection is visible without needing to
// switch floors.
export function renderCrossFloorGhosts(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
): void {
  (engine.crossFloorGhosts || []).forEach((g) => {
    if (engine._hiddenNets.has(g.net)) return;
    const net = NETS.find((n) => n.id === g.net);
    const col = net ? net.col : '#e2e2e8';
    const c = engine.toCvs(g.x, g.y);
    const r = engine.realMmToCanvasPx(20) * 0.6;
    g._hitCircle = { x: c.x, y: c.y, r };

    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1 * engine.zoom;
    ctx.setLineDash([4 * engine.zoom, 3 * engine.zoom]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const fsCode = engine.mm2cvs(engine.MM.lblName * engine.labelScaleM);
    const fsInfo = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM);
    const codeStr = (g.code || '').replace(/#/g, '').toUpperCase();
    const diamStr = g.dNominal && g.dNominal !== '0' ? normalizeDnLabel(g.dNominal) : '';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = col;
    ctx.font = `bold ${fsCode}px Geist, monospace`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(codeStr, c.x, c.y - r - engine.mm2cvs(1));
    if (diamStr) {
      ctx.font = `${fsInfo}px Geist, monospace`;
      ctx.textBaseline = 'top';
      ctx.fillText(`D=${diamStr}`, c.x, c.y + r + engine.mm2cvs(1));
    }
    ctx.restore();
  });
}
