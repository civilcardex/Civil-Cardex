import type { EngineFull } from '../engineFull.ts';
import { renderDims, renderDimGhost } from '../renderers/renderDimensions.ts';
import { renderGuideLines, renderGuideGhost } from '../renderers/renderGuideLines.ts';
import { renderTexts } from '../renderers/renderTextAnnotations.ts';
import { renderGrid } from '../renderers/renderGrid.ts';
import { renderAreas, renderActiveArea } from '../renderers/renderAreas.ts';
import {
  renderBajantes,
  renderGhosts,
  renderCrossFloorGhosts,
  renderCanalGhost,
} from '../renderers/renderBajantes.ts';
import { renderRamales, renderActiveRamal } from '../renderers/renderRamales.ts';
import { renderNetCrossings } from '../renderers/renderNetCrossings.ts';
import { iniciarFrame, terminarFrame } from '../renderers/frameIndex.ts';

/**
 * Un cuadro del plano: ajusta el lienzo al área visible, aplica el transform del zoom al wrapper
 * del PDF y repinta las capas en orden (cuadrícula, guías, cotas, textos, áreas, ramales,
 * bajantes y fantasmas XFG (fantasma entrepisos)). Movido tal cual de PlanoEngine.render — el
 * método de la clase solo delega; el índice geométrico del frame lo comparten los renderers.
 */
export function renderFrame(engine: EngineFull): void {
  engine.ensureCanvasSize();
  const ctx = engine.ctx;
  const w = engine.canv.width,
    h = engine.canv.height;
  // ponytail: canvas sin tamaño (montaje/viewport oculto) — pintar es trabajo tirado.
  if (w === 0 || h === 0) return;
  // Sin LÁMINA conocida el contenedor todavía no tiene su tamaño final: pintar el trazo
  // ahí lo deja en un recuadro provisional y el dibujo salta al llegar el PDF (orig.
  // usuario). El motor espera a que la lámina marque la medida buena.
  if (!engine.pageW || !engine.pageH) return;
  const t0 = performance.now();
  ctx.clearRect(0, 0, w, h);

  if (engine.pdfWrap) {
    const t = `translate(${engine.offX}px,${engine.offY}px) scale(${engine.zoom})`;
    if (t !== engine._lastTransform) {
      engine._lastTransform = t;
      engine.pdfWrap.style.transform = t;
      engine.pdfWrap.style.transformOrigin = '0 0';
      engine.pdfWrap.style.willChange = 'transform';
    }
  }

  // Índice geométrico del frame: lo construye UNA vez y lo comparten todos los renderers
  // (codos, uniones, etiquetas). Sin cambios de geometría se reutiliza: el paneo y el zoom
  // solo mueven la cámara.
  iniciarFrame(engine);
  try {
    if (engine.gridMode) renderGrid(ctx, engine);
    renderGuideLines(ctx, engine);
    renderDims(ctx, engine);
    renderTexts(ctx, engine);
    renderAreas(ctx, engine);
    const tRam = performance.now();
    renderRamales(ctx, engine);
    engine._perf.capas.ramales = performance.now() - tRam;
    const tBaj = performance.now();
    renderNetCrossings(ctx, engine);
    renderBajantes(ctx, engine);
    engine._perf.capas.bajantes = performance.now() - tBaj;
    renderGhosts(ctx, engine);
    renderCrossFloorGhosts(ctx, engine);
    renderDimGhost(ctx, engine);
    renderGuideGhost(ctx, engine);
    renderCanalGhost(ctx, engine);
    renderActiveArea(ctx, engine);
    renderActiveRamal(ctx, engine);
    engine._perf.frames++;
    engine._perf.totalMs = performance.now() - t0;
  } finally {
    terminarFrame();
  }

  if (engine.marqueeRect) {
    const { x1, y1, x2, y2 } = engine.marqueeRect;
    ctx.save();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 1 * engine.zoom;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.fillStyle = 'rgba(59,130,246,0.08)';
    ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.restore();
  }
}
