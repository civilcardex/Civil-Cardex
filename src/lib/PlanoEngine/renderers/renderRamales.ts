import { NETS } from '../PlanoState';
import { snapTributaryToPadre45Deg } from '../PlanoEngineDrawing';
import { rotatedRectCorners } from '../Coords';
import type { IPlanoEngineCore } from '../PlanoEngineTypes';

interface ElbowInfo {
  T_A: { x: number; y: number };
  T_C: { x: number; y: number };
  perp_u: { x: number; y: number };
  perp_v: { x: number; y: number };
}

function drawRamalPath(
  ctx: CanvasRenderingContext2D,
  pts: number[][],
  engine: IPlanoEngineCore,
  _col: string
): ElbowInfo[] {
  if (pts.length < 2) return [];

  const cvsPts = pts.map(pt => engine.toCvs(pt[0], pt[1]));
  const elbows: ElbowInfo[] = [];

  const activeRamal = engine.activeRamal;
  const r = engine.ramales.find((rm: any) => rm.pts === pts) || (activeRamal?.pts === pts ? activeRamal : null);
  const netId = r ? r.net : engine.activeNet;
  const netRamales = engine.ramales.filter((rm: any) => rm.net === netId);
  if (activeRamal && activeRamal.net === netId && !netRamales.some((rm: any) => rm.pts === activeRamal.pts)) {
    netRamales.push(activeRamal as any);
  }

  ctx.beginPath();
  ctx.moveTo(cvsPts[0].x, cvsPts[0].y);

  for (let i = 1; i < cvsPts.length; i++) {
    const isCorner = i < cvsPts.length - 1;
    let drewArc = false;

    if (isCorner) {
      const cvsA = cvsPts[i - 1];
      const cvsB = cvsPts[i];
      const cvsC = cvsPts[i + 1];

      const ax = cvsB.x - cvsA.x, ay = cvsB.y - cvsA.y;
      const bx = cvsC.x - cvsB.x, by = cvsC.y - cvsB.y;
      const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);

      if (lenA > 0 && lenB > 0) {
        const ux = -ax / lenA, uy = -ay / lenA; // B -> A
        const vx = bx / lenB, vy = by / lenB;   // B -> C
        const cosAngle = ux * vx + uy * vy;

        const pt = pts[i];
        let isJunc = false;
        for (let k = 0; k < pts.length; k++) {
          if (k !== i && Math.hypot(pts[k][0] - pt[0], pts[k][1] - pt[1]) < 0.5) {
            isJunc = true;
            break;
          }
        }
        if (!isJunc) {
          const r = engine.ramales.find((rm: any) => rm.pts === pts);
          if (r) {
            const hasTrib = engine.ramales.some((other: any) => 
              other.padre === r.id && 
              other.pts.length >= 2 && 
              Math.hypot(other.pts[0][0] - pt[0], other.pts[0][1] - pt[1]) < 0.5
            );
            if (hasTrib) isJunc = true;
          }
        }

        if (Math.abs(cosAngle) < 0.05 && !isJunc) {
          const rad = engine.mm2cvs(1.5);
          const actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);

          if (actualRad > 0.1) {
            const T_A = { x: cvsB.x + actualRad * ux, y: cvsB.y + actualRad * uy };
            const T_C = { x: cvsB.x + actualRad * vx, y: cvsB.y + actualRad * vy };
            const ccx = cvsB.x + (ux + vx) * actualRad;
            const ccy = cvsB.y + (uy + vy) * actualRad;
            const angle_TA = Math.atan2(-vy, -vx);
            const angle_TC = Math.atan2(-uy, -ux);
            const cross = ux * vy - uy * vx;
            const counterclockwise = cross > 0;
            const perp_u = { x: -uy, y: ux };
            const perp_v = { x: -vy, y: vx };

            ctx.lineTo(T_A.x, T_A.y);
            ctx.stroke();

            ctx.save();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(ccx, ccy, actualRad, angle_TA, angle_TC, counterclockwise);
            ctx.stroke();
            ctx.restore();

            ctx.beginPath();
            ctx.moveTo(T_C.x, T_C.y);

            elbows.push({ T_A, T_C, perp_u, perp_v });
            drewArc = true;
          }
        }
      }
    }

    if (!drewArc) {
      ctx.lineTo(cvsPts[i].x, cvsPts[i].y);
    }
  }

  ctx.stroke();

  if (elbows.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([]);
    const tickLen = engine.mm2cvs(1.0);
    elbows.forEach(elb => {
      ctx.beginPath();
      ctx.moveTo(elb.T_A.x - elb.perp_u.x * tickLen / 2, elb.T_A.y - elb.perp_u.y * tickLen / 2);
      ctx.lineTo(elb.T_A.x + elb.perp_u.x * tickLen / 2, elb.T_A.y + elb.perp_u.y * tickLen / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(elb.T_C.x - elb.perp_v.x * tickLen / 2, elb.T_C.y - elb.perp_v.y * tickLen / 2);
      ctx.lineTo(elb.T_C.x + elb.perp_v.x * tickLen / 2, elb.T_C.y + elb.perp_v.y * tickLen / 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  return elbows;
}

function isJunctionVertex(px: number, py: number, netRamales: any[]): boolean {
  const outgoingVectors: { x: number; y: number }[] = [];
  
  netRamales.forEach(r => {
    let isVertex = false;
    for (let i = 0; i < r.pts.length; i++) {
      if (Math.hypot(r.pts[i][0] - px, r.pts[i][1] - py) < 0.5) {
        isVertex = true;
        if (i > 0) {
          const prev = r.pts[i - 1];
          const dx = prev[0] - px, dy = prev[1] - py;
          const len = Math.hypot(dx, dy);
          if (len > 0.1) outgoingVectors.push({ x: dx / len, y: dy / len });
        }
        if (i < r.pts.length - 1) {
          const next = r.pts[i + 1];
          const dx = next[0] - px, dy = next[1] - py;
          const len = Math.hypot(dx, dy);
          if (len > 0.1) outgoingVectors.push({ x: dx / len, y: dy / len });
        }
      }
    }

    if (!isVertex) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const A = r.pts[i];
        const B = r.pts[i + 1];
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const lenSq = dx * dx + dy * dy;
        if (lenSq > 0.001) {
          let t = ((px - A[0]) * dx + (py - A[1]) * dy) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const projX = A[0] + t * dx;
          const projY = A[1] + t * dy;
          const dist = Math.hypot(px - projX, py - projY);
          
          const lenA = Math.hypot(A[0] - px, A[1] - py);
          const lenB = Math.hypot(B[0] - px, B[1] - py);

          if (dist < 0.5 && lenA > 0.5 && lenB > 0.5) {
            outgoingVectors.push({ x: (A[0] - px) / lenA, y: (A[1] - py) / lenA });
            outgoingVectors.push({ x: (B[0] - px) / lenB, y: (B[1] - py) / lenB });
          }
        }
      }
    }
  });

  const uniqueVectors: { x: number; y: number }[] = [];
  outgoingVectors.forEach(v => {
    const isDup = uniqueVectors.some(uv => {
      const dot = uv.x * v.x + uv.y * v.y;
      return dot > 0.99;
    });
    if (!isDup) uniqueVectors.push(v);
  });

  if (uniqueVectors.length >= 3 && uniqueVectors.length <= 4) {
    let bestPair = { i: -1, j: -1, dot: 1 };
    for (let i = 0; i < uniqueVectors.length; i++) {
      for (let j = i + 1; j < uniqueVectors.length; j++) {
        const dot = uniqueVectors[i].x * uniqueVectors[j].x + uniqueVectors[i].y * uniqueVectors[j].y;
        if (dot < bestPair.dot) {
          bestPair = { i, j, dot };
        }
      }
    }

    if (bestPair.dot < -0.9) {
      const uB = uniqueVectors[bestPair.j];
      const branches: { x: number; y: number }[] = [];
      for (let k = 0; k < uniqueVectors.length; k++) {
        if (k !== bestPair.i && k !== bestPair.j) {
          branches.push(uniqueVectors[k]);
        }
      }

      if (branches.length > 0) {
        const cosVal = branches[0].x * uB.x + branches[0].y * uB.y;
        const isTee = Math.abs(cosVal) < 0.15;
        const isYee = Math.abs(cosVal) >= 0.4 && Math.abs(cosVal) <= 0.85;
        return isTee || isYee;
      }
    }
  }

  return false;
}

export function renderRamales(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const isTributarioMode = engine.tipoTramo === 'tributario' && engine.tool === 'line';
  const padreId = engine.padreTributario;
  engine.ramales.forEach((r: any) => {
    if (engine._hiddenNets.has(r.net)) return;
    const net = NETS.find((n: any) => n.id === r.net);
    const col = net ? net.col : '#e2e2e8';
    const sel = r.id === engine.selId;
    const isPadre = r.id === padreId;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = sel ? 5 : 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (r.pts.length > 1) {
      if (isPadre && isTributarioMode) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 4;
        ctx.strokeStyle = col;
        drawRamalPath(ctx, r.pts, engine, col);
        ctx.restore();
      } else if (r.tipo === 'tributario') {
        ctx.save();
        ctx.setLineDash([6, 4]);
        drawRamalPath(ctx, r.pts, engine, col);
        ctx.restore();
      } else {
        drawRamalPath(ctx, r.pts, engine, col);
      }
    }

    if (sel) {
      r.pts.forEach(([px, py]: [number, number], idx: number) => {
        if (idx > 0 && idx < r.pts.length - 1) {
          const cvsA = engine.toCvs(r.pts[idx - 1][0], r.pts[idx - 1][1]);
          const cvsB = engine.toCvs(px, py);
          const cvsC = engine.toCvs(r.pts[idx + 1][0], r.pts[idx + 1][1]);
          const ax = cvsB.x - cvsA.x, ay = cvsB.y - cvsA.y;
          const bx = cvsC.x - cvsB.x, by = cvsC.y - cvsB.y;
          const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
          if (lenA > 0 && lenB > 0) {
            const ux = -ax / lenA, uy = -ay / lenA;
            const vx = bx / lenB, vy = by / lenB;
            const cosAngle = ux * vx + uy * vy;
            const pt = r.pts[idx];
            let isJunc = false;
            for (let k = 0; k < r.pts.length; k++) {
              if (k !== idx && Math.hypot(r.pts[k][0] - pt[0], r.pts[k][1] - pt[1]) < 0.5) {
                isJunc = true;
                break;
              }
            }
            if (!isJunc) {
              const hasTrib = engine.ramales.some((other: any) => 
                other.padre === r.id && 
                other.pts.length >= 2 && 
                Math.hypot(other.pts[0][0] - pt[0], other.pts[0][1] - pt[1]) < 0.5
              );
              if (hasTrib) isJunc = true;
            }
            if (Math.abs(cosAngle) < 0.05 && !isJunc) {
              return;
            }
          }
        }
        const c = engine.toCvs(px, py);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (isPadre && isTributarioMode && !engine.activeRamal && r.pts.length >= 2) {
      const mp = engine.snapPreviewToPadre(engine.mouseX, engine.mouseY);
      if (mp) {
        const c = engine.toCvs(mp.x, mp.y);
        ctx.save();
        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    if (r.pts.length >= 2) {
      const cStart = engine.toCvs(r.pts[0][0], r.pts[0][1]);
      const cEnd = engine.toCvs(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]);
      const drawEndMarker = (c: any, label: string) => {
        if (!label) return;
        ctx.save();
        ctx.font = `bold ${engine.mm2cvs(1.6)}px Geist, monospace`;
        const tw = ctx.measureText(label).width;
        const pad = 3;
        const w = tw + pad * 2;
        const h = engine.mm2cvs(2.4) + pad * 2;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(c.x + 6, c.y - h / 2, w, h);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, c.x + 6 + pad, c.y);
        ctx.restore();
      };
      drawEndMarker(cStart, r.ini);
      drawEndMarker(cEnd, r.fin);
    }

    if (r.label || r.totalL || r.material || r.diametro || r.pendiente) {
      const lc = engine.toCvs(r.labelX, r.labelY);
      const FLOW_NETS = ['san', 'll', 'af', 'ac'];
      const showFlow = FLOW_NETS.includes(r.net) && r.pts.length >= 2;
      let flowDx = 0, flowDy = 0, flowLen = 0;
      if (showFlow) {
        const fc = engine.toCvs(r.pts[0][0], r.pts[0][1]);
        const lastc = engine.toCvs(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]);
        flowDx = lastc.x - fc.x;
        flowDy = lastc.y - fc.y;
        flowLen = Math.hypot(flowDx, flowDy);
      }
      const arrowSize = showFlow && flowLen > 12 ? 46 : 0;
      const lbl = r.label || '';
      const matPart = r.material || '';
      const dPart = r.diametro ? `D=${r.diametro.split(' — ')[0]}` : '';
      const pPart = r.pendiente ? `S=${r.pendiente}%` : '';
      const showPend = (r.net === 'san' || r.net === 'll');
      const pendPart = showPend && pPart ? pPart : '';
      const lblPart = r.totalL ? `L=${r.totalL.toFixed(2)}m` : '';

      const fsName = engine.mm2cvs(engine.MM.lblName * engine.labelScaleM);
      const fsInfo = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM);
      const lineHName = fsName + 2;
      const lineHInfo = fsName + 4;
      const boxPadX = engine.mm2cvs(1.0);
      const boxPadY = engine.mm2cvs(0.6);

      const infoSegs: Array<{ text: string; bold: boolean; w: number } | null> = [
        matPart ? { text: matPart, bold: false, w: 0 } : null,
        dPart ? { text: dPart, bold: true, w: 0 } : null,
        pendPart ? { text: pendPart, bold: false, w: 0 } : null,
        lblPart ? { text: lblPart, bold: false, w: 0 } : null,
      ].filter(Boolean) as Array<{ text: string; bold: boolean; w: number }>;
      const segSep = ' · ';
      let sepW = 0;
      ctx.font = `600 ${fsInfo}px Geist, monospace`;
      if (infoSegs.length > 1) sepW = ctx.measureText(segSep).width;
      for (const s of infoSegs) {
        ctx.font = s!.bold ? `bold ${fsInfo}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
        s!.w = ctx.measureText(s!.text).width;
      }
      const totalInfoW = infoSegs.reduce((sum: number, s, i) => sum + s!.w + (i < infoSegs.length - 1 ? sepW : 0), 0);

      ctx.font = `bold ${fsName}px Geist, monospace`;
      const nameW = lbl ? ctx.measureText(lbl).width : 0;
      const contentW = Math.max(nameW, totalInfoW);
      const boxW = contentW + boxPadX * 2;
      const boxH = (lbl ? lineHName : 0) + (infoSegs.length > 0 ? lineHInfo : 0) + boxPadY * 2;
      let drawX: number, drawY: number;
      drawX = lc.x;
      drawY = lc.y;
      const labelAngle = (r.labelAngle || 0) * Math.PI / 180;
      const cosA = Math.cos(labelAngle), sinA = Math.sin(labelAngle);

      const { corners, minX, minY, maxX, maxY } = rotatedRectCorners(drawX, drawY, boxW, boxH, labelAngle);
      r._labelBox = { cx: drawX, cy: drawY, w: boxW, h: boxH, angle: labelAngle, minX, minY, maxX, maxY, corners };

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(labelAngle);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (lbl) {
        ctx.font = `bold ${fsName}px Geist, monospace`;
        ctx.fillStyle = col;
        ctx.fillText(lbl, 0, -boxH / 2 + boxPadY + lineHName / 2);
      }
      if (infoSegs.length > 0) {
        const yInfo = boxH / 2 - boxPadY - lineHInfo / 2;
        let xCursor = -totalInfoW / 2;
        for (let i = 0; i < infoSegs.length; i++) {
          const s = infoSegs[i];
          ctx.font = s!.bold ? `bold ${fsInfo}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
          ctx.fillStyle = s!.bold ? '#000000' : '#1a1a1a';
          ctx.textAlign = 'left';
          ctx.fillText(s!.text, xCursor, yInfo);
          xCursor += s!.w;
          if (i < infoSegs.length - 1) {
            ctx.font = `600 ${fsInfo}px Geist, monospace`;
            ctx.fillStyle = '#1a1a1a';
            ctx.fillText(segSep, xCursor, yInfo);
            xCursor += sepW;
          }
        }
        ctx.textAlign = 'center';
      }

      if (showFlow && flowLen > 12) {
        const arrowGap = -8;
        const arrowY = boxH / 2 + arrowGap + arrowSize / 2;
        ctx.save();
        ctx.translate(0, arrowY);
        const dot = flowDx * cosA + flowDy * sinA;
        const dir = dot >= 0 ? 1 : -1;
        const halfSize = arrowSize * 1.4;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-halfSize * dir, 0);
        ctx.lineTo(halfSize * dir, 0);
        ctx.stroke();
        const aSize = 10;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(halfSize * dir, 0);
        ctx.lineTo(halfSize * dir - dir * aSize, -aSize * 0.4);
        ctx.lineTo(halfSize * dir - dir * aSize, aSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else {
      r._labelBox = null;
    }

    ctx.restore();

    if (r.net === 'san' && r.pts.length >= 2) {
      const endpointIndices = [0, r.pts.length - 1];
      for (const idx of endpointIndices) {
        const connectedBaj = engine.bajantes.find((b: any) => {
          if (b.net !== 'san') return false;
          const bDisp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
          const bx = b.x + (bDisp ? bDisp.dx : 0);
          const by = b.y + (bDisp ? bDisp.dy : 0);
          return Math.hypot(bx - r.pts[idx][0], by - r.pts[idx][1]) < 0.5;
        });
        if (connectedBaj && connectedBaj.direccion) {
          const v = engine.toCvs(r.pts[idx][0], r.pts[idx][1]);
          const rad = engine.mm2cvs(2);
          const isSube = connectedBaj.direccion === 'sube';
          ctx.save();
          ctx.strokeStyle = col;
          ctx.fillStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(v.x, v.y, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (isSube) {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(v.x, v.y, rad * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }

    if (r.id === engine.selId && r.pts.length >= 2) {
      const firstC = engine.toCvs(r.pts[0][0], r.pts[0][1]);
      const secondC = engine.toCvs(r.pts[1][0], r.pts[1][1]);
      const adx = secondC.x - firstC.x, ady = secondC.y - firstC.y;
      const alen = Math.hypot(adx, ady);
      if (alen > 2) {
        const unx = adx / alen, uny = ady / alen;
        const arrowR = 18;
        const cx = firstC.x - unx * arrowR * 0.3;
        const cy = firstC.y - uny * arrowR * 0.3;
        ctx.save();
        ctx.fillStyle = '#FFEB3B';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(cx + unx * arrowR, cy + uny * arrowR);
        ctx.lineTo(cx + uny * arrowR * 0.5, cy - unx * arrowR * 0.5);
        ctx.lineTo(cx - uny * arrowR * 0.5, cy + unx * arrowR * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  });

  if (engine.tool === 'line') {
    const activeNetsRamales = engine.ramales.filter((r: any) => r.net === engine.activeNet && r.pts.length >= 2);

    const net = NETS.find((n: any) => n.id === engine.activeNet);
    const col = net ? net.col : '#a1a1aa';
    activeNetsRamales.forEach((r: any) => {
      r.pts.forEach(([px, py]: [number, number]) => {
        // Skip drawing connection socket if it's a Tee/Yee junction
        if (isJunctionVertex(px, py, activeNetsRamales)) {
          return;
        }
        const c = engine.toCvs(px, py);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    });

  }

  renderJunctions(ctx, engine);
}

function renderJunctions(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const DOUBLE_YEE_THRESHOLD_MM = 10;

  NETS.forEach(net => {
    if (engine._hiddenNets.has(net.id)) return;
    const netRamales = engine.ramales.filter((r: any) => r.net === net.id);
    if (netRamales.length === 0) return;

    const getPointKey = (x: number, y: number) => `${x.toFixed(3)}_${y.toFixed(3)}`;
    const vertexMap = new Map<string, number[]>();

    netRamales.forEach(r => {
      r.pts.forEach((pt: number[]) => {
        vertexMap.set(getPointKey(pt[0], pt[1]), pt);
      });
    });

    interface JunctionData {
      P: number[];
      uA: { x: number; y: number };
      uB: { x: number; y: number };
      branches: { x: number; y: number }[];
      isTee: boolean;
      isYee: boolean;
    }

    const junctions: JunctionData[] = [];

    vertexMap.forEach((P) => {
      const outgoingVectors: { x: number; y: number }[] = [];

      netRamales.forEach(r => {
        let isVertex = false;
        for (let i = 0; i < r.pts.length; i++) {
          if (Math.hypot(r.pts[i][0] - P[0], r.pts[i][1] - P[1]) < 0.5) {
            isVertex = true;
            if (i > 0) {
              const prev = r.pts[i - 1];
              const dx = prev[0] - P[0], dy = prev[1] - P[1];
              const len = Math.hypot(dx, dy);
              if (len > 0.1) outgoingVectors.push({ x: dx / len, y: dy / len });
            }
            if (i < r.pts.length - 1) {
              const next = r.pts[i + 1];
              const dx = next[0] - P[0], dy = next[1] - P[1];
              const len = Math.hypot(dx, dy);
              if (len > 0.1) outgoingVectors.push({ x: dx / len, y: dy / len });
            }
          }
        }

        if (!isVertex) {
          for (let i = 0; i < r.pts.length - 1; i++) {
            const A = r.pts[i];
            const B = r.pts[i + 1];
            const dx = B[0] - A[0], dy = B[1] - A[1];
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0.001) {
              let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / lenSq;
              t = Math.max(0, Math.min(1, t));
              const projX = A[0] + t * dx;
              const projY = A[1] + t * dy;
              const dist = Math.hypot(P[0] - projX, P[1] - projY);
              
              const lenA = Math.hypot(A[0] - P[0], A[1] - P[1]);
              const lenB = Math.hypot(B[0] - P[0], B[1] - P[1]);

              if (dist < 0.5 && lenA > 0.5 && lenB > 0.5) {
                outgoingVectors.push({ x: (A[0] - P[0]) / lenA, y: (A[1] - P[1]) / lenA });
                outgoingVectors.push({ x: (B[0] - P[0]) / lenB, y: (B[1] - P[1]) / lenB });
              }
            }
          }
        }
      });

      const uniqueVectors: { x: number; y: number }[] = [];
      outgoingVectors.forEach(v => {
        const isDup = uniqueVectors.some(uv => {
          const dot = uv.x * v.x + uv.y * v.y;
          return dot > 0.99;
        });
        if (!isDup) uniqueVectors.push(v);
      });

      if (uniqueVectors.length >= 3 && uniqueVectors.length <= 4) {
        let bestPair = { i: -1, j: -1, dot: 1 };
        for (let i = 0; i < uniqueVectors.length; i++) {
          for (let j = i + 1; j < uniqueVectors.length; j++) {
            const dot = uniqueVectors[i].x * uniqueVectors[j].x + uniqueVectors[i].y * uniqueVectors[j].y;
            if (dot < bestPair.dot) {
              bestPair = { i, j, dot };
            }
          }
        }

        if (bestPair.dot < -0.9) {
          const uA = uniqueVectors[bestPair.i];
          const uB = uniqueVectors[bestPair.j];
          
          const branches: { x: number; y: number }[] = [];
          for (let k = 0; k < uniqueVectors.length; k++) {
            if (k !== bestPair.i && k !== bestPair.j) {
              branches.push(uniqueVectors[k]);
            }
          }

          const cosVal = branches[0].x * uB.x + branches[0].y * uB.y;
          const isTee = Math.abs(cosVal) < 0.15;
          const isYee = Math.abs(cosVal) >= 0.4 && Math.abs(cosVal) <= 0.85;

          if (isTee || isYee) {
            junctions.push({ P, uA, uB, branches, isTee, isYee });
          }
        }
      }
    });

    const usedInDouble = new Set<number>();

    for (let i = 0; i < junctions.length; i++) {
      for (let j = i + 1; j < junctions.length; j++) {
        if (usedInDouble.has(i) || usedInDouble.has(j)) continue;
        const a = junctions[i], b = junctions[j];
        const distMm = Math.hypot(a.P[0] - b.P[0], a.P[1] - b.P[1]);
        if (distMm > DOUBLE_YEE_THRESHOLD_MM) continue;

        const dotMain = a.uA.x * b.uA.x + a.uA.y * b.uA.y;
        const dotMain2 = a.uA.x * b.uB.x + a.uA.y * b.uB.y;
        const aligned = Math.abs(Math.abs(dotMain) - 1) < 0.15 || Math.abs(Math.abs(dotMain2) - 1) < 0.15;
        if (!aligned) continue;

        usedInDouble.add(i);
        usedInDouble.add(j);

        const cvsA = engine.toCvs(a.P[0], a.P[1]);
        const cvsB = engine.toCvs(b.P[0], b.P[1]);
        const rad = engine.mm2cvs(2.0);
        const tickLen = engine.mm2cvs(0.8);

        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cvsA.x, cvsA.y);
        ctx.lineTo(cvsB.x, cvsB.y);
        ctx.stroke();
        
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        const drawSingleTick = (center: { x: number; y: number }, u: { x: number; y: number }) => {
          const T_pt = { x: center.x + rad * u.x, y: center.y + rad * u.y };
          const perp = { x: -u.y, y: u.x };

          ctx.lineWidth = 5;
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(center.x, center.y);
          ctx.lineTo(T_pt.x, T_pt.y);
          ctx.stroke();

          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#000000';
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(T_pt.x - perp.x * tickLen / 2, T_pt.y - perp.y * tickLen / 2);
          ctx.lineTo(T_pt.x + perp.x * tickLen / 2, T_pt.y + perp.y * tickLen / 2);
          ctx.stroke();
        };

        const vecAB = { x: b.P[0] - a.P[0], y: b.P[1] - a.P[1] };
        const dotAa = a.uA.x * vecAB.x + a.uA.y * vecAB.y;
        if (dotAa <= 0) drawSingleTick(cvsA, a.uA); else drawSingleTick(cvsA, a.uB);
        a.branches.forEach(uC => drawSingleTick(cvsA, uC));

        const vecBA = { x: a.P[0] - b.P[0], y: a.P[1] - b.P[1] };
        const dotBa = b.uA.x * vecBA.x + b.uA.y * vecBA.y;
        if (dotBa <= 0) drawSingleTick(cvsB, b.uA); else drawSingleTick(cvsB, b.uB);
        b.branches.forEach(uC => drawSingleTick(cvsB, uC));

        ctx.restore();
      }
    }

    for (let i = 0; i < junctions.length; i++) {
      if (usedInDouble.has(i)) continue;
      const j = junctions[i];

      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);

      const rad = engine.mm2cvs(2.0);
      const tickLen = engine.mm2cvs(0.8);
      const cvsP = engine.toCvs(j.P[0], j.P[1]);

      const drawTick = (u: { x: number; y: number }) => {
        const T_pt = { x: cvsP.x + rad * u.x, y: cvsP.y + rad * u.y };
        const perp = { x: -u.y, y: u.x };

        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cvsP.x, cvsP.y);
        ctx.lineTo(T_pt.x, T_pt.y);
        ctx.stroke();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(T_pt.x - perp.x * tickLen / 2, T_pt.y - perp.y * tickLen / 2);
        ctx.lineTo(T_pt.x + perp.x * tickLen / 2, T_pt.y + perp.y * tickLen / 2);
        ctx.stroke();
      };

      drawTick(j.uA);
      drawTick(j.uB);
      j.branches.forEach(uC => drawTick(uC));

      ctx.restore();
    }
  });
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine.activeRamal) return;
  const ar = engine.activeRamal;
  const net = NETS.find((n: any) => n.id === ar.net);
  const col = net ? net.col : '#e2e2e8';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (ar.pts.length > 1) {
    drawRamalPath(ctx, ar.pts, engine, col);
  }

  ar.pts.forEach((pt: number[], idx: number) => {
    const px = pt[0], py = pt[1];
    const c = engine.toCvs(px, py);
    ctx.save();
    ctx.fillStyle = idx === 0 ? '#fff' : col;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const first = ar.pts[0];
  const last = ar.pts[ar.pts.length - 1];
  let mp = engine.toPlane(engine.mouseX, engine.mouseY);
  
  let snapped = false;

  if (engine.snapMode) {
    mp = engine.snapAngle(last[0], last[1], mp.x, mp.y);
  }

  const activeRamales = engine.ramales.filter((r: any) => r.net === engine.activeNet);
  for (const r of activeRamales) {
    if (r.id === ar.id) continue;
    let segSp = null;
    if (engine.snapMode) {
      segSp = snapTributaryToPadre45Deg(mp.x, mp.y, last[0], last[1], r.pts, 20 / engine.zoom);
    } else {
      segSp = engine._snapToSegment(mp.x, mp.y, r.pts, 20 / engine.zoom);
    }
    if (segSp) {
      mp = segSp;
      snapped = true;
      break;
    }
  }

  const sp = engine.snapToExisting(mp.x, mp.y);
  if (sp) {
    mp = sp;
    snapped = true;
  }

  const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
  const SNAP_CLOSE = 12 / engine.zoom;
  if (ar.pts.length >= 3 && distFirst < SNAP_CLOSE) {
    const fc = engine.toCvs(first[0], first[1]);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10, 0, Math.PI * 2);
    ctx.fill();
    mp = { x: first[0], y: first[1] };
  }

  const lc = engine.toCvs(last[0], last[1]);
  const mc = engine.toCvs(mp.x, mp.y);

  ctx.strokeStyle = col + '88';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(lc.x, lc.y);
  ctx.lineTo(mc.x, mc.y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (snapped) {
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mc.x, mc.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  const segPx = Math.hypot(mp.x - last[0], mp.y - last[1]);
  const segM = engine.pxToM(segPx);
  const deg = Math.atan2(mp.y - last[1], mp.x - last[0]) * 180 / Math.PI;
  const cursorLabel = `${segM}m  ${Math.round(((deg % 360) + 360) % 360)}°`;
  ctx.font = `${engine.mm2cvs(engine.MM.coord * engine.labelScaleM)}px Geist, monospace`;
  const tw = ctx.measureText(cursorLabel).width;
  ctx.fillStyle = 'rgba(17,19,23,0.82)';
  ctx.fillRect(mc.x + 12, mc.y - 18, tw + 8, 16);
  ctx.fillStyle = '#e2e2e8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(cursorLabel, mc.x + 16, mc.y - 10);

  ctx.restore();
}
