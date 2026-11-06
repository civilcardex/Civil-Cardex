import type { IPlanoEngineCore } from '../PlanoState.ts';
import type { AccSimboloArgs } from './renderAccessorySymbols.ts';

/** Coseno y seno de 45° — las X de los rociadores van en ejes absolutos, como en el PDF. */
const DIAG = Math.SQRT1_2;

/** Símbolos de rci (Red Contra Incendio): los 5 rociadores de la simbología del PDF de
 *  referencia (montante, colgante seco, de pared, oculto, que fluye) y las 3 riostras sísmicas
 *  (transversal, longitudinal, cuatro vías). Trazo negro como el resto de glifos del plano.
 *  Ej: un rociador oculto se lee como anillo discontinuo con X sobre el ramal rci. true = dibujó. */
export function drawRciSymbols(a: AccSimboloArgs): boolean {
  const { ctx, engine, accType, c, dx, dy, px, py } = a;
  // Mismo tamaño que las válvulas (rad × 1.25): la familia se lee pareja sobre el trazo.
  const r = a.rad * 1.25;

  if (accType === 'rociadorMontante') {
    estilo(ctx, engine);
    anillo(ctx, c.x, c.y, r * 0.9);
    cruzDiagonal(ctx, c.x, c.y, r * 0.9);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }

  if (accType === 'rociadorSeco') {
    estilo(ctx, engine);
    anillo(ctx, c.x, c.y, r * 1.15);
    anillo(ctx, c.x, c.y, r * 0.9);
    anillo(ctx, c.x, c.y, r * 0.32);
    // La X va AL FINAL: cruza por encima del circulito central, como en el PDF.
    cruzDiagonal(ctx, c.x, c.y, r * 0.9);
    return true;
  }

  if (accType === 'rociadorOculto') {
    estilo(ctx, engine);
    // Anillo discontinuo: el rociador queda escondido bajo el cielorraso.
    ctx.save();
    ctx.setLineDash([r * 0.28, r * 0.22]);
    anillo(ctx, c.x, c.y, r * 0.9);
    ctx.setLineDash([]);
    ctx.restore();
    anillo(ctx, c.x, c.y, r * 0.34);
    // La X cruza por encima del circulito central (PDF).
    cruzDiagonal(ctx, c.x, c.y, r * 0.9);
    return true;
  }

  if (accType === 'rociadorArea') {
    estilo(ctx, engine);
    anillo(ctx, c.x, c.y, r * 0.9);
    anillo(ctx, c.x, c.y, r * 0.32);
    // La X va AL FINAL y cruza por encima del circulito central, como en el PDF de
    // simbología (sin cuadradito ni hatch en los cuartos).
    cruzDiagonal(ctx, c.x, c.y, r * 0.9);
    return true;
  }

  if (accType === 'riostraLat') {
    // Transversal: línea perpendicular al ramal con ganchos de 90° opuestos en los extremos.
    // Riostras más grandes y de trazo más grueso que los rociadores (ped. usuario).
    estilo(ctx, engine, 1.5);
    const brazo = r * 2.0;
    const gancho = r * 0.65;
    const e1x = c.x + px * brazo;
    const e1y = c.y + py * brazo;
    const e2x = c.x - px * brazo;
    const e2y = c.y - py * brazo;
    ctx.beginPath();
    ctx.moveTo(e2x - dx * gancho, e2y - dy * gancho);
    ctx.lineTo(e2x, e2y);
    ctx.lineTo(e1x, e1y);
    ctx.lineTo(e1x + dx * gancho, e1y + dy * gancho);
    ctx.stroke();
    nudo(ctx, c.x, c.y, r * 0.4);
    return true;
  }

  if (accType === 'riostraLon') {
    // Longitudinal (geom. extraída del PDF de simbología): el glifo PINTA el trazo del ramal
    // (línea a lo largo, ±2.27r), dos rayas a 45° («/») flanqueando — la izquierda arranca del
    // trazo y sube, la derecha cuelga por debajo (asimetría real del símbolo) — y el nudo
    // cuadradito al final (tapando la línea en el centro).
    estilo(ctx, engine, 3);
    const media = r * 4.2;
    ctx.beginPath();
    ctx.moveTo(c.x - dx * media, c.y - dy * media);
    ctx.lineTo(c.x + dx * media, c.y + dy * media);
    ctx.stroke();
    // Brazos a 45° con el MISMO grosor que la línea (mismo estilo, un solo beginPath/stroke).
    const anclaIzq = r * 2.2;
    const anclaDer = r * 2.5;
    const brazo = r * 0.9;
    ctx.beginPath();
    ctx.moveTo(c.x - dx * anclaIzq, c.y - dy * anclaIzq);
    ctx.lineTo(c.x - dx * anclaIzq + (dx + px) * brazo, c.y - dy * anclaIzq + (dy + py) * brazo);
    ctx.moveTo(c.x + dx * anclaDer, c.y + dy * anclaDer);
    ctx.lineTo(c.x + dx * anclaDer - (dx + px) * brazo, c.y + dy * anclaDer - (dy + py) * brazo);
    ctx.stroke();
    nudo(ctx, c.x, c.y, r * 0.4);
    return true;
  }

  if (accType === 'riostra4v') {
    // Cuatro vías: molino de 4 brazos diagonales con gancho en L en el mismo sentido de giro.
    estilo(ctx, engine, 1.5);
    const brazos = [
      { x: (dx + px) * DIAG, y: (dy + py) * DIAG },
      { x: (dx - px) * DIAG, y: (dy - py) * DIAG },
      { x: (-dx + px) * DIAG, y: (-dy + py) * DIAG },
      { x: (-dx - px) * DIAG, y: (-dy - py) * DIAG },
    ];
    const largo = r * 1.45;
    const gancho = r * 0.6;
    ctx.beginPath();
    for (const u of brazos) {
      const ex = c.x + u.x * largo;
      const ey = c.y + u.y * largo;
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(ex, ey);
      // Gancho perpendicular al brazo, siempre hacia el mismo lado (molino).
      ctx.lineTo(ex - u.y * gancho, ey + u.x * gancho);
    }
    ctx.stroke();
    nudo(ctx, c.x, c.y, r * 0.4);
    return true;
  }

  return false;
}

/** Trazo base de los glifos rci: negro, relleno blanco y el grosor de las válvulas. */
function estilo(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore, grosor = 1): void {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1) * grosor;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
}

/** Anillo blanco con borde negro. */
function anillo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** X de 45° en ejes absolutos (no rota con el ramal), como en la simbología de referencia. */
function cruzDiagonal(ctx: CanvasRenderingContext2D, cx: number, cy: number, mitad: number): void {
  const d = mitad * DIAG;
  ctx.beginPath();
  ctx.moveTo(cx - d, cy - d);
  ctx.lineTo(cx + d, cy + d);
  ctx.moveTo(cx - d, cy + d);
  ctx.lineTo(cx + d, cy - d);
  ctx.stroke();
}

/** Cuadradito blanco del nudo de las riostras. */
function nudo(ctx: CanvasRenderingContext2D, cx: number, cy: number, mitad: number): void {
  ctx.beginPath();
  ctx.rect(cx - mitad, cy - mitad, mitad * 2, mitad * 2);
  ctx.fill();
  ctx.stroke();
}
