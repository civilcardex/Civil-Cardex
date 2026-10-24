import { NETS } from '../PlanoState.ts';
import { snapTributaryToPadre45Deg, _midpoint } from '../PlanoEngineDrawing.ts';
import { rotatedRectCorners } from '../HitTester.ts';
import { angleAtHalfLength, segmentAtPosition } from '../drawingAngles.ts';
import type { IPlanoEngineCore } from '../PlanoState.ts';
import { buildRamalLabelParts } from './ramalLabelText.ts';
import { renderLabelFlowArrow, renderEndpointFlowArrows } from './renderFlowArrows.ts';
import { renderAparatoSymbols } from './renderAparatoSymbols.ts';
import { drawRamalPath } from './drawRamalPath.ts';
import { drawExtremeAccessorySymbol, drawCornerCodoArc } from './renderAccessorySymbols.ts';
import { renderJunctions } from './renderJunctions.ts';
import { beginDeclutterFrame, desTapadoDelMotor, findFreeLabelCenter } from '../labelDeclutter.ts';
import { indiceFrame } from './frameIndex.ts';
import { anchoTexto } from './measureText.ts';
import { pickTeeBranchDir } from './teeUtils.ts';

export { pickTeeBranchDir };

// A qué distancia del punto medio una etiqueta automática se considera "desterrada" (en cajas
// de etiqueta, no en px: así el umbral escala con el tamaño del texto). El des-tapado puede
// alejarla hasta ~6.6 cajas (12 anillos × 0.55), y ninguna colocación legítima —creación,
// arrastre o edición— pasa de ~1 caja. 4 queda entre ambas: coge lo desterrado y no toca lo vivo.
const FAR_LABEL_BOXES = 4;

/** Índice red→config: evita buscar en NETS por cada ramal dibujado (antes O(ramales×redes)). */
const NET_POR_ID = new Map(NETS.map((n) => [n.id, n]));

/** Lado de la celda del índice de puntos (la tolerancia del codo reventilado es 0.5). */
const CELDA_PUNTOS = 0.5;

/**
 * Índice de puntos por celda para consultar "¿hay un punto a menos de 0.5?".
 *
 * Por qué: la comprobación del codo reventilado recorría TODOS los puntos de TODOS los
 * ramales sanitize, y se hacía por cada ramal y por cada frame del render (que se agenda
 * por rAF en cada mousemove del arrastre): O(ramales×puntos) por frame.
 *
 * @param pts puntos a indexar (en coordenadas de plano).
 * @returns función que responde si hay un punto a menos de 0.5 de (x, y).
 */
function indicePuntosCercanos(pts: number[][]): (x: number, y: number) => boolean {
  const celdas = new Map<string, number[][]>();
  for (const p of pts) {
    const k = `${Math.floor(p[0] / CELDA_PUNTOS)},${Math.floor(p[1] / CELDA_PUNTOS)}`;
    const arr = celdas.get(k);
    if (arr) arr.push(p);
    else celdas.set(k, [p]);
  }
  return (x: number, y: number) => {
    const cx = Math.floor(x / CELDA_PUNTOS);
    const cy = Math.floor(y / CELDA_PUNTOS);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = celdas.get(`${cx + dx},${cy + dy}`);
        if (!arr) continue;
        for (const p of arr) {
          if (Math.hypot(x - p[0], y - p[1]) < 0.5) return true;
        }
      }
    }
    return false;
  };
}

export function renderRamales(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const isTributarioMode = engine.tipoTramo === 'tributario' && engine.tool === 'line';
  const padreId = engine.padreTributario;
  // Foto de obstáculos para el auto-orden de etiquetas (solo mueve las nunca tocadas a mano).
  const declutter = beginDeclutterFrame(engine);
  let declutterNeedsSeed = false;
  // Memoria del des-tapado: con la misma geometría y el mismo zoom el sitio elegido por cada
  // etiqueta no cambia (se guarda como desplazamiento desde su centro, que el paneo no mueve),
  // así que mover la cámara no repite la espiral por etiqueta. Se desactiva mientras alguna
  // etiqueta movida a mano todavía no tenga caja: el frame siguiente debe re-converger.
  const firmaFrame = indiceFrame(engine).firma;
  const puedeMemorizar = !engine.ramales.some((rm) => rm.labelMoved && !rm._labelBox);
  const memoria = puedeMemorizar ? desTapadoDelMotor(engine, firmaFrame) : null;

  // Índices del frame (UNA vez, no por ramal): el render se agenda por rAF en cada
  // mousemove del arrastre, así que cualquier búsqueda lineal dentro del bucle de ramales
  // se multiplicaba por el número de ramales en cada frame.
  const ventRamales = engine.ramales.filter((rm) => rm.net === 'vent');
  const sanRamales = engine.ramales.filter((rm) => rm.net === 'san');
  const hayPuntoSanCercano = indicePuntosCercanos(sanRamales.flatMap((sr) => sr.pts));
  const bajantesSan = engine.bajantes.filter((b) => b.net === 'san');
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    const net = NET_POR_ID.get(r.net);
    const col = net ? net.col : '#e2e2e8';
    const sel = r.id === engine.selId;
    const isPadre = r.id === padreId;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = (sel ? 3 : 2) * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

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

    if (r.label || r.totalL || r.material || r.diametro || r.pendiente) {
      const lc = engine.toCvs(r.labelX, r.labelY);
      const FLOW_NETS = ['san', 'll', 'af', 'ac', 'gas'];
      const showFlow = FLOW_NETS.includes(r.net) && r.pts.length >= 2;
      let flowDx = 0,
        flowDy = 0,
        flowLen = 0;
      if (showFlow) {
        // La dirección del flujo se define por el PRIMER segmento creado (pts[0]→pts[1]) — no
        // por el vector extremo-a-extremo, que en ramales multipunto cambia de orientación
        // visual al rotar/editar segmentos posteriores. Al ser un vector geométrico del propio
        // trazo, rota rígidamente con él y nunca se reinvierte por cambios de orientación.
        // Solo _tribReversed (decisión explícita del usuario) lo invierte. El Ldesvio (LD_)
        // usa la misma regla: sus pts nacen [anillo fantasma → bajante original], flecha hacia
        // el original.
        const seg = segmentAtPosition(r.pts, r.labelX, r.labelY);
        const useIdx = seg ? seg.idx : 0;
        const a = engine.toCvs(r.pts[useIdx][0], r.pts[useIdx][1]);
        const b = engine.toCvs(r.pts[useIdx + 1][0], r.pts[useIdx + 1][1]);
        const flip =
          r._tribReversed && (r.tipo === 'tributario' || ['af', 'ac', 'gas'].includes(r.net))
            ? -1
            : 1;
        flowDx = (b.x - a.x) * flip;
        flowDy = (b.y - a.y) * flip;
        flowLen = Math.hypot(flowDx, flowDy);
      }

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
        ctx.font = s!.bold
          ? `bold ${fsInfo}px Geist, monospace`
          : `600 ${fsInfo}px Geist, monospace`;
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
      const labelClear = Math.max(
        engine.mm2cvs(4) + 6 * engine.zoom,
        boxH * 0.35,
        16 * engine.zoom,
      );
      const labelGap = -(boxH / 2 + labelClear);
      const gapOffX = -labelGap * sinA;
      const gapOffY = labelGap * cosA;
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
    } else {
      r._labelBox = undefined;
    }

    ctx.restore();

    renderEndpointFlowArrows(ctx, engine, r, { ventRamales, hayPuntoSanCercano, bajantesSan });
  });

  // Primer frame tras cargar (cajas manuales aún sin calcular): el declutter trabajó sin
  // ellas; un solo pase extra converge. scheduleRender coalesca, no hay recursión.
  if (declutterNeedsSeed) engine.scheduleRender();

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
      // El codo/sifón solo se dibuja por el accesorio PERSISTIDO (accesorioInicio/Fin) o por un
      // aparato AF/AC implícito — nunca auto-generado por la presencia de un bajante en el otro
      // extremo (orig. usuario #4: crear un bajante no debe crear un codo 90° sube).
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
        accType === 'codo90rc' ||
        accType === 'codo90rm' ||
        accType === 'codo90rl' ||
        accType === 'codos_90_std' ||
        accType === 'codos_90_rl' ||
        accType === 'codo45' ||
        accType === 'codo45rc' ||
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
      drawExtremeAccessorySymbol({
        ctx,
        engine,
        accType,
        c,
        dx: accType === 'teeTapon' || accType === 'teeLlaveTerminal' ? px : dx,
        dy: accType === 'teeTapon' || accType === 'teeLlaveTerminal' ? py : dy,
        px,
        py,
        outX,
        outY,
        rad,
        diamLabel,
        ramal: r,
        slot: idx === 0 ? 'ini' : 'fin',
        declutter,
        // Hacia el cuerpo del ramal (los brazos de la horquilla del tapón abren al trazo).
        pipeToward: { x: -outX, y: -outY },
      });
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

  // Símbolos de aparato (fixture) en los extremos — pase extraído a renderAparatoSymbols.ts
  // (con su cache de imágenes de nivel de módulo).
  renderAparatoSymbols(ctx, engine);

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
      // En AF/AC/gas/vent los glifos de codo ya no se dibujan (codo90rc/rm/rl, sube/baja,
      // codo45rc, codos_90_std): el arco que dibuja drawRamalPath en cada quiebre ES el codo — el
      // círculo "C90"/"C45" al lado solo reduce (REV se dibujaba mal: arco + disco encima = mancha).
      if (
        (accType.startsWith('codo90') ||
          accType.startsWith('codo45') ||
          accType.startsWith('codos_90')) &&
        (r.net === 'af' || r.net === 'ac' || r.net === 'gas' || r.net === 'vent')
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
      drawExtremeAccessorySymbol({
        ctx,
        engine,
        accType,
        c,
        dx,
        dy,
        px,
        py,
        outX: px,
        outY: py,
        rad,
        declutter,
        // Horquilla del tapón a mitad de ramal: abierta a lo largo del eje del trazo.
        pipeToward: { x: dx, y: dy },
      });
      ctx.restore();
    }
  });

  // Las uniones vent↔san ahora se manejan geométricamente por renderJunctions (vent agrupado en
  // el pase sanitaria), produciendo el glifo tee/yee correcto según la geometría — no más codo
  // reventilado forzado en cada contacto vent-san, que es por lo que el pase viejo de
  // renderVentCodos ya no existe.
  // Tiempo de las uniones (tee/yee): va dentro de `capas.ramales`, se separa para saber si el
  // costo del frame está en el trazo o en las uniones (lo lee `__cfPerf` en DEV).
  const tJun = performance.now();
  renderJunctions(ctx, engine);
  const perf = (engine as { _perf?: { capas: Record<string, number> } })._perf;
  if (perf) perf.capas.junctions = performance.now() - tJun;
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine.activeRamal) return;
  const ar = engine.activeRamal;
  const net = NETS.find((n) => n.id === ar.net);
  const col = net ? net.col : '#e2e2e8';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
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
    ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
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
  // Item 5: preview igual que el trazo real — el vent pega en 45°/90° a ramales san.
  const snapCandidates =
    ar.net === 'vent'
      ? [...activeRamales, ...engine.ramales.filter((r) => r.net === 'san')]
      : activeRamales;
  for (const r of snapCandidates) {
    if (r.id === ar.id) continue;
    // Igual que el trazo real: un ramal no pega a tributarios (evita el círculo
    // cyan de conexión sobre un tributario que luego finishRamal rechaza).
    if (ar.tipo === 'ramal' && r.tipo === 'tributario') continue;
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
    ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
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
  ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
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
