import type { IPlanoEngineCore } from '../PlanoState.ts';
import { rotatedRectCorners } from '../HitTester.ts';
import {
  snapGuidePoint,
  snapGuideSegmentToRamal,
  guideRamalJunctions,
} from '../PlanoEngineDrawing.ts';

/** Líneas guía (ayuda de dibujo): punteadas, finas, gris apagado para no confundirse con un ramal real; seleccionada pasa a guion negro más grueso, nunca a línea sólida. */
export function renderGuideLines(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.guideLines.forEach((g) => {
    if (!g.pts || g.pts.length < 2) return;
    // Selección individual O por arrastre (multiSel) — la guía completa se resalta.
    const selected = engine.selId === g.id || (engine.multiSel || []).includes(g.id);

    ctx.save();
    // MURO (red rci, ped. usuario): guía marcada esMuro se pinta gruesa y roja — confirmación
    // visual de que participa en la verificación de distancia de ramales a muros.
    if (g.esMuro) {
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2.5 * engine.zoom * (engine.lineWidthScale || 1);
    } else {
      ctx.strokeStyle = selected ? '#000000' : '#888888';
      ctx.lineWidth = (selected ? 1.5 : 1) * engine.zoom * (engine.lineWidthScale || 1);
    }
    ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
    ctx.beginPath();
    g.pts.forEach((p, i) => {
      const c = engine.toCvs(p[0], p[1]);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Flecha amarilla de selección (ped. usuario): mismo lenguaje visual que textos/bajantes —
    // triángulo #FFEB3B con borde negro en el EXTREMO INICIAL de la guía, apuntando al
    // vértice. Ej: clic en una guía → el triángulo marca cuál está seleccionada.
    if (selected && g.pts.length >= 2) {
      const a = engine.toCvs(g.pts[0][0], g.pts[0][1]);
      const r = 7 * engine.zoom;
      const ox = a.x + 14 * engine.zoom;
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom * (engine.lineWidthScale || 1);
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - r, a.y);
      ctx.lineTo(ox, a.y - r * 0.5);
      ctx.lineTo(ox, a.y + r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Caja de hit-test para clic derecho/selección (guías de 2 puntos): un rectángulo fino
    // alrededor del segmento. Multisegmento (L/U): sin caja única — el hit va por proximidad
    // a segmentos (guideBodyHit), una caja envolvente daría falsos positivos.
    if (g.pts.length === 2) {
      const c1 = engine.toCvs(g.pts[0][0], g.pts[0][1]);
      const c2 = engine.toCvs(g.pts[1][0], g.pts[1][1]);
      const cx = (c1.x + c2.x) / 2;
      const cy = (c1.y + c2.y) / 2;
      const w = Math.hypot(c2.x - c1.x, c2.y - c1.y);
      const h = 16 * engine.zoom;
      const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
      const rect = rotatedRectCorners(cx, cy, w, h, angle);
      g._labelBox = { cx, cy, w, h, angle, ...rect };
    } else {
      g._labelBox = undefined;
    }
  });
}

// Ítem 3 (guías): el círculo cyan de conexión es SOLO del trazo en curso (ghost) — una guía ya
// trazada no lleva ningún indicador (los símbolos reales de codo/tee los dibujan los ramales al
// convertir). Mismo estilo que el círculo de conexión de los ramales (connCircle).
function guideConnCircle(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  cx: number,
  cy: number,
  r: number,
): void {
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
}

/** Guía/MURO EN CURSO: vértices fijos + segmento al cursor YA CORREGIDO por el snap de ángulo —
 *  preview WYSIWYG de lo que quedará al hacer clic. Con el tool muro el preview sale rojo
 *  (nace esMuro nativo). */
export function renderGuideGhost(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine._guideStart || (engine.tool !== 'guide' && engine.tool !== 'muro')) return;
  const esMuro = engine.tool === 'muro';
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const raw = snapGuidePoint(engine, engine._guideStart, mp.x, mp.y);
  // Ítems 3/4: preview WYSIWYG — el segmento al cursor se muestra YA CORREGIDO si va a
  // conectar con un extremo de ramal en ángulo fuera de regla (mismo ajuste que hará el clic).
  const snapped = snapGuideSegmentToRamal(engine, engine._guideStart, raw);

  ctx.save();
  ctx.strokeStyle = esMuro ? '#f87171' : '#888888';
  ctx.lineWidth = (esMuro ? 2.5 : 1) * engine.zoom * (engine.lineWidthScale || 1);
  ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
  ctx.beginPath();
  // Ítem 2: la guía en construcción muestra sus vértices fijos + el segmento al cursor.
  const fixed: Array<{ x: number; y: number }> = (engine._guidePts || []).map((p) => ({
    x: p[0],
    y: p[1],
  }));
  const chain = [...fixed, snapped];
  chain.forEach((p, i) => {
    const c = engine.toCvs(p.x, p.y);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Ítem 3 (guías): conexión de cruce guía-ramal — círculo cyan SOLO mientras se dibuja la
  // guía (antes de finalizarla como trazo), en cada punto donde el ghost cruza o toca un ramal.
  // Mismo estilo que el círculo de conexión de los ramales (connCircle).
  const ghostGuide = {
    pts: chain.map((p) => [p.x, p.y] as [number, number]),
  };
  for (const j of guideRamalJunctions(engine.ramales, ghostGuide)) {
    const jc = engine.toCvs(j.point[0], j.point[1]);
    guideConnCircle(ctx, engine, jc.x, jc.y, 4 * engine.zoom);
  }

  // Indicador de conexión (ítem 16): cuando el snap pegó el extremo de la guía a un elemento
  // existente, el ghost se dibuja en el punto snapped — el círculo cyan marca que el clic
  // conectará ahí.
  if (engine.snapMode && (Math.abs(snapped.x - mp.x) > 1e-9 || Math.abs(snapped.y - mp.y) > 1e-9)) {
    const e = engine.toCvs(snapped.x, snapped.y);
    guideConnCircle(ctx, engine, e.x, e.y, 4 * engine.zoom);
  }
}
