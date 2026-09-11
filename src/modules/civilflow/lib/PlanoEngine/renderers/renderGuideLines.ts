import type { IPlanoEngineCore } from '../PlanoState';
import { rotatedRectCorners } from '../HitTester';
import {
  snapGuidePoint,
  snapGuideSegmentToRamal,
  guideRamalJunctions,
} from '../PlanoEngineDrawing';

// Las líneas guía son una ayuda de dibujo pura — punteadas, finas, gris apagado — para que
// nunca se confundan de un vistazo con un ramal real, estén o no seleccionadas (la selección
// solo cambia a un guion un poco más grueso, no a línea sólida, para conservar la distinción
// visible incluso al editar).
export function renderGuideLines(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.guideLines.forEach((g) => {
    if (!g.pts || g.pts.length < 2) return;
    // Selección individual O por arrastre (multiSel) — la guía completa se resalta.
    const selected = engine.selId === g.id || (engine.multiSel || []).includes(g.id);

    ctx.save();
    ctx.strokeStyle = selected ? '#000000' : '#888888';
    ctx.lineWidth = (selected ? 1.5 : 1) * engine.zoom * (engine.lineWidthScale || 1);
    ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
    ctx.beginPath();
    g.pts.forEach((p, i) => {
      const c = engine.toCvs(p[0], p[1]);
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
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

export function renderGuideGhost(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine._guideStart || engine.tool !== 'guide') return;
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const raw = snapGuidePoint(engine, engine._guideStart, mp.x, mp.y);
  // Ítems 3/4: preview WYSIWYG — el segmento al cursor se muestra YA CORREGIDO si va a
  // conectar con un extremo de ramal en ángulo fuera de regla (mismo ajuste que hará el clic).
  const snapped = snapGuideSegmentToRamal(engine, engine._guideStart, raw);

  ctx.save();
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
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
