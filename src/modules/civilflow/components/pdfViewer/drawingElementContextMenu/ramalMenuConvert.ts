// Conversión ramal↔tributario del menú contextual (lógica sin JSX): candidatos a padre,
// conversión a tributario (renumera T{n}{raíz}) y de regreso a ramal (recupera id libre).
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import { allocTributaryNumber, nextFreeRamalId } from '../../../lib/PlanoEngine/PlanoState.ts';
import { renameRamalId } from '../../../lib/PlanoEngine/networkRenumber.ts';
import { sameNetGroup } from '../../../lib/PlanoEngine/drawingAngles.ts';
import { pointOnRamalBody, tribsBlockingRamalConversion } from './ramalMenuHelpers.ts';
import type { DrawingElementContextMenuContextValue } from './context.ts';

/** Mínimo del menú que las conversiones tocan (setSelElement + cierre del menú). */
type MenuBits = Pick<
  DrawingElementContextMenuContextValue,
  'selElement' | 'setSelElement' | 'setContextMenuState'
>;

/**
 * Candidatos a padre para "Convertir en tributario": ramales de la misma red (o grupo
 * san/vent) que ESTE ramal toca (extremo sobre vértice o sobre cuerpo). Los tributarios
 * no son candidatos: un tributario nunca es un tronco.
 */
export function tribCandidatesDe(
  eng: {
    ramales: PlanoRamal[];
  } | null,
  ramalEl: PlanoRamal,
): PlanoRamal[] {
  if (!eng || ramalEl.tipo === 'tributario' || !ramalEl.pts || ramalEl.pts.length < 2) {
    return [];
  }
  const TOL = 0.5;
  const eps = [ramalEl.pts[0], ramalEl.pts[ramalEl.pts.length - 1]];
  const out: PlanoRamal[] = [];
  for (const o of eng.ramales) {
    if (o.id === ramalEl.id || o.tipo === 'tributario') continue;
    if (!sameNetGroup(o.net, ramalEl.net)) continue;
    const touch =
      eps.some(
        (e) =>
          (o.pts || []).some((p) => Math.hypot(p[0] - e[0], p[1] - e[1]) < TOL) ||
          pointOnRamalBody(o.pts || [], e, TOL),
      ) ?? false;
    if (touch) out.push(o);
  }
  return out;
}

/**
 * Convierte el ramal en tributario del padre dado: hereda el label consecutivo del grupo
 * (T{n}{raíz}) y fija la convención de flecha (_tribReversed: san/ll drenan HACIA la
 * unión; af/ac/gas/vent fluyen DESDE ella). El consecutivo va contra el padre ELEGIDO —
 * un padre auto-creado (con mergesFrom) hacía que la raíz subiera hasta el tramo original
 * y el label salía T2RS9 habiendo elegido RS8 (orig. usuario).
 */
export function convertirATributario(
  ctx: MenuBits,
  eng: PlanoEngine,
  ramalEl: PlanoRamal,
  padreId: string,
): void {
  const fresh = eng.ramales.find((r) => r.id === ramalEl.id);
  if (!fresh || !fresh.pts || fresh.pts.length < 2) return;
  const TOL = 0.5;
  const p0 = fresh.pts[0];
  const p1 = fresh.pts[fresh.pts.length - 1];
  const padre = eng.ramales.find((r) => r.id === padreId);
  const touchOnPadre = (e: number[]) =>
    (padre?.pts || []).some((p) => Math.hypot(p[0] - e[0], p[1] - e[1]) < TOL) ||
    pointOnRamalBody(padre?.pts || [], e, TOL);
  const t0 = touchOnPadre(p0);
  const t1 = touchOnPadre(p1);
  const epIsStart = t0 && !t1;
  const rootLbl = padre?.label || padreId;
  const updates: Record<string, unknown> = {
    tipo: 'tributario',
    padre: padreId,
    // Convención de punta de flecha igual que autoSplitJunctionAndSumFlow: la geometría ya
    // está conectada (el ramal tocó y dividió a su padre al dibujarse) — esto solo cambia
    // la semántica del flujo.
    _tribReversed: fresh.net === 'san' || fresh.net === 'll' ? epIsStart : !epIsStart,
  };
  if (rootLbl) {
    updates.label = `T${allocTributaryNumber(eng, rootLbl)}${rootLbl}`;
  }
  eng.updateElementById(fresh.id, updates);
  if (ctx.selElement?.id === fresh.id) {
    ctx.setSelElement({ ...ctx.selElement, ...updates } as never);
  }
  eng.render();
  (eng as unknown as { _markDirty: () => void })._markDirty();
  ctx.setContextMenuState(null);
}

/**
 * Convierte el tributario de vuelta a ramal: recupera el primer id/label libre con el
 * prefijo de su red EXCLUYENDO el propio elemento (ida y vuelta RS2→T1RS2→RS2 recupera
 * RS2, nextFreeRamalId), renombra el id y migra todas sus referencias. Si el ramal
 * resultante LLEGA a un tributario (extremo propio sobre él), la regla "los ramales no se
 * conectan a tributarios" aplica y se aborta con alerta (el llamador ya la mostró).
 * @returns true si la conversión se aplicó.
 */
export function convertirARamal(
  ctx: MenuBits,
  eng: PlanoEngine,
  ramalEl: PlanoRamal,
  triggerAlert: (t: string, m: string) => void,
): boolean {
  const fresh = eng.ramales.find((r) => r.id === ramalEl.id);
  if (!fresh) return false;
  if (fresh.tipo === 'tributario' && fresh.pts && fresh.pts.length >= 2) {
    if (tribsBlockingRamalConversion(eng.ramales, fresh.id).length > 0) {
      triggerAlert('Conexión no permitida', 'Los ramales no se conectan a tributarios.');
      return false;
    }
  }
  // El flip de la flecha del renderer depende de `tipo`: san/ll/vent solo aplican
  // _tribReversed a TRIBUTARIOS; al pasar a ramal el flip vuelve a 1 y la flecha se
  // invertiría si el tributario traía _tribReversed. Revertir pts + limpiar el flag
  // deja la flecha apuntando igual que antes de la conversión.
  const net = fresh.net;
  if ((net === 'san' || net === 'll' || net === 'vent') && fresh._tribReversed) {
    fresh.pts = [...(fresh.pts || [])].reverse();
    fresh._tribReversed = undefined;
  }
  const pfx =
    net === 'san'
      ? 'RS'
      : net === 'll'
        ? 'RALL'
        : net === 'af'
          ? 'RAF'
          : net === 'ac'
            ? 'RAC'
            : 'R';
  const oldId = fresh.id;
  const newId = nextFreeRamalId(eng.ramales, pfx, oldId);
  const updates: Record<string, unknown> = {
    tipo: 'ramal',
    padre: null,
    label: newId,
    pts: fresh.pts,
    _tribReversed: fresh._tribReversed,
  };
  renameRamalId(eng, oldId, newId, fresh.label);
  eng.updateElementById(newId, updates);
  if (ctx.selElement?.id === oldId)
    ctx.setSelElement({ ...ctx.selElement, ...updates, id: newId } as never);
  eng.render();
  (eng as unknown as { _markDirty: () => void })._markDirty();
  ctx.setContextMenuState(null);
  return true;
}
