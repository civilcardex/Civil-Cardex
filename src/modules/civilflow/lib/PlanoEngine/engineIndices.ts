import type {
  IPlanoEngineCore,
  PlanoArea,
  PlanoBajante,
  PlanoDimension,
  PlanoGuideLine,
  PlanoRamal,
  PlanoTextAnnotation,
} from './PlanoState.ts';

/**
 * Índices por id de las 6 colecciones del motor: se construye UNA vez por operación
 * (clic/drag) — nunca cacheado, el motor reasigna sus arrays en muchos sitios y un
 * índice viejo se pudre. Ej: drag de 50 seleccionados = 50 lookups O(1), no 50×6 scans.
 */
export interface IndicesMotor {
  ramales: Map<string, PlanoRamal>;
  bajantes: Map<string, PlanoBajante>;
  textos: Map<string, PlanoTextAnnotation>;
  areas: Map<string, PlanoArea>;
  cotas: Map<string, PlanoDimension>;
  guias: Map<string, PlanoGuideLine>;
}

/** Construye los índices id→pieza del motor. El primero gana (como haría un .find). */
export function indicesDeMotor(engine: IPlanoEngineCore): IndicesMotor {
  const porId = <T extends { id: string }>(lista: readonly T[] | undefined): Map<string, T> => {
    const m = new Map<string, T>();
    for (const p of lista || []) if (!m.has(p.id)) m.set(p.id, p);
    return m;
  };
  return {
    ramales: porId(engine.ramales),
    bajantes: porId(engine.bajantes),
    textos: porId(engine.textAnnots),
    areas: porId(engine.areas),
    cotas: porId(engine.dims),
    guias: porId(engine.guideLines),
  };
}
