import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { rotatedRectCorners } from '../HitTester.ts';
import { _midpoint } from '../PlanoEngineDrawing.ts';
import { angleAtHalfLength } from '../drawingAngles.ts';
import { buildRamalLabelParts } from './ramalLabelText.ts';
import { renderLabelFlowArrow } from './renderFlowArrows.ts';
import { drawRamalPath } from './drawRamalPath.ts';
import {
  type DeclutterFrame,
  desTapadoConMemoria,
  findFreeLabelCenter,
  gapAnclaACaja,
} from '../labelDeclutter.ts';
import { anchoTexto } from './measureText.ts';

// A qué distancia del punto medio una etiqueta automática se considera "desterrada" (en cajas
// de etiqueta, no en px: así el umbral escala con el tamaño del texto). El des-tapado puede
// alejarla hasta ~6.6 cajas (12 anillos × 0.55), y ninguna colocación legítima —creación,
// arrastre o edición— pasa de ~1 caja. 4 queda entre ambas: coge lo desterrado y no toca lo vivo.
const FAR_LABEL_BOXES = 4;

/** Memoria del des-tapado (sitios elegidos por etiqueta mientras la geometría no cambia). */
export type MemoriaDetapado = ReturnType<typeof desTapadoConMemoria>;

/** Vector de flujo del ramal (lo calcula renderRamales del PRIMER segmento creado). */
export interface FlujoRamal {
  showFlow: boolean;
  flowDx: number;
  flowDy: number;
  flowLen: number;
}

/**
 * Cuerpo del ramal: el trazo (sólido, o punteado si es tributario / padre en modo tributario),
 * los puntos de selección (ocultando los vértices colineales) y el punto blanco de vista previa
 * al conectar un tributario al padre. Ej: un tributario T1 se pinta con línea discontinua.
 */
export function dibujaCuerpoRamal(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  r: PlanoRamal,
  col: string,
  sel: boolean,
  isPadre: boolean,
  isTributarioMode: boolean,
): void {
  if (r.pts.length > 1) {
    if (isPadre && isTributarioMode) {
      ctx.save();
      ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
      ctx.lineWidth = 3 * engine.zoom * (engine.lineWidthScale || 1);
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
      ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5 * engine.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Etiqueta flotante del ramal (nombre + material/diámetro/pendiente): caja rotada, des-tapado automático si nunca se movió a mano, línea guía y texto. Ej: "RS1" con "PVC · 2"" debajo. @returns true si quedó una etiqueta manual sin caja (hay que reprogramar un pase de render). */
export function dibujaEtiquetaRamal(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  r: PlanoRamal,
  col: string,
  declutter: DeclutterFrame,
  memoria: MemoriaDetapado | null,
  flujo: FlujoRamal,
): boolean {
  const { showFlow, flowDx, flowDy, flowLen } = flujo;
  let declutterNeedsSeed = false;
  const lc = engine.toCvs(r.labelX, r.labelY);

  // Ítem 1: formatos por red (san/ll/ac/af/gas compacto; vent y resto genérico) —
  // la construcción del texto vive en ramalLabelText.ts (pura y testeada).
  const { lbl, infoStr, matPart, dPart, pendPart, lblPart } = buildRamalLabelParts(
    r,
    engine.nivelActual?.n,
  );
  const showGuide = r.showGuide !== false;

  const fsName = engine.mm2cvs(engine.MM.lblName * engine.labelScaleM);
  const fsInfo = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM);
  const lineHName = fsName + 2;
  const lineHInfo = fsName + 4;
  const boxPadX = engine.mm2cvs(1.0);
  const boxPadY = engine.mm2cvs(0.6);

  const infoSegs: Array<{ text: string; bold: boolean; w: number } | null> = infoStr
    ? [{ text: infoStr, bold: false, w: 0 }]
    : ([
        matPart ? { text: matPart, bold: false, w: 0 } : null,
        dPart ? { text: dPart, bold: true, w: 0 } : null,
        pendPart ? { text: pendPart, bold: false, w: 0 } : null,
        lblPart ? { text: lblPart, bold: false, w: 0 } : null,
      ].filter(Boolean) as Array<{ text: string; bold: boolean; w: number }>);
  const segSep = infoStr ? '' : ' · ';
  let sepW = 0;
  ctx.font = `600 ${fsInfo}px Geist, monospace`;
  if (infoSegs.length > 1) sepW = anchoTexto(ctx, segSep);
  for (const s of infoSegs) {
    ctx.font = s!.bold ? `bold ${fsInfo}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
    s!.w = anchoTexto(ctx, s!.text);
  }
  const totalInfoW = infoSegs.reduce(
    (sum: number, s, i) => sum + s!.w + (i < infoSegs.length - 1 ? sepW : 0),
    0,
  );

  ctx.font = `bold ${fsName}px Geist, monospace`;
  const nameW = lbl ? anchoTexto(ctx, lbl) : 0;
  const contentW = Math.max(nameW, totalInfoW);
  const boxW = contentW + boxPadX * 2;
  const boxH = (lbl ? lineHName : 0) + (infoSegs.length > 0 ? lineHInfo : 0) + boxPadY * 2;
  let drawX = lc.x;
  let drawY = lc.y;
  const labelAngleDeg = r.labelAngle != null ? r.labelAngle : angleAtHalfLength(r.pts || []);
  const labelAngle = (labelAngleDeg * Math.PI) / 180;
  const cosA = Math.cos(labelAngle),
    sinA = Math.sin(labelAngle);
  // Gap dinámico: el BORDE inferior de la caja (no su centro) queda separado del trazo.
  // El aire mínimo crece con la propia caja (35% de su alto) y tiene piso en píxeles de
  // pantalla (16·zoom): con menos aire las etiquetas quedaban muy encima del trazo y se
  // solapaban con él (orig. usuario). La línea guía (leader) mantiene la lectura clara.
  // labelClear es también la banda donde vive la flecha de flujo (ver más abajo).
  // gapAnclaACaja es la MISMA fórmula que usa dragLabel para re-anclar el primer agarre.
  const labelClear = Math.max(engine.mm2cvs(4) + 6 * engine.zoom, boxH * 0.35, 16 * engine.zoom);
  const labelGap = -(boxH / 2 + labelClear);
  const gapOff = gapAnclaACaja(boxH, labelAngle, engine.mm2cvs.bind(engine), engine.zoom);
  const gapOffX = gapOff.x;
  const gapOffY = gapOff.y;
  let adjCx = drawX + gapOffX;
  let adjCy = drawY + gapOffY;
  // Auto-orden: la etiqueta nunca movida a mano busca un sitio libre (espiral) si su caja
  // choca con otras etiquetas o trazos; la líder de abajo sigue sola al nuevo sitio.
  if (!r.labelMoved && r.pts.length >= 2) {
    // Autocuración: en una etiqueta automática labelX/labelY ES el punto medio del trazo
    // (así la pone finishRamal y lo reencasilla cada arrastre o edición del panel). Si aparece
    // a kilómetros de su punto medio, no lo puso el usuario: lo dejó un des-tapado de un
    // render anterior que se guardó (y se persistió en label_x). Como ese sitio equivocado
    // pasaba a ser el "por defecto" del frame siguiente —y allí estaba libre—, la etiqueta ya
    // no volvía nunca. Se reencasilla en el punto medio.
    const [mx, my] = _midpoint(r.pts);
    const midC = engine.toCvs(mx, my);
    if (Math.hypot(lc.x - midC.x, lc.y - midC.y) > boxW * FAR_LABEL_BOXES) {
      r.labelX = mx;
      r.labelY = my;
      drawX = midC.x;
      drawY = midC.y;
      adjCx = drawX + gapOffX;
      adjCy = drawY + gapOffY;
    }
    const spot = memoria
      ? memoria.busca(
          r.id,
          boxW,
          boxH,
          labelAngle,
          adjCx,
          adjCy,
          declutter.placed,
          declutter.segs,
          engine.zoom,
        )
      : findFreeLabelCenter(
          r.id,
          boxW,
          boxH,
          labelAngle,
          adjCx,
          adjCy,
          declutter.placed,
          declutter.segs,
        );
    if (spot) {
      // El sitio elegido es SOLO de este render: no se guarda en labelX/labelY. Antes sí se
      // escribía, y el frame siguiente lo tomaba como "por defecto" —ya libre, porque las
      // demás etiquetas seguían en su sitio— así que cada des-tapado empujaba la etiqueta un
      // poco más lejos (ratchet de hasta 12 anillos de la espiral, ~400 px) y el destino
      // quedaba persistido. Orig. usuario: etiquetas muy alejadas de su ramal al reingresar
      // al visor. La líder de abajo mantiene la lectura mientras el hueco siga ocupado.
      drawX = spot.x - gapOffX;
      drawY = spot.y - gapOffY;
      adjCx = spot.x;
      adjCy = spot.y;
    }
  } else if (r.labelMoved && !r._labelBox) {
    // Etiqueta manual sin caja calculada aún (primer frame tras cargar): el declutter de
    // este frame trabajó sin ella como obstáculo; reprogramar un pase para converger.
    declutterNeedsSeed = true;
  }

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
  // La caja final (auto o manual) es obstáculo para las siguientes etiquetas de este frame.
  declutter.placed.push({ id: r.id, minX, minY, maxX, maxY });

  // Línea guía (leader): une la MITAD DEL LADO más cercano de la caja con el punto medio del
  // ramal, para amarrar visualmente la etiqueta flotante a su tubería (pedido explícito:
  // salir del lado, no de la esquina). Se recalcula en cada render, así que sigue
  // automáticamente a la etiqueta cuando se arrastra y al ramal cuando se mueve/estira/
  // encoge. Se salta cuando el punto medio cae DENTRO de la caja (etiqueta encima del ramal).
  // Ítem 1: showGuide controla visibilidad de la guía.
  if (showGuide !== false && r.pts.length >= 2) {
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
      ctx.lineWidth = 0.8 * engine.zoom * (engine.lineWidthScale || 1);
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

  renderLabelFlowArrow(ctx, {
    engine,
    r,
    col,
    showFlow,
    flowDx,
    flowDy,
    flowLen,
    cosA,
    sinA,
    nameW,
    labelGap,
    labelClear,
    drawX,
    drawY,
    boxH,
  });
  ctx.restore();
  return declutterNeedsSeed;
}
