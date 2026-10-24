import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState.ts';
import { calculateRamalLength, _midpoint } from '../PlanoEngineDrawing.ts';
import { angleAtHalfLength } from '../drawingAngles.ts';

/** Buscador rápido por id de tuberías (durante un arrastre se consulta muchas veces por cuadro;
 *  recorrer la lista cada vez se sentía lento). */
export function indexRamales(engine: IPlanoEngineCore): Map<string, PlanoRamal> {
  return new Map(engine.ramales.map((r) => [r.id, r]));
}

/** Buscador rápido por id de las guías — misma idea que indexRamales. */
export function indexGuias(
  engine: IPlanoEngineCore,
): Map<string, (typeof engine.guideLines)[number]> {
  return new Map(engine.guideLines.map((g) => [g.id, g]));
}

/** Buscador rápido por id de las áreas — misma idea que indexRamales. */
export function indexAreas(engine: IPlanoEngineCore): Map<string, (typeof engine.areas)[number]> {
  return new Map(engine.areas.map((a) => [a.id, a]));
}

/** Buscador rápido por id de las cotas — misma idea que indexRamales. */
export function indexCotas(engine: IPlanoEngineCore): Map<string, (typeof engine.dims)[number]> {
  return new Map(engine.dims.map((d) => [d.id, d]));
}

/** Buscador rápido por id de las tuberías verticales — misma idea que indexRamales. */
export function indexBajantes(engine: IPlanoEngineCore): Map<string, PlanoBajante> {
  return new Map(engine.bajantes.map((b) => [b.id, b]));
}

/** san y vent comparten grupo de red: la cascada de arrastre (una mueve a la otra) cruza
 *  entre ambas; el resto de redes solo consigo mismas. */
// Canónico en drawingAngles (san y vent comparten grupo de red).
export { sameNetGroup } from '../drawingAngles.ts';

/** Índices del frame que comparten varias ramas del dispatcher de arrastre. */
export interface DragCtx {
  /** id→ramal del plano (el arrastre de un bajante busca sus ramales por id). */
  ramalesPorId: Map<string, PlanoRamal>;
  /** Índice inverso: qué bajantes reciben a cada ramal (el .includes era O(bajantes×recibe)). */
  bajantesQueReciben: Map<string, PlanoBajante[]>;
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
