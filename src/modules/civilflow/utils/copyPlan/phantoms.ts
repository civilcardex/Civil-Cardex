/**
 * Fantasmas al copiar (definición usuario): el MISMO bajante clonado en su posición DESPLAZADA
 * por el anillo de asociación (x+dx, y+dy, escalado por el factor de calibración) con dirección
 * 'sube' — la versión dashed de la imagen. En modo 'fantasmas' las copias reales se retiran y
 * queda solo el clon; además se retiran los XFG (fantasmas entrepisos) residuales que quedaron
 * redundantes tras materializar la copia.
 * Ej: modo 'ambos' → el Piso 2 muestra el bajante real y su gemelo desplazado a la derecha.
 */
import type { PlanoBajante } from '../../lib/PlanoEngine/PlanoState.ts';
import type { CopyElement, CopyOpciones, ExtendedEngine } from './types.ts';
import { purgarClavesDeCopias, type ParCopia } from './storeKeys.ts';
import type { Contadores } from './renumber.ts';

/** Entradas de generarFantasmas (estado vivo del lote: mapa old→new, contadores y offsets). */
export interface FantasmasCtx {
  engine: ExtendedEngine;
  netId: string;
  bmPfx: string;
  monPfx: string;
  modoFantasmas: CopyOpciones['fantasmas'];
  oldToNew: Record<string, string>;
  offsetFantasma: Map<string, { dx: number; dy: number }>;
  calibFactor: number;
  contadores: Contadores;
  srcRamales: CopyElement[];
  srcBajantes: CopyElement[];
  srcGlobals: CopyElement[];
  selPairs: ParCopia[];
  targetPlanId: string;
}

/** Resultado: los clones creados y los ids VIEJOS que tienen clon (para retirar XFG residuales). */
export interface FantasmasResult {
  phantoms: PlanoBajante[];
  oldIdsConClon: Set<string>;
}

/** Genera (y en modo 'fantasmas', sustituye las copias por) los clones desplazados del anillo. */
export function generarFantasmas(ctx: FantasmasCtx): FantasmasResult {
  const {
    engine,
    netId,
    bmPfx,
    monPfx,
    modoFantasmas,
    oldToNew,
    offsetFantasma,
    calibFactor,
    contadores,
    srcRamales,
    srcBajantes,
    srcGlobals,
    selPairs,
    targetPlanId,
  } = ctx;
  const revOld: Record<string, string> = {};
  for (const [o, n] of Object.entries(oldToNew)) revOld[n] = o;
  const phantoms: PlanoBajante[] = [];
  const oldIdsConClon = new Set<string>();
  if (modoFantasmas !== 'originales') {
    const nuevos = (
      engine.bajantes as unknown as Array<
        Record<string, unknown> & { id: string; tipo: string; x?: number; y?: number }
      >
    ).slice(-(srcBajantes.length + srcGlobals.length));
    for (const b of nuevos) {
      const off = offsetFantasma.get(revOld[b.id] || b.id);
      if (!off) continue;
      oldIdsConClon.add(revOld[b.id] || b.id);
      // El anillo es un VECTOR en px crudos del frame origen: escalarlo por calibFactor
      // (la traslación ya se cancela — b.x/y están transformados; la escala no).
      const f = calibFactor || 1;
      const ph = {
        ...b,
        x: (b.x ?? 0) + off.dx * f,
        y: (b.y ?? 0) + off.dy * f,
        direccion: 'sube',
      } as Record<string, unknown> & { tipo: string; id: string };
      // Sin labelX/labelY heredados: quedaban en la posición del bajante base, lejos del
      // glifo desplazado — el render auto-posiciona la etiqueta junto al símbolo.
      delete ph.labelX;
      delete ph.labelY;
      if (ph.tipo === 'montante') {
        contadores.montante++;
        ph.id = monPfx + contadores.montante + '_' + netId;
      } else {
        contadores.bajante++;
        ph.id = bmPfx + contadores.bajante;
      }
      ph.code = ph.id;
      phantoms.push(ph as unknown as PlanoBajante);
    }
    if (modoFantasmas === 'fantasmas') {
      // Solo fantasmas: retirar las copias REALES recién agregadas (y ramales seleccionados)
      // — queda solo la versión desplazada (sube). SIN bajantes con anillo (phantoms vacío)
      // el destino queda como estaba: se retira todo y el conteo da 0 (antes: splice total
      // + "✓ N copiados" con el canvas intacto).
      (engine.bajantes as unknown[]).splice(
        engine.bajantes.length - srcBajantes.length - srcGlobals.length,
        srcBajantes.length + srcGlobals.length,
      );
      (engine.ramales as unknown[]).splice(engine.ramales.length - srcRamales.length);
      if (phantoms.length) {
        // Los clones heredaron punteros de las copias retiradas: sanear contra lo que
        // SIGUE vivo (los ramales referenciados se splicean arriba).
        const vivos = new Set<string>([
          ...(engine.bajantes as Array<{ id: string }>).map((b) => b.id),
          ...(engine.ramales as Array<{ id: string }>).map((r) => r.id),
        ]);
        for (const ph of phantoms as unknown as Array<Record<string, unknown>>) {
          for (const k of ['recibeDeIds', 'alimentaIds'] as const) {
            const arr = ph[k] as string[] | undefined;
            if (Array.isArray(arr)) ph[k] = arr.filter((id) => vivos.has(id));
          }
          if (ph.descargaEnId && !vivos.has(String(ph.descargaEnId))) delete ph.descargaEnId;
        }
        purgarClavesDeCopias(selPairs, netId, String(targetPlanId));
      }
    }
    if (phantoms.length) engine.bajantes.push(...(phantoms as unknown as PlanoBajante[]));
  }
  return { phantoms, oldIdsConClon };
}

/** Retira los XFG proyectados del plano origen que quedaron redundantes tras materializar la copia. */
export function retirarGhostsResiduales(
  engine: ExtendedEngine,
  modoFantasmas: CopyOpciones['fantasmas'],
  oldToNew: Record<string, string>,
  oldIdsConClon: Set<string>,
  srcPid: string,
): void {
  // Doble etiqueta (orig. usuario): si el piso origen proyectó un FANTASMA del bajante en
  // este piso destino, el bajante ahora copiado coexistía con ese fantasma residual que
  // muestra el mismo código — dos etiquetas para el mismo elemento. Tras copiar DESDE un
  // plano, TODOS sus fantasmas proyectados aquí son redundantes (sus bajantes ya están
  // materializados como copias); se retiran por sourcePlanId y por id viejo/nuevo.
  // Doble etiqueta: el XFG que este destino proyectaba del origen es redundante cuando el
  // bajante quedó MATERIALIZADO aquí. En 'originales' son todos; con clones ('ambos'/
  // 'fantasmas') SOLO los que tienen clon — sin clon el usuario pidió conservar la proyección
  // (test copyFloorsAndDiametros 'ambos': XFG sin anillo sobrevive).
  if (modoFantasmas === 'originales' || oldIdsConClon.size > 0) {
    const conClonOld = [...oldIdsConClon].map((o) => ({ o, n: oldToNew[o] }));
    const copiedOldIds = new Set(
      modoFantasmas === 'originales' ? Object.keys(oldToNew) : conClonOld.map((x) => x.o),
    );
    const copiedNewIds = new Set(
      modoFantasmas === 'originales'
        ? Object.values(oldToNew)
        : conClonOld.map((x) => x.n).filter(Boolean as unknown as (n: string) => boolean),
    );
    engine.crossFloorGhosts = (engine.crossFloorGhosts || []).filter((g) => {
      const ghost = g as {
        sourceBajanteId?: string;
        targetBajanteId?: string;
        code?: string;
        sourcePlanId?: string | number;
      };
      return (
        String(ghost.sourcePlanId ?? '') !== srcPid &&
        !copiedOldIds.has(ghost.sourceBajanteId || '') &&
        !copiedNewIds.has(ghost.targetBajanteId || '') &&
        !(ghost.code && copiedNewIds.has(ghost.code))
      );
    });
  }
}
