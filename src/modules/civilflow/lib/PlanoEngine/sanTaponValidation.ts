/**
 * Validación de tapones y limpieza de yees muertas en la red san: retira banderas yeeDobleAt
 * cuyas uniones desaparecieron (con sus tapones huérfanos) y tapones anclados en esquinas-L
 * (2 direcciones), sustituyéndolos por codo cuando aplica. Extraído verbatim de
 * sanAccessoriesCalc.ts. Ej: al desarmar una yee doble en una L, el tapón viejo se retira y
 * queda el codo 45°.
 */
import type { IPlanoEngineCore } from './PlanoState.ts';
import { assignCodoAfterBranchDelete } from './deleteJunctionCleanup.ts';
import type { SanJunctionCtx } from './sanJunctionGeometry.ts';

/** Contrato oculto: `_taponKeepPts` lo escribe deleteYeePreserve.ts (borrado del tronco de la
 *  doble) y SOLO aquí se lee — puertos con tapón legítimo que las pasadas NO deben retirar. */

/** Limpieza del caso yee doble + tapón: la bandera y su tapón viven mientras ALGUNO de los
 *  puntos de la yee siga siendo una unión yee viva. Si ambas uniones desaparecieron (se
 *  borraron las piezas que las formaban), el caso ya no aplica — se retiran bandera y
 *  tapones anclados en esos puntos; el reconteo de abajo actualiza hidroData (orig. usuario).
 *  Puertos recién tapados por preserveYeeDobleAt (borrado del segmento medio del tronco de
 *  la doble): la limpieza de banderas muertas NO debe retirar esos tapones en esta pasada —
 *  la geometría L resultante es idéntica al desarme viejo y solo esta marca los distingue.
 *  Se consume aquí (una sola pasada). MUTA: ramales y ctx.persistedYeePts (agrega keep pts). */
export function limpiarYeesMuertas(
  engine: IPlanoEngineCore,
  ctx: SanJunctionCtx,
  junctionPositions: { x: number; y: number }[],
): void {
  const { sanRamales, persistedYeePts } = ctx;
  const taponKeepPts = (engine as unknown as { _taponKeepPts?: number[][] })._taponKeepPts;
  const taponKept = (p: number[]): boolean =>
    (taponKeepPts || []).some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5);
  // Puertos con tapón legítimo (borrado del tronco de la doble): cuantan como yee PERSISTIDA
  // en TODAS las pasadas — la validación de esquinas-L y el recuento no los retiran (orig.
  // usuario: el tapón soldado desaparecía de plano y resumen en la 2ª pasada). Ya NO se
  // consume: vive en el engine hasta que la yee se re-establezca o se borre el tramo.
  if (taponKeepPts?.length) persistedYeePts.push(...taponKeepPts);
  for (const r of [...sanRamales]) {
    if (!r.yeeDobleAt || r.yeeDobleAt.length !== 2) continue;
    const [f1, f2] = r.yeeDobleAt;
    const isLive = (p: number[]) =>
      junctionPositions.some((jp) => Math.hypot(jp.x - p[0], jp.y - p[1]) < 0.5);
    if (isLive(f1) || isLive(f2)) continue;
    const near = (p: number[]) => (q: number[]) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5;
    const same = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5;
    const pairMatch = (a: number[][], b: number[][]) =>
      (same(a[0], b[0]) && same(a[1], b[1])) || (same(a[0], b[1]) && same(a[1], b[0]));
    for (const rr of sanRamales) {
      if (!rr.pts) continue;
      if (
        rr.accesorioInicio === 'tapon' &&
        (near(f1)(rr.pts[0]) || near(f2)(rr.pts[0])) &&
        !taponKept(rr.pts[0])
      )
        rr.accesorioInicio = '';
      if (
        rr.accesorioFin === 'tapon' &&
        rr.pts.length >= 2 &&
        (near(f1)(rr.pts[rr.pts.length - 1]) || near(f2)(rr.pts[rr.pts.length - 1])) &&
        !taponKept(rr.pts[rr.pts.length - 1])
      )
        rr.accesorioFin = '';
      if (rr.accMed) {
        for (const [k, v] of Object.entries(rr.accMed)) {
          if (v !== 'tapon') continue;
          const m = k.match(/^accMed(\d+)$/);
          const idx = m ? parseInt(m[1], 10) : -1;
          const p = rr.pts[idx];
          if (p && (near(f1)(p) || near(f2)(p)) && !taponKept(p)) delete rr.accMed[k];
        }
      }
      // Bandera con los mismos puntos (cualquier titular de la referencia/valores) → fuera —
      // SALVO que sus puertos tengan tapones protegidos (limpiarla dejaba sin blindaje la
      // pasada siguiente y el tapón soldado se perdía, orig. usuario).
      if (
        rr.yeeDobleAt &&
        (pairMatch(rr.yeeDobleAt, [f1, f2]) || pairMatch(rr.yeeDobleAt, [f2, f1])) &&
        !taponKept(f1) &&
        !taponKept(f2)
      )
        rr.yeeDobleAt = undefined;
    }
  }
}

/** Validación global de tapones (independiente de las banderas): un tapón solo cierra una
 *  dirección libre de una unión viva (≥3 direcciones en el punto) o el extremo abierto de un
 *  stub (1 dirección, el propio host). En un punto de 2 direcciones — esquina L (codo) o paso
 *  recto — sobra: se retira (orig. usuario: al desarmar la yee en una L, el tapón viejo
 *  seguía dibujado y contado). */
export function validarTaponesGlobales(engine: IPlanoEngineCore, ctx: SanJunctionCtx): void {
  const { sanRamales, persistedYeePts, dirsAt } = ctx;
  const taponGoneAt: number[][] = [];
  // Tapón anclado en un punto de yee doble PERSISTIDA viva: es el cierre legítimo del
  // extremo abierto del caso doble (borrar el tronco-terminal deja la unión en 2 direcciones
  // con su lateral) — NO se retira aunque dirsAt dé 2 (orig. usuario: el tapón dejaba de
  // aparecer). El desarme viejo (banderas ya muertas) sí se retira → codo.
  const onPersistedYeePt = (p: number[]): boolean =>
    persistedYeePts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5);
  for (const rr of sanRamales) {
    if (!rr.pts || rr.pts.length < 2) continue;
    if (rr.accesorioInicio === 'tapon' && dirsAt(rr.pts[0]) === 2 && !onPersistedYeePt(rr.pts[0])) {
      rr.accesorioInicio = '';
      taponGoneAt.push(rr.pts[0]);
    }
    const li = rr.pts.length - 1;
    if (rr.accesorioFin === 'tapon' && dirsAt(rr.pts[li]) === 2 && !onPersistedYeePt(rr.pts[li])) {
      rr.accesorioFin = '';
      taponGoneAt.push(rr.pts[li]);
    }
    if (rr.accMed) {
      for (const [k, v] of Object.entries(rr.accMed)) {
        if (v !== 'tapon') continue;
        const m = k.match(/^accMed(\d+)$/);
        const idx = m ? parseInt(m[1], 10) : -1;
        const p = rr.pts[idx];
        if (p && dirsAt(p) === 2 && !onPersistedYeePt(p)) {
          delete rr.accMed[k];
          taponGoneAt.push(p);
        }
      }
    }
  }
  // Tapón retirado en una esquina L (2 direcciones NO colineales): la esquina queda sin
  // símbolo — el codo de plano lo sustituye. Sin esto, el tapón del caso yee bloqueó la
  // asignación del codo durante el desarme y la validación dejaba el punto vacío (orig.
  // usuario: desarmar la yee doble no dibujaba el codo 45). Para paso recto (colineal)
  // assignCodoAfterBranchDelete no hace nada por sí solo.
  for (const pt of taponGoneAt) assignCodoAfterBranchDelete(engine, pt);
  // Tapón retirado en una esquina L (2 direcciones NO colineales): la esquina queda sin
  // símbolo — el codo de plano lo sustituye. Sin esto, el tapón del caso yee bloqueó la
  // asignación del codo durante el desarme y la validación dejaba el punto vacío (orig.
  // usuario: desarmar la yee doble no dibujaba el codo 45). Para paso recto (colineal)
  // assignCodoAfterBranchDelete no hace nada por sí solo.
  for (const pt of taponGoneAt) assignCodoAfterBranchDelete(engine, pt);
}
