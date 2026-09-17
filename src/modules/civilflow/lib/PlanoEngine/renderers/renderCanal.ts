import { NETS, type IPlanoEngineCore, type PlanoBajante } from '../PlanoState';
import { BORDE_LIBRE_CANAL_CM } from '../../../utils/calcRainwater';
import { renderBajanteLabel } from './bajanteLabels';

/** Rectángulo del canal recolectora en planta, con las flechas de flujo hacia cada bajante asociado. */
export function renderCanalGlyph(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  b: PlanoBajante,
): void {
  if (engine._hiddenNets.has(b.net)) return;
  const tl = engine.toCvs(b.x, b.y);
  const w = Math.max(engine.cmToCanvasPx(b.longitud || 0), 20);
  const h = Math.max(engine.cmToCanvasPx(b.base || 0), 14);
  const sel = b.id === engine.selId && !engine._isGhostSel;
  const col = NETS.find((n) => n.id === 'll')?.col || '#8B5CF6';

  // Flecha corta de flujo (misma forma que la flecha de flujo propia de un ramal); `stroke`
  // permite colorearla — la tubería externa del canal se dibuja en el color de la red ll.
  const drawFlowArrow = (
    tail: { x: number; y: number },
    head: { x: number; y: number },
    stroke = '#000',
  ) => {
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
    const aSize = Math.min(5 * engine.zoom, len * 0.55);
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(head.x - ux * aSize - uy * aSize * 0.45, head.y - uy * aSize + ux * aSize * 0.45);
    ctx.lineTo(head.x - ux * aSize + uy * aSize * 0.45, head.y - uy * aSize - ux * aSize * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  ctx.save();
  // Ítem 5: canal visualmente TRANSPARENTE — sin relleno y con líneas al ~45% de opacidad para
  // que ramales/bajantes dentro o atravesándolo sean legibles. Solo visual: el hit-test sigue
  // usando _canalBox/_circ (matemática pura), así que selección/asociación no cambian.
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = col;
  ctx.lineWidth = (sel ? 1.6 : 0.8) * engine.zoom * (engine.lineWidthScale || 1);
  // Perfil de canal: las líneas horizontales superior e inferior, más los dos segmentos
  // verticales laterales que cierran el contorno del canalón.
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tl.x + w, tl.y);
  ctx.moveTo(tl.x, tl.y + h);
  ctx.lineTo(tl.x + w, tl.y + h);
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tl.x, tl.y + h);
  ctx.moveTo(tl.x + w, tl.y);
  ctx.lineTo(tl.x + w, tl.y + h);
  // Ítem 4: líneas de pliegue longitudinales — misma posición que las muescas del isométrico
  // (exterior 15% / interior 10% desde cada borde, useIsometriaRender.ts:326-332), a todo lo
  // largo del canal: 15%, 25%, 75% y 85% de la base.
  const foldF = h * 0.15;
  const foldI = h * 0.25;
  for (const fy of [foldF, foldI, h - foldI, h - foldF]) {
    ctx.moveTo(tl.x, tl.y + fy);
    ctx.lineTo(tl.x + w, tl.y + fy);
  }
  ctx.stroke();
  // La flecha amarilla de selección vuelve a opacidad completa
  ctx.globalAlpha = 1;

  // Las manijas de redimensionado de esquina deliberadamente no se dibujan — el hit-test de
  // agarre en _tryCanalResizeHit de handleMouseDown.ts funciona puramente por proximidad a las
  // esquinas de `_canalBox` (calculadas abajo sin importar lo renderizado), así que el
  // redimensionado funciona igual sin los cuadrados visuales.

  // Flecha amarilla de selección — mismo estilo/forma que todo otro glifo del array de bajantes
  // muestra al seleccionarse (el loop principal de renderBajantes abajo), apuntando desde el
  // borde derecho.
  const inMultiSel = (engine.multiSel || []).includes(b.id);
  if ((sel || inMultiSel) && !engine._isGhostSel) {
    const arrowR = 8 * engine.zoom;
    const cy = tl.y + h / 2;
    const ox = tl.x + w + 14 * engine.zoom;
    ctx.fillStyle = '#FFEB3B';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6 * engine.zoom;
    ctx.beginPath();
    ctx.moveTo(ox - arrowR, cy);
    ctx.lineTo(ox, cy - arrowR * 0.5);
    ctx.lineTo(ox, cy + arrowR * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Flechas de flujo (orig. usuario): CON codos (ramales de canal) conectados, cada codo
  // recibe un PAR de flechas a lo largo del eje largo del canal — una desde la izquierda y
  // una desde la derecha — AMBAS apuntando HACIA el punto de salida del codo (el agua del
  // canal fluye hacia ese punto). La flecha central original desaparece. Sin codos: queda
  // la flecha central única según _canalFlowDir.
  ctx.save();
  ctx.globalAlpha = 0.9;
  const codosCanal = engine.ramales.filter(
    (rc) => rc.esCanalId === b.id && rc.pts && rc.pts.length >= 2,
  );
  if (codosCanal.length === 0) {
    const cx = tl.x + w / 2;
    const cy = tl.y + h / 2;
    const half = 7 * engine.zoom;
    const dir = b._canalFlowDir ?? (w >= h ? 'derecha' : 'abajo');
    if (dir === 'derecha') drawFlowArrow({ x: cx - half, y: cy }, { x: cx + half, y: cy });
    else if (dir === 'izquierda') drawFlowArrow({ x: cx + half, y: cy }, { x: cx - half, y: cy });
    else if (dir === 'abajo') drawFlowArrow({ x: cx, y: cy - half }, { x: cx, y: cy + half });
    else drawFlowArrow({ x: cx, y: cy + half }, { x: cx, y: cy - half });
  } else {
    // Flechas CORTAS (mismo tamaño que la flecha central) y SEPARADAS del codo — un par
    // convergente por codo: la de la izquierda apunta →, la de la derecha apunta ←.
    const horizontal = w >= h;
    const sep = 10 * engine.zoom; // hueco entre la punta y el punto de salida del codo
    const len = 12 * engine.zoom; // largo de cada flecha (≈ la central)
    for (const rc of codosCanal) {
      // Salida del codo = inicio del ramal (el flujo siempre nace en el canal), proyectado
      // sobre el eje largo; la flecha corre al nivel transversal del punto de salida.
      const p = engine.toCvs(rc.pts[0][0], rc.pts[0][1]);
      if (horizontal) {
        const t = Math.min(1, Math.max(0, (p.x - tl.x) / w));
        const px = tl.x + t * w;
        const headL = { x: px - sep, y: p.y };
        const tailL = { x: headL.x - len, y: p.y };
        const headR = { x: px + sep, y: p.y };
        const tailR = { x: headR.x + len, y: p.y };
        if (tailL.x >= tl.x) drawFlowArrow(tailL, headL);
        if (tailR.x <= tl.x + w) drawFlowArrow(tailR, headR);
      } else {
        const t = Math.min(1, Math.max(0, (p.y - tl.y) / h));
        const py = tl.y + t * h;
        const headU = { x: p.x, y: py - sep };
        const tailU = { x: p.x, y: headU.y - len };
        const headD = { x: p.x, y: py + sep };
        const tailD = { x: p.x, y: headD.y + len };
        if (tailU.y >= tl.y) drawFlowArrow(tailU, headU);
        if (tailD.y <= tl.y + h) drawFlowArrow(tailD, headD);
      }
    }
  }
  ctx.restore();

  b._canalBox = { x: tl.x, y: tl.y, w, h };
  // _canalBox (el rectángulo visible) es el objetivo de clic del canal; _circ queda como ancla
  // de respaldo pequeña (mitad del lado más largo, NO la diagonal) para código que solo lee un
  // centro/radio — los hit-tests de clic/clic-derecho/inicio-de-ramal usan todos
  // canalRectHitDistance.
  b._circ = { x: tl.x + w / 2, y: tl.y + h / 2, r: Math.max(w, h) / 2 };

  if (b.code || b.code === '') {
    // Siempre centrada directamente debajo del rectángulo, fuera de él — no arrastrable
    // (ignora cualquier labelX/labelY/labelAngle guardado) y sin línea de guía, por pedido
    // explícito.
    const offDx = 0;
    const offDy = h + engine.mm2cvs(3);
    // El sufijo de piso ya viene incrustado en b.code al crearlo (CALL{n}-P{piso}) — un canal
    // vive en un solo piso, a diferencia del lvlSuffix dinámico por render del bajante.
    const line1 = b.code || '—';
    const dirText = `${b.base || 0}x${(b.altura || 0) + BORDE_LIBRE_CANAL_CM} S=2% L=${((b.longitud || 0) / 100).toFixed(2)}m`;
    renderBajanteLabel(
      ctx,
      engine,
      b,
      { x: tl.x + w / 2, y: tl.y },
      0,
      0,
      offDx,
      offDy,
      line1,
      dirText,
      '_labelBox',
      1,
      {
        skipLeader: true,
      },
    );
  } else {
    b._labelBox = undefined;
  }
}

// Vista previa de goma en vivo mientras la herramienta de canal está a mitad de arrastre
// (_canalStart fijado, primera esquina colocada, segundo clic aún no hecho) — mismo patrón de
// vista previa punteada que renderGuideGhost/renderDimGhost, más una lectura de dimensiones en
// cm en vivo (también mostrada en la barra de estado vía _statusMsg) para que el usuario vea el
// tamaño exacto antes de comprometer el segundo clic.
/** Versión fantasma del canal mientras se dibuja o arrastra. */
export function renderCanalGhost(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine._canalStart || engine.tool !== 'canal') return;
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const x = Math.min(engine._canalStart.x, mp.x);
  const y = Math.min(engine._canalStart.y, mp.y);
  const w = Math.abs(mp.x - engine._canalStart.x);
  const h = Math.abs(mp.y - engine._canalStart.y);
  const tl = engine.toCvs(x, y);
  const cw = w * engine.zoom;
  const ch = h * engine.zoom;

  ctx.save();
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
  ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
  ctx.beginPath();
  ctx.rect(tl.x, tl.y, cw, ch);
  ctx.stroke();
  ctx.setLineDash([]);

  const baseCm = Math.round(engine.pxToM(h) * 100);
  const longCm = Math.round(engine.pxToM(w) * 100);
  ctx.font = `${11 * engine.zoom}px Geist, monospace`;
  ctx.fillStyle = '#8B5CF6';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${baseCm} x ${longCm} cm`, tl.x, tl.y - 4 * engine.zoom);
  ctx.restore();
}

/**
 * Render principal de bajantes/montantes/contadores/calentadores/canales.
 * Dibuja símbolo, etiqueta con leader y hitbox; filtra por red oculta y estado ghost.
 * @param ctx - Contexto 2D del canvas.
 * @param engine - Motor con colecciones y escalas.
 */
