import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import type { DeclutterFrame } from '../labelDeclutter.ts';
import { drawSifonSymbol } from './accTraps';
import { drawCodoSymbols } from './accElbows';
import { drawTeeSymbols } from './accTees';
import { drawValveSymbols } from './accValves';
import { drawFallbackSymbol } from './accFallback';
export { drawCornerCodoArc } from './cornerElbowArc.ts';

/** Contrato común de los pintores de accesorios y el repartidor que elige la familia que dibuja cada glifo. */

/** Argumentos del símbolo de accesorio en extremo de ramal — un solo objeto en vez de una
 *  firma de 16 posicionales que cada familia ignoraba en parte. Ej: drawCodoSymbols solo
 *  lee ctx/engine/accType/c/dx/dy/px/py/rad; el resto lo ignora. */
export interface AccSimboloArgs {
  ctx: CanvasRenderingContext2D;
  engine: IPlanoEngineCore;
  accType: string;
  c: { x: number; y: number };
  dx: number;
  dy: number;
  px: number;
  py: number;
  outX: number;
  outY: number;
  rad: number;
  diamLabel?: string;
  ramal?: PlanoRamal;
  slot?: 'ini' | 'fin';
  declutter?: DeclutterFrame;
  /** Hacia el cuerpo del ramal: horquillas/tapones abren sus brazos hacia allí. */
  pipeToward?: { x: number; y: number };
}

/** Reparte el glifo del accesorio de EXTREMO entre las familias (sifón → codo → tee → válvula → respaldo): el primero que reconoce el tipo gana. */
export function drawExtremeAccessorySymbol(a: AccSimboloArgs): void {
  if (drawSifonSymbol(a)) return;
  if (drawCodoSymbols(a)) return;
  if (drawTeeSymbols(a)) return;
  if (drawValveSymbols(a)) return;
  drawFallbackSymbol(a);
}
