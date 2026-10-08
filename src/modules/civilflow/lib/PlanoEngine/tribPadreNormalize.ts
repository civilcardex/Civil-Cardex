// Normalización de padres de tributarios (el label T{n}{raíz} es la verdad); usado por el
// autoSplit y el sanado global. Extraído verbatim de junctionAutoSplit.

import type { IPlanoEngineCore } from './PlanoState';
import { rootTributarioLabel, allocTributaryNumber, relabelTribChain } from './PlanoState';

/** Re-etiqueta los tributarios del punto a la raíz del padre del primero (el label T{n}{raíz} es la verdad). */
export function normalizeTribPadresAt(
  engine: IPlanoEngineCore,
  ep: number[],
  trunkId: string,
  sameNetGroup: (a: string, b: string) => boolean,
  TOL: number,
): void {
  const trunk = engine.ramales.find((r) => r.id === trunkId);
  if (!trunk) return;
  const trunkLbl = trunk.label || trunk.id;
  for (const r of engine.ramales) {
    if (r.tipo !== 'tributario' || !r.pts?.length) continue;
    if (!sameNetGroup(r.net, trunk.net)) continue;
    if (!r.pts.some(([x, y]) => Math.hypot(x - ep[0], y - ep[1]) < TOL)) continue;
    r.padre = trunkId;
    const root = rootTributarioLabel(engine.ramales, trunkId) || trunkLbl;
    if (!r.label || !r.label.endsWith(root)) {
      r.label = `T${allocTributaryNumber(engine, root)}${root}`;
    }
    relabelTribChain(engine.ramales, r.id, (suffix) => allocTributaryNumber(engine, suffix));
  }
}

export function healedPadreId(
  ramales: Array<{ id: string; label?: string; tipo?: string; padre: string | null }>,
  tribId: string,
): string | null {
  const r = ramales.find((x) => x.id === tribId);
  if (!r || r.tipo !== 'tributario') return null;
  const m = /^T\d+(.+)$/.exec(r.label || '');
  if (!m) return r.padre;
  const rootLbl = m[1];
  const root = ramales.find(
    (x) => x.tipo !== 'tributario' && (x.label === rootLbl || x.id === rootLbl),
  );
  if (!root) return r.padre;
  // ¿El padre actual ya resuelve a esa misma raíz? Nada que sanear.
  let cur: string | null = r.padre;
  let guard = 0;
  while (cur && guard++ < 20) {
    const p = ramales.find((x) => x.id === cur);
    if (!p) break;
    if (p.tipo !== 'tributario') return p.id === root.id ? r.padre : root.id;
    cur = p.padre;
  }
  return root.id;
}

export function normalizeTribPadresAtPoint(
  engine: IPlanoEngineCore,
  ep: number[],
  targetPadreId: string,
  net: string,
  sameNetGroup: (a: string, b: string) => boolean,
  TOL: number,
): void {
  if (!targetPadreId) return;
  for (const r of engine.ramales) {
    if (r.tipo !== 'tributario' || !r.pts?.length) continue;
    if (!sameNetGroup(r.net, net)) continue;
    if (!r.pts.some(([x, y]) => Math.hypot(x - ep[0], y - ep[1]) < TOL)) continue;
    // SIN guard de "padre ya correcto": aunque el padre no cambie, el LABEL puede estar stale
    // (T2RS1 con padre RS2) — relabelTribChain re-etiqueta a la raíz de la cadena.
    r.padre = targetPadreId;
    relabelTribChain(engine.ramales, r.id, (suffix) => allocTributaryNumber(engine, suffix));
  }
}
