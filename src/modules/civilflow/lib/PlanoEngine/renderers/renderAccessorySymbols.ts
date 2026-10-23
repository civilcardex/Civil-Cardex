import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import type { DeclutterFrame } from '../labelDeclutter.ts';
import { drawSifonSymbol } from './accTraps';
import { drawCodoSymbols } from './accElbows';
import { drawTeeSymbols } from './accTees';
import { drawValveSymbols } from './accValves';
import { drawFallbackSymbol } from './accFallback';
export { drawCornerCodoArc } from './cornerElbowArc.ts';

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
