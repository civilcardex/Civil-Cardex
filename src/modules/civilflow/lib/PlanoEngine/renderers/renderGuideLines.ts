import type { IPlanoEngineCore } from '../PlanoState';
import { rotatedRectCorners } from '../HitTester';
import { snapGuidePoint, snapGuideLineToRamal, guideRamalJunctions } from '../PlanoEngineDrawing';

// Las líneas guía son una ayuda de dibujo pura — punteadas, finas, gris apagado — para que
// nunca se confundan de un vistazo con un ramal real, estén o no seleccionadas (la selección
// solo cambia a un guion un poco más grueso, no a línea sólida, para conservar la distinción
// visible incluso al editar).
export function renderGuideLines(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.guideLines.forEach((g) => {
    const [p1, p2] = g.pts;
    const c1 = engine.toCvs(p1[0], p1[1]);
    const c2 = engine.toCvs(p2[0], p2[1]);
    const selected = engine.selId === g.id;

    ctx.save();
    ctx.strokeStyle = selected ? '#000000' : '#888888';
    ctx.lineWidth = (selected ? 1.5 : 1) * engine.zoom;
    ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Caja de hit-test para clic derecho/selección: un rectángulo fino alrededor del segmento,
    // generoso para que el clic sea fácil sin exigir precisión de píxel perfecto sobre la línea
    // punteada misma.
    const cx = (c1.x + c2.x) / 2;
    const cy = (c1.y + c2.y) / 2;
    const w = Math.hypot(c2.x - c1.x, c2.y - c1.y);
    const h = 16 * engine.zoom;
    const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
    const rect = rotatedRectCorners(cx, cy, w, h, angle);
    g._labelBox = { cx, cy, w, h, angle, ...rect };
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
}

export function renderGuideGhost(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine._guideStart || engine.tool !== 'guide') return;
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const snapped = snapGuidePoint(engine, engine._guideStart, mp.x, mp.y);
  // Mismo snap de conexión que el clic final: el ghost ya muestra la guía trasladada/rotada
  // sobre el extremo del ramal cuando pasa cerca con ángulo fuera de snap.
  const line = snapGuideLineToRamal(engine, engine._guideStart, snapped);
  const s = engine.toCvs(line.s.x, line.s.y);
  const e = engine.toCvs(line.p.x, line.p.y);

  ctx.save();
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 1 * engine.zoom;
  ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Ítem 3 (guías): conexión de cruce guía-ramal — círculo cyan SOLO mientras se dibuja la
  // guía (antes de finalizarla como trazo), en cada punto donde el ghost cruza o toca un ramal.
  // Mismo estilo que el círculo de conexión de los ramales (connCircle).
  const ghostGuide = {
    pts: [
      [line.s.x, line.s.y],
      [line.p.x, line.p.y],
    ] as [number, number][],
  };
  for (const j of guideRamalJunctions(engine.ramales, ghostGuide)) {
    const jc = engine.toCvs(j.point[0], j.point[1]);
    guideConnCircle(ctx, engine, jc.x, jc.y, 4 * engine.zoom);
  }

  // Indicador de conexión (ítem 16): cuando el snap pegó el extremo de la guía a un elemento
  // existente (o el snap de conexión trasladó/rotó la línea sobre un extremo de ramal), el
  // ghost se dibuja en el punto snapped — el círculo cyan marca que el segundo clic conectará
  // ahí.
  if (engine.snapMode && (Math.abs(line.p.x - mp.x) > 1e-9 || Math.abs(line.p.y - mp.y) > 1e-9)) {
    guideConnCircle(ctx, engine, e.x, e.y, 4 * engine.zoom);
  }
}
