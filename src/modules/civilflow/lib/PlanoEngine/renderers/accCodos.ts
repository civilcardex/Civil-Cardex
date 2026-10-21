import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import type { DeclutterFrame } from '../labelDeclutter.ts';

export function drawCodoSymbols(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  accType: string,
  c: { x: number; y: number },
  dx: number,
  dy: number,
  px: number,
  py: number,
  _outX: number,
  _outY: number,
  rad: number,
  _diamLabel?: string,
  _ramal?: PlanoRamal,
  _slot?: 'ini' | 'fin',
  _declutter?: DeclutterFrame,
  _pipeToward?: { x: number; y: number },
): boolean {
  if (accType === 'codoSube') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 0.3, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }
  if (accType === 'codoBaja') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    const offset = rad * Math.SQRT1_2;
    ctx.moveTo(c.x - offset, c.y - offset);
    ctx.lineTo(c.x + offset, c.y + offset);
    ctx.moveTo(c.x + offset, c.y - offset);
    ctx.lineTo(c.x - offset, c.y + offset);
    ctx.stroke();
    return true;
  }
  if (accType === 'codo90rmSube') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 0.25, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }
  if (accType === 'codo90rmBaja') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const aS = rad * 0.7;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = rad * 0.15 * (engine.lineWidthScale || 1);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - aS * 0.9);
    ctx.lineTo(c.x, c.y + aS * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + aS * 0.9);
    ctx.lineTo(c.x - aS * 0.4, c.y + aS * 0.3);
    ctx.lineTo(c.x + aS * 0.4, c.y + aS * 0.3);
    ctx.closePath();
    ctx.fill();
    return true;
  }
  if (accType === 'codoReventilado') {
    // Proporcionado a `rad` (tamaño real del accesorio) en vez de una constante fija de mm de
    // papel, para que escale junto con el fix de ajuste a pared como todo otro símbolo de
    // accesorio.
    const rf = rad / 1.6;
    const rRad = 1.2 * rf;
    const vLen = 1.6 * rf;
    const offset = rRad + 0.5 * rf;
    const cx1 = c.x - dx * offset,
      cy1 = c.y - dy * offset;
    const cx2 = c.x + dx * offset,
      cy2 = c.y + dy * offset;

    // Rellenar el disco ANTES de trazar nada encima — la línea del ramal debajo se dibuja
    // primero (pase separado anterior) y sin este fondo se transparenta por el anillo sin
    // relleno, dando la impresión de que la tubería "entra" al símbolo. Mismo radio que el
    // trazo del anillo mismo (sin margen de halo extra), así que enmascara la línea sin
    // reintroducir el look de borde blanco grueso.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.35 * engine.zoom * (engine.lineWidthScale || 1);
    ctx.beginPath();
    ctx.moveTo(cx1 - px * vLen, cy1 - py * vLen);
    ctx.lineTo(cx1 + px * vLen, cy1 + py * vLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx2 - px * vLen, cy2 - py * vLen);
    ctx.lineTo(cx2 + px * vLen, cy2 + py * vLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(c.x, c.y, rRad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 0.35 * rf, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }
  return false;
}
