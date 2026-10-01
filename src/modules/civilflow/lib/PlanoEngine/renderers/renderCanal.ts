import { NETS, type IPlanoEngineCore, type PlanoBajante } from '../PlanoState';
import { BORDE_LIBRE_CANAL_CM } from '../../../utils/calcRainwater';
import { renderBajanteLabel } from './bajanteLabels';
import {
  canalMarco,
  canalToLocal,
  esquinasCanalOBB,
  normalizarCanal,
  geometriaCanalDesdePuntos,
  geometriaCanalAncho,
  norm180,
  pxPerCmDe,
  puntoAnchoMinimo,
} from '../canalAssociation';

/** Rectángulo del canal recolectora en planta, con las flechas de flujo hacia cada bajante asociado. */
export function renderCanalGlyph(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  b: PlanoBajante,
): void {
  if (engine._hiddenNets.has(b.net)) return;
  // Marco efectivo en px de PLANO (pxPerCm real del doc — con 1 el tamaño salía mal y
  // el ghost no calzaba con el cursor); a canvas con toCvs/zoom aquí.
  const mPlano = canalMarco(engine.cmToPlanePx(1), b);
  const oCvs = engine.toCvs(mPlano.x, mPlano.y);
  const w = Math.max(mPlano.w * engine.zoom, 20);
  const h = Math.max(mPlano.h * engine.zoom, 14);
  const ang = mPlano.angRad;
  // AABB del OBB rotado (broadphase de clic + ancla de etiqueta).
  const _cs = esquinasCanalOBB({ x: 0, y: 0, w, h, angRad: ang });
  const _xs = _cs.map((c) => oCvs.x + c.x);
  const _ys = _cs.map((c) => oCvs.y + c.y);
  const boxX = Math.min(..._xs);
  const boxY = Math.min(..._ys);
  const boxW = Math.max(..._xs) - boxX;
  const boxH = Math.max(..._ys) - boxY;
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
  ctx.translate(oCvs.x, oCvs.y);
  ctx.rotate(ang);
  // Ítem 5: canal visualmente TRANSPARENTE — sin relleno y con líneas al ~45% de opacidad para
  // que ramales/bajantes dentro o atravesándolo sean legibles. Solo visual: el hit-test sigue
  // usando _canalBox/_circ (matemática pura), así que selección/asociación no cambian.
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = col;
  ctx.lineWidth = (sel ? 1.6 : 0.8) * engine.zoom * (engine.lineWidthScale || 1);
  // Perfil de canal en marco LOCAL (eje largo = X siempre tras normalizar): contorno +
  // pliegues longitudinales PARALELOS al eje — en un canal vertical/diagonal quedan
  // verticales/diagonales con el eje (ítem 1 usuario), no horizontales fijos.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.moveTo(0, h);
  ctx.lineTo(w, h);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(w, h);
  // Ítem 4: líneas de pliegue longitudinales — misma posición que las muescas del isométrico
  // (exterior 15% / interior 10% desde cada borde, useIsometriaRender.ts), a todo lo LARGO
  // del canal: corren PARALELAS al eje (local X = longitud) en 15%, 25%, 75% y 85% del
  // ANCHO (base, eje local Y). Vertical/diagonal: giran con el eje, nunca fijas.
  const foldF = h * 0.15;
  const foldI = h * 0.25;
  for (const fy of [foldF, foldI, h - foldI, h - foldF]) {
    ctx.moveTo(0, fy);
    ctx.lineTo(w, fy);
  }
  ctx.stroke();
  // La flecha amarilla de selección vuelve a opacidad completa
  ctx.globalAlpha = 1;

  // Las manijas de redimensionado de esquina deliberadamente no se dibujan — el hit-test de
  // agarre en _tryCanalResizeHit de handleMouseDown.ts funciona puramente por proximidad a las
  // esquinas del OBB (calculadas abajo sin importar lo renderizado), así que el
  // redimensionado funciona igual sin los cuadrados visuales.

  // Flecha amarilla de selección — mismo estilo/forma que todo otro glifo del array de bajantes
  // muestra al seleccionarse (el loop principal de renderBajantes abajo), apuntando desde el
  // borde derecho.
  const inMultiSel = (engine.multiSel || []).includes(b.id);
  if ((sel || inMultiSel) && !engine._isGhostSel) {
    const arrowR = 8 * engine.zoom;
    const cy = h / 2;
    const ox = w + 14 * engine.zoom;
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

  // Flechas de flujo (orig. usuario) en marco LOCAL: CON codos (ramales de canal), cada
  // codo recibe un PAR de flechas a lo largo del eje largo — una desde cada lado — AMBAS
  // apuntando HACIA el punto de salida del codo. Sin codos: flecha central única hacia +X
  // local (el eje apunta en el sentido del arrastre por construcción — legacy sanado a
  // 0/±90/180 conserva el sentido original vía canalMarco).
  ctx.save();
  ctx.globalAlpha = 0.9;
  // Local→canvas-mundo: oCvs + R(ang)·local.
  const _cA = Math.cos(ang);
  const _sA = Math.sin(ang);
  const loc = (lx: number, ly: number) => ({
    x: oCvs.x + lx * _cA - ly * _sA,
    y: oCvs.y + lx * _sA + ly * _cA,
  });
  const codosCanal = engine.ramales.filter(
    (rc) => rc.esCanalId === b.id && rc.pts && rc.pts.length >= 2,
  );
  if (codosCanal.length === 0) {
    const half = 7 * engine.zoom;
    drawFlowArrow(loc(w / 2 - half, h / 2), loc(w / 2 + half, h / 2));
  } else {
    // Flechas CORTAS (mismo tamaño que la central) y SEPARADAS del codo — un par
    // convergente por codo a lo largo del eje.
    const sep = 10 * engine.zoom; // hueco entre la punta y el punto de salida del codo
    const len = 12 * engine.zoom; // largo de cada flecha (≈ la central)
    for (const rc of codosCanal) {
      // Salida del codo = inicio del ramal (el flujo siempre nace en el canal): a marco
      // local en px de plano, proyectada sobre el eje largo; la flecha corre al nivel
      // transversal del punto de salida.
      const lp = canalToLocal(mPlano, rc.pts[0][0], rc.pts[0][1]);
      const t = Math.min(1, Math.max(0, mPlano.w > 0 ? lp.lx / mPlano.w : 0));
      const px = t * w;
      const py = Math.min(h, Math.max(0, lp.ly * engine.zoom));
      const headL = { x: px - sep, y: py };
      const tailL = { x: headL.x - len, y: py };
      const headR = { x: px + sep, y: py };
      const tailR = { x: headR.x + len, y: py };
      if (tailL.x >= 0) drawFlowArrow(loc(tailL.x, tailL.y), loc(headL.x, headL.y));
      if (tailR.x <= w) drawFlowArrow(loc(tailR.x, tailR.y), loc(headR.x, headR.y));
    }
  }
  ctx.restore();

  b._canalBox = { x: boxX, y: boxY, w: boxW, h: boxH };
  // _canalBox (AABB del OBB visible) es el objetivo grueso de clic del canal; _circ queda como
  // ancla de respaldo (mitad del lado más largo) para código que solo lee un centro/radio —
  // los hit-tests precisos usan canalMarco, no esta caja.
  b._circ = { x: boxX + boxW / 2, y: boxY + boxH / 2, r: Math.max(boxW, boxH) / 2 };

  if (b.code || b.code === '') {
    // Siempre centrada directamente debajo del rectángulo, fuera de él — no arrastrable
    // (ignora cualquier labelX/labelY/labelAngle guardado) y sin línea de guía, por pedido
    // explícito.
    const offDx = 0;
    const offDy = boxH + engine.mm2cvs(3);
    // El sufijo de piso ya viene incrustado en b.code al crearlo (CALL{n}-P{n}) — un canal
    // vive en un solo piso, a diferencia del lvlSuffix dinámico por render del bajante.
    const line1 = b.code || '—';
    // La pendiente de la etiqueta refleja el campo editable (ítem 7 usuario), no un 2 fijo.
    const pendTxt = b.pendiente ?? 2;
    const dirText = `${b.base || 0}x${(b.altura || 0) + BORDE_LIBRE_CANAL_CM} S=${pendTxt}% L=${((b.longitud || 0) / 100).toFixed(2)}m`;
    renderBajanteLabel(
      ctx,
      engine,
      b,
      { x: boxX + boxW / 2, y: boxY },
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
  if (engine.tool !== 'canal') return;
  // Fase de ancho (diagonal, 3er clic): eje fijo + ancho vivo del cursor — WYSIWYG del commit.
  if (engine._canalEje) {
    // Mismo guardarraíl del commit (puntoAnchoMinimo): el ghost muestra el ancho que el
    // commit creará incluso con el clic accidental pegado al eje (doble-clic — WYSIWYG).
    const mp = puntoAnchoMinimo(
      engine._canalEje,
      engine.toPlane(engine.mouseX, engine.mouseY),
      engine.cmToPlanePx(1),
    );
    const g = geometriaCanalAncho(
      engine._canalEje,
      mp,
      (d) => engine.pxToM(d),
      engine.cmToPlanePx(1),
    );
    if (!g) return;
    const tmp = { x: g.x, y: g.y, longitud: g.longitudCm, base: g.baseCm, angulo: g.angulo };
    // Escala rota (pxPerCmDe lanza 'escala_invalida'): el loop de render no tiene try/catch —
    // el ghost falla en silencio (return) en vez de matar el frame completo.
    try {
      normalizarCanal(pxPerCmDe(engine), tmp);
    } catch {
      return;
    }
    const m = canalMarco(engine.cmToPlanePx(1), tmp);
    const o = engine.toCvs(m.x, m.y);
    const cw = m.w * engine.zoom;
    const ch = m.h * engine.zoom;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(m.angRad);
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.save();
    const baseCm = Math.round((tmp.base || 0) * 10) / 10;
    const longCm = Math.round((tmp.longitud || 0) * 10) / 10;
    ctx.font = `${11 * engine.zoom}px Geist, monospace`;
    ctx.fillStyle = '#8B5CF6';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`ancho: ${baseCm} cm — eje: ${longCm} cm`, o.x, o.y - 4 * engine.zoom);
    ctx.restore();
    return;
  }
  if (!engine._canalStart) return;
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  // Misma matemática que la creación (siempre eje + ancho, también horizontal/vertical —
  // orig. usuario): el ghost es WYSIWYG y muestra el eje YA AJUSTADO si roza un cardinal (≤15°).
  const g = geometriaCanalDesdePuntos(engine._canalStart, mp, (d) => engine.pxToM(d));
  if (!g) return;
  // Fase 1: SOLO el eje, sin caja — el ancho lo define el siguiente clic y una caja
  // provisional (= lado corto del arrastre) se veía muy ancha y confundía (orig. usuario).
  const o1 = engine.toCvs(engine._canalStart.x, engine._canalStart.y);
  const o2 = engine.toCvs(g.p2.x, g.p2.y);
  ctx.save();
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 2 * engine.zoom * (engine.lineWidthScale || 1);
  ctx.setLineDash([8 * engine.zoom, 5 * engine.zoom]);
  ctx.beginPath();
  ctx.moveTo(o1.x, o1.y);
  ctx.lineTo(o2.x, o2.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const longCm = Math.round(g.longitudCm * 10) / 10;
  ctx.font = `${11 * engine.zoom}px Geist, monospace`;
  ctx.fillStyle = '#8B5CF6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  // Ángulo mostrado en sentido ANTIHORARIO (orig. usuario): convención matemática — girar
  // la mano en contra de las manecillas hace crecer el número.
  ctx.fillText(
    `eje: ${longCm} cm ∠${Math.round(norm180(-g.angulo))}° — clic fija el eje, luego el ancho`,
    (o1.x + o2.x) / 2,
    (o1.y + o2.y) / 2 - 6 * engine.zoom,
  );
  ctx.restore();
}

/**
 * Render principal de bajantes/montantes/contadores/calentadores/canales.
 * Dibuja símbolo, etiqueta con leader y hitbox; filtra por red oculta y estado ghost.
 * @param ctx - Contexto 2D del canvas.
 * @param engine - Motor con colecciones y escalas.
 */
