import { NETS } from '../PlanoState';
import { rotatedRectCorners } from '../HitTester';
import type { IPlanoEngineCore } from '../PlanoState';
import type { PlanoBajante } from '../PlanoState';
import type { CrossFloorGhost } from '../../../utils/associateBajanteAcrossFloors';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { parseDescargaEnId } from '../../../utils/parseDescargaEnId';
import { pisoCortoLoose as getPisoCorto } from '../../../constants';
import { MONTANTE_NETS } from '../drawingCreations';
import { BORDE_LIBRE_CANAL_CM } from '../../../utils/calcRainwater';
import { computeCanalFlowArrows, computeCanalSegments } from '../canalAssociation';

const DIR_MAP: Record<string, string> = { sube: 'Sube', baja: 'Baja', continua: 'Continua' };

function renderBajanteLabel(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  b: PlanoBajante | CrossFloorGhost,
  c: { x: number; y: number },
  r: number,
  angle: number,
  offDx: number,
  offDy: number,
  line1: string,
  dirText: string,
  labelBoxProp: '_labelBox' | '_ghostLabelBox' | '_crossFloorLabelBox',
  alpha: number,
  opts?: { skipLeader?: boolean; textColor?: string },
): void {
  const { skipLeader = false, textColor = '#000' } = opts || {};
  const hasDir = !!dirText;

  const bTipo2 = 'tipo' in b ? b.tipo : undefined;
  const labelSizeMul = bTipo2 === 'contador' || bTipo2 === 'calentador' ? 0.75 : 1;
  // La etiqueta de código del bajante/montante usa exactamente la misma fórmula de tamaño que
  // la etiqueta de nombre de un ramal (fsName/fsInfo en renderRamales.ts) para que las dos se
  // lean objetivamente iguales en tamaño.
  const fsCode = engine.mm2cvs(engine.MM.lblName * engine.labelScaleM * labelSizeMul);
  const fsDir = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * labelSizeMul);
  const lineH = fsCode + 2;

  ctx.save();
  ctx.font = `bold ${fsCode}px Geist, monospace`;
  const tw1 = ctx.measureText(line1).width;
  const boxW = tw1 + engine.mm2cvs(4);
  const boxH = hasDir ? lineH + 2 + fsDir + engine.mm2cvs(1.5) : lineH + engine.mm2cvs(1);
  const hh2 = boxH / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(c.x, c.y);

  if (!skipLeader) {
    const intersection = getLabelIntersection(offDx, offDy, boxW, boxH, angle);
    const distToLabel = Math.hypot(offDx, offDy);
    let lineStartX = 0,
      lineStartY = 0;
    if (distToLabel > 0.1) {
      const ux = offDx / distToLabel,
        uy = offDy / distToLabel;
      lineStartX = r * ux;
      lineStartY = r * uy;
    }
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineStartY);
    ctx.lineTo(intersection.x, intersection.y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.8 * engine.zoom;
    ctx.stroke();
    ctx.restore();
  }

  ctx.translate(offDx, offDy);
  ctx.rotate(angle);

  const lbCx = c.x + offDx;
  const lbCy = c.y + offDy;
  const {
    corners: corners2,
    minX,
    minY,
    maxX,
    maxY,
  } = rotatedRectCorners(lbCx, lbCy - 10 + hh2, boxW, boxH, angle, 2);
  (b as unknown as Record<string, unknown>)[labelBoxProp] = {
    cx: lbCx,
    cy: lbCy - 10 + hh2,
    w: boxW,
    h: boxH,
    angle,
    minX,
    minY,
    maxX,
    maxY,
    corners: corners2,
  };

  // Deliberadamente sin relleno aquí — antes las etiquetas quedaban sobre una placa blanca
  // sólida; ahora se leen directamente sobre lo que haya debajo (fondo transparente), por
  // pedido explícito.
  ctx.beginPath();
  ctx.roundRect(-boxW / 2, -10, boxW, boxH, 0);

  const bTipo = 'tipo' in b ? b.tipo : undefined;
  if (bTipo === 'contador' || bTipo === 'calentador') {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8 * engine.zoom;
    ctx.stroke();
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(line1, 0, -10 + engine.mm2cvs(0.5));

  if (dirText) {
    // Misma fuente/peso que la línea de información de un ramal (600, ver renderRamales.ts)
    // para que las etiquetas del canal se lean idénticas a las de los ramales.
    ctx.font = `600 ${fsDir}px Geist, monospace`;
    ctx.fillStyle = textColor;
    ctx.fillText(dirText, 0, -10 + lineH + engine.mm2cvs(1));
  }
  ctx.restore();
  ctx.restore();
}

function getLabelIntersection(
  offDx: number,
  offDy: number,
  boxW: number,
  boxH: number,
  angle: number,
): { x: number; y: number } {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const localStartX = -offDx * cosA - offDy * sinA;
  const localStartY = offDx * sinA - offDy * cosA;

  const xMin = -boxW / 2;
  const xMax = boxW / 2;
  const yMin = -10;
  const yMax = -10 + boxH;

  let tEnter = 0;

  if (localStartX !== 0) {
    const t1 = 1 - xMin / localStartX;
    const t2 = 1 - xMax / localStartX;
    const tMin = Math.min(t1, t2);
    tEnter = Math.max(tEnter, tMin);
  }

  if (localStartY !== 0) {
    const t1 = 1 - yMin / localStartY;
    const t2 = 1 - yMax / localStartY;
    const tMin = Math.min(t1, t2);
    tEnter = Math.max(tEnter, tMin);
  }

  tEnter = Math.max(0, Math.min(1, tEnter));

  const localIntersectX = localStartX * (1 - tEnter);
  const localIntersectY = localStartY * (1 - tEnter);

  const intersectDx = localIntersectX * cosA - localIntersectY * sinA + offDx;
  const intersectDy = localIntersectX * sinA + localIntersectY * cosA + offDy;

  return { x: intersectDx, y: intersectDy };
}

// Compartido por el círculo propio del bajante padre Y su fantasma — dibuja el glifo interior
// de dirección (flecha arriba/abajo, punto o flecha "continua") exactamente igual en ambos
// lugares. Antes el fantasma usaba glifos de texto unicode (⬇/•/➜) rellenos con el color de la
// red en vez de esta forma vectorial en arrowCol (rojo para bajante, azul para montante), así
// que nunca se veía de verdad como su padre pese a que tamaño/opacidad ya coincidían. El caller
// ya debe haber traducido ctx al origen local del símbolo (0,0) y rotado como se necesite.
function drawDireccionSymbol(
  ctx: CanvasRenderingContext2D,
  tipo: string,
  r: number,
  direccion: string | undefined,
): void {
  const arrowCol = tipo === 'bajante' ? '#F04545' : '#3B82F6';
  if (direccion === 'sube') {
    ctx.fillStyle = arrowCol;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (direccion === 'baja') {
    const aS = r * 0.7;
    ctx.strokeStyle = arrowCol;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, -aS * 0.9);
    ctx.lineTo(0, aS * 0.5);
    ctx.stroke();
    ctx.fillStyle = arrowCol;
    ctx.beginPath();
    ctx.moveTo(0, aS * 0.9);
    ctx.lineTo(-aS * 0.4, aS * 0.3);
    ctx.lineTo(aS * 0.4, aS * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (direccion === 'continua') {
    ctx.fillStyle = arrowCol;
    ctx.font = `${r * 1.1}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('➜', 0, 0);
  } else {
    // Sin dirección resuelta: flecha de respaldo por defecto, hacia abajo para bajante / hacia
    // arriba para montante.
    const aS = r * 0.7;
    ctx.strokeStyle = arrowCol;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    if (tipo === 'bajante') {
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(0, aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(-aS * 0.4, aS * 0.3);
      ctx.lineTo(aS * 0.4, aS * 0.3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(0, -aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(-aS * 0.4, -aS * 0.3);
      ctx.lineTo(aS * 0.4, -aS * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// El canal es un rectángulo de esquina+tamaño (b.x/b.y = esquina superior-izquierda del plano,
// b.base/b.altura = tamaño real en cm) en vez de un símbolo de punto+radio — se dibuja en
// espacio absoluto de canvas, nunca rotado (a diferencia de todo otro glifo del array de
// bajantes, cuya forma rota con labelAngle), porque un rectángulo no cuadrado rotando con la
// etiqueta contradeciría visualmente sus propias manijas de redimensionado, que siempre están
// alineadas a los ejes. Las esquinas seleccionadas reciben una manija cuadrada pequeña
// (agarrada por _tryCanalResizeHit en handleMouseDown.ts) para redimensionar independientemente
// de la rotación de la etiqueta.
function renderCanalGlyph(
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

  // Línea de conexión con un bajante de lluvia asociado POR FUERA del canal (bajanteExternoId):
  // una tubería simple de la red ll — ni ramal ni tributario, sin flecha ni semántica de flujo.
  // Se dibuja antes del relleno blanco para que el rectángulo del canal quede encima.
  if (b.bajanteExternoId) {
    const ext = engine.bajantes.find((x) => x.id === b.bajanteExternoId && x.tipo !== 'canal');
    if (ext) {
      const ec = engine.toCvs(ext.x, ext.y);
      const nearX = Math.min(Math.max(ec.x, tl.x), tl.x + w);
      const nearY = Math.min(Math.max(ec.y, tl.y), tl.y + h);
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = (sel ? 1.6 : 0.8) * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(nearX, nearY);
      ctx.lineTo(ec.x, ec.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.rect(tl.x, tl.y, w, h);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = (sel ? 1.6 : 0.8) * engine.zoom;
  // Perfil de canal: las líneas horizontales superior, interior (25%) e inferior, más los dos
  // segmentos verticales laterales que cierran el contorno del canalón.
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tl.x + w, tl.y);
  const midY = tl.y + h * 0.25;
  ctx.moveTo(tl.x, midY);
  ctx.lineTo(tl.x + w, midY);
  ctx.moveTo(tl.x, tl.y + h);
  ctx.lineTo(tl.x + w, tl.y + h);
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tl.x, tl.y + h);
  ctx.moveTo(tl.x + w, tl.y);
  ctx.lineTo(tl.x + w, tl.y + h);
  ctx.stroke();

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
    ctx.lineWidth = 1.5 * engine.zoom;
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
  const drawFlowArrow = (tail: { x: number; y: number }, head: { x: number; y: number }) => {
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = 1 * engine.zoom;
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
  const bajArrows = computeCanalFlowArrows(engine, b);
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
  ctx.lineWidth = 1 * engine.zoom;
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

export function renderBajantes(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.bajantes.forEach((b) => {
    if (engine._hiddenNets.has(b.net)) return;

    // El canal es un rectángulo de esquina+tamaño, no un símbolo de punto+radio como todo otro
    // tipo de este array — nunca rota (labelAngle solo afecta la posición de su etiqueta, no la
    // forma) y tiene su propia caja de hit-test (_canalBox) en vez del pipeline genérico de
    // glifo con ctx.rotate de abajo, así que se maneja completamente aparte.
    if (b.tipo === 'canal') {
      renderCanalGlyph(ctx, engine, b);
      return;
    }

    // Un bajante solo recibe su círculo sólido en SU PROPIO piso (pisoBase). Una entrada de
    // desplazamiento para el nivel actual no dice nada sobre a qué piso pertenece — además es
    // así como se posicionan los fantasmas en pisos remotos — así que nunca debe suprimir el
    // chequeo de fantasma.
    const isDirectionGhost = b.pisoBase !== engine.nivelActual?.label;

    const c = engine.toCvs(b.x, b.y);
    // Cuando este bajante es un fantasma de piso remoto, nunca dibujar el borde amarillo grueso
    // de selección.
    const sel = b.id === engine.selId && !engine._isGhostSel && !isDirectionGhost;
    // realMmToCanvasPx tiene un piso de 1mm de papel (ver PlanoEngine.ts) — en escalas
    // arquitectónicas comunes un radio real de 20mm o 10mm caen en ese piso y renderizan
    // idéntico, así que dividir a la mitad el argumento en mm solo es invisible. Se divide el
    // valor px resultante en su lugar.
    const r = engine.realMmToCanvasPx(20) * 0.6;

    // Item 2: Ángulo de etiqueta + restricción de snap (auto-rotación removida por pedido)
    const angle = ((b.labelAngle || 0) * Math.PI) / 180;

    b._circ = { x: c.x, y: c.y, r };
    if (isDirectionGhost) return;

    // Dibujar líneas verdes punteadas desde los ramales que alimentan este bajante
    // (recibeDeIds) — es una guía para cuando el bajante queda LEJOS del ramal (p.ej. una
    // posición desplazada/fantasma), así que se salta siempre que el punto propio del
    // bajante/montante ya coincida con CUALQUIER punto del ramal (no solo sus dos extremos):
    // un montante creado a mitad de cuerpo (createMontanteMidBody) queda en un vértice
    // INTERIOR, no un extremo, así que comparar solo contra el extremo más cercano nunca
    // coincidía y siempre dibujaba una línea sin sentido desde dondequiera que estuviera ese
    // extremo; el mismo fix también cubre un ramal llegando a la posición fantasma/desplazada
    // de este bajante en este piso.
    if (b.recibeDeIds?.length) {
      const ghostDisp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const bPos = ghostDisp
        ? { x: b.x + ghostDisp.dx, y: b.y + ghostDisp.dy }
        : { x: b.x, y: b.y };
      b.recibeDeIds.forEach((rid: string) => {
        const ram = engine.ramales.find((rr) => rr.id === rid);
        if (ram && ram.pts.length) {
          const touchesDirectly = ram.pts.some(
            ([px, py]) => Math.hypot(px - bPos.x, py - bPos.y) < 1.5,
          );
          if (touchesDirectly) return;
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(rc.x, rc.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    if (b.descargaEnId) {
      const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
      const targetPlanId = parts[0];
      const targetId = parts[1];

      // Solo dibujar la línea si el destino está en el piso ACTUAL
      if (String(targetPlanId) === String(engine._loadedPlanId)) {
        // Dibujar línea al RAMAL destino
        const ram = engine.ramales.find((rr) => rr.id === targetId);
        if (ram && ram.pts.length) {
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(rc.x, rc.y);
          ctx.stroke();
          ctx.restore();
        }
        // Dibujar línea al BAJANTE destino del mismo piso
        const targetBaj = engine.bajantes.find((bb) => bb.id === targetId);
        if (targetBaj) {
          const tc = engine.toCvs(targetBaj.x, targetBaj.y);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(tc.x, tc.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#ffffff';
    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#475569';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else if (b.tipo === 'contador' && b.net === 'gas') {
      ctx.fillStyle = '#A855F7';
      const devW = r * 2;
      const devH = r * 2.4;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#A855F7';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.stroke();
      const dispW = devW * 0.6;
      const dispH = devH * 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-dispW / 2, -devH / 2 + devH * 0.12, dispW, dispH, 1 * engine.zoom);
      ctx.fill();
    } else if (b.tipo === 'contador') {
      const netObj = NETS.find((n) => n.id === (b.net === 'gas' ? 'gas' : 'af'));
      const col = netObj ? netObj.col : '#4D8FF7';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (b.tipo === 'calentador') {
      const netObj = NETS.find((n) => n.id === (b.net === 'gas' ? 'gas' : 'ac'));
      const col = netObj ? netObj.col : b.net === 'gas' ? '#A855F7' : '#F04545';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else {
      const netObj = NETS.find((n) => n.id === b.net);
      const col = netObj ? netObj.col : '#e2e2e8';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 1.2 : 0.6) * engine.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RP', 0, 0);
    } else if (b.tipo === 'contador' && b.net === 'gas') {
      // Medidor de gas: sin letra, sin segmentos de tubería
    } else if (b.tipo === 'contador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', 0, 0);
    } else if (b.tipo === 'calentador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, 0);
    } else {
      drawDireccionSymbol(ctx, b.tipo, r, b.direccion);
    }

    // Flecha amarilla de selección (mismo estilo que los ramales)
    const inMultiSel = (engine.multiSel || []).includes(b.id);
    if ((sel || inMultiSel) && !engine._isGhostSel) {
      const arrowR = 8 * engine.zoom;
      const ox = r + 14 * engine.zoom;
      ctx.save();
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // La etiqueta del padre se dibuja EXCEPTO cuando esto es un fantasma direccional en un piso
    // remoto (pisoBase !== nivel actual significa que el bajante pertenece a otro piso) —
    // isDirectionGhost calculado arriba; todo este bloque es inalcanzable para ese caso de todos
    // modos (retorno temprano arriba).
    if (!isDirectionGhost && (b.code || b.code === '')) {
      const lx = b.labelX ?? b.x;
      const ly = b.labelY ?? b.y + 20;
      const offDx = (lx - b.x) * engine.zoom;
      let offDy = (ly - b.y) * engine.zoom;

      // Item 2: Aplicar desplazamiento perpendicular mínimo para que la etiqueta no quede sobre
      // el ramal
      const minPerpPx = engine.mm2cvs(3);
      if (Math.abs(offDy) < minPerpPx) {
        offDy = offDy >= 0 ? minPerpPx : -minPerpPx;
      }

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const codeStr =
        (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      let diamStr = '';
      if (b.dNominal && b.dNominal !== '0') {
        const v = String(b.dNominal).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = normalizeDnLabel(v);
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = normalizeDnLabel(v);
          }
        }
      } else if (b.diametro) {
        diamStr = normalizeDnLabel(b.diametro.split(' — ')[0]);
      }
      // La línea grande en negrita es solo el código — espeja la etiqueta propia de un ramal,
      // que mantiene su línea de nombre en negrita con el código corto solo y empuja el
      // diámetro a la línea de info más pequeña debajo.
      const line1 = codeStr || '—';
      const dirWord = DIR_MAP[b.direccion ?? ''] || '';
      const dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
      renderBajanteLabel(ctx, engine, b, c, r, angle, offDx, offDy, line1, dirText, '_labelBox', 1);
    } else {
      b._labelBox = undefined;
    }
  });
}

export function renderGhosts(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const fg = engine.getBajantesFantasma();
  fg.forEach((b) => {
    const net = NETS.find((n) => n.id === b.net);
    const col = net ? net.col : '#e2e2e8';
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    const gx = b.x + (disp ? disp.dx : 0);
    const gy = b.y + (disp ? disp.dy : 0);
    const c = engine.toCvs(gx, gy);
    // realMmToCanvasPx tiene un piso de 1mm de papel (ver PlanoEngine.ts) — en escalas
    // arquitectónicas comunes un radio real de 20mm o 10mm caen en ese piso y renderizan
    // idéntico, así que dividir a la mitad el argumento en mm solo es invisible. Se divide el
    // valor px resultante en su lugar.
    const r = engine.realMmToCanvasPx(20) * 0.6;
    b._ghost = { x: c.x, y: c.y, r };

    // La etiqueta del fantasma siempre horizontal
    const ghostAngle = 0;

    // Círculo del fantasma: mismo tamaño, color y opacidad completa que el círculo propio del
    // padre (por pedido explícito — el fantasma debe verse exactamente como su padre, tamaño e
    // intensidad por igual). Excepción: un fantasma sin desplazamiento real en el piso PROPIO
    // del padre queda en exactamente el mismo (x,y) que el padre, que ya dibuja ahí su propio
    // círculo sólido — se salta el anillo extra para que no parezca un halo sobredimensionado.
    // Un fantasma creado por arrastre (dx/dy fijados) es un punto distinto en el espacio incluso
    // en el piso propio del padre, así que igual debe dibujarse. Un marcador de asociación
    // entre pisos (entrada de desplazamientos que lleva un id de conector Ldesvio) siempre
    // dibuja su anillo — incluido el caso perfectamente alineado (dx/dy = 0) — porque ese
    // anillo es la única traza visible del enlace entre pisos en el piso origen.
    const hasDisplacement = !!disp && (Math.abs(disp.dx) >= 1 || Math.abs(disp.dy) >= 1);
    const isOwnFloorGhost =
      b.pisoBase === engine.nivelActual?.label && !hasDisplacement && !disp?.Ldesvio;
    if (!isOwnFloorGhost) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      // Debe coincidir exactamente con el trazo del círculo no-seleccionado propio del padre
      // (0.6*zoom, fijado en la rama bajante/montante por defecto de arriba) — esto era 1.5,
      // 2.5x más grueso que el padre, que es exactamente la queja de "el fantasma se ve más
      // grueso".
      ctx.lineWidth = 0.6 * engine.zoom;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
    let ghostDir = b.direccion;
    if (gd && gd.direccion !== undefined) {
      ghostDir = gd.direccion;
    } else if (b.direccion === 'sube') {
      ghostDir = 'baja';
    } else if (b.direccion === 'baja') {
      ghostDir = 'sube';
    }
    // Mismo símbolo vectorial que el círculo propio del padre (drawDireccionSymbol), no el
    // renderizado viejo de glifos unicode — ese era el desajuste visual real con el padre.
    const skipSymbol = !ghostDir && !!b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    if (!skipSymbol) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(c.x, c.y);
      drawDireccionSymbol(ctx, b.tipo, r, ghostDir);
      ctx.restore();
    }

    // Item 4: Flecha amarilla de selección para selección de bajante fantasma
    const inMultiSel = (engine.multiSel || []).includes(b.id);
    const ghostSel = engine.selId === b.id && engine._isGhostSel;
    if (ghostSel || inMultiSel) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ghostAngle);
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      const arrowR = 8 * engine.zoom;
      const ox = r + 14 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Item 6: Etiqueta del fantasma — renderizar para todos los fantasmas
    if (b.code || b.code === '') {
      const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
      let ghostOffX = 0;
      let ghostOffY = 0;
      if (gd?.labelX != null && gd?.labelY != null) {
        ghostOffX = (gd.labelX - gx) * engine.zoom;
        ghostOffY = (gd.labelY - gy) * engine.zoom;
      } else {
        const distPx = engine.mm2cvs(15);
        ghostOffX = distPx * Math.cos(ghostAngle);
        ghostOffY = distPx * Math.sin(ghostAngle);
      }
      const offDx = ghostOffX;
      const offDy = ghostOffY;

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const codeStr =
        (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      let ghostDir = b.direccion;
      if (gd?.direccion !== undefined) {
        ghostDir = gd.direccion;
      } else if (b.direccion === 'sube') {
        ghostDir = 'baja';
      } else if (b.direccion === 'baja') {
        ghostDir = 'sube';
      }
      const ghostDNom = gd?.dNominal || b.dNominal;
      let diamStr = '';
      if (b.diametro) {
        diamStr = normalizeDnLabel(b.diametro.split(' — ')[0]);
      } else if (ghostDNom && ghostDNom !== '0') {
        const v = String(ghostDNom).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = normalizeDnLabel(v);
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = normalizeDnLabel(v);
          }
        }
      }
      const line1 = codeStr || '—';
      const dirWord = DIR_MAP[ghostDir ?? ''] || '';
      const dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
      renderBajanteLabel(
        ctx,
        engine,
        b,
        c,
        r,
        ghostAngle,
        offDx,
        offDy,
        line1,
        dirText,
        '_ghostLabelBox',
        1,
      );
    }
  });
}

// Fantasmas de asociación entre pisos (associateBajanteAcrossFloors.ts) — marcadores de
// referencia posicionales puros escritos directamente en el array `crossFloorGhosts` propio de
// este piso. Círculo punteado + etiqueta completa de bajante arriba (code-Piso, D=, dir) en
// color de red, coincidiendo con el formato del bajante fuente.
function toShortPiso(label: string): string {
  if (!label) return '';
  if (label.includes('Cubierta')) return 'C';
  const m = label.match(/(\d+)/);
  if (label.includes('Sótano')) return `S${m?.[1] || ''}`;
  if (label.includes('Piso')) return `P${m?.[1] || ''}`;
  return label;
}

export function renderCrossFloorGhosts(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
): void {
  (engine.crossFloorGhosts || []).forEach((g) => {
    if (engine._hiddenNets.has(g.net)) return;
    const net = NETS.find((n) => n.id === g.net);
    const col = net ? net.col : '#e2e2e8';
    const c = engine.toCvs(g.x, g.y);
    const r = engine.realMmToCanvasPx(20) * 0.6;
    g._hitCircle = { x: c.x, y: c.y, r };

    // Línea punteada hacia el bajante destino en este piso — más tenue que el color de la red y
    // punteada, para que el conector entre pisos se lea como referencia (no como tubería real)
    // y quede visiblemente más claro que los ramales de este mismo piso.
    if (g.targetBajanteId) {
      const targetB = engine.bajantes.find((b) => b.id === g.targetBajanteId);
      if (targetB) {
        const tc = engine.toCvs(targetB.x, targetB.y);
        ctx.save();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5 * engine.zoom;
        ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tc.x, tc.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // Círculo punteado
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1 * engine.zoom;
    ctx.setLineDash([4 * engine.zoom, 3 * engine.zoom]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Glifo de dirección dentro del círculo — misma forma vectorial que el bajante real,
    // leyendo la dirección del ORIGEN (padre) para que la flecha coincida con la etiqueta de
    // texto de arriba.
    const ghostTipo = MONTANTE_NETS.includes(g.net) ? 'montante' : 'bajante';
    ctx.save();
    ctx.translate(c.x, c.y);
    drawDireccionSymbol(ctx, ghostTipo, r, g.parentDireccion ?? g.direccion);
    ctx.restore();

    // Etiqueta: BAN2-P2 / D=4" Baja (piso corto, diámetro mostrado)
    const shortPiso = toShortPiso(g.piso || '');
    const codeStr = (g.code || '').replace(/#/g, '').toUpperCase();
    const line1 = codeStr ? `${codeStr}${shortPiso ? '-' + shortPiso : ''}` : shortPiso || '—';
    let diamStr = '';
    if (g.dNominal && g.dNominal !== '0') {
      const v = String(g.dNominal).trim();
      if (v.includes('"') || v.includes('mm')) {
        diamStr = normalizeDnLabel(v);
      } else {
        const numV = Number(v);
        diamStr = !isNaN(numV) ? (numV < 20 ? `${numV}"` : `${numV}mm`) : normalizeDnLabel(v);
      }
    }
    // Mostrar en la etiqueta la dirección del ORIGEN (padre del piso superior), no la
    // contra-dirección propia del fantasma. Cae a ghost.direccion para fantasmas legacy escritos
    // antes de que existiera este campo.
    const dirWord = DIR_MAP[g.parentDireccion ?? g.direccion ?? ''] || '';
    const dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;

    // Etiqueta sobre el círculo, centrada, sin línea de guía, color de red. Desplazamiento más
    // ajustado que la etiqueta regular de un bajante — el fantasma queda junto a su línea
    // punteada y al símbolo del padre origen, así que 8 mm extra de aire solo lo empujarían
    // sobre anotaciones adyacentes.
    const offDy = -(r + engine.mm2cvs(3));
    renderBajanteLabel(
      ctx,
      engine,
      g,
      c,
      r,
      0,
      0,
      offDy,
      line1,
      dirText,
      '_crossFloorLabelBox',
      1,
      {
        skipLeader: true,
        textColor: col,
      },
    );
  });
}
