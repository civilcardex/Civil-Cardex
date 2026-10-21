import type { MutableRefObject } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { CountsMap, HidroDataMap, SelectableTarget } from '../fixturesStorage.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { loadAll } from '../fixturesStorage.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { aggBajanteAsociado, type AsocLiveBaj } from '../../utils/bombaAssociation';
import { bajanteLocalDe } from '../../utils/bajanteLocal.ts';
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
  /** Tick de los libros de herencia (heredados/fold): sin él, un cambio SOLO de libros
   *  (la asociación entre pisos) no rehacía el mapa y el panel se quedaba rancio hasta
   *  que se seleccionaba el elemento (el memo solo se rehace al cambiar la selección). */
  librosTick?: number;
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
  // El motor puede tener VARIOS bajantes con el MISMO id (los de otros pisos que atraviesan
  // esta altura viven en el mismo array, con su pisoBase): si el primero que find() encuentra
  // es la proyección del piso de arriba, el panel leía SU libro rancio en vez del real
  // (orig. usuario MAC1-P1: 15.5 con el real en 4.5) — se prefiere el del piso abierto.
  const liveBaj = targetId ? bajanteLocalDe(engineRef.current, targetId) : undefined;
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
    // Se resuelve por PISO: el motor puede tener el owner real y la proyección de otro piso
    // con el mismo id (un find plano leía el libro rancio de la proyección).
    const owner = engM?.bajantes.filter(
      (b) => b.net === netId && exitsDeBajante(b.id).has(targetId),
    );
    const ownerBaj = owner?.length
      ? (owner.find((b) => (b.pisoBase ?? '') === (engM?.nivelActual?.label ?? '')) ?? owner[0])
      : undefined;
    if (ownerBaj) {
      // Salida de un bajante ASOCIADO: misma fuente única (la suma cruda del árbol daba 16).
      if (ownerBaj.origenId?.includes('|') || ownerBaj.bombaEnId?.includes('|')) {
        const asoc = aggBajanteAsociado({
          targetId: ownerBaj.id,
          netId,
          planId: String(planId ?? ''),
          liveBaj: ownerBaj,
          plans,
          counts,
          hidro: hidroData as unknown as Record<string, { accesorios?: Record<string, number> }>,
          engine: engineRef.current,
        });
        if (asoc) return asoc;
      }
      return agregadoBajante(ownerBaj.id);
    }
  }
  // LDesvio: espeja el GRUPO de la asociación (la clave espejo `net_LD_X_plan` puede quedar
  // stale de escrituras viejas) — en TODAS las redes (mismo camino de los bajantes san: la
  // clave espejo de af/ac era la única fuente y una clave rancia mostraba el Ldesvio en 0).
  // El grupo se resuelve por el bajante asociado local cuyo `origenId` referencia al titular
  // del LD (`LD_<upperId>`).
  if (targetId?.startsWith('LD_')) {
    const upperId = targetId.slice(3);
    const engL = engineRef.current;
    // splitPtr sin '|' devuelve el string completo en [1] — matchearía en falso un
    // origenId pelado; el original (split('|')[1]) solo matcheaba punteros cross-floor.
    // Se resuelve por PISO (el motor puede tener el asociado real y su proyección con el
    // mismo id: un find plano leía el libro rancio de la proyección).
    const nivelLbl = engL?.nivelActual?.label ?? '';
    const candidatos = (engL?.bajantes ?? []).filter(
      (b) => ((b as { origenId?: string }).origenId ?? '').split('|')[1] === upperId,
    );
    let lower = (candidatos.find((b) => (b.pisoBase ?? '') === nivelLbl) ??
      candidatos[0]) as unknown as AsocLiveBaj | undefined;
    if (!lower) {
      const rawLoc = loadFromStorage<{ bajantes?: AsocLiveBaj[] } | null>(
        TRAZOS_PREFIX + String(planId ?? ''),
        null,
      );
      lower = rawLoc?.bajantes?.find((b) => (b.origenId ?? '').split('|')[1] === upperId);
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
  // af/ac (orig. usuario: 1ª selección tras reingresar mostraba el storage rancio del
  // arranque): leer VIVO de storage — la propagación async ya escribió el estado bueno
  // antes de que el usuario volviera a seleccionar. El merge-sum sigue vigente para gas.
  // El panel muestra la CARGA TOTAL de la pieza (propio + heredado + plegado — lo que
  // transporta): es lo que el usuario espera ver al seleccionar un receptor ("RAC4 con el
  // tin de T1RAC4 y el lvm de RAC1"). El bloqueo de edición lo da esPropagado (heredados
  // no vacíos), no la resta — restar aquí mostraba receptores en CEROS y parecía que la
  // propagación no llegaba (orig. usuario 2026-10-17).
  if (netId === 'af' || netId === 'ac') {
    return loadAll()[storageKey] || {};
  }
  const own = counts[storageKey] || {};
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
    librosTick,
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
      librosTick,
    ],
  );
}
