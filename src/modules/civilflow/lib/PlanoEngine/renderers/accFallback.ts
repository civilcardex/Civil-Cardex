import { MONO_3D } from '../../../components/shared/config3d';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import type { DeclutterFrame } from '../labelDeclutter.ts';

export function drawFallbackSymbol(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  accType: string,
  c: { x: number; y: number },
  _dx: number,
  _dy: number,
  _px: number,
  _py: number,
  _outX: number,
  _outY: number,
  rad: number,
  _diamLabel?: string,
  _ramal?: PlanoRamal,
  _slot?: 'ini' | 'fin',
  _declutter?: DeclutterFrame,
  _pipeToward?: { x: number; y: number },
): boolean {
  if (
    accType.startsWith('tee') ||
    accType === 'te_linea' ||
    accType === 'te_ramal' ||
    accType.startsWith('yee')
  ) {
    return true;
  }
  // Símbolo de texto de respaldo para cualquier otro accesorio
  let label = accType.substring(0, 3).toUpperCase();
  if (accType.startsWith('codo90')) label = 'C90';
  else if (accType.startsWith('codo45')) label = 'C45';
  else if (accType.startsWith('codos_90')) label = 'C90';
  else if (accType === 'valvula_bola') label = 'VB';
  else if (accType === 'valvPie') label = 'VP';
  else if (accType === 'reduccion') label = 'RED';
  else if (accType === 'ampliacion') label = 'AMP';

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.5 * engine.zoom * (engine.lineWidthScale || 1);
  ctx.beginPath();
  ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#000000';
  // Dimensionado al radio propio del círculo (como todo otro glifo de accesorio) — un mínimo
  // fijo basado en zoom aquí se desbordaría del círculo cuando este se encoge a un tamaño
  // realista.
  ctx.font = `bold ${rad * 0.6}px ${MONO_3D}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, c.x, c.y);
  return true;
}
