import type { MutableRefObject } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { CountsMap, HidroDataMap, SelectableTarget } from '../fixturesStorage';
import { loadFromStorage } from '../../services/storageService';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { splitPtr } from '../../utils/keys';
import { aggBajanteAsociado, type AsocLiveBaj } from '../../utils/bombaAssociation';
import { useMemo } from 'react';

/** Args del mapa visible del panel (objeto — el panel pasa sus closures tal cual). */
export interface TargetArgs {
  netId: string;
  storageKey: string | null;
  targetId: string | null;
  /** Cuando el tramo es una unión de varios ramales, el panel muestra la suma de estas claves. */
  mergeKeys: Iterable<string> | null;
  isBajanteSan: boolean;
  planId?: string | number;
  selElement: SelectableTarget | null;
  counts: CountsMap;
  hidroData: HidroDataMap;
  plans: Array<{ id: string | number; nivel: string | number | null }>;
  engineRef: MutableRefObject<PlanoEngine | null>;
  agregadoBajante: (bajId: string) => Record<string, number>;
  exitsDeBajante: (bajId: string) => Set<string>;
}

/** Mapa de unidades que SE VE en el panel del tramo elegido. Según el caso toma la
 *  fuente correcta: bajante asociado a otro piso o bomba (lo que muestra el grupo),
 *  salida espejo de un bajante, LDesvio (ramal desvio entrepisos) (copia del grupo),
 *  af (Agua Fria)/ac (Agua Caliente) (la clave ya trae lo propagado) o gas (Gas) con
 *  unión (suma de las patas). */
export function currentMapDe(a: TargetArgs): Record<string, number> {
  const {
    storageKey,
    targetId,
    netId,
    counts,
    hidroData,
    engineRef,
    selElement,
    planId,
    plans,
    agregadoBajante,
    exitsDeBajante,
    mergeKeys,
    isBajanteSan,
  } = a;
  if (!storageKey) return {};
  // Bajante ASOCIADO desde arriba (origenId): muestra las UDs del GRUPO — la clave del
  // Ldesvio las mantiene la propagación en vivo desde el piso superior.
  // origenId leído del ENGINE VIVO (selElement puede quedar stale tras updateElementById).
  const liveBaj = engineRef.current?.bajantes.find((b) => b.id === targetId);
  const origen =
    liveBaj?.origenId ??
    liveBaj?.bombaEnId ??
    (selElement as { origenId?: string; bombaEnId?: string } | null)?.origenId ??
    (selElement as { bombaEnId?: string } | null)?.bombaEnId;
  // FUENTE ÚNICA del bajante asociado (orig. usuario: original/fantasma/Ldesvio muestran
  // SIEMPRE las UD del grupo — 12, nunca 16): bomba → libro → árbol real del origen.
  if (isBajanteSan && targetId && origen?.includes('|')) {
    const asoc = aggBajanteAsociado({
      targetId,
      netId,
      planId: String(planId ?? ''),
      liveBaj,
      plans,
      counts,
      hidro: hidroData as unknown as Record<string, { accesorios?: Record<string, number> }>,
      engine: engineRef.current,
    });
    if (asoc) return asoc;
  }
  const propio = isBajanteSan && targetId ? agregadoBajante(targetId) : null;
  if (propio) return propio;
  // Espejo de SALIDA de un bajante/caja: mostrar EXACTAMENTE el agregado del elemento dueño
  // — nunca la clave propia del ramal ni sus mergeKeys (cualquier copia vieja en esas claves
  // mostraba los aparatos de los trazos de entrada DUPLICADOS en la salida, orig. usuario).
  if (
    targetId &&
    (netId === 'san' || netId === 'll') &&
    !targetId.startsWith('LD_') &&
    !targetId.startsWith('B')
  ) {
    const engM = engineRef.current;
    const owner = engM?.bajantes.find((b) => b.net === netId && exitsDeBajante(b.id).has(targetId));
    if (owner) {
      // Salida de un bajante ASOCIADO: misma fuente única (la suma cruda del árbol daba 16).
      if (owner.origenId?.includes('|') || owner.bombaEnId?.includes('|')) {
        const asoc = aggBajanteAsociado({
          targetId: owner.id,
          netId,
          planId: String(planId ?? ''),
          liveBaj: owner,
          plans,
          counts,
          hidro: hidroData as unknown as Record<string, { accesorios?: Record<string, number> }>,
          engine: engineRef.current,
        });
        if (asoc) return asoc;
      }
      return agregadoBajante(owner.id);
    }
  }
  // LDesvio: espeja el GRUPO de la asociación (la clave espejo `san_LD_X_plan` puede quedar
  // stale de escrituras viejas). El grupo se resuelve por el bajante asociado local cuyo
  // `origenId` referencia al titular del LD (`LD_<upperId>`).
  if (targetId?.startsWith('LD_') && (netId === 'san' || netId === 'll')) {
    const upperId = targetId.slice(3);
    const engL = engineRef.current;
    let lower = engL?.bajantes.find(
      (b) => splitPtr((b as { origenId?: string }).origenId ?? '', '')[1] === upperId,
    ) as unknown as AsocLiveBaj | undefined;
    if (!lower) {
      const rawLoc = loadFromStorage<{ bajantes?: AsocLiveBaj[] } | null>(
        TRAZOS_PREFIX + String(planId ?? ''),
        null,
      );
      lower = rawLoc?.bajantes?.find((b) => splitPtr(b.origenId ?? '', '')[1] === upperId);
    }
    if (lower) {
      const asoc = aggBajanteAsociado({
        targetId: lower.id || targetId,
        netId: (lower as { net?: string }).net || netId,
        planId: String(planId ?? ''),
        liveBaj: lower,
        plans,
        counts,
        hidro: hidroData as unknown as Record<string, { accesorios?: Record<string, number> }>,
        engine: engineRef.current,
      });
      if (asoc) return asoc;
    }
  }
  const own = counts[storageKey] || {};
  // af/ac (orig. usuario): la clave YA trae la carga propagada (propia + heredada) —
  // sumar las patas de la unión encima duplicaba (RAF1 mostraba RAF2+RAF3 = ×2). El
  // merge-sum sigue vigente para gas (sin propagación).
  if (netId === 'af' || netId === 'ac') return own;
  if (!mergeKeys) return own;
  const merged: Record<string, number> = { ...own };
  for (const k of mergeKeys) {
    for (const [apId, v] of Object.entries(counts[k] || {})) {
      merged[apId] = (merged[apId] || 0) + v;
    }
  }
  return merged;
}

/** Hook del panel: mismos deps que el useMemo original. */
export function useFixtureTarget(a: TargetArgs): Record<string, number> {
  const {
    counts,
    hidroData,
    storageKey,
    mergeKeys,
    isBajanteSan,
    targetId,
    planId,
    selElement,
    agregadoBajante,
    engineRef,
    exitsDeBajante,
    netId,
    plans,
  } = a;
  return useMemo(
    () => currentMapDe(a),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismos deps que el useMemo original
    [
      counts,
      hidroData,
      storageKey,
      mergeKeys,
      isBajanteSan,
      targetId,
      planId,
      selElement,
      agregadoBajante,
      engineRef,
      exitsDeBajante,
      netId,
      plans,
    ],
  );
}
