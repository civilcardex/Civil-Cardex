import { rotatedRectCorners } from '../HitTester';
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState';
import type { CrossFloorGhost } from '../../../utils/associateBajanteAcrossFloors';

/** Dirección con mayúscula inicial para mostrar: sube/baja/continua. */
export const DIR_MAP: Record<string, string> = { sube: 'Sube', baja: 'Baja', continua: 'Continua' };

// Una reventilación (bajante de la red vent) se identifica como "REV[N] [diámetro]" en la línea
// grande y SOLO la dirección (Sube/Baja/Continua) en la línea pequeña de abajo — sin la palabra
// "REVENTILACIÓN" por pedido explícito. El consecutivo N se toma del número del código/id de la
// reventilación (BREV{n}), que _renumberBajantes ya asigna de forma independiente por red y
// renumera sin huecos ni duplicados al crear/borrar.
/** Líneas de etiqueta de una reventilación: código REV[n] en la línea grande y la dirección sola en la pequeña. */
export function ventLabelLines(
  codeStr: string,
  diamStr: string,
  dirWord: string,
): { line1: string; dirText: string } {
  const m = codeStr.match(/(\d+)/);
  const n = m ? m[1] : '';
  const line1 = n ? `REV${n}${diamStr ? ' ' + diamStr : ''}` : diamStr ? `REV${diamStr}` : 'REV';
  return { line1, dirText: dirWord };
}

/** Etiqueta estándar de un bajante/montante (código + dirección) con su caja rotada y anclada al símbolo. */
export function renderBajanteLabel(
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
    ctx.lineWidth = 0.8 * engine.zoom * (engine.lineWidthScale || 1);
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
    ctx.lineWidth = 0.8 * engine.zoom * (engine.lineWidthScale || 1);
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
/** Glifo de flecha de dirección junto a la etiqueta del bajante, según sube/baja/continua. */
export function drawDireccionSymbol(
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
