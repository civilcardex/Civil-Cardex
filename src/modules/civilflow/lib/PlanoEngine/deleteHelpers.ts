/** Ayudantes del borrado, separados de deleteSelected: pasar los ramalitos huérfanos al ramal
 *  hermano y renumerar los canales para que no queden huecos. Movidos tal cual. */
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState.ts';
import { allocTributaryNumber } from './PlanoState.ts';

// Orig. usuario #2: al borrar un trazo, sus tributarios se REASIGNAN al ramal del otro lado de
// la unión si existe (p. ej. el otro brazo de una yee doble, o la continuación del paso), en vez
// de borrarse junto con él. El ramal hermano comparte un punto de unión con `deleted` (mismo net,
// no tributario) y sigue existiendo tras el borrado.
// Yee doble: los dos brazos están a ~10 unidades a lo largo del tronco, no comparten vértice
// exacto — se busca primero coincidencia exacta (0.5) y en segunda pasada hasta 20px.
// Ítem 4: reasignación validada contra la estructura final + re-etiqueta inmediata.
export function reassignTributariosToHermano(
  engine: IPlanoEngineCore,
  deleted: PlanoRamal,
  toDelete?: Set<string>,
): void {
  if (!deleted.pts?.length) return;
  const TOL = 0.5;
  const LARGE = 20;
  const TOUCH = 2.0;
  const isCandidate = (o: PlanoRamal) =>
    o.id !== deleted.id &&
    o.net === deleted.net &&
    o.tipo !== 'tributario' &&
    !toDelete?.has(o.id) &&
    !!o.pts?.length;
  const deletedEps = [deleted.pts[0], deleted.pts[deleted.pts.length - 1]];
  const findByTol = (tol: number): PlanoRamal | undefined => {
    let best: PlanoRamal | undefined;
    let bestD = Infinity;
    for (const o of engine.ramales) {
      if (!isCandidate(o)) continue;
      const oEps = [o.pts[0], o.pts[o.pts.length - 1]];
      for (const de of deletedEps) {
        for (const oe of oEps) {
          const d = Math.hypot(de[0] - oe[0], de[1] - oe[1]);
          if (d < tol && d < bestD) {
            bestD = d;
            best = o;
          }
        }
      }
    }
    return best;
  };
  const hermanoExact = findByTol(TOL) ?? findByTol(LARGE);
  // Ítem 4: cada tributario debe TOCAR al hermano elegido (estructura final, no ids previos) —
  // si no lo toca se busca otro candidato tocado; sin host válido cae en cascada como antes.
  // Además se re-etiqueta T{nuevo}{hermano} de inmediato (antes conservaba T{n}{borrado}).
  const tribTouches = (t: PlanoRamal, o: PlanoRamal): boolean => {
    if (!t.pts || t.pts.length < 2 || !o.pts || o.pts.length < 2) return false;
    const tEps = [t.pts[0], t.pts[t.pts.length - 1]];
    for (const e of tEps) {
      if ((o.pts || []).some((p) => Math.hypot(p[0] - e[0], p[1] - e[1]) < TOUCH)) return true;
      for (let i = 0; i < o.pts.length - 1; i++) {
        const [ax, ay] = o.pts[i];
        const [bx, by] = o.pts[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-9) continue;
        const tt = Math.max(0, Math.min(1, ((e[0] - ax) * dx + (e[1] - ay) * dy) / lenSq));
        if (Math.hypot(e[0] - (ax + tt * dx), e[1] - (ay + tt * dy)) < TOUCH) return true;
      }
    }
    return false;
  };
  const orphans = engine.ramales.filter((t) => t.tipo === 'tributario' && t.padre === deleted.id);
  for (const t of orphans) {
    let host: PlanoRamal | undefined;
    if (hermanoExact && tribTouches(t, hermanoExact)) {
      host = hermanoExact;
    } else {
      let bestD = Infinity;
      for (const o of engine.ramales) {
        if (!isCandidate(o) || o.id === hermanoExact?.id) continue;
        if (!tribTouches(t, o)) continue;
        const tEps = [t.pts[0], t.pts[t.pts.length - 1]];
        for (const e of tEps) {
          for (const op of o.pts) {
            const d = Math.hypot(e[0] - op[0], e[1] - op[1]);
            if (d < bestD) {
              bestD = d;
              host = o;
            }
          }
        }
      }
    }
    if (!host) continue;
    t.padre = host.id;
    const rootLbl = host.label || host.id;
    t.label = `T${allocTributaryNumber(engine, rootLbl)}${rootLbl}`;
  }
}

/** Después de borrar un canal, corre la numeración (CNL1, CNL2...) para que no queden saltos; el
 *  id del canal queda igual a su código y avisa del cambio a quien escuche. */
export function renumberCanales(engine: IPlanoEngineCore): void {
  const idMap = new Map<string, string>();
  let n = 0;
  for (const b of engine.bajantes) {
    if (b.tipo !== 'canal') continue;
    n++;
    const raw = b.code || b.id || '';
    const suf = raw.includes('-') ? raw.split('-').slice(1).join('-') : '';
    const code = suf ? `CNL${n}-${suf}` : `CNL${n}`;
    if (b.id !== code) idMap.set(b.id, code);
    b.id = code;
    b.code = code;
  }
  if (idMap.size === 0) return;
  for (const r of engine.ramales) {
    if (r.esCanalId && idMap.has(r.esCanalId)) r.esCanalId = idMap.get(r.esCanalId)!;
  }
  for (const b of engine.bajantes) {
    if (b.canalId && idMap.has(b.canalId)) b.canalId = idMap.get(b.canalId)!;
  }
  // Overrides de canales (cf_anulaciones_canales_pluviales) se clavean por sector = code
  // base: sin este aviso, la fila manual quedaba huérfana y el canal renombrado nacía sin
  // material/áreas (duplicado + datos desasociados). RainwaterContext migra sus sectores.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('civilflow_canales_renumerados', {
        detail: { idMap: Object.fromEntries(idMap) },
      }),
    );
  }
}
