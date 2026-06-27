import { NETS } from '../PlanoState';
import { snapTributaryToPadre45Deg } from '../PlanoEngineDrawing';
import { rotatedRectCorners } from '../Coords';
import type { IPlanoEngineCore } from '../PlanoState';
import { drawRamalPath } from './drawRamalPath';
import { renderJunctions } from './renderJunctions';
import { renderVentCodos } from './renderVentCodos';

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
            ctx.lineWidth = (sel ? 3 : 2) * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (r.pts.length > 1) {
      if (isPadre && isTributarioMode) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 3 * engine.zoom;
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
            if ((Math.abs(cosAngle) < 0.05 || Math.abs(cosAngle + Math.cos(Math.PI / 4)) < 0.05) && !isJunc) {
              return;
            }
          }
        }
        const c = engine.toCvs(px, py);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3 * engine.zoom, 0, Math.PI * 2);
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
        ctx.lineWidth = 2 * engine.zoom;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5 * engine.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
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
      const arrowSize = showFlow && flowLen > 12 * engine.zoom ? 46 * engine.zoom : 0;
      const lbl = r.label || '';
      const matPart = r.material || '';
      let dPart = r.diametro ? `D=${r.diametro.split(' — ')[0]}` : '';
      if (r.net === 'gas' && dPart && !dPart.endsWith('"')) {
        dPart += '"';
      }
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
      const labelGap = -engine.mm2cvs(12);
      const gapOffX = -labelGap * sinA;
      const gapOffY = labelGap * cosA;
      const adjCx = drawX + gapOffX;
      const adjCy = drawY + gapOffY;

      const { corners, minX, minY, maxX, maxY } = rotatedRectCorners(adjCx, adjCy, boxW, boxH, labelAngle);
      r._labelBox = { cx: adjCx, cy: adjCy, w: boxW, h: boxH, angle: labelAngle, minX, minY, maxX, maxY, corners };

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(labelAngle);
      ctx.translate(0, labelGap);
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

      if (showFlow && flowLen > 12 * engine.zoom) {
        const arrowGap = -8 * engine.zoom;
        const arrowY = boxH / 2 + arrowGap + arrowSize / 2;
        ctx.save();
        ctx.translate(0, arrowY);
        const dot = flowDx * cosA + flowDy * sinA;
        const dir = dot >= 0 ? 1 : -1;
        const halfSize = arrowSize * 1.4;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1 * engine.zoom;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-halfSize * dir, 0);
        ctx.lineTo(halfSize * dir, 0);
        ctx.stroke();
        const aSize = 10 * engine.zoom;
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
          ctx.lineWidth = 2 * engine.zoom;
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

    if (r.pts.length >= 2 && (r.id === engine.selId || (engine.multiSel || []).includes(r.id))) {
      const isDesvio = engine.bajantes.some((b: any) => {
        const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
        if (!disp || disp.Ldesvio !== r.id) return false;
        const gx = b.x + (disp.dx || 0), gy = b.y + (disp.dy || 0);
        const firstPt = r.pts[0], lastPt = r.pts[r.pts.length - 1];
        const nearParent = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
        const nearGhost = Math.hypot(lastPt[0] - gx, lastPt[1] - gy) < 0.5;
        return nearParent && nearGhost;
      });
      if (isDesvio) {
        const lastPt = r.pts[r.pts.length - 1];
        const prevPt = r.pts[r.pts.length - 2];
        const lastC = engine.toCvs(lastPt[0], lastPt[1]);
        const prevC = engine.toCvs(prevPt[0], prevPt[1]);
        const adx = prevC.x - lastC.x, ady = prevC.y - lastC.y;
        const alen = Math.hypot(adx, ady);
        if (alen > 2) {
          const unx = adx / alen, uny = ady / alen;
          const arrowR = 14 * engine.zoom;
          const cx = lastC.x;
          const cy = lastC.y;
          ctx.save();
          ctx.fillStyle = '#FFEB3B';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5 * engine.zoom;
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 6 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx - unx * arrowR + uny * arrowR * 0.4, cy - uny * arrowR - unx * arrowR * 0.4);
          ctx.lineTo(cx - unx * arrowR - uny * arrowR * 0.4, cy - uny * arrowR + unx * arrowR * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else {
        let startIdx = 0;
        let nextIdx = 1;
        
        let isCodoReventiladoConnection = false;
        let codoEndIdx = -1;

        if (r.net === 'vent' || r.net === 'san') {
          const ventRamales = engine.ramales.filter((rm: any) => rm.net === 'vent');
          const sanRamales = engine.ramales.filter((rm: any) => rm.net === 'san');
          
          for (const vr of ventRamales) {
            for (const idx of [0, vr.pts.length - 1]) {
              const pt = vr.pts[idx];
              const connectsToSan = sanRamales.some((sr: any) =>
                sr.pts.some((sPt: number[]) => Math.hypot(pt[0] - sPt[0], pt[1] - sPt[1]) < 0.5)
              );
              if (connectsToSan) {
                const rEndIdx = [0, r.pts.length - 1].find(eIdx => Math.hypot(r.pts[eIdx][0] - pt[0], r.pts[eIdx][1] - pt[1]) < 0.5);
                if (rEndIdx !== undefined) {
                  isCodoReventiladoConnection = true;
                  codoEndIdx = rEndIdx;
                  break;
                }
              }
            }
            if (isCodoReventiladoConnection) break;
          }
        }

        if (r.net === 'san' && !isCodoReventiladoConnection) {
          for (const b of (engine.bajantes || [])) {
            if (b.net !== 'san') continue;
            if (!b.recibeDeIds?.includes(r.id)) continue;
            const firstPt = r.pts[0];
            const lastPt = r.pts[r.pts.length - 1];
            const bajanteNearFirst = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
            const bajanteNearLast = Math.hypot(lastPt[0] - b.x, lastPt[1] - b.y) < 0.5;
            if (bajanteNearFirst) {
              startIdx = r.pts.length - 1;
              nextIdx = r.pts.length - 2;
            } else if (bajanteNearLast) {
              startIdx = 0;
              nextIdx = 1;
            }
            break;
          }
        }

        if (isCodoReventiladoConnection && codoEndIdx !== -1) {
          startIdx = codoEndIdx === 0 ? r.pts.length - 1 : 0;
          nextIdx = startIdx === 0 ? 1 : r.pts.length - 2;
        } else if (r.net === 'vent' && r.pts[r.pts.length - 1][0] < r.pts[0][0]) {
          startIdx = r.pts.length - 1;
          nextIdx = r.pts.length - 2;
        }
        
        const firstC = engine.toCvs(r.pts[startIdx][0], r.pts[startIdx][1]);
        const secondC = engine.toCvs(r.pts[nextIdx][0], r.pts[nextIdx][1]);
        const adx = secondC.x - firstC.x, ady = secondC.y - firstC.y;
        const alen = Math.hypot(adx, ady);
        if (alen > 2) {
          const unx = adx / alen, uny = ady / alen;
          const arrowR = 14 * engine.zoom;
          const cx = firstC.x;
          const cy = firstC.y;
          ctx.save();
          ctx.fillStyle = '#FFEB3B';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5 * engine.zoom;
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 6 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx - unx * arrowR + uny * arrowR * 0.4, cy - uny * arrowR - unx * arrowR * 0.4);
          ctx.lineTo(cx - unx * arrowR - uny * arrowR * 0.4, cy - uny * arrowR + unx * arrowR * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  });

  if (engine.tool === 'line') {
    const activeNetsRamales = engine.ramales.filter((r: any) => r.net === engine.activeNet && r.pts.length >= 2);

    const net = NETS.find((n: any) => n.id === engine.activeNet);
    const col = net ? net.col : '#a1a1aa';
    activeNetsRamales.forEach((r: any) => {
      r.pts.forEach(([px, py]: [number, number]) => {
        if (isJunctionVertex(px, py, activeNetsRamales)) {
          return;
        }
        const c = engine.toCvs(px, py);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5 * engine.zoom;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    });

  }

  renderJunctions(ctx, engine);
  renderVentCodos(ctx, engine);
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine.activeRamal) return;
  const ar = engine.activeRamal;
  const net = NETS.find((n: any) => n.id === ar.net);
  const col = net ? net.col : '#e2e2e8';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2 * engine.zoom;
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
    ctx.arc(c.x, c.y, 4 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const first = ar.pts[0];
  const last = ar.pts[ar.pts.length - 1];
  let mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const origMp = { x: mp.x, y: mp.y };
  
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

  if (!snapped) {
    const sp = engine.snapToExisting(mp.x, mp.y);
    if (sp) mp = sp;
  }

  const bajThresh = 20 / engine.zoom;
  const nearBaj = engine.bajantes.find((b: any) => {
    if (engine._hiddenNets.has(b.net) || b.net !== ar.net) return false;
    return Math.hypot(origMp.x - b.x, origMp.y - b.y) < bajThresh;
  });
  if (nearBaj) {
    mp = { x: nearBaj.x, y: nearBaj.y };
    snapped = true;
    const bc = engine.toCvs(nearBaj.x, nearBaj.y);
    ctx.save();
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(bc.x, bc.y, 12 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.15)';
    ctx.beginPath();
    ctx.arc(bc.x, bc.y, 12 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
  const SNAP_CLOSE = 12 / engine.zoom;
  if (ar.pts.length >= 3 && distFirst < SNAP_CLOSE) {
    const fc = engine.toCvs(first[0], first[1]);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    mp = { x: first[0], y: first[1] };
  }

  const lc = engine.toCvs(last[0], last[1]);
  const mc = engine.toCvs(mp.x, mp.y);

  ctx.strokeStyle = col + '88';
  ctx.lineWidth = 2 * engine.zoom;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(lc.x, lc.y);
  ctx.lineTo(mc.x, mc.y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (snapped) {
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.beginPath();
    ctx.arc(mc.x, mc.y, 2.5 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }

  const segPx = Math.hypot(mp.x - last[0], mp.y - last[1]);
  const segM = +(engine.pxToM(segPx).toFixed(2));
  const deg = Math.atan2(mp.y - last[1], mp.x - last[0]) * 180 / Math.PI;
  const cursorLabel = `${segM} m  ${Math.round(((deg % 360) + 360) % 360)}°`;
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
