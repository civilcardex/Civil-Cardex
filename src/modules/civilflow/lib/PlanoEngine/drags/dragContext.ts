import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { calculateRamalLength, _midpoint } from '../PlanoEngineDrawing.ts';
import { angleAtHalfLength } from '../drawingAngles.ts';

/* Índices por id durante el arrastre: canónico en engineIndices.indicesDeMotor (una llamada
 * construye los 6 mapas; antes había 5 wrappers indexRamales/indexGuias/… duplicados aquí). */

/** san y vent comparten grupo de red: la cascada de arrastre (una mueve a la otra) cruza
 *  entre ambas; el resto de redes solo consigo mismas. */
// Canónico en drawingAngles (san y vent comparten grupo de red).
export { sameNetGroup } from '../drawingAngles.ts';

/** Índices del frame que comparten varias ramas del dispatcher de arrastre. */
export interface DragCtx {
  /** id→ramal del plano (el arrastre de un bajante busca sus ramales por id). */
  ramalesPorId: Map<string, PlanoRamal>;
  /** Índice inverso: qué bajantes reciben a cada ramal (el .includes era O(bajantes×recibe)). */
  bajantesQueReciben: Map<string, import('../PlanoState.ts').PlanoBajante[]>;
}

/**
 * Refresco de longitud+etiqueta tras mover puntos de un ramal: totalL, ángulo y posición de
 * la etiqueta. La etiqueta movida A MANO (labelMoved) no se toca — solo el arrastre de
 * etiqueta (lblDrag) la mueve; con `recentrar` (Ldesvio del fantasma) la posición se
 * re-centra SIEMPRE.
 */
export function refrescarTrazo(engine: IPlanoEngineCore, r: PlanoRamal, recentrar = false): void {
  r.totalL = calculateRamalLength(r.pts, engine);
  if (!r.labelMoved) r.labelAngle = angleAtHalfLength(r.pts);
  if (!r.labelMoved || recentrar) {
    const [mx, my] = _midpoint(r.pts);
    r.labelX = mx;
    r.labelY = my;
  }
}
