// Dispatch de la escalera de herramientas del mousedown (extraído de PlanoEngine
// _onDownHandler): la escalera if/else de 13 herramientas era el último bloque largo del
// método. La tabla hace el mismo dispatch (las herramientas son exclusivas, no hay solape).
// El caso 'sel' queda en el método (label-drag con retorno temprano propio).
import type { IPlanoEngineCore } from './PlanoState.ts';
import {
  handleLineDown,
  handleDimDown,
  handleGuideDown,
  handleTextDown,
  handleBajanteDown,
  handleMontanteDown,
  handleRedPublicaDown,
  handleContadorDown,
  handleCalentadorDown,
  handleCanalDown,
  handleCajaDown,
  handleEraseDown,
  handleAreaDown,
} from './PlanoEngineDrawing.ts';

/** Handler por herramienta; (px, py) = punto en unidades de plano; (x, y) = canvas. */
type ToolDown = (eng: IPlanoEngineCore, px: number, py: number, x: number, y: number) => void;

/** Dispatch de herramienta → handler de mousedown (el `sel` se maneja en el método). */
export const TOOL_DOWN: Record<string, ToolDown> = {
  line: (e, px, py) => handleLineDown(e, px, py),
  dim: (e, px, py) => handleDimDown(e, px, py),
  guide: (e, px, py) => handleGuideDown(e, px, py),
  text: (e, px, py) => handleTextDown(e, px, py),
  baj: (e, px, py) => handleBajanteDown(e, px, py),
  mon: (e, px, py) => handleMontanteDown(e, px, py),
  red_pub: (e, px, py) => handleRedPublicaDown(e, px, py),
  cont: (e, px, py) => handleContadorDown(e, px, py),
  calent: (e, px, py) => handleCalentadorDown(e, px, py),
  canal: (e, px, py) => handleCanalDown(e, px, py),
  caja: (e, px, py) => handleCajaDown(e, px, py),
  area: (e, px, py) => handleAreaDown(e, px, py),
  erase: (e, _px, _py, x, y) => handleEraseDown(e, x, y),
};
