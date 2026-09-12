import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APARATOS_DEF,
  UD_BASE_INIT,
  ACCESORIOS_HIDRO,
  GAS_ACCESORIOS,
  DIAM_BY_MAT,
} from '../constants';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import { matchDiamOption } from '../utils/diamOptionMatch';
import { diamPulgFromLabel } from '../utils/diamPulgFromLabel';
import { sanDiamAllowedForApparatus } from '../utils/sanitaryDiamCompat';
import { bumpHidroAccesorio } from '../utils/syncExtremeAccessory';
import { usePlans } from '../context/PlansContext';
import { useApparatus } from '../context/ApparatusContext';
import { writeSanDrawingSync, writeHydroDrawingSync } from '../utils/drawingSync';
import type { DrawingData } from '../utils/drawingSync';
import FixtureGrid from './fixtures/FixtureGrid';
import AccesoriosSection from './fixtures/AccessoriesSection';
import { devError } from '../../../utils/devError';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import {
  UNIDAD,
  loadAll,
  saveAll,
  loadHidroData,
  saveHidroData,
  loadGasAcc,
  saveGasAcc,
  unitFor,
  esAplicable,
  isCountableTarget,
  type CountsMap,
  type HidroDataMap,
  type GasAccMap,
  type SelectableTarget,
  idsSalidasDeBajante,
  libroHeredadoSumado,
  aggParaEspejoSalida,
  stableStringify,
} from './fixturesStorage';
import { resolveJunctionEntrant } from '../utils/flowDirection';
import { mapUdBombaDesdeTrazos, propagarHerenciaBomba } from '../utils/bombaAssociation';
import {
  collectSourceAgg,
  type InheritPoolBajante,
  type InheritPoolRamal,
} from '../utils/bajanteAssociation';
import { ldesvioIdFor } from '../utils/associateBajanteAcrossFloors';
import { extremoEntrelazado, flowEndsAt } from '../lib/PlanoEngine/PlanoEngineDrawing';
import { flowTailEnd } from './pdfViewer/drawingElementContextMenu/ramalMenuHelpers';
import { distToPolyline } from '../lib/shared/geometry';
import type PlanoEngine from '../lib/PlanoEngine/PlanoEngine';
import { useTramos } from '../context/TramosContext';
import { buildSanConnectivity } from '../utils/sanitaryRows';

const HIDROSAN_IDS = new Set(['af', 'ac', 'san']);
const GAS_ID = 'gas';

import { TRAZOS_PREFIX } from '../constants/storage-keys';
const FixturesPanel_S1: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px 8px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  overflow: 'hidden',
};
const FixturesPanel_S2: React.CSSProperties = {
  fontFamily: "'Geist',monospace",
  fontSize: 12,
  color: 'var(--txt3)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const FixturesPanel_S3: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  color: 'var(--txt2)',
  fontFamily: "'Geist',monospace",
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 6,
  padding: '0 2px',
};

import type { ProbedElement } from './pdfViewer/tramoEditor/context';

/** Espeja `next` sobre la clave (reemplazo, no fusión) y @returns si cambió — comparación
 *  JSON contra el valor en disco. Con deleteEmpty, un next vacío ELIMINA la clave (borrar UDs
 *  heredadas) en vez de dejar un espejo {} que reinsertaba basura vieja. */
function syncMirrorKey(
  disk: Record<string, Record<string, number>>,
  key: string,
  next: Record<string, number>,
  deleteEmpty: boolean,
): boolean {
  if (!Object.keys(next).length) {
    if (deleteEmpty && disk[key]) {
      delete disk[key];
      return true;
    }
    return false;
  }
  if (JSON.stringify(disk[key] || {}) === JSON.stringify(next)) return false;
  disk[key] = { ...next };
  return true;
}

const AparatosPanel = memo(function AparatosPanel_({
  activeNet,
  selElement,
  setSelElement,
  planId,
  engineRef,
  loadingPlanRef,
}: {
  activeNet: string;
  selElement: SelectableTarget | null;
  setSelElement?: React.Dispatch<React.SetStateAction<ProbedElement | null>>;
  planId?: string | number;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  loadingPlanRef?: React.MutableRefObject<boolean>;
}) {
  const { plans } = usePlans();
  const { tramosSan } = useTramos();
  const { aps } = useApparatus();
  const [counts, setCounts] = useState<CountsMap>(loadAll);
  const [hidroData, setHidroData] = useState<HidroDataMap>(loadHidroData);
  const [gasAcc, setGasAcc] = useState<GasAccMap>(loadGasAcc);
  const [open, setOpen] = useState(true);
  const [pulse, setPulse] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const existingIds = new Set<string>();
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      try {
        const data = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
        if (!data) continue;
        for (const r of data.ramales || []) {
          if (r.net === 'gas' && r.tipo !== 'tributario') existingIds.add(r.id);
        }
      } catch {
        // ignorar
      }
    }
    const pruned = loadGasAcc();
    let prunedChanged = false;
    const prunedNext: GasAccMap = {};
    for (const id of existingIds) {
      if (pruned[id]) prunedNext[id] = pruned[id];
    }
    if (Object.keys(prunedNext).length !== Object.keys(pruned).length) prunedChanged = true;
    if (prunedChanged) {
      saveGasAcc(prunedNext);
      setGasAcc(prunedNext);
      return;
    }
    setGasAcc((prev) => {
      let changed = false;
      const next: GasAccMap = {};
      for (const id of existingIds) {
        if (prev[id]) next[id] = prev[id];
      }
      if (Object.keys(next).length !== Object.keys(prev).length) changed = true;
      return changed ? next : prev;
    });
  }, [plans]);

  useEffect(() => {
    // Recarga guardada: solo setea si el CONTENIDO cambió (misma ref = bail, sin re-render).
    // Sin esto, escuchar los syncs entraría en loop sync→reload→sync (cada sync dispara
    // evento y cada reload crea refs nuevas). Con esto el panel se entera del re-anclaje
    // de claves (orig. usuario piso 2: montaba con el store vacío y nunca refrescaba).
    const reloadAll = () => {
      setCounts((prev) => {
        const next = loadAll();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
      setHidroData((prev) => {
        const next = loadHidroData();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
      setGasAcc((prev) => {
        const next = loadGasAcc();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
    };
    window.addEventListener('storage', reloadAll);
    window.addEventListener('aparatos-clear', reloadAll);
    window.addEventListener('civilflow_san_sync_changed', reloadAll);
    window.addEventListener('civilflow_hidro_sync_changed', reloadAll);
    return () => {
      window.removeEventListener('storage', reloadAll);
      window.removeEventListener('aparatos-clear', reloadAll);
      window.removeEventListener('civilflow_san_sync_changed', reloadAll);
      window.removeEventListener('civilflow_hidro_sync_changed', reloadAll);
    };
  }, []);

  useEffect(() => {
    try {
      // Los trazos deben estar FRESCOS antes del sync: writeSanDrawingSync corre la GC de
      // claves aparatos/hidro contra los trazos GUARDADOS — con trazos stale (elementos
      // recién dibujados que el autosave aún no persistía) borraba las claves de aparatos
      // recién asignadas: el panel las seguía mostrando (estado vivo) pero la validación de
      // cierre las leía vacías y disparaba "UC/UD pendientes" (orig. usuario).
      const eng = engineRef.current;
      // Carga en vuelo: el engine aún tiene el piso anterior (o nada) bajo el id del piso
      // entrante — snapshot aquí persistía trabajo vacío/ajeno con ts fresco sobre la caché
      // buena del piso entrante (orig. usuario: pisos vaciados al reabrir).
      if (eng && eng._loadedPlanId != null && !loadingPlanRef?.current) {
        const work = eng.saveWork();
        work.ts = Date.now();
        saveToStorage(`${TRAZOS_PREFIX}${String(eng._loadedPlanId)}`, work);
      }
      writeSanDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
    try {
      writeHydroDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
  }, [counts, hidroData, plans, engineRef, loadingPlanRef]);

  // Un bajante de calentador es siempre elemento AC (net 'ac') aunque el usuario lo ancle estando
  // en la red AF — sus aparatos deben caer en `ac_<id>_<planId>` para que el ramal sintético
  // AC-01-{id} (buildTramos) los tome en la tabla de selección de calentador. Usar activeNet aquí
  // los escribiría bajo `af_<id>_<planId>` y la tabla del calentador no leería nada.
  const netId = selElement?.tipo === 'calentador' ? selElement.net || 'ac' : activeNet;
  const isGas = netId === GAS_ID;
  const isHidro = HIDROSAN_IDS.has(netId);
  const isAfAc = netId === 'af' || netId === 'ac';
  const visible = isHidro || isGas;

  const unitKey = useMemo(() => unitFor(netId), [netId]);
  const unidadLbl = unitKey ? (UNIDAD as Record<string, string>)[unitKey] : '';

  const items = useMemo(() => {
    if (!unitKey) return [];
    const filtered = APARATOS_DEF.filter((ap) => esAplicable(ap, netId, unitKey));
    const APS_FIELD: Record<string, 'ud' | 'ucaf' | 'ucac'> = {
      ud: 'ud',
      uc_af: 'ucaf',
      uc_ac: 'ucac',
    };
    const apsField = APS_FIELD[unitKey || ''] || null;
    let result = filtered;
    if (apsField && unitKey) {
      result = filtered.map((ap) => {
        const fromAps = aps.find((p) => p.id === ap.id);
        return fromAps ? { ...ap, [unitKey]: fromAps[apsField] || ap[unitKey] } : ap;
      });
    }
    if (unitKey === 'ud') {
      const order = UD_BASE_INIT.map((d) => d.id);
      return result.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [netId, unitKey, aps]);

  // Bajantes y CAJAS (AN/LL) muestran el agregado de UDs de sus trazos de entrada.
  const isBajanteSan =
    (selElement?.tipo === 'bajante' ||
      selElement?.tipo === 'caja_san' ||
      selElement?.tipo === 'caja_ll' ||
      selElement?.tipo === 'bomba') &&
    (netId === 'san' || netId === 'll');
  // Discriminación por piso (orig. usuario): BAN1 existe en P1 y en P2 con el MISMO id —
  // todo lookup en tramosSan debe limitarse al piso actual o el panel agrega UDs del otro.
  const samePlan = useCallback(
    (t: { planId?: string | number }) =>
      planId == null || t.planId == null || String(t.planId) === String(planId),
    [planId],
  );
  const tramosPiso = useMemo(() => tramosSan.filter((t) => samePlan(t)), [tramosSan, samePlan]);
  // Conectividad del árbol sanitario SOLO del piso actual — la geométrica conectaba tramos de
  // pisos distintos (mismas coordenadas de plano) y mezclaba UDs entre BAN1-P1 y BAN1-P2.
  const sanConnectivity = useMemo(() => {
    if (netId !== 'san' && netId !== 'll') return null;
    return buildSanConnectivity(
      tramosPiso,
      plans,
      items as unknown as import('../utils/sanitaryRows').MergedApBase[],
    );
  }, [netId, tramosPiso, plans, items]);

  const target = useMemo(
    () =>
      isCountableTarget(selElement)
        ? selElement
        : selElement?.tipo === 'contador'
          ? { ...selElement, id: 'CNT1' }
          : null,
    [selElement],
  );
  const targetId = target?.id || null;
  const targetLbl = target?.label || target?.code || target?.id || '';
  const storageKey = targetId
    ? planId
      ? `${netId}_${targetId}_${planId}`
      : `${netId}_${targetId}`
    : null;

  useEffect(() => {
    if (targetId && targetId !== lastTargetRef.current) {
      lastTargetRef.current = targetId;
      setOpen(true);
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1400);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          let el = containerRef.current.parentElement;
          while (el) {
            const s = window.getComputedStyle(el);
            if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
              el.scrollTop = 0;
              break;
            }
            el = el.parentElement;
          }
        }
      });
      return () => clearTimeout(t);
    }
    if (!targetId) {
      lastTargetRef.current = null;
    }
  }, [targetId]);

  // Todos los ramales del plano actual (almacenamiento crudo, no el motor en vivo) — necesario
  // para hallar, en AF/AC/gas, qué ramal acumula de verdad la UC combinada de un empalme. Ya no es
  // siempre el ramal auto-creado (mergesFrom solo vive en él) — es aquel de los tres participantes
  // cuya dirección de flujo entra de verdad al empalme (ver waterNetworkRows.ts).
  // Deliberadamente NO memoizado solo por planId — el dibujo (un nuevo corte, una dirección
  // invertida) cambia constantemente mientras este panel queda abierto sobre el mismo plano, y no
  // hay evento dedicado de "geometría cambiada" contra el cual invalidar un caché. Una lectura
  // simple de localStorage es barata de repetir en cada render, así que se re-lee fresco en vez de
  // quedar obsoleto a mitad de sesión.
  const allRamalesForPlan = (() => {
    const fromStorage = planId
      ? loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + planId, null)?.ramales || []
      : [];
    if (fromStorage.length > 0) return fromStorage;
    // Fallback al motor vivo (planId puede ser string vs number, o storage aún no volcado)
    return (engineRef.current?.ramales || []).filter((r) => {
      // Filtrar por planId si existe; si no, tomar todos de la red activa
      const pid = (r as unknown as { planId?: string | number }).planId;
      return planId == null || pid == null || String(pid) === String(planId);
    }) as unknown as typeof fromStorage;
  })();

  // Keys de las fuentes de fusión — un ramal auto-creado (por corte en medio de un empalme)
  // arranca sin aparatos propios; el ramal que MUESTRA la UC combinada (que puede ser el
  // auto-creado o una de sus dos fuentes — la que su flujo entre al empalme) debe en cambio
  // reflejar los conteos combinados de los OTROS dos participantes, de solo lectura, para que el
  // usuario no se quede mirando ceros/parciales en un tramo que visiblemente los lleva todos.
  // Se recalcula plano en cada render (no useMemo) porque depende de allRamalesForPlan, que a su
  // vez se re-lee fresco en cada render.
  const mergeKeys = (() => {
    if (!target?.id || !netId) return null;
    const keyFor = (id: string) => (planId ? `${netId}_${id}_${planId}` : `${netId}_${id}`);
    // Unir AMBAS fuentes de verdad de flujo: mergesFrom (auto-split) + geometría
    // (extremo-a-extremo). RS3 suele ser extremo-a-extremo (sin mergesFrom) pero RS5 es
    // auto-split (con mergesFrom); el subárbol completo de RS3 debe incluir ambos.
    // Antes solo se usaba mergesFrom y RS3 dibujado a mano quedaba en 0 ("muestra de menos").
    const mergeSiblingPairs = new Set<string>();
    for (const r of allRamalesForPlan) {
      if (r.mergesFrom) mergeSiblingPairs.add(r.mergesFrom.toSorted().join('|'));
    }
    const geomKeysForSan = (): string[] => {
      if (netId !== 'san' || !target?.id) return [];
      const visited = new Set<string>([target.id]);
      const keys: string[] = [];
      const collect = (id: string) => {
        const t = allRamalesForPlan.find((r) => r.id === id);
        if (!t || !t.pts || t.pts.length < 2) return;
        const tDownstream = t._tribReversed ? t.pts[0] : t.pts[t.pts.length - 1];
        for (const f of allRamalesForPlan) {
          if (f.id === id || f.net !== netId || visited.has(f.id)) continue;
          if (!f.pts || f.pts.length < 2) continue;
          if (f.tipo === 'bajante' || f.tipo === 'montante') continue;
          if (mergeSiblingPairs.has([f.id, t.id].sort().join('|'))) continue;
          // Dos ramales que desembocan en el mismo bajante no se consideran que drenan entre sí
          const fFinCheck = (f as unknown as { fin?: string }).fin || '';
          const tFinCheck = (t as unknown as { fin?: string }).fin || '';
          if (tFinCheck && fFinCheck && tFinCheck === fFinCheck) {
            const isBajanteFin = (fid: string) => {
              if (
                /^B[A-Z]+/.test(fid) ||
                fid.startsWith('BAN') ||
                fid.startsWith('BALL') ||
                fid.startsWith('BREV')
              )
                return true;
              // fallback: buscar en bajantes reales
              if (engineRef.current?.bajantes?.some((b) => b.code === fid || b.id === fid))
                return true;
              return false;
            };
            if (isBajanteFin(tFinCheck)) continue;
          }
          const fEnd = f._tribReversed ? f.pts[0] : f.pts[f.pts.length - 1];
          if (distToPolyline(fEnd, t.pts) >= 2.0) continue;
          // Si ambos terminan en el mismo bajante geométricamente, no agregar
          if (engineRef.current?.bajantes) {
            const bajAtTDown = engineRef.current.bajantes.find(
              (b) => Math.hypot(b.x - tDownstream[0], b.y - tDownstream[1]) < 2.0,
            );
            const bajAtFEnd = engineRef.current.bajantes.find(
              (b) => Math.hypot(b.x - fEnd[0], b.y - fEnd[1]) < 2.0,
            );
            if (bajAtTDown && bajAtFEnd && bajAtTDown.id === bajAtFEnd.id) continue;
          }
          const touchesTDownstream =
            Math.hypot(fEnd[0] - tDownstream[0], fEnd[1] - tDownstream[1]) < 2.0;
          if (touchesTDownstream) {
            const tFin = (t as unknown as { fin?: string }).fin || '';
            if (!tFin) continue;
            const finIsRamalAtPt = allRamalesForPlan.some(
              (o) =>
                (o.id === tFin || (o as unknown as { label?: string }).label === tFin) &&
                o.pts &&
                o.pts.length >= 2 &&
                distToPolyline(fEnd, o.pts) < 2.0,
            );
            if (finIsRamalAtPt) continue;
          }
          visited.add(f.id);
          keys.push(keyFor(f.id));
          collect(f.id);
        }
      };
      collect(target.id);
      return keys;
    };
    // Si target es el ramal auto-creado, su propio mergesFrom es el par de fuentes; si no,
    // hallar el ramal auto-creado que lista a target como una de sus dos fuentes.
    const isAutoCreated = !!target.mergesFrom;
    const hostR = isAutoCreated
      ? target
      : allRamalesForPlan.find((r) => r.net === netId && r.mergesFrom?.includes(target.id!));
    if (!hostR?.mergesFrom) {
      const g = geomKeysForSan();
      return g.length > 0 ? g : null;
    }
    const [aId, bId] = hostR.mergesFrom;
    if (!aId || !bId) return null;
    // `hostR.mergesFrom` es siempre [existing.id, incoming.id] por construcción
    // (PlanoEngineDrawing.ts, autoSplitJunctionAndSumFlow). Cuál de los tres ramales de este
    // empalme (existing, hostR=downstream, incoming) MUESTRA el total combinado se decide solo por
    // la dirección actual del flujo — no está fijo a "existing" ni al "auto-creado":
    // junctionHasOutgoingFlow ya garantiza al menos uno de los tres flujos FUERA del empalme, así
    // que con tres ramales la división es siempre 2-vs-1, y el único disidente (el que discrepa de
    // los otros dos) es el entrante. Coincide con waterNetworkRows.ts / WaterNetworkDesign.tsx.
    if (!hostR.id || !hostR.pts || hostR.pts.length === 0) return null;
    // Para la sidebar de aparatos mostrar el combinado en CUALQUIERA de los participantes
    // (auto o fuente), no solo en el entrante — el usuario espera ver en RS3 (auto) el total
    // RS5+RS2 (+ RS1,RS4 transitivos), igual que la tabla TOTAL. Antes solo el entrante
    // (tributario) veía el combinado y RS3 quedaba en 0 ("muestra de menos").
    const targetIsInMerge = hostR.mergesFrom.includes(target.id!);
    if (!targetIsInMerge && hostR.id !== target.id) return null;
    const jc = hostR.pts[0];
    const existingObj = allRamalesForPlan.find((r) => r.id === aId);
    const incomingObj = allRamalesForPlan.find((r) => r.id === bId);
    const entrantId = existingObj
      ? resolveJunctionEntrant(
          jc,
          existingObj,
          { id: hostR.id, pts: hostR.pts, _tribReversed: Boolean(hostR._tribReversed) },
          incomingObj,
        )
      : aId;
    if (hostR.id !== target.id && entrantId !== target.id) return null;
    // TRANSITIVIDAD: un ramal auto-creado puede ser a su vez fuente de un empalme aguas arriba
    // (cadena RS1+T1RS1→RS2, RS2+T2RS2→RS3). Las fuentes directas de RS3 incluyen a RS2, que
    // es también un merge point sin aparatos propios — sus conteos viven en RS1/T1RS1. Sumar
    // solo un nivel dejaba el panel de RS3 con los aparatos del tributario directo pero sin la
    // cadena acumulada (la tabla de diseño sí muestra el total transitivo). Recolectar todo el
    // subárbol aguas arriba (cada ramal aparece una sola vez).
    const seen = new Set<string>();
    const allKeys: string[] = [];
    const collect = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      if (id !== target.id) allKeys.push(keyFor(id));
      const r = allRamalesForPlan.find((x) => x.id === id);
      if (r?.mergesFrom) for (const src of r.mergesFrom) collect(src);
    };
    collect(hostR.id);
    // Unión con geom para robustez (cubre extremo-a-extremo donde mergesFrom no registra un
    // alimentador pero geométricamente sí existe).
    const geomExtra = geomKeysForSan().filter((k) => !allKeys.includes(k));
    return geomExtra.length > 0 ? [...allKeys, ...geomExtra] : allKeys;
  })();

  // Ramales que SALEN de un bajante: la COLA de la flecha de flujo queda del lado del bajante
  // (criterio del usuario). Geométrico sobre pts (misma convención de flowVecAt: flujo de
  // pts[0] al último, invertido si _tribReversed) con alimentaIds como respaldo para trazos
  // viejos; si la cabeza cae en el bajante, DRENA en él y no es salida.
  const exitsDeBajante = useCallback(
    (bajId: string): Set<string> => {
      const eng = engineRef.current;
      const baj = eng?.bajantes.find((b) => b.id === bajId);
      if (!eng || !baj) return new Set<string>();
      return idsSalidasDeBajante(baj, eng.ramales, eng.zoom || 1);
    },
    [engineRef],
  );

  // Agregado de UDs del bajante: clave propia + UDs de todos sus descendientes en el árbol
  // sanitario (ramales y tributarios que drenan en él, transitivo), excepto los ramales de
  // SALIDA (espejos) con su subárbol — jamás son fuente, para evitar el eco espejo→agregado
  // →espejo. Compartido entre el display (currentMap) y la asignación automática (efecto):
  // el número del panel del bajante y el copiado al ramal siempre coinciden.
  const agregadoBajante = useCallback(
    (bajId: string): Record<string, number> => {
      const agg: Record<string, number> = {};
      const ownKey = planId ? `${netId}_${bajId}_${planId}` : `${netId}_${bajId}`;
      for (const [k, v] of Object.entries(counts[ownKey] || {}))
        agg[k] = (agg[k] || 0) + (v as number);
      const exits = exitsDeBajante(bajId);
      // Suma el storageKey de un tramo; sin counts propios usa sus fixtures directos.
      const sumCounts = (ck: string, fixtures?: Record<string, number>) => {
        const m = counts[ck] || {};
        if (Object.keys(m).length > 0) {
          for (const [k, v] of Object.entries(m)) agg[k] = (agg[k] || 0) + (v as number);
        } else if (fixtures) {
          for (const [k, v] of Object.entries(fixtures)) agg[k] = (agg[k] || 0) + (v as number);
        }
      };
      const visited = new Set<string>();
      const walkKey = (tKey: string) => {
        if (visited.has(tKey)) return;
        visited.add(tKey);
        const ct = tramosPiso.find((x) => x._key === tKey);
        if (!ct) return;
        if (!ct.esBajante) {
          // Espejo (salida): no suma NI recorre su subárbol. Doble guard: referencia
          // explícita (alimentaIds / ini = código) ADEMÁS del set geométrico — una salida
          // que la geometría no detecta (ramal corto junto a una caja) no puede volver al
          // walk, o su clave (que ya contiene el agregado) crecería en cada pasada.
          const bajRef = engineRef.current?.bajantes.find((b) => b.id === bajId);
          if (
            exits.has(ct.id) ||
            (bajRef &&
              ((bajRef.alimentaIds || []).includes(ct.id) || ct.ini === (bajRef.code || bajRef.id)))
          )
            return;
          // Cada tramo aporta con SU propia clave (su planId): los hijos pueden ser de otro
          // piso (enlace de asociación entre pisos) y sus UDs viven bajo el plan de origen.
          if (ct.tipo === 'ramal' || ct.tipo === 'tributario')
            sumCounts(
              planId ? `${netId}_${ct.id}_${planId}` : `${netId}_${ct.id}`,
              ct.fixtures as Record<string, number> | undefined,
            );
        }
        for (const child of sanConnectivity?.fullChildrenMap[tKey] || []) walkKey(child);
      };
      const bajT = tramosPiso.find((t) => t.esBajante && t.id === bajId);
      if (bajT?._key) {
        for (const child of sanConnectivity?.fullChildrenMap[bajT._key] || []) walkKey(child);
      } else {
        // Fallback sin árbol sanitario: ramales asociados (recibeDeIds) + cadenas de
        // tributarios colgantes. `seen` incluye las salidas EXPLÍCITAS (alimentaIds), no solo
        // las geométricas: sin engine (o con geometría ambigua) una salida con la clave ya
        // espejada volvería al walk y re-fusionaría el agregado en su propia clave en cada
        // pasada (misma familia que el dup de caja AN / suma infinita de bomba).
        const eng = engineRef.current;
        const baj = eng?.bajantes.find((b) => b.id === bajId);
        const seen = new Set<string>([bajId, ...exits, ...(baj?.alimentaIds || [])]);
        const sum = (rid: string) => {
          if (seen.has(rid)) return;
          seen.add(rid);
          sumCounts(planId ? `${netId}_${rid}_${planId}` : `${netId}_${rid}`);
          for (const trib of eng?.ramales || [])
            if (trib.tipo === 'tributario' && (trib.net ?? netId) === netId && trib.padre === rid)
              sum(trib.id);
        };
        for (const rid of baj?.recibeDeIds || []) sum(rid);
      }
      return agg;
    },
    [counts, netId, planId, sanConnectivity, tramosPiso, exitsDeBajante, engineRef],
  );

  const currentMap = useMemo(() => {
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
    // Bajante ASOCIADO desde arriba (origenId): muestra el LIBRO de herencia (`ucAplicado`
    // del propio bajante en su trazo) — exactamente las UDs que la asociación trajo del
    // piso superior, por aparato.
    if (isBajanteSan && targetId && origen?.includes('|')) {
      // Enlace a BOMBA (bombaEnId): las UDs heredadas se leen DIRECTO de los trazos del piso
      // de la bomba (clave de su caja + tramos asociados) — sin depender del libro en disco.
      if (liveBaj?.bombaEnId?.includes('|')) {
        const [pPlan, pId] = liveBaj.bombaEnId.split('|');
        try {
          const engLive = engineRef.current;
          const live =
            engLive && String(engLive._loadedPlanId ?? '') === pPlan
              ? {
                  bajantes: engLive.bajantes as unknown as InheritPoolBajante[],
                  ramales: engLive.ramales as unknown as InheritPoolRamal[],
                }
              : null;
          const heredado = mapUdBombaDesdeTrazos(pPlan, pId, netId, live);
          if (Object.keys(heredado).length) return heredado;
        } catch {
          /* lectura best-effort */
        }
      }
      try {
        const t = loadFromStorage<{
          bajantes?: Array<{ id: string; ucAplicado?: Record<string, Record<string, number>> }>;
        } | null>(TRAZOS_PREFIX + planId, null);
        const aplicado = t?.bajantes?.find((x) => x.id === targetId)?.ucAplicado;
        const heredado: Record<string, number> = {};
        for (const m of Object.values(aplicado || {}))
          for (const [k, v] of Object.entries(m)) heredado[k] = (heredado[k] || 0) + (v as number);
        if (Object.keys(heredado).length) return heredado;
      } catch {
        /* lectura best-effort */
      }
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
      const owner = engM?.bajantes.find(
        (b) => b.net === netId && exitsDeBajante(b.id).has(targetId),
      );
      if (owner) return agregadoBajante(owner.id);
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
  }, [
    counts,
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
  ]);

  const curHidro = useMemo(() => {
    if (!storageKey) return { accesorios: {}, Lh: 0, nSalidas: 0 };
    return hidroData[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 };
  }, [hidroData, storageKey]);

  const total = useMemo(() => {
    if (!storageKey) return 0;
    let s = 0;
    for (const ap of items) {
      const u = (unitKey ? ap[unitKey] : undefined) || 0;
      s += (currentMap[ap.id] || 0) * u;
    }
    return s;
  }, [items, currentMap, unitKey, storageKey]);

  // Total de unidades MANUALES propias de este tramo (sin sumas combinadas de fuentes) — el
  // cap del ítem 6 (máximo 1 aparato) aplica solo sobre lo que el usuario asigna aquí.
  const ownTotal = useMemo(() => {
    if (!storageKey) return 0;
    return Object.values(counts[storageKey] || {}).reduce((s, v) => s + v, 0);
  }, [counts, storageKey]);

  const totalStr = useMemo(() => {
    if (Number.isInteger(total)) return String(total);
    return total.toFixed(2);
  }, [total]);

  // Asignación automática (orig. usuario): los ramales que SALEN de un bajante deben tener
  // las MISMAS UDs que el bajante. "Sale" = cola de la flecha de flujo del lado del bajante
  // (exitsDeBajante, geométrico); el valor copiado es el MISMO agregado que muestra el panel
  // del bajante (agregadoBajante, compartido con currentMap). Recorre TODOS los bajantes de
  // la red activa en cada cambio de conteos o selección: editar un ramal que drena en BAN1
  // actualiza su ramal de salida al momento, sin depender de qué tramo está seleccionado.
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const disk = loadAll();
    const hdisk = loadHidroData();
    const pkey = (rid: string) => (planId ? `${netId}_${rid}_${planId}` : `${netId}_${rid}`);
    let dirty = false;
    let hdirty = false;
    // Libros de herencia cross-floor por bajante (misma lectura que el display del panel:
    // TRAZOS del piso cargado) — el espejo de salidas copia lo que el bajante MUESTRA.
    let trazBooks = new Map<string, Record<string, Record<string, number>>>();
    try {
      const t = loadFromStorage<{
        bajantes?: Array<{ id: string; ucAplicado?: Record<string, Record<string, number>> }>;
      } | null>(TRAZOS_PREFIX + planId, null);
      for (const b of t?.bajantes || []) if (b.ucAplicado) trazBooks.set(b.id, b.ucAplicado);
    } catch {
      trazBooks = new Map();
    }
    for (const baj of eng.bajantes) {
      if (baj.net !== netId) continue;
      // BOMBA (orig. usuario): punto de transferencia — su clave SIEMPRE espeja el agregado
      // de su caja de origen (recalculado por conectividad; nunca genera UDs propias). SIN
      // `continue`: la bomba también puede sostener un enlace cross-floor (descargaEnId →
      // bajante superior), que se procesa más abajo en esta misma iteración.
      if (baj.tipo === 'bomba' && baj.cajaOrigenId) {
        // Misma fuente que BombaARDesign: trazos del piso de la caja (con fallback al agregado
        // vivo) — la clave de la bomba SIEMPRE termina valiendo lo mismo en ambos lados.
        // La bomba vive en el piso cargado: se suma el pool vivo (los trazos en disco van
        // por detrás del motor y el espejo divergía del mapa de la página).
        const desdeTrazos = mapUdBombaDesdeTrazos(String(planId), baj.id, netId, {
          bajantes: eng.bajantes as unknown as InheritPoolBajante[],
          ramales: eng.ramales as unknown as InheritPoolRamal[],
        });
        const aggBomba = Object.keys(desdeTrazos).length
          ? desdeTrazos
          : agregadoBajante(baj.cajaOrigenId);
        // Sin agregado (caja vacía o red aún en construcción): NO sobrescribir la clave con
        // {} — el espejo vacío borraba UDs legítimas (orig. usuario).
        if (!Object.keys(aggBomba).length) continue;
        if (syncMirrorKey(disk, pkey(baj.id), aggBomba, false)) dirty = true;
      } else {
        // Bajante asociado a BOMBA (orig. usuario): sus salidas espejan las UDs DE LA BOMBA
        // (misma lectura que el panel del bajante) — NO el agregado del árbol, que puede no
        // contener las ramales heredadas y dejaba la salida en 0 aunque el bajante mostrara
        // el total (caso RS7/BAN2). Con pool vivo si la bomba es de este piso.
        let agg = agregadoBajante(baj.id);
        if (baj.bombaEnId?.includes('|')) {
          const [pp, pi] = baj.bombaEnId.split('|');
          const engMismoPiso =
            String(eng._loadedPlanId ?? '') === pp
              ? {
                  bajantes: eng.bajantes as unknown as InheritPoolBajante[],
                  ramales: eng.ramales as unknown as InheritPoolRamal[],
                }
              : null;
          agg = mapUdBombaDesdeTrazos(pp, pi, netId, engMismoPiso);
        } else if (baj.origenId?.includes('|')) {
          // Asociación cross-floor: el panel del bajante muestra el LIBRO heredado, no el
          // árbol — el espejo copia lo mismo o la salida queda en 0 con el bajante lleno
          // (orig. usuario: bajante con 2 UDs, ramal de salida sin nada).
          const espejo = aggParaEspejoSalida(
            agg,
            libroHeredadoSumado({ ucAplicado: trazBooks.get(baj.id) }),
          );
          if (!espejo) continue;
          agg = espejo;
        }
        if (!Object.keys(agg).length) continue;
        for (const rid of exitsDeBajante(baj.id)) {
          const rk = pkey(rid);
          // REEMPLAZO (antes fusión): el ramal de salida es un ESPEJO de solo lectura del
          // elemento (inc/dec bloqueados) — conservar valores viejos en su clave mantenía
          // viva cualquier inflación pasada y la re-mostraba para siempre. El reemplazo la
          // sana al agregado exacto en el próximo pase (orig. usuario: caja AN duplicaba UDs).
          if (syncMirrorKey(disk, rk, agg, false)) dirty = true;
        }
      }
    }
    // Propagación EN VIVO hacia el piso de abajo: la clave del Ldesvio y los ramales destino
    // reciben el agregado COMPLETO del bajante superior — la misma verdad única que usa el
    // apply (collectSourceAgg: cierre transitivo, sin topes), no el parcial de antes.
    // Solo escribe el extremo SUPERIOR del enlace (guard por npt): el inferior nunca
    // re-empuja hacia arriba (eso envenenaba la herencia al cambiar de asociado). Con npt
    // desconocido se conserva el comportamiento previo (titular = descargaEnId).
    // Cubre san y ll aunque el panel esté en la otra red (el cambio pudo venir del menú).
    // BOMBA → BAJANTE del piso superior (orig. usuario): la clave de la bomba (= agregado de
    // su caja, espejado arriba) hereda a los ramales del bajante (recibe+alimenta) vía libro
    // `ucAplicado` — MISMA mecánica de delta que la herencia hacia abajo, pero hacia ARRIBA.
    // Campo dedicado `bombaEnId`: descargaEnId/origenId dispararían la herencia invertida.
    // Una sola implementación (ver `propagarHerenciaBomba`): también la usa `asociarBomba`
    // para propagar sincrónicamente al marcar.
    if (propagarHerenciaBomba(eng, planId, netId, disk)) dirty = true;
    const loadedPid = planId != null ? String(planId) : '';
    const nptOf = (pid: string): number | null => {
      const p = plans.find((x) => String(x.id) === pid) as { npt?: number } | undefined;
      return typeof p?.npt === 'number' ? p.npt : null;
    };
    const loadedNpt = loadedPid ? nptOf(loadedPid) : null;
    for (const propNet of ['san', 'll']) {
      for (const baj of eng.bajantes) {
        if (baj.net !== propNet) continue;
        const links: { ldPlan: string; lowerBajId: string; upperBajId: string }[] = [];
        if (baj.descargaEnId?.includes('|')) {
          const [q, qBaj] = baj.descargaEnId.split('|');
          const nq = q ? nptOf(q) : null;
          if (q && qBaj && (loadedNpt == null || nq == null || loadedNpt > nq))
            links.push({ ldPlan: q, lowerBajId: qBaj, upperBajId: baj.id });
        }
        if (baj.origenId?.includes('|')) {
          const [r, rBaj] = baj.origenId.split('|');
          const nr = r ? nptOf(r) : null;
          // Empate de npt (mismo piso): el titular upper es el origenId (igual que el apply).
          if (r && rBaj && (loadedNpt == null || nr == null || loadedNpt > nr || loadedNpt === nr))
            links.push({ ldPlan: r, lowerBajId: rBaj, upperBajId: baj.id });
        }
        for (const link of links) {
          const { ldPlan: ldPlanId, lowerBajId, upperBajId } = link;
          const srcAgg = collectSourceAgg({
            net: propNet,
            planId: loadedPid,
            bajId: upperBajId,
            liveBaj: eng.bajantes.find((b) => b.id === upperBajId) ?? null,
            liveRamales: (eng.ramales ?? []) as unknown as InheritPoolRamal[],
            storedBaj: null,
            storedRamales: null,
            counts: disk,
            hidro: hdisk as unknown as Record<string, { accesorios?: Record<string, number> }>,
          });
          const liveAgg = srcAgg.agg;
          const liveHydro = srcAgg.hydroAgg;
          const lk = `${propNet}_${ldesvioIdFor(upperBajId)}_${ldPlanId}`;
          if (syncMirrorKey(disk, lk, liveAgg, true)) dirty = true;
          const tgt = loadFromStorage<{
            bajantes?: Array<{
              id: string;
              ucAcum?: number;
              recibeDeIds?: string[];
              alimentaIds?: string[];
              ucAplicado?: Record<string, Record<string, number>>;
              ucAplicadoHidro?: Record<string, Record<string, number>>;
            }>;
          } | null>(TRAZOS_PREFIX + ldPlanId, null);
          const tBaj = tgt?.bajantes?.find((x) => x.id === lowerBajId);
          const tgtRamalIds = [...(tBaj?.recibeDeIds || []), ...(tBaj?.alimentaIds || [])];
          const ownKey = `${propNet}_${lowerBajId}_${ldPlanId}`;
          const own = disk[ownKey] || {};
          const aplicadoPrev = tBaj?.ucAplicado || {};
          const aplicadoHidroPrev = tBaj?.ucAplicadoHidro || {};
          let tgtChanged = false;
          const ucAplicadoNuevo: Record<string, Record<string, number>> = {};
          const ucAplicadoHidroNuevo: Record<string, Record<string, number>> = {};
          for (const rid of tgtRamalIds) {
            const tk = `${propNet}_${rid}_${ldPlanId}`;
            const esAlimenta = (tBaj?.alimentaIds || []).includes(rid);
            const extra = esAlimenta ? { ...liveAgg, ...own } : liveAgg;
            const cur = disk[tk] || {};
            const prevAp = aplicadoPrev[tk] || {};
            const result: Record<string, number> = {};
            const keys = new Set([...Object.keys(cur), ...Object.keys(extra)]);
            for (const k of keys) {
              const nv = Math.max(0, (cur[k] || 0) - (prevAp[k] || 0)) + (extra[k] || 0);
              if (nv > 0) result[k] = nv;
            }
            if (syncMirrorKey(disk, tk, result, true)) tgtChanged = true;
            ucAplicadoNuevo[tk] = { ...extra };
            if (liveHydro) {
              const prevH = aplicadoHidroPrev[tk] || {};
              const hcur = hdisk[tk] || { accesorios: {}, Lh: 0, nSalidas: 0 };
              const acc: Record<string, number> = {};
              for (const k of new Set([
                ...Object.keys(hcur.accesorios || {}),
                ...Object.keys(liveHydro),
              ])) {
                const nv =
                  Math.max(0, ((hcur.accesorios || {})[k] || 0) - (prevH[k] || 0)) +
                  (liveHydro[k] || 0);
                if (nv > 0) acc[k] = nv;
              }
              if (JSON.stringify(hcur.accesorios || {}) !== JSON.stringify(acc)) {
                hdisk[tk] = { ...hcur, accesorios: acc };
                hdirty = true;
              }
              ucAplicadoHidroNuevo[tk] = { ...liveHydro };
            }
          }
          const totalUc = Object.values(liveAgg).reduce((s, v) => s + (v as number), 0);
          if (tBaj && (tBaj.ucAcum ?? 0) !== totalUc) {
            tBaj.ucAcum = totalUc;
            tgtChanged = true;
          }
          // El libro cubre también la clave del Ldesvio (el mismo agregado): sin esta entrada,
          // la desasociación no sabría qué restar de ella y sus UDs quedarían colgadas.
          ucAplicadoNuevo[lk] = { ...liveAgg };
          if (tBaj && JSON.stringify(tBaj.ucAplicado || {}) !== JSON.stringify(ucAplicadoNuevo)) {
            tBaj.ucAplicado = ucAplicadoNuevo;
            tgtChanged = true;
          }
          if (liveHydro) {
            ucAplicadoHidroNuevo[lk] = { ...liveHydro };
            if (
              JSON.stringify(tBaj?.ucAplicadoHidro || {}) !==
                JSON.stringify(ucAplicadoHidroNuevo) &&
              tBaj
            ) {
              tBaj.ucAplicadoHidro = ucAplicadoHidroNuevo;
              tgtChanged = true;
            }
          } else if (tBaj && Object.keys(aplicadoHidroPrev).length) {
            tBaj.ucAplicadoHidro = {};
            tgtChanged = true;
          }
          if (tgtChanged) {
            saveToStorage(TRAZOS_PREFIX + ldPlanId, tgt);
            saveTrazosToDB(ldPlanId, tgt);
            dirty = true;
          }
        }
      }
    }
    if (dirty) {
      saveAll(disk);
      setCounts(disk);
    }
    if (hdirty) {
      saveHidroData(hdisk);
      setHidroData(hdisk);
    }
  }, [
    counts,
    hidroData,
    storageKey,
    targetId,
    target?.tipo,
    planId,
    plans,
    netId,
    agregadoBajante,
    exitsDeBajante,
    engineRef,
  ]);

  // Ramal de salida de un bajante (espejo): sus UDs las manda el bajante — panel en modo
  // opaco/solo lectura, igual que el panel de bajante. Sin chequeo de target.tipo: el elemento
  // seleccionado puede llegar sin tipo (por eso isCountableTarget usa prefijos del id) y el
  // conjunto de salidas ya solo contiene ramales por construcción.
  const esEspejoBajante = useMemo(() => {
    if (!targetId || (netId !== 'san' && netId !== 'll')) return false;
    // Todo Ldesvio es el espejo del bajante superior — siempre solo lectura.
    if (targetId.startsWith('LD_')) return true;
    // Bajante asociado desde arriba (origenId) o a una bomba (bombaEnId): UDs del grupo.
    const origen = selElement as { origenId?: string; bombaEnId?: string } | null;
    if (origen?.origenId || origen?.bombaEnId) return true;
    const eng = engineRef.current;
    if (!eng) return false;
    for (const baj of eng.bajantes) {
      if (baj.net !== netId) continue;
      if (exitsDeBajante(baj.id).has(targetId)) return true;
    }
    return false;
  }, [targetId, netId, selElement, exitsDeBajante, engineRef]);

  const inc = (apId: string) => {
    if (!storageKey) return;
    if (
      target?.tipo === 'bajante' ||
      target?.tipo === 'caja_san' ||
      target?.tipo === 'caja_ll' ||
      target?.tipo === 'bomba'
    )
      return; // bajante/caja/bomba: panel de solo lectura
    if (esEspejoBajante) return; // espejo de bajante: UDs las manda el bajante
    const effectiveMergeKeys = isBajanteSan ? null : mergeKeys;
    if (effectiveMergeKeys) return;
    // Ítem 6: máximo UN aparato por ramal (manual)
    if (ownTotal >= 1 && netId !== 'll') {
      engineRef.current?.triggerAlert(
        'Máximo 1 aparato por ramal-tributario',
        'Un ramal/tributario admite máximo un aparato asignado manualmente. Si necesitas más unidades, crea otro ramal o tributario desde el cuerpo de este.',
      );
      return;
    }
    // Ítem 2/3 (rev 4): el aparato SOLO va en el extremo LIBRE hacia el que apunta el flujo del
    // ramal — el glifo del codo (af/ac) y el símbolo del aparato se derivan de
    // aparatoInicio/Fin, y no deben aparecer en conexiones de T/Y. Si el extremo de entrega
    // está ocupado o el flujo va en contra del libre, bloqueado con alerta. Solo la primera
    // unidad escribe el campo; si ya hay un aparato (del menú contextual), solo suma el conteo.
    const eng = engineRef.current;
    const live = eng?.ramales.find((r) => r.id === targetId);
    const firstUnit = !(counts[storageKey] || {})[apId];
    // Una asignación = UN snapshot: pausa durante TODAS las mutaciones + escritura a disco.
    // try/finally garantiza el resume aunque algo lance — una pausa huérfana dejaba el
    // historial mudo y el Ctrl+Z sin efecto sobre los aparatos recién asignados.
    if (eng) eng.pauseHistory();
    try {
      if (
        eng &&
        live &&
        live.pts &&
        live.pts.length >= 2 &&
        (live.net === 'af' || live.net === 'ac' || live.net === 'gas')
      ) {
        const head = live.pts[live.pts.length - 1];
        const tail = live.pts[0];
        // Item 1 (regla global): ocupado = entrelazado con la red. Los glifos de
        // codo/sifón no cuentan (el aparato los reemplaza). Ambos ocupados → sin
        // símbolo, CON alerta (el silencio se percibía como "clic que no hace nada" y
        // obligaba a asignar dos veces).
        const headOcc = extremoEntrelazado(eng.ramales, eng.bajantes || [], live, head);
        const tailOcc = extremoEntrelazado(eng.ramales, eng.bajantes || [], live, tail);
        const headOk = !headOcc && flowEndsAt(live, head, 0.5);
        const tailOk = !tailOcc && flowEndsAt(live, tail, 0.5);
        if (headOcc && tailOcc) {
          eng.triggerAlert(
            'Extremos ocupados',
            'Ambos extremos del ramal están conectados a la red. Libera una punta o invierte la dirección del ramal antes de asignar el aparato.',
          );
          return;
        }
        if (!headOk && !tailOk) {
          eng.triggerAlert(
            'Aparato no permitido',
            'El flujo del ramal apunta a la conexión (va en contra del extremo libre): el aparato solo se dibuja en el extremo libre hacia el que apunta el flujo. Invierte la dirección del ramal antes de asignar el aparato.',
          );
          return;
        }
        const endPt = headOk ? head : tail;
        const field: 'aparatoInicio' | 'aparatoFin' =
          endPt === head ? 'aparatoFin' : 'aparatoInicio';
        const accField = field === 'aparatoInicio' ? 'accesorioInicio' : 'accesorioFin';
        const hasBajante = (eng.bajantes || []).some(
          (b) =>
            Math.abs(b.x - endPt[0]) < 0.5 && Math.abs(b.y - endPt[1]) < 0.5 && b.net === live.net,
        );
        if (live[accField] || hasBajante) {
          eng.triggerAlert(
            'Extremo ocupado',
            'El extremo libre del ramal ya tiene accesorio o bajante. Elimínalo antes de asignar el aparato desde la sidebar.',
          );
          return;
        }
        if (firstUnit && !live.aparatoInicio && !live.aparatoFin) {
          eng.updateElementById(live.id, { [field]: apId });
          eng.render();
        }
      }
      if (eng && live && live.net === 'san' && firstUnit) {
        // Ítem 6/7/8: regla central (inodoro → 4" mínimo; otros → relleno 2" si vacío)
        const isInodoro = apId === 'san';
        const targetDiamForAcc = isInodoro ? '4"' : '2"';
        const curDiamPulg = live.diametro ? diamPulgFromLabel(live.diametro) : 0;
        // Detect previous aparato for switch diam perception
        let prevAparatoFix: string | null = null;
        try {
          const prevCountsFix = loadAll();
          const prevMapFix = prevCountsFix[storageKey] || {};
          const foundFix = Object.keys(prevMapFix).find(
            (k) => k !== apId && (prevMapFix[k] || 0) > 0,
          );
          if (foundFix) prevAparatoFix = foundFix;
        } catch (_e) {
          void _e;
        }
        const needsDiam =
          (isInodoro && (curDiamPulg < 4 || !sanDiamAllowedForApparatus(curDiamPulg, apId))) ||
          (!isInodoro && (!live.diametro || prevAparatoFix === 'san'));
        if (needsDiam) {
          eng.updateElementById(live.id, { diametro: targetDiamForAcc });
          // Sincronizar el snapshot de React para que el dropdown del panel derecho refleje el cambio.
          if (selElement?.id === live.id)
            setSelElement?.({
              ...selElement,
              diametro: targetDiamForAcc,
            } as unknown as ProbedElement);
        }
        const head = live.pts[live.pts.length - 1];
        const tail = live.pts[0];
        const headOcc = extremoEntrelazado(eng.ramales, eng.bajantes || [], live, head);
        const tailOcc = extremoEntrelazado(eng.ramales, eng.bajantes || [], live, tail);
        // Item 1 (regla global): ambos extremos ocupados → no crear símbolo, sin
        // alerta. La selección de targetField abajo ya cubre accesorios y conexiones.
        let targetField: 'accesorioInicio' | 'accesorioFin' | null = null;
        let targetDiamField: 'diametroInicio' | 'diametroFin' | null = null;
        // Trazo aislado (orig. usuario): el codo sube va del lado de la COLA de la
        // flecha de flujo (el sube entrega). Cola en pts[0] = el flujo termina en head.
        const endHead = flowEndsAt(live, head, 0.5);
        const endTail = flowEndsAt(live, tail, 0.5);
        const tailEnd = flowTailEnd(endTail, endHead);
        if (!headOcc && !tailOcc && tailEnd === 0 && !live.accesorioInicio) {
          targetField = 'accesorioInicio';
          targetDiamField = 'diametroInicio';
        } else if (!headOcc && !live.accesorioFin) {
          targetField = 'accesorioFin';
          targetDiamField = 'diametroFin';
        } else if (!tailOcc && !live.accesorioInicio) {
          targetField = 'accesorioInicio';
          targetDiamField = 'diametroInicio';
        }
        if (targetField && targetDiamField) {
          // Sifón (aparato 'sif') dibuja el glifo de sifón (accesorio 'sifon'), no el codo 90°.
          // El conteo de accesorios sigue sumando un codo 90° por sifón (requisito orig. #3).
          const isSif = apId === 'sif';
          const accType = isSif ? 'sifon' : 'codo90rmSube';
          const updates: Record<string, unknown> = { [targetField]: accType };
          const diamListSan = DIAM_BY_MAT['PVC-S'] || [];
          // sifón siempre 2" (fix bug 3"), inodoro 4", resto hereda o 2"
          const diamValRaw = isSif
            ? '2"'
            : isInodoro
              ? '4"'
              : live.diametro
                ? matchDiamOption(diamListSan, live.diametro)
                : '2"';
          const diamVal = matchDiamOption(diamListSan, diamValRaw);
          if (diamVal) (updates as Record<string, unknown>)[targetDiamField] = diamVal;
          eng.updateElementById(live.id, updates);
          eng.render();
          const planId = eng._loadedPlanId ?? '';
          if (isSif) bumpHidroAccesorio('san', 'codo90rmSube', 1, live.id, planId);
          else bumpHidroAccesorio('san', 'codo90rmSube', 1, live.id, planId);
        }
      }
      // Ítem 1: persistencia síncrona a disco ANTES del snapshot final — el useEffect que
      // guarda es asíncrono y el snapshot debe incluir los conteos nuevos (si no, redo
      // restauraría geometría nueva con conteos viejos). Disco-primero evita stale closures.
      try {
        const disk = loadAll();
        const curD = disk[storageKey] || {};
        const nextDisk = { ...disk, [storageKey]: { ...curD, [apId]: (curD[apId] || 0) + 1 } };
        saveAll(nextDisk);
        setCounts(nextDisk);
      } catch (_e) {
        void _e;
        setCounts((prev) => {
          const cur = prev[storageKey] || {};
          return { ...prev, [storageKey]: { ...cur, [apId]: (cur[apId] || 0) + 1 } };
        });
      }
    } finally {
      if (eng) eng.resumeHistory();
    }
    if (eng) {
      eng._markDirty();
    }
  };

  const dec = (apId: string) => {
    if (!storageKey) return;
    if (
      target?.tipo === 'bajante' ||
      target?.tipo === 'caja_san' ||
      target?.tipo === 'caja_ll' ||
      target?.tipo === 'bomba'
    )
      return; // solo lectura
    if (esEspejoBajante) return; // espejo de bajante: UDs las manda el bajante
    const curBefore = { ...(counts[storageKey] || {}) };
    const vBefore = (curBefore[apId] || 0) - 1;
    // El campo del ramal solo se limpia cuando el conteo PROPIO tenía el aparato (vBefore === 0,
    // decremento legítimo del último). Con conteo propio ya en 0 (el panel puede mostrar 1 por
    // UDs heredadas/combinadas de una asociación entre pisos), un clic en "-" no debe borrar el
    // símbolo del dibujo — solo vacía la clave, sin tocar aparatoInicio/Fin (orig. usuario:
    // inodoro de RS4 desaparecía al descontar UDs heredadas).
    const teniaPropio = (curBefore[apId] || 0) > 0;
    // Una desasignación = UN snapshot: pausa + try/finally (mismo razonamiento que inc).
    const engDec = engineRef.current;
    if (engDec) engDec.pauseHistory();
    try {
      if (vBefore <= 0 && teniaPropio && targetId) {
        const eng = engineRef.current;
        const live = eng?.ramales.find((r) => r.id === targetId);
        if (eng && live) {
          if (live.aparatoInicio === apId || live.aparatoFin === apId) {
            const updates: Record<string, unknown> = {};
            if (live.aparatoInicio === apId) updates.aparatoInicio = null;
            if (live.aparatoFin === apId) updates.aparatoFin = null;
            eng.updateElementById(targetId, updates);
            eng.render();
            eng._markDirty();
          }
          // Sanitaria: al quitar el último aparato, también quitar el accesorio del extremo libre
          // (codo 90° sube o sifón) — orig. usuario #5: quitar el sifón desde el panel debe quitar
          // su símbolo en el dibujo.
          if (live.net === 'san') {
            const totalAfter = Object.entries(counts[storageKey] || {}).reduce(
              (s, [k, v]) => s + (k === apId ? Math.max(0, v - 1) : v),
              0,
            );
            if (totalAfter === 0) {
              const accIni = live.accesorioInicio;
              const accFin = live.accesorioFin;
              const hasAccIni = accIni === 'codo90rmSube' || accIni === 'sifon';
              const hasAccFin = accFin === 'codo90rmSube' || accFin === 'sifon';
              if (hasAccIni || hasAccFin) {
                const updates: Record<string, unknown> = {};
                if (hasAccIni) {
                  updates.accesorioInicio = '';
                  updates.diametroInicio = '';
                }
                if (hasAccFin) {
                  updates.accesorioFin = '';
                  updates.diametroFin = '';
                }
                eng.updateElementById(targetId, updates);
                eng.render();
                const planId = eng._loadedPlanId ?? '';
                if (hasAccIni || hasAccFin) {
                  bumpHidroAccesorio('san', 'codo90rmSube', -1, targetId, planId);
                }
              }
            }
          }
        }
      }
      // Ítem 1: disco-primero (ver inc) + un snapshot final con todo persistido.
      try {
        const disk = loadAll();
        const curD = { ...(disk[storageKey] || {}) };
        const v = (curD[apId] || 0) - 1;
        if (v <= 0) delete curD[apId];
        else curD[apId] = v;
        const nextDisk = { ...disk };
        if (Object.keys(curD).length === 0) delete nextDisk[storageKey];
        else nextDisk[storageKey] = curD;
        saveAll(nextDisk);
        setCounts(nextDisk);
      } catch (_e) {
        void _e;
        setCounts((prev) => {
          const cur = { ...(prev[storageKey] || {}) };
          const v = (cur[apId] || 0) - 1;
          if (v <= 0) delete cur[apId];
          else cur[apId] = v;
          const next = { ...prev, [storageKey]: cur };
          if (Object.keys(cur).length === 0) delete next[storageKey];
          return next;
        });
      }
    } finally {
      if (engDec) engDec.resumeHistory();
    }
    const engEnd = engineRef.current;
    if (engEnd) {
      engEnd._markDirty();
    }
  };

  // Escritura directa (write-through): cada handler guarda en disco al mutar. El antiguo
  // efecto de re-guardado ciego (`saveAll(counts)` ante cualquier cambio) pisaba escrituras
  // externas del menú contextual con estado React viejo entre el save y el reload del evento
  // → el primer clic "no hacía nada" de forma intermitente. Ya no existe ese efecto.
  const incAcc = (accId: string) => {
    if (!storageKey) return;
    try {
      const disk = loadHidroData();
      const cur = { ...(disk[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      acc[accId] = (acc[accId] || 0) + 1;
      const next = { ...disk, [storageKey]: { ...cur, accesorios: acc } };
      saveHidroData(next);
      setHidroData(next);
    } catch (_e) {
      void _e;
      setHidroData((prev) => {
        const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
        const acc = { ...(cur.accesorios || {}) };
        acc[accId] = (acc[accId] || 0) + 1;
        return { ...prev, [storageKey]: { ...cur, accesorios: acc } };
      });
    }
  };

  const decAcc = (accId: string) => {
    if (!storageKey) return;
    try {
      const disk = loadHidroData();
      const cur = { ...(disk[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      const v = (acc[accId] || 0) - 1;
      if (v <= 0) delete acc[accId];
      else acc[accId] = v;
      const next = { ...disk, [storageKey]: { ...cur, accesorios: acc } };
      saveHidroData(next);
      setHidroData(next);
    } catch (_e) {
      void _e;
      setHidroData((prev) => {
        const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
        const acc = { ...(cur.accesorios || {}) };
        const v = (acc[accId] || 0) - 1;
        if (v <= 0) delete acc[accId];
        else acc[accId] = v;
        return { ...prev, [storageKey]: { ...cur, accesorios: acc } };
      });
    }
  };

  const gasAccMap = useMemo(() => {
    if (!targetId) return {};
    return gasAcc[targetId] || {};
  }, [gasAcc, targetId]);

  const incAccGas = (accId: string) => {
    if (!targetId) return;
    try {
      const disk = loadGasAcc();
      const cur = { ...(disk[targetId] || {}) };
      cur[accId] = (cur[accId] || 0) + 1;
      const next = { ...disk, [targetId]: cur };
      saveGasAcc(next);
      setGasAcc(next);
    } catch (_e) {
      void _e;
      setGasAcc((prev) => {
        const cur = { ...(prev[targetId] || {}) };
        cur[accId] = (cur[accId] || 0) + 1;
        return { ...prev, [targetId]: cur };
      });
    }
  };

  const decAccGas = (accId: string) => {
    if (!targetId) return;
    try {
      const disk = loadGasAcc();
      const cur = { ...(disk[targetId] || {}) };
      const v = (cur[accId] || 0) - 1;
      if (v <= 0) delete cur[accId];
      else cur[accId] = v;
      const next = { ...disk };
      if (Object.keys(cur).length === 0) delete next[targetId];
      else next[targetId] = cur;
      saveGasAcc(next);
      setGasAcc(next);
    } catch (_e) {
      void _e;
      setGasAcc((prev) => {
        const cur = { ...(prev[targetId] || {}) };
        const v = (cur[accId] || 0) - 1;
        if (v <= 0) delete cur[accId];
        else cur[accId] = v;
        const next = { ...prev };
        if (Object.keys(cur).length === 0) delete next[targetId];
        else next[targetId] = cur;
        return next;
      });
    }
  };

  // Ítem: las orientaciones del codo 90° medio se fusionan en UNA sola fila de la sidebar —
  // el contador suma medio + sube + baja, independiente de la orientación pedida. La fila
  // única se llama igual que el id base; +/− escriben sobre ids REALES vivos (para AF/AC un
  // codo manual en 'codo90rm' sería borrado por calcHydroAccessories al re-sincronizar desde
  // los campos del ramal, así que el + escribe 'codo90rmSube'; el − quita de la orientación
  // que tenga unidades primero).
  const AFAC_CODO_MERGE: Record<string, string[]> = {
    codo90rm: ['codo90rm', 'codo90rmSube', 'codo90rmBaja'],
  };
  const GAS_CODO_MERGE: Record<string, string[]> = {
    codos_90_std: ['codos_90_std', 'codos_90_std_sube', 'codos_90_std_baja'],
    codos_90_rl: ['codos_90_rl', 'codos_90_rl_sube', 'codos_90_rl_baja'],
  };

  const afAcAccItems = useMemo(
    () =>
      ACCESORIOS_HIDRO.filter(
        (a) =>
          ![
            'teeDirecto',
            'teeSube',
            'teeBaja',
            'teeTapon',
            'teeLlaveTerminal',
            'tapon',
            'llaveTerminal',
          ].includes(a.id) &&
          a.id !== 'codo90rmSube' &&
          a.id !== 'codo90rmBaja',
      ).map((a) => (a.id === 'codo90rm' ? { ...a, nombre: 'Codo medio 90°' } : a)),
    [],
  );
  const gasAccItems = useMemo(
    () => GAS_ACCESORIOS.filter((a) => !a.id.endsWith('_sube') && !a.id.endsWith('_baja')),
    [],
  );

  const accCodoInc = (accId: string) => incAcc(accId === 'codo90rm' ? 'codo90rmSube' : accId);
  const accCodoDec = (accId: string) => {
    if (accId !== 'codo90rm') return decAcc(accId);
    const acc = curHidro.accesorios || {};
    const target = ['codo90rmSube', 'codo90rmBaja', 'codo90rm'].find((k) => (acc[k] || 0) > 0);
    if (target) decAcc(target);
  };
  const gasCodoDec = (accId: string) => {
    const acc = gasAccMap;
    const target = [accId, `${accId}_sube`, `${accId}_baja`].find((k) => (acc[k] || 0) > 0);
    if (target) decAccGas(target);
  };

  if (!visible) {
    return (
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: 'var(--txt3)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Cuantificación de aparatos
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--txt2)',
            fontFamily: "'Geist',monospace",
            padding: '4px 0',
            lineHeight: 1.5,
          }}
        >
          Esta red no cuantifica aparatos sanitarios.
        </div>
      </div>
    );
  }

  const netObj = NETS.find((n) => n.id === netId);
  const accent = netObj?.col || '#2563EB';

  const headerLbl = isGas ? ' Aparatos' : ' Aparatos';
  const isActive = !!targetId;
  const containerStyle = {
    borderBottom: '1px solid #3a494a',
    background: pulse ? 'rgba(37,99,235,.10)' : 'transparent',
    transition: 'background .8s ease',
    boxShadow: pulse ? `inset 0 0 0 1px ${accent}` : 'none',
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={FixturesPanel_S1}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isActive ? accent : 'transparent',
              border: isActive ? 'none' : '1px solid #3a494a',
              flexShrink: 0,
              boxShadow: isActive ? `0 0 8px ${accent}` : 'none',
            }}
          />
          <span style={FixturesPanel_S2}>{headerLbl}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: accent,
              fontFamily: "'Geist',monospace",
              background: 'rgba(37,99,235,.1)',
              border: `1px solid ${accent}55`,
              borderRadius: 3,
              padding: '1px 7px',
              whiteSpace: 'nowrap',
            }}
          >
            {totalStr} {unidadLbl}
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--txt2)',
              fontFamily: "'Geist',monospace",
              flexShrink: 0,
            }}
          >
            {open ? '▾' : '▸'}
          </span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 10px 10px' }}>
          {targetId ? (
            <div style={FixturesPanel_S3}>
              <span>
                Asignado a <span style={{ color: accent, fontWeight: 700 }}>{targetLbl}</span>
              </span>
            </div>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: 'var(--txt2)',
                fontFamily: "'Geist',monospace",
                textAlign: 'center',
                marginBottom: 6,
                padding: '2px 0',
              }}
            >
              {isGas ? 'Selecciona un tramo de gas' : 'Selecciona un ramal/bajante en el dibujo'}
            </div>
          )}

          <div
            style={{
              opacity: targetId ? 1 : 0.45,
              pointerEvents: targetId ? 'auto' : 'none',
              transition: 'opacity .25s',
              filter: targetId ? 'none' : 'grayscale(.6)',
            }}
          >
            {selElement?.tipo === 'contador' ? (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--txt3)',
                  padding: '24px 0',
                  textAlign: 'center',
                }}
              >
                La sección de aparatos no aplica para el contador.
              </div>
            ) : (
              <>
                <FixtureGrid
                  items={items}
                  currentMap={currentMap}
                  unitKey={unitKey}
                  unidadLbl={unidadLbl}
                  inc={inc}
                  dec={dec}
                  targetId={targetId}
                  accent={accent}
                  disabled={isBajanteSan || esEspejoBajante ? true : !!mergeKeys}
                />

                {items.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--txt3)',
                      padding: '24px 0',
                      textAlign: 'center',
                    }}
                  >
                    No hay aparatos en esta red. Dibuje ramales en el visor para agregarlos.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isAfAc && selElement?.tipo !== 'calentador' && (
        <AccesoriosSection
          targetId={targetId}
          curHidro={curHidro}
          incAcc={accCodoInc}
          decAcc={accCodoDec}
          accent={accent}
          items={afAcAccItems}
          merge={AFAC_CODO_MERGE}
        />
      )}
      {isGas && (
        <AccesoriosSection
          targetId={targetId}
          curHidro={{ accesorios: gasAccMap }}
          incAcc={incAccGas}
          decAcc={gasCodoDec}
          accent={accent}
          items={gasAccItems}
          merge={GAS_CODO_MERGE}
        />
      )}
    </div>
  );
});
export default AparatosPanel;
