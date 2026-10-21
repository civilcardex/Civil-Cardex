// Handlers de anotaciones (cota, texto, área) y snap final de cota.// Extraídos verbatim de lineTool (des-monolitización 2026-10-06).
import { NETS } from './PlanoState.ts';
import type { IPlanoEngineCore } from './PlanoState.ts';

import { _statusMsg } from './ramalMeasure.ts';
import { finishArea } from './drawingUtils.ts';

/** Herramienta de cotas (las medidas que se ponen sobre el plano): el primer clic marca el inicio
 *  y el segundo cierra la medida con su línea y su largo. */
export function handleDimDown(engine: IPlanoEngineCore, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (engine.snapMode) {
    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) pt = sp;
  }
  if (!engine._dimStart) {
    engine._dimStart = { x: pt.x, y: pt.y };
    // PUNTO (orig. usuario): sin esto, el preview heredaba el _dimPreviewPt de la cota
    // anterior (posiblemente lejano) y el primer clic pintaba una línea larga fantasma.
    engine._dimPreviewPt = null;
  } else {
    const s = engine._dimStart;
    let endPt: { x: number; y: number } = { x: pt.x, y: pt.y };
    if (engine.snapMode) {
      endPt = dimSnapEnd(engine, s, pt);
    }
    const len = Math.hypot(endPt.x - s.x, endPt.y - s.y);
    engine.dims.push({
      id: 'D' + Date.now(),
      x1: s.x,
      y1: s.y,
      x2: endPt.x,
      y2: endPt.y,
      L: engine.pxToM(len),
    });
    engine._dimStart = null;
    engine._dimPreviewPt = null;
    // PUNTO 2 (orig. usuario): sin _markDirty la cota jamás llegaba al autosave — solo vivía
    // en memoria y desaparecía al recargar (nada en caché local ni en BD).
    engine._markDirty();
    engine.render();
  }
}

/** Pone una nota de texto en el punto donde hiciste clic (te pregunta qué quieres escribir). */
export function handleTextDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (engine._onRequestTextCb) {
    engine._onRequestTextCb(px, py, (t: string) => {
      if (t) {
        const tid = 'T' + Date.now();
        engine.textAnnots.push({
          id: tid,
          x: px,
          y: py,
          text: t,
          fontMm: 2.5,
          boxW: 0,
          lblOffX: 0,
          lblOffY: 0,
          textAngle: 0,
        });
        engine.selId = tid;
        engine._emitSelect(engine.textAnnots[engine.textAnnots.length - 1]);
        engine.render();
        engine._markDirty();
      }
    });
  } else {
    const t = prompt('Texto:');
    if (t) {
      const tid2 = 'T' + Date.now();
      engine.textAnnots.push({
        id: tid2,
        x: px,
        y: py,
        text: t,
        fontMm: 2.5,
        boxW: 0,
        lblOffX: 0,
        lblOffY: 0,
        textAngle: 0,
      });
    }
  }

  engine.render();
  engine._markDirty();
}

/** Herramienta de áreas: cada clic agrega una esquina al polígono, y se cierra al volver al
 *  punto inicial (queda la superficie pintada). */
export function handleAreaDown(engine: IPlanoEngineCore, px: number, py: number): void {
  let pt: { x: number; y: number } = { x: px, y: py };
  if (!engine.activeArea) {
    if (engine.snapMode) pt = engine.snapAngle(px, py, pt.x, pt.y);
    const netCol =
      (NETS.find((n) => n.id === engine.activeNet)?.col || 'rgba(0,220,229,0.2)') + '33';
    engine.activeArea = { pts: [[pt.x, pt.y]], color: netCol };
  } else {
    const last = engine.activeArea.pts[engine.activeArea.pts.length - 1];
    const first = engine.activeArea.pts[0];
    if (engine.snapMode) pt = engine.snapAngle(last[0], last[1], pt.x, pt.y);
    const sp = engine.snapToExisting(pt.x, pt.y);
    if (sp) pt = sp;
    const distFirst = Math.hypot(pt.x - first[0], pt.y - first[1]);
    const SNAP_CLOSE = 12 / engine.zoom;
    if (engine.activeArea.pts.length >= 3 && distFirst < SNAP_CLOSE) {
      finishArea(engine);
      return;
    }
    engine.activeArea.pts.push([pt.x, pt.y]);
  }
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

/** Ajuste del extremo de la cota: la MISMA regla del clic (ángulo legal + pegarse a elementos
 *  existentes). También la usa la vista previa mientras mueves el mouse, para que lo que se ve
 *  sea exactamente lo que aterriza al soltar. */
export function dimSnapEnd(
  engine: IPlanoEngineCore,
  start: { x: number; y: number },
  raw: { x: number; y: number },
): { x: number; y: number } {
  let endPt = engine.snapAngle(start.x, start.y, raw.x, raw.y);
  const sp = engine.snapToExisting(endPt.x, endPt.y);
  if (sp) endPt = sp;
  // Snap también a LÍNEAS GUÍA (las referencias punteadas): proyección sobre cada segmento
  // de la guía si el punto cae cerca — así las cotas a una misma guía son deterministas.
  let bestD = Infinity;
  let guidePt: { x: number; y: number } | null = null;
  for (const g of engine.guideLines || []) {
    if (!g.pts || g.pts.length < 2) continue;
    for (let i = 0; i + 1 < g.pts.length; i++) {
      const ax = g.pts[i][0];
      const ay = g.pts[i][1];
      const bx = g.pts[i + 1][0];
      const by = g.pts[i + 1][1];
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.001) continue;
      let t = ((endPt.x - ax) * dx + (endPt.y - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const fx = ax + t * dx;
      const fy = ay + t * dy;
      const d = Math.hypot(endPt.x - fx, endPt.y - fy);
      if (d < bestD) {
        bestD = d;
        guidePt = { x: fx, y: fy };
      }
    }
  }
  const TH = 12 / (engine.zoom || 1);
  if (guidePt && bestD <= TH) endPt = guidePt;
  return endPt;
}
