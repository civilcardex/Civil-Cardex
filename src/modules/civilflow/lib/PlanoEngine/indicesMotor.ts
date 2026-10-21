import type {
  IPlanoEngineCore,
  PlanoArea,
  PlanoBajante,
  PlanoDimension,
  PlanoGuideLine,
  PlanoRamal,
  PlanoTextAnnotation,
} from './PlanoEstado.ts';

/**
 * Índices por id de las piezas del motor (ramales, bajantes, anotaciones, áreas, cotas, guías).
 *
 * El motor busca piezas por id DENTRO de bucles — al arrastrar un grupo de N elementos
 * seleccionados, cada uno buscaba su ramal, su bajante, su anotación, su área, su cota y su
 * guía recorriendo la lista completa: N × 6 × lista. Con 50 elementos seleccionados y 500
 * ramales en el plano, eso son 150 000 comparaciones POR CLIC.
 *
 * El índice se construye una vez por operación (no se cachea en el motor): el motor muta sus
 * arrays en muchos sitios (`engine.ramales = engine.ramales.filter(...)`), y un índice
 * cacheado se quedaría rancia. Aquí se construye al empezar el clic y se usa mientras dura.
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
