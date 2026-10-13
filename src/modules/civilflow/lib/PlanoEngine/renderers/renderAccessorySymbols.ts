import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';
import type { DeclutterFrame } from '../labelDeclutter';
import { drawSifonSymbol } from './accSifon';
import { drawCodoSymbols } from './accCodos';
import { drawTeeSymbols } from './accTees';
import { drawValveSymbols } from './accValves';
import { drawFallbackSymbol } from './accFallback';
export { drawCornerCodoArc } from './cornerCodoArc';

// Hub verbatim (Fase A3): dispatcher conserva firma y orden semántico original.
// ponytail: split mecánico por familia; cada helper retorna true si manejó accType.
export function drawExtremeAccessorySymbol(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  accType: string,
  c: { x: number; y: number },
  dx: number,
  dy: number,
  px: number,
  py: number,
  outX: number,
  outY: number,
  rad: number,
  diamLabel?: string,
  ramal?: PlanoRamal,
  slot?: 'ini' | 'fin',
  declutter?: DeclutterFrame,
  pipeToward?: { x: number; y: number },
): void {
  const args = [
    ctx,
    engine,
    accType,
    c,
    dx,
    dy,
    px,
    py,
    outX,
    outY,
    rad,
    diamLabel,
    ramal,
    slot,
    declutter,
    pipeToward,
  ] as const;
  if (drawSifonSymbol(...args)) return;
  if (drawCodoSymbols(...args)) return;
  if (drawTeeSymbols(...args)) return;
  if (drawValveSymbols(...args)) return;
  drawFallbackSymbol(...args);
}
