import { NETS, type IPlanoEngineCore, type PlanoBajante } from '../PlanoState';
import { BORDE_LIBRE_CANAL_CM } from '../../../utils/calcRainwater';
import { computeCanalFlowArrows, computeCanalSegments } from '../canalAssociation';
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

  // Línea de conexión con un bajante de lluvia asociado POR FUERA del canal (bajanteExternoId):
  // una tubería simple de la red ll — ni ramal ni tributario, sin semántica de flujo de red.
  // Ítem 5: el origen es el PUNTO MEDIO del lado del rectángulo más cercano al bajante (no la
  // esquina), la tubería termina en el borde del círculo del bajante y lleva flecha de flujo
  // canal→bajante + etiqueta L/S/Ø. Se dibuja antes del relleno blanco para que el rectángulo
  // del canal quede encima. Es render-only: no crea ningún ramal, por lo que las tablas de
  // accesorios/insumos no la listan.
  if (b.bajanteExternoId) {
    const ext = engine.bajantes.find((x) => x.id === b.bajanteExternoId && x.tipo !== 'canal');
    if (ext) {
      const ec = engine.toCvs(ext.x, ext.y);
      const sides = [
        { x: tl.x + w / 2, y: tl.y }, // arriba
        { x: tl.x + w / 2, y: tl.y + h }, // abajo
        { x: tl.x, y: tl.y + h / 2 }, // izquierda
        { x: tl.x + w, y: tl.y + h / 2 }, // derecha
      ];
      let best = sides[0];
      let bestD = Infinity;
      for (const s of sides) {
        const d = (s.x - ec.x) ** 2 + (s.y - ec.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      const dx = ec.x - best.x;
      const dy = ec.y - best.y;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        const ux = dx / len;
        const uy = dy / len;
        // Mismo radio con que se renderiza el símbolo del bajante — la tubería se detiene en el
        // borde del círculo en vez de atravesarlo.
        const rim = {
          x: ec.x - ux * engine.realMmToCanvasPx(20) * 0.6,
          y: ec.y - uy * engine.realMmToCanvasPx(20) * 0.6,
        };
        // Tubería simple del color de la red ll — la flecha de flujo va en la etiqueta, con el
        // mismo lenguaje que las de los ramales (renderRamales.ts: línea corta + punta).
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = (sel ? 1.6 : 0.8) * engine.zoom * (engine.lineWidthScale || 1);
        ctx.beginPath();
        ctx.moveTo(best.x, best.y);
        ctx.lineTo(rim.x, rim.y);
        ctx.stroke();
        ctx.restore();
        const lenM = engine.pxToM(len / engine.zoom);
        // Diámetro del BAJANTE externo en vivo (dNominal), no el del canal — si se cambia el
        // diámetro del bajante, la etiqueta de la tubería lo refleja al re-renderizar.
        const dNom = ext.dNominal || '';
        const pipeLabel = `L=${lenM.toFixed(2)}m S=2% D=${dNom}`;
        const mid = { x: (best.x + ec.x) / 2, y: (best.y + ec.y) / 2 };
        const mx = dx / len;
        const my = dy / len;
        const fsP = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * 0.9);
        ctx.save();
        ctx.font = `600 ${fsP}px Geist, monospace`;
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Etiqueta desplazada a un lado del trazo (perpendicular a la dirección de la tubería)
        const lx = mid.x + my * 9 * engine.zoom;
        const ly = mid.y - mx * 9 * engine.zoom;
        ctx.fillText(pipeLabel, lx, ly);
        // Flecha de flujo bajo la etiqueta, canal→bajante — misma forma que la de los ramales
        // (renderRamales.ts:1194-1217).
        const tw = ctx.measureText(pipeLabel).width;
        const dir = mx >= 0 ? 1 : -1;
        const half = tw / 2 + 4 * engine.zoom;
        const ay = ly + fsP * 0.95;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 1 * engine.zoom * (engine.lineWidthScale || 1);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx - half * dir, ay);
        ctx.lineTo(lx + half * dir, ay);
        ctx.stroke();
        const aSize = Math.min(6 * engine.zoom, half * 0.6);
        ctx.beginPath();
        ctx.moveTo(lx + half * dir, ay);
        ctx.lineTo(lx + half * dir - dir * aSize, ay - aSize * 0.4);
        ctx.lineTo(lx + half * dir - dir * aSize, ay + aSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

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

  // Flechas de dirección de flujo — negras y cortas, igual que la flecha de flujo propia de un
  // ramal. Sin bajante DENTRO, una sola flecha centrada apunta hacia donde el canal se arrastró
  // al dibujarse (_canalFlowDir). Con bajantes, esa flecha se reemplaza por una flecha corta por
  // lado de bajante, cada una apuntando HACIA el bajante (dos si está a mitad de cuerpo; ver
  // computeCanalFlowArrows en canalAssociation.ts), alineada con el centro del círculo del
  // bajante y deteniéndose en su borde — las flechas quedan fuera del símbolo. El canal mismo
  // nunca se divide.
  const bajArrows = computeCanalFlowArrows(engine, b);
  // Flechas y etiquetas internas del canal también semitransparentes (ítem 5)
  ctx.save();
  ctx.globalAlpha = 0.9;
  if (bajArrows.length === 0) {
    const cx = tl.x + w / 2;
    const cy = tl.y + h / 2;
    const half = 7 * engine.zoom;
    const dir = b._canalFlowDir ?? (w >= h ? 'derecha' : 'abajo');
    if (dir === 'derecha') drawFlowArrow({ x: cx - half, y: cy }, { x: cx + half, y: cy });
    else if (dir === 'izquierda') drawFlowArrow({ x: cx + half, y: cy }, { x: cx - half, y: cy });
    else if (dir === 'abajo') drawFlowArrow({ x: cx, y: cy - half }, { x: cx, y: cy + half });
    else drawFlowArrow({ x: cx, y: cy + half }, { x: cx, y: cy - half });
  }
  // Redondeado al mismo radio con que se renderiza el símbolo del bajante (el loop principal de
  // renderBajantes), para que la cabeza de la flecha se detenga exactamente en el borde del
  // círculo del bajante en vez de atravesarlo.
  const bajR = engine.realMmToCanvasPx(20) * 0.6;
  const shortLen = 14 * engine.zoom;
  for (const arrow of bajArrows) {
    const head = engine.toCvs(arrow.x1, arrow.y1);
    const tail = engine.toCvs(arrow.x0, arrow.y0);
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ux = dx / len;
    const uy = dy / len;
    const rim = { x: head.x - ux * bajR, y: head.y - uy * bajR };
    const cut = Math.min(shortLen, len - bajR);
    drawFlowArrow({ x: rim.x - ux * cut, y: rim.y - uy * cut }, rim);
  }

  // Etiquetas por tramo junto a las flechas: una por cada lado de la división del bajante —
  // longitud proporcional del tramo, pendiente fija S=2% y el MISMO nombre del canal — misma
  // matemática de límites que las flechas (computeCanalSegments) para que nunca diverjan.
  const canalHorizontal = w >= h;
  const fsSeg = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * 0.9);
  const canalName = b.code || '—';
  for (const seg of computeCanalSegments(engine, b)) {
    const midT = (seg.tLeft + seg.tRight) / 2;
    const axisPlaneLen = (canalHorizontal ? w : h) / engine.zoom;
    const lengthM = engine.pxToM((seg.tRight - seg.tLeft) * axisPlaneLen);
    const segLabel = `L=${lengthM.toFixed(2)}m S=2% ${canalName}`;
    // La etiqueta se alinea con la coordenada TRANSVERSAL del centro del bajante de su tramo
    // (la misma línea sobre la que corre la flecha de ese tramo — computeCanalFlowArrows), no
    // con el eje medio del canal: así queda siempre al MISMO nivel (mismo Y en canal horizontal,
    // mismo X en vertical) que la flecha y que el bajante.
    const bajCvs = engine.toCvs(seg.bajante.x, seg.bajante.y);
    ctx.save();
    ctx.font = `600 ${fsSeg}px Geist, monospace`;
    ctx.fillStyle = '#000';
    if (canalHorizontal) {
      // Centrada sobre la línea de la flecha del tramo, al mismo nivel del bajante
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(segLabel, tl.x + midT * w, bajCvs.y);
    } else {
      // A la derecha de la línea de la flecha (eje del bajante), al mismo nivel vertical
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(segLabel, bajCvs.x + 5 * engine.zoom, tl.y + midT * h);
    }
    ctx.restore();
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
