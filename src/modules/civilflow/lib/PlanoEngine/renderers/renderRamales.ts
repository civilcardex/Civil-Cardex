import { NETS } from '../PlanoState';
import { snapTributaryToPadre45Deg, _midpoint } from '../PlanoEngineDrawing';
import { rotatedRectCorners, pointToSegmentDist } from '../HitTester';
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { pisoCortoLoose as getPisoCorto, matDrawingLabel, APARATO_IMG } from '../../../constants';
import { drawRamalPath } from './drawRamalPath';
import { drawExtremeAccessorySymbol, drawCornerCodoArc } from './renderAccessorySymbols';
import { renderJunctions } from './renderJunctions';

// Cache de nivel de módulo para los símbolos de aparato (drawRamalPath + pase de aparato
// abajo). DEBE vivir aquí, no dentro de renderRamales: un cache por-render se borra en cada
// engine.render(), así que la imagen reiniciaría su carga en cada pase, nunca se dibujaría, y
// cada onload dispararía otro render (bucle infinito de recargas). Con un cache de nivel de
// módulo el primer render arranca la carga, onload guarda la imagen y re-renderiza una vez, y
// el siguiente pase la dibuja síncronamente desde el cache.
const aparatoImgCache = new Map<string, HTMLImageElement | null>();

/**
 * Elige el lado de rama (perpendicular) para un glifo teeReduccion/teeLado en una unión.
 * `throughDx/throughDy` es la dirección propia del ramal en el punto (para un extremo: el
 * rumbo del segmento adyacente; para un vértice de medio cuerpo: la bisectriz). El brazo de
 * rama del glifo debe apuntar hacia el ramal que realmente cruza/se ramifica — no ciegamente
 * hacia arriba de pantalla.
 * Estrategia: buscar el segmento de la misma red cerca de `pt` que sea MÁS PERPENDICULAR a la
 * dirección de paso (|dot| mínimo). Un segmento colineal (p. ej. el tope dividido de esta
 * misma unión, u otros segmentos del propio ramal) también toca el punto pero da |dot| ~ 1 y
 * pierde ante el tributario realmente perpendicular (|dot| ~ 0). Si no se encuentra ninguno
 * (accesorio aislado, sin cruce), cae a la convención clásica "arriba de pantalla para
 * horizontal, derecha para vertical".
 */
export function pickTeeBranchDir(
  engine: IPlanoEngineCore,
  ownId: string,
  net: string,
  pt: number[],
  throughDx: number,
  throughDy: number,
  fallbackPx: number,
  fallbackPy: number,
): { px: number; py: number } {
  const px = fallbackPx;
  const py = fallbackPy;
  const pxAlt = -fallbackPx;
  const pyAlt = -fallbackPy;
  const CROSS_TOL = 0.5;
  let crossDir: { x: number; y: number } | null = null;
  let bestPerp = 2;
  for (const cr of engine.ramales) {
    if (cr.net !== net || cr.id === ownId) continue;
    if (!cr.pts || cr.pts.length < 2) continue;
    for (let ci = 0; ci < cr.pts.length - 1; ci++) {
      if (
        pointToSegmentDist(
          pt[0],
          pt[1],
          cr.pts[ci][0],
          cr.pts[ci][1],
          cr.pts[ci + 1][0],
          cr.pts[ci + 1][1],
        ) < CROSS_TOL
      ) {
        // Debe apuntar DESDE la unión HACIA el cuerpo real del ramal rama — la dirección cruda
        // del segmento ci->ci+1 depende del orden arbitrario de puntos de ese ramal (p. ej. si
        // `pt` es el propio punto final de ese segmento, ci->ci+1 apunta hacia adelante pasando
        // el punto final hacia la nada, al revés de donde está el material real de la tubería),
        // lo que elegía el lado equivocado abajo cuando el ramal cruzado quedaba dibujado
        // "lejos-y-vuelta". Anclar en el que sea de los dos extremos del segmento que queda MÁS
        // LEJOS de `pt` es independiente del orden.
        const dToCi = Math.hypot(cr.pts[ci][0] - pt[0], cr.pts[ci][1] - pt[1]);
        const dToCiNext = Math.hypot(cr.pts[ci + 1][0] - pt[0], cr.pts[ci + 1][1] - pt[1]);
        const farPt = dToCi >= dToCiNext ? cr.pts[ci] : cr.pts[ci + 1];
        const cdx = farPt[0] - pt[0];
        const cdy = farPt[1] - pt[1];
        const clen = Math.hypot(cdx, cdy);
        if (clen <= 0.01) continue;
        const ux = cdx / clen;
        const uy = cdy / clen;
        const d = Math.abs(ux * throughDx + uy * throughDy);
        if (d < bestPerp) {
          bestPerp = d;
          crossDir = { x: ux, y: uy };
        }
      }
    }
  }
  if (crossDir) {
    const dotP = px * crossDir.x + py * crossDir.y;
    const dotA = pxAlt * crossDir.x + pyAlt * crossDir.y;
    if (dotA > dotP) {
      return { px: pxAlt, py: pyAlt };
    }
    return { px, py };
  }
  // Respaldo: normalizar hacia arriba de pantalla si la perpendicular es casi horizontal, o
  // hacia la derecha si es casi vertical (convención clásica de dibujo).
  const PERP_EPS = 0.1;
  if (py > PERP_EPS) {
    return { px: -px, py: -py };
  }
  if (Math.abs(py) <= PERP_EPS && px < 0) {
    return { px: -px, py: -py };
  }
  return { px, py };
}

export function renderRamales(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const isTributarioMode = engine.tipoTramo === 'tributario' && engine.tool === 'line';
  const padreId = engine.padreTributario;
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    const net = NETS.find((n) => n.id === r.net);
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
        ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
        ctx.lineWidth = 3 * engine.zoom;
        ctx.strokeStyle = col;
        drawRamalPath(ctx, r.pts, engine, col);
        ctx.restore();
      } else if (r.tipo === 'tributario') {
        ctx.save();
        ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
        drawRamalPath(ctx, r.pts, engine, col);
        ctx.restore();
      } else {
        drawRamalPath(ctx, r.pts, engine, col);
      }
    }

    if (sel) {
      r.pts.forEach(([px, py], idx: number) => {
        if (idx > 0 && idx < r.pts.length - 1) {
          const cvsA = engine.toCvs(r.pts[idx - 1][0], r.pts[idx - 1][1]);
          const cvsB = engine.toCvs(px, py);
          const cvsC = engine.toCvs(r.pts[idx + 1][0], r.pts[idx + 1][1]);
          const ax = cvsB.x - cvsA.x,
            ay = cvsB.y - cvsA.y;
          const bx = cvsC.x - cvsB.x,
            by = cvsC.y - cvsB.y;
          const lenA = Math.hypot(ax, ay),
            lenB = Math.hypot(bx, by);
          if (lenA > 0 && lenB > 0) {
            const ux = -ax / lenA,
              uy = -ay / lenA;
            const vx = bx / lenB,
              vy = by / lenB;
            const cosAngle = ux * vx + uy * vy;
            // Ocultar puntos de selección intermedios colineales (tramo recto): si el ángulo es
            // casi 180°, el vértice es decorativo y su punto estorba la lectura de la línea.
            if (cosAngle < -0.95) {
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
      const FLOW_NETS = ['san', 'll', 'af', 'ac', 'gas'];
      const showFlow = FLOW_NETS.includes(r.net) && r.pts.length >= 2;
      let flowDx = 0,
        flowDy = 0,
        flowLen = 0;
      if (showFlow) {
        let flowFromIdx = 0;
        let flowToIdx = r.pts.length - 1;
        if (r._tribReversed && (r.tipo === 'tributario' || ['af', 'ac', 'gas'].includes(r.net))) {
          flowFromIdx = flowToIdx;
          flowToIdx = 0;
        }
        // Ldesvio (id `LD_<sourceBajanteId>`, pts[0] es siempre el origen según
        // associateBajanteAcrossFloors.ts) debe apuntar al que sea 'baja' de los dos bajantes
        // enlazados — no siempre el mismo extremo, porque el origen mismo puede ser 'sube' o
        // 'baja' según el piso donde esté el destino. pts[0] ya coincide con el destino
        // (el 'baja') siempre que el origen sea 'sube', así que solo el caso origen-'baja'
        // necesita el default invertido.
        if (r.id.startsWith('LD_')) {
          const srcBaj = engine.bajantes.find((b) => b.id === r.id.slice(3));
          if (srcBaj?.direccion === 'baja') {
            flowFromIdx = r.pts.length - 1;
            flowToIdx = 0;
          }
        }
        const fc = engine.toCvs(r.pts[flowFromIdx][0], r.pts[flowFromIdx][1]);
        const lastc = engine.toCvs(r.pts[flowToIdx][0], r.pts[flowToIdx][1]);
        flowDx = lastc.x - fc.x;
        flowDy = lastc.y - fc.y;
        flowLen = Math.hypot(flowDx, flowDy);
      }

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const lbl = r.label ? `${r.label}${lvlSuffix}` : '';
      const matPart = matDrawingLabel(r.material) || (r.net === 'vent' ? 'PVC-V' : '');
      const dPart = r.diametro ? `D=${normalizeDnLabel(r.diametro).split(' — ')[0]}` : '';
      const pPart = r.pendiente ? `S=${r.pendiente}%` : '';
      const showPend = r.net === 'san' || r.net === 'll';
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
        ctx.font = s!.bold
          ? `bold ${fsInfo}px Geist, monospace`
          : `600 ${fsInfo}px Geist, monospace`;
        s!.w = ctx.measureText(s!.text).width;
      }
      const totalInfoW = infoSegs.reduce(
        (sum: number, s, i) => sum + s!.w + (i < infoSegs.length - 1 ? sepW : 0),
        0,
      );

      ctx.font = `bold ${fsName}px Geist, monospace`;
      const nameW = lbl ? ctx.measureText(lbl).width : 0;
      const contentW = Math.max(nameW, totalInfoW);
      const boxW = contentW + boxPadX * 2;
      const boxH = (lbl ? lineHName : 0) + (infoSegs.length > 0 ? lineHInfo : 0) + boxPadY * 2;
      const drawX = lc.x;
      const drawY = lc.y;
      let labelAngleDeg = r.labelAngle != null ? r.labelAngle : 0;
      if ((r.labelAngle == null || r.labelAngle === 0) && r.pts && r.pts.length >= 2) {
        const dx = r.pts[1][0] - r.pts[0][0];
        const dy = r.pts[1][1] - r.pts[0][1];
        if (Math.abs(dy) > Math.abs(dx)) {
          labelAngleDeg = 90;
        }
      }
      const labelAngle = (labelAngleDeg * Math.PI) / 180;
      const cosA = Math.cos(labelAngle),
        sinA = Math.sin(labelAngle);
      const labelGap = -engine.mm2cvs(5);
      const gapOffX = -labelGap * sinA;
      const gapOffY = labelGap * cosA;
      const adjCx = drawX + gapOffX;
      const adjCy = drawY + gapOffY;

      const { corners, minX, minY, maxX, maxY } = rotatedRectCorners(
        adjCx,
        adjCy,
        boxW,
        boxH,
        labelAngle,
      );
      r._labelBox = {
        cx: adjCx,
        cy: adjCy,
        w: boxW,
        h: boxH,
        angle: labelAngle,
        minX,
        minY,
        maxX,
        maxY,
        corners,
      };

      // Línea guía (leader): une la MITAD DEL LADO más cercano de la caja con el punto medio del
      // ramal, para amarrar visualmente la etiqueta flotante a su tubería (pedido explícito:
      // salir del lado, no de la esquina). Se recalcula en cada render, así que sigue
      // automáticamente a la etiqueta cuando se arrastra y al ramal cuando se mueve/estira/
      // encoge. Se salta cuando el punto medio cae DENTRO de la caja (etiqueta encima del ramal).
      if (r.pts.length >= 2) {
        const [mx, my] = _midpoint(r.pts);
        const mc = engine.toCvs(mx, my);
        const relX = mc.x - adjCx;
        const relY = mc.y - adjCy;
        const localX = relX * cosA + relY * sinA;
        const localY = -relX * sinA + relY * cosA;
        const midInside = Math.abs(localX) <= boxW / 2 && Math.abs(localY) <= boxH / 2;
        if (!midInside) {
          // Puntos medios de los 4 lados de la caja rotada (coordenadas canvas).
          const hw = boxW / 2;
          const hh = boxH / 2;
          const sideMids = [
            { x: adjCx + hw * cosA, y: adjCy + hw * sinA }, // derecho (local +w/2, 0)
            { x: adjCx - hw * cosA, y: adjCy - hw * sinA }, // izquierdo (local -w/2, 0)
            { x: adjCx + hh * sinA, y: adjCy - hh * cosA }, // inferior (local 0, +h/2)
            { x: adjCx - hh * sinA, y: adjCy + hh * cosA }, // superior (local 0, -h/2)
          ];
          let best = sideMids[0];
          let bestD = Infinity;
          for (const s of sideMids) {
            const d = Math.hypot(s.x - mc.x, s.y - mc.y);
            if (d < bestD) {
              bestD = d;
              best = s;
            }
          }
          // Ítem 1 (rev 4): la flecha de flujo del label vive en el lado INFERIOR de la caja (local
          // +h/2, trazo a +2·zoom del borde). Si el lado más cercano es ese inferior, la línea
          // guía se ancla a la MITAD del lado pero DETENIÉNDOSE antes de la flecha: centrada en
          // el eje de la flecha y separada de su trazo por un pequeño hueco — ni la cruza ni la
          // toca.
          if (showFlow && flowLen > 12 * engine.zoom) {
            const bdx = best.x - adjCx;
            const bdy = best.y - adjCy;
            const bLocalY = -bdx * sinA + bdy * cosA;
            if (Math.abs(bLocalY - hh) < 0.01) {
              const ay = hh + 5 * engine.zoom;
              best = { x: adjCx - ay * sinA, y: adjCy + ay * cosA };
            }
          }
          ctx.save();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 0.8 * engine.zoom;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(mc.x, mc.y);
          ctx.lineTo(best.x, best.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(labelAngle);
      ctx.translate(0, labelGap);
      // Deliberadamente ya no se pinta fondo — las etiquetas antes se apoyaban sobre una placa
      // blanca casi opaca; ahora se leen directamente sobre lo que haya debajo, según petición
      // explícita.
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
          ctx.font = s!.bold
            ? `bold ${fsInfo}px Geist, monospace`
            : `600 ${fsInfo}px Geist, monospace`;
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
        const arrowY = boxH / 2 + 2 * engine.zoom;
        ctx.save();
        ctx.translate(0, arrowY);
        const dot = flowDx * cosA + flowDy * sinA;
        const dir = dot >= 0 ? 1 : -1;
        const halfSize = nameW ? nameW / 2 : 12 * engine.zoom;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1 * engine.zoom;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-halfSize * dir, 0);
        ctx.lineTo(halfSize * dir, 0);
        ctx.stroke();
        const aSize = Math.min(6 * engine.zoom, halfSize * 0.6);
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
      r._labelBox = undefined;
    }

    ctx.restore();

    if (r.pts.length >= 2 && (r.id === engine.selId || (engine.multiSel || []).includes(r.id))) {
      let desvioBajante: PlanoBajante | null = null;
      const isDesvio = engine.bajantes.some((b) => {
        const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
        if (!disp || disp.Ldesvio !== r.id) return false;
        const gx = b.x + (disp.dx || 0),
          gy = b.y + (disp.dy || 0);
        const firstPt = r.pts[0],
          lastPt = r.pts[r.pts.length - 1];
        const nearParent = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
        const nearGhost = Math.hypot(lastPt[0] - gx, lastPt[1] - gy) < 0.5;
        if (nearParent && nearGhost) {
          desvioBajante = b;
          return true;
        }
        return false;
      });

      if (isDesvio && desvioBajante) {
        const baj: PlanoBajante = desvioBajante;
        const firstPt = r.pts[0];

        let startIdx = 0,
          nextIdx = 1;

        const firstIsParent = Math.hypot(firstPt[0] - baj.x, firstPt[1] - baj.y) < 0.5;
        // La punta de flecha va SIEMPRE sobre el extremo cuyo bajante tiene dirección 'baja' — no
        // siempre el mismo lado, porque el bajante padre (source) puede ser 'sube' o 'baja' según
        // en qué piso quede el otro extremo de la asociación (ver applyBajanteAssociation). Mismo
        // criterio que el indicador de flujo permanente más arriba.
        const parentIdx = firstIsParent ? 0 : r.pts.length - 1;
        const otherIdx = firstIsParent ? r.pts.length - 1 : 0;
        if (baj.direccion === 'baja') {
          startIdx = parentIdx;
          nextIdx = otherIdx;
        } else {
          startIdx = otherIdx;
          nextIdx = parentIdx;
        }

        const firstC = engine.toCvs(r.pts[startIdx][0], r.pts[startIdx][1]);
        const secondC = engine.toCvs(r.pts[nextIdx][0], r.pts[nextIdx][1]);
        const adx = secondC.x - firstC.x,
          ady = secondC.y - firstC.y;
        const alen = Math.hypot(adx, ady);

        if (alen > 2) {
          const unx = adx / alen,
            uny = ady / alen;
          const arrowR = 10 * engine.zoom;
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
          ctx.lineTo(
            cx - unx * arrowR + uny * arrowR * 0.4,
            cy - uny * arrowR - unx * arrowR * 0.4,
          );
          ctx.lineTo(
            cx - unx * arrowR - uny * arrowR * 0.4,
            cy - uny * arrowR + unx * arrowR * 0.4,
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else {
        let startIdx = 0;
        let nextIdx = 1;

        if (r._tribReversed && (r.tipo === 'tributario' || ['af', 'ac', 'gas'].includes(r.net))) {
          startIdx = r.pts.length - 1;
          nextIdx = r.pts.length - 2;
        }

        let isCodoReventiladoConnection = false;
        let codoEndIdx = -1;

        if (r.net === 'vent' || r.net === 'san') {
          const ventRamales = engine.ramales.filter((rm) => rm.net === 'vent');
          const sanRamales = engine.ramales.filter((rm) => rm.net === 'san');

          for (const vr of ventRamales) {
            for (const idx of [0, vr.pts.length - 1]) {
              const pt = vr.pts[idx];
              const connectsToSan = sanRamales.some((sr) =>
                sr.pts.some((sPt: number[]) => Math.hypot(pt[0] - sPt[0], pt[1] - sPt[1]) < 0.5),
              );
              if (connectsToSan) {
                const rEndIdx = [0, r.pts.length - 1].find(
                  (eIdx) => Math.hypot(r.pts[eIdx][0] - pt[0], r.pts[eIdx][1] - pt[1]) < 0.5,
                );
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
          for (const b of engine.bajantes || []) {
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
        const adx = secondC.x - firstC.x,
          ady = secondC.y - firstC.y;
        const alen = Math.hypot(adx, ady);
        if (alen > 2) {
          const unx = adx / alen,
            uny = ady / alen;
          const arrowR = 10 * engine.zoom;
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
          ctx.lineTo(
            cx - unx * arrowR + uny * arrowR * 0.4,
            cy - uny * arrowR - unx * arrowR * 0.4,
          );
          ctx.lineTo(
            cx - unx * arrowR - uny * arrowR * 0.4,
            cy - uny * arrowR + unx * arrowR * 0.4,
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  });

  // Dibujar accesorios de extremo (accesorioInicio/Fin) en su propio pase, después de que el
  // trazo del path de cada ramal ya se pintó — si no, la línea de un ramal iterado después
  // (p. ej. un ramal vent que comparte el punto final de un ramal san) pinta encima del
  // símbolo de accesorio de un ramal anterior en ese mismo punto.
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if (!((r.tipo === 'tributario' || r.tipo === 'ramal') && r.pts.length >= 2)) return;

    [0, r.pts.length - 1].forEach((idx) => {
      let accType = idx === 0 ? r.accesorioInicio : r.accesorioFin;
      // Item 8: un aparato (distinto de nevera) en un extremo AF/AC implica un codo 90° sube —
      // se dibuja el glifo junto al aparato aunque el campo de accesorio esté libre.
      if (!accType && (r.net === 'af' || r.net === 'ac')) {
        const app = idx === 0 ? r.aparatoInicio : r.aparatoFin;
        if (app && app !== 'nev') accType = 'codo90rmSube';
      }
      if (!accType) return;

      const pt = r.pts[idx];
      const c = engine.toCvs(pt[0], pt[1]);

      let dx = 0,
        dy = 0;
      if (idx === 0) {
        dx = r.pts[1][0] - r.pts[0][0];
        dy = r.pts[1][1] - r.pts[0][1];
      } else {
        dx = r.pts[idx][0] - r.pts[idx - 1][0];
        dy = r.pts[idx][1] - r.pts[idx - 1][1];
      }
      const len = Math.hypot(dx, dy);
      if (len > 0.01) {
        dx /= len;
        dy /= len;
      } else {
        dx = 1;
        dy = 0;
      }
      let px = -dy,
        py = dx;
      const branchDir = pickTeeBranchDir(engine, r.id, r.net, pt, dx, dy, px, py);
      px = branchDir.px;
      py = branchDir.py;
      const outX = idx === 0 ? -dx : dx;
      const outY = idx === 0 ? -dy : dy;

      // realMmToCanvasPx piso en 1mm de papel (ver PlanoEngine.ts) — dividir a la mitad el
      // argumento en mm solo es invisible a escalas comunes, ya que ambos caen en ese piso.
      // Se divide el resultado en px.
      const rad = engine.realMmToCanvasPx(23) * 0.6;

      const diamLabel = idx === 0 ? r.diametroInicio : r.diametroFin;

      // Ítem 6: el codo de plano en una esquina L (dos tuberías compartiendo el extremo) usa el
      // símbolo de codo de segmentos — arco + marcas, igual que un quiebre interior — en vez del
      // disco de respaldo con el texto "C90". Los codos de montante (codo90rmSube/Baja,
      // codoSube/Baja) conservan su disco (verticales, sin esquina en planta).
      const isPlanCodo =
        accType === 'codo90rm' ||
        accType === 'codos_90_std' ||
        accType === 'codo45' ||
        accType === 'codos_45';
      if (isPlanCodo) {
        // El arco necesita la dirección de la tubería SALIENDO del extremo (away): en el último
        // vértice dx/dy es la dirección de LLEGADA y con ella el arco salía al lado contrario de
        // la esquina ("codo al revés").
        const awayX = idx === 0 ? dx : -dx;
        const awayY = idx === 0 ? dy : -dy;
        // ponytail: un codo de plano sin esquina real (extremo muerto tras borrar el tributario
        // de una unión de guía) no dibuja nada — ni arco ni el disco de respaldo "C90".
        drawCornerCodoArc(ctx, engine, pt, { x: awayX, y: awayY });
        return;
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawExtremeAccessorySymbol(
        ctx,
        engine,
        accType,
        c,
        accType === 'teeTapon' || accType === 'teeLlaveTerminal' ? px : dx,
        accType === 'teeTapon' || accType === 'teeLlaveTerminal' ? py : dy,
        px,
        py,
        outX,
        outY,
        rad,
        diamLabel,
        r,
        idx === 0 ? 'ini' : 'fin',
      );
      ctx.restore();
      // Los glifos de codo (codoSube/codoBaja/codo90rmSube/codo90rmBaja) son discos blancos
      // rellenos dibujados en este pase, DESPUÉS del path del ramal — si el extremo queda cerca
      // del quiebre interior (ramal corto de 2 segmentos), el disco tapa el arco del codo del
      // quiebre. Redibujar solo las marcas de codo (arco/inglete + marcas T_A/T_C, sin el cuerpo
      // de la tubería) para que el símbolo del quiebre interior siga visible.
      if (
        accType === 'codoSube' ||
        accType === 'codoBaja' ||
        accType === 'codo90rmSube' ||
        accType === 'codo90rmBaja'
      ) {
        drawRamalPath(ctx, r.pts, engine, '', { marksOnly: true });
      }
    });
  });

  // Dibujar símbolos de aparato (fixture) en los extremos de ramal. aparatoInicio/aparatoFin
  // guardan un id de fixture (id de APARATOS_DEF como 'lvm'/'duc') asignado vía el dropdown
  // "Seleccionar Aparato". Los fixtures son imágenes webp (APARATO_IMG), no paths vectoriales
  // como los accesorios, así que se renderizan con ctx.drawImage y un cache de nivel de módulo
  // con carga asíncrona (ver aparatoImgCache arriba) — cuando una imagen por fin carga, el
  // engine re-renderiza para que el símbolo aparezca sin interacción del usuario.
  const getAparatoImg = (src: string): HTMLImageElement | null => {
    if (aparatoImgCache.has(src)) return aparatoImgCache.get(src) || null;
    aparatoImgCache.set(src, null);
    const img = new Image();
    img.onload = () => {
      aparatoImgCache.set(src, img);
      engine.render();
    };
    img.onerror = () => {
      aparatoImgCache.set(src, null);
    };
    img.src = src;
    return null;
  };
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if (!((r.tipo === 'tributario' || r.tipo === 'ramal') && r.pts.length >= 2)) return;
    // En AF/AC el símbolo del aparato no se dibuja: el glifo de accesorio implícito (codo 90°
    // sube junto al aparato, arriba) ya marca el extremo y la imagen del fixture solo ensucia
    // el plano. En san se mantiene.
    if (r.net === 'af' || r.net === 'ac') return;

    [0, r.pts.length - 1].forEach((idx) => {
      const appType = idx === 0 ? r.aparatoInicio : r.aparatoFin;
      if (!appType) return;
      const imgSrc = (APARATO_IMG as Record<string, string>)[appType];
      if (!imgSrc) return;
      const img = getAparatoImg(imgSrc);
      if (!img) return; // todavía cargando — onload re-renderiza este pase

      const pt = r.pts[idx];
      const c = engine.toCvs(pt[0], pt[1]);

      let dx = 0,
        dy = 0;
      if (idx === 0) {
        dx = r.pts[1][0] - r.pts[0][0];
        dy = r.pts[1][1] - r.pts[0][1];
      } else {
        dx = r.pts[idx][0] - r.pts[idx - 1][0];
        dy = r.pts[idx][1] - r.pts[idx - 1][1];
      }
      const len = Math.hypot(dx, dy);
      if (len > 0.01) {
        dx /= len;
        dy /= len;
      } else {
        dx = 1;
        dy = 0;
      }
      const outX = idx === 0 ? -dx : dx;
      const outY = idx === 0 ? -dy : dy;

      const rad = engine.realMmToCanvasPx(23) * 0.9;
      const size = rad * 2;
      ctx.save();
      // Quedar apenas al lado exterior de la tubería para que la línea del ramal siga visible
      // bajo el símbolo.
      ctx.translate(c.x + outX * rad * 0.3, c.y + outY * rad * 0.3);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  });

  // Dibujar accesorios de mitad de ramal (accMed*) — accesorios asignados a vértices interiores
  // con clic derecho sobre el cuerpo de un ramal, en vez de un extremo. La dirección es la
  // bisectriz de los dos segmentos adyacentes (un vértice interior tiene un segmento "entrante"
  // y uno "saliente", a diferencia de un extremo).
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if (!r.accMed || !r.pts || r.pts.length < 3) return;

    for (const key of Object.keys(r.accMed)) {
      const m = key.match(/^accMed(\d+)$/);
      if (!m) continue;
      const idx = parseInt(m[1], 10);
      if (idx <= 0 || idx >= r.pts.length - 1) continue;
      const accType = r.accMed[key];
      if (!accType) continue;
      // En AF/AC/gas los glifos de codo ya no se dibujan (codo90rc/rm/rl, sube/baja, codo45rc,
      // codos_90_std): el arco que dibuja drawRamalPath en cada quiebre ES el codo — el círculo
      // "C90"/"C45" al lado solo reduce.
      if (
        (accType.startsWith('codo90') ||
          accType.startsWith('codo45') ||
          accType.startsWith('codos_90')) &&
        (r.net === 'af' || r.net === 'ac' || r.net === 'gas')
      ) {
        continue;
      }

      const pt = r.pts[idx];

      // Un montante creado a mitad de cuerpo (createMontanteMidBody) auto-escribe este mismo
      // accMed como su contabilidad "implica una tee", pero el círculo+símbolo de dirección del
      // propio montante ya se renderiza justo encima de este mismo punto — dibujar el glifo de
      // tee completo además solo se veía como una línea gruesa estampada sobre el montante. Se
      // salta el glifo dondequiera que haya un bajante.
      const hasBajanteHere = engine.bajantes.some(
        (b) => Math.hypot(b.x - pt[0], b.y - pt[1]) < 0.5,
      );
      if (hasBajanteHere) continue;

      const c = engine.toCvs(pt[0], pt[1]);

      const dxIn = pt[0] - r.pts[idx - 1][0],
        dyIn = pt[1] - r.pts[idx - 1][1];
      const lenIn = Math.hypot(dxIn, dyIn);
      const dxOut = r.pts[idx + 1][0] - pt[0],
        dyOut = r.pts[idx + 1][1] - pt[1];
      const lenOut = Math.hypot(dxOut, dyOut);
      const uxIn = lenIn > 0.01 ? dxIn / lenIn : 1,
        uyIn = lenIn > 0.01 ? dyIn / lenIn : 0;
      const uxOut = lenOut > 0.01 ? dxOut / lenOut : uxIn,
        uyOut = lenOut > 0.01 ? dyOut / lenOut : uyIn;

      let dx = uxIn + uxOut,
        dy = uyIn + uyOut;
      const bisLen = Math.hypot(dx, dy);
      if (bisLen > 0.01) {
        dx /= bisLen;
        dy /= bisLen;
      } else {
        dx = uxIn;
        dy = uyIn;
      }
      // Calcular dos direcciones perpendiculares desde la bisectriz (dirección de paso). Para
      // teeReduccion y teeLado, el brazo de la rama apunta hacia la dirección REAL del ramal
      // que cruza — no ciegamente hacia arriba de pantalla. Cae a la convención "arriba de
      // pantalla" cuando no se encuentra ningún ramal cruzando (accesorio aislado).
      let px = -dy,
        py = dx;
      const branchDir = pickTeeBranchDir(engine, r.id, r.net, pt, dx, dy, px, py);
      px = branchDir.px;
      py = branchDir.py;

      // realMmToCanvasPx piso en 1mm de papel (ver PlanoEngine.ts) — dividir a la mitad el
      // argumento en mm solo es invisible a escalas comunes, ya que ambos caen en ese piso.
      // Se divide el resultado en px.
      const rad = engine.realMmToCanvasPx(23) * 0.6;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawExtremeAccessorySymbol(ctx, engine, accType, c, dx, dy, px, py, px, py, rad);
      ctx.restore();
    }
  });

  // Las uniones vent↔san ahora se manejan geométricamente por renderJunctions (vent agrupado en
  // el pase sanitaria), produciendo el glifo tee/yee correcto según la geometría — no más codo
  // reventilado forzado en cada contacto vent-san, que es por lo que el pase viejo de
  // renderVentCodos ya no existe.
  renderJunctions(ctx, engine);
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine.activeRamal) return;
  const ar = engine.activeRamal;
  const net = NETS.find((n) => n.id === ar.net);
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
    const px = pt[0],
      py = pt[1];
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
    mp = engine.snapAngle(last[0], last[1], mp.x, mp.y, ar.net, ar.tipo);
  }

  // Indicador de conexión (ítem 16): círculo cyan punteado cuando el cursor está lo bastante
  // cerca de un elemento existente para conectarse — ramales/tributarios (vértice o cuerpo,
  // vía snapToExisting o el snap 45° al padre) o bajantes. Mismo estilo que el indicador que
  // ya existía para bajantes, ahora unificado para toda conexión posible.
  const connCircle = (cx: number, cy: number, r: number) => {
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(34,211,238,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const activeRamales = engine.ramales.filter((r) => r.net === ar.net);
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
      const sc = engine.toCvs(mp.x, mp.y);
      connCircle(sc.x, sc.y, 4 * engine.zoom);
      break;
    }
  }

  if (!snapped) {
    const sp = engine.snapToExisting(mp.x, mp.y, ar.net, ar.tipo);
    if (sp) {
      mp = sp;
      const sc = engine.toCvs(mp.x, mp.y);
      connCircle(sc.x, sc.y, 4 * engine.zoom);
    }
  }

  const bajThresh = 20 / engine.zoom;
  const nearBaj = engine.bajantes.find((b) => {
    if (engine._hiddenNets.has(b.net) || b.net !== ar.net) return false;
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''] || {};
    return (
      Math.hypot(origMp.x - (b.x + (disp.dx || 0)), origMp.y - (b.y + (disp.dy || 0))) < bajThresh
    );
  });
  if (nearBaj) {
    const disp = nearBaj.desplazamientos?.[engine.nivelActual?.label ?? ''] || {};
    const bx = nearBaj.x + (disp.dx || 0);
    const by = nearBaj.y + (disp.dy || 0);
    mp = { x: bx, y: by };
    snapped = true;
    const bc = engine.toCvs(bx, by);
    connCircle(bc.x, bc.y, 5 * engine.zoom);
  }

  const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
  const SNAP_CLOSE = 12 / engine.zoom;
  if (ar.pts.length >= 3 && distFirst < SNAP_CLOSE) {
    const fc = engine.toCvs(first[0], first[1]);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 4 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 4 * engine.zoom, 0, Math.PI * 2);
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

  const segPx = Math.hypot(mp.x - last[0], mp.y - last[1]);
  const segM = +engine.pxToM(segPx).toFixed(2);
  const deg = (Math.atan2(mp.y - last[1], mp.x - last[0]) * 180) / Math.PI;
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
