import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
import { loadFromStorage } from '../services/storageService';
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
} from './fixturesStorage';
import { resolveJunctionEntrant } from '../utils/flowDirection';
import { extremoEntrelazado, flowEndsAt } from '../lib/PlanoEngine/PlanoEngineDrawing';
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

const AparatosPanel = memo(function AparatosPanel_({
  activeNet,
  selElement,
  setSelElement,
  planId,
  engineRef,
}: {
  activeNet: string;
  selElement: SelectableTarget | null;
  setSelElement?: React.Dispatch<React.SetStateAction<ProbedElement | null>>;
  planId?: string | number;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
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
    const reloadAll = () => {
      setCounts(loadAll());
      setHidroData(loadHidroData());
      setGasAcc(loadGasAcc());
    };
    window.addEventListener('storage', reloadAll);
    window.addEventListener('aparatos-clear', reloadAll);
    return () => {
      window.removeEventListener('storage', reloadAll);
      window.removeEventListener('aparatos-clear', reloadAll);
    };
  }, []);

  useEffect(() => {
    saveAll(counts);
    saveHidroData(hidroData);
    saveGasAcc(gasAcc);
  }, [counts, hidroData, gasAcc]);

  useEffect(() => {
    try {
      writeSanDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
    try {
      writeHydroDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
  }, [counts, hidroData, plans]);

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

  const isBajanteSan = selElement?.tipo === 'bajante' && (netId === 'san' || netId === 'll');
  const sanConnectivity = useMemo(() => {
    if (!isBajanteSan) return null;
    return buildSanConnectivity(
      tramosSan,
      plans,
      items as unknown as import('../utils/sanitaryRows').MergedApBase[],
    );
  }, [isBajanteSan, tramosSan, plans, items]);

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

  const currentMap = useMemo(() => {
    if (!storageKey) return {};
    // Bajante san/ll: agregar aparatos de todos los ramales/tribs que drenan en él (fullChildrenMap transitivo)
    if (isBajanteSan && sanConnectivity) {
      const bajanteTramo = tramosSan.find((t) => t.id === target?.id && t.esBajante);
      const tKey = bajanteTramo?._key || `${target?.id}-${String(planId ?? '')}`;
      const visited = new Set<string>([tKey]);
      const stack = [...(sanConnectivity.fullChildrenMap[tKey] || [])];
      const descendants: string[] = [];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        descendants.push(cur);
        for (const child of sanConnectivity.fullChildrenMap[cur] || [])
          if (!visited.has(child)) stack.push(child);
      }
      const aggregated: Record<string, number> = { ...(counts[storageKey] || {}) };
      for (const ck of descendants) {
        const ct = tramosSan.find((x) => x._key === ck);
        if (!ct || ct.esBajante) continue;
        if (ct.tipo !== 'ramal' && ct.tipo !== 'tributario') continue;
        const storageKeyForDesc = `${netId}_${ct.id}_${String(planId ?? ct.planId ?? '')}`;
        const descCounts = counts[storageKeyForDesc] || {};
        for (const [apId, v] of Object.entries(descCounts)) {
          aggregated[apId] = (aggregated[apId] || 0) + (v as number);
        }
        // Fallback: si no hay counts por storageKey, usar fixtures directos del tramo (por si tramosSan ya trae fixtures)
        if (Object.keys(descCounts).length === 0 && ct.fixtures) {
          for (const [apId, v] of Object.entries(ct.fixtures)) {
            aggregated[apId] = (aggregated[apId] || 0) + (v as number);
          }
        }
      }
      // Si no hay descendientes vía sanConnectivity (tramosSan vacío), fallback a recibeDeIds explícitos
      if (descendants.length === 0 && engineRef.current?.bajantes) {
        const baj = engineRef.current.bajantes.find((b) => b.id === target?.id);
        const rIds = baj?.recibeDeIds || [];
        for (const rid of rIds) {
          const storageKeyForR = `${netId}_${rid}_${String(planId ?? '')}`;
          const descCounts = counts[storageKeyForR] || {};
          for (const [apId, v] of Object.entries(descCounts))
            aggregated[apId] = (aggregated[apId] || 0) + (v as number);
          // incluir tributarios de ese ramal
          for (const trib of engineRef.current?.ramales || []) {
            if (trib.tipo === 'tributario' && trib.padre === rid) {
              const storageKeyForTrib = `${netId}_${trib.id}_${String(planId ?? '')}`;
              const tribCounts = counts[storageKeyForTrib] || {};
              for (const [apId, v] of Object.entries(tribCounts))
                aggregated[apId] = (aggregated[apId] || 0) + (v as number);
            }
          }
        }
      }
      return aggregated;
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
    sanConnectivity,
    tramosSan,
    planId,
    target,
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

  const inc = (apId: string) => {
    if (!storageKey) return;
    if (target?.tipo === 'bajante') return; // bajante panel es solo lectura
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
      // símbolo y sin alerta.
      const headOcc = extremoEntrelazado(eng.ramales, eng.bajantes || [], live, head);
      const tailOcc = extremoEntrelazado(eng.ramales, eng.bajantes || [], live, tail);
      const headOk = !headOcc && flowEndsAt(live, head, 0.5);
      const tailOk = !tailOcc && flowEndsAt(live, tail, 0.5);
      if (headOcc && tailOcc) {
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
      const field: 'aparatoInicio' | 'aparatoFin' = endPt === head ? 'aparatoFin' : 'aparatoInicio';
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
        // Actualizar live para que el siguiente matchDiamOption use el nuevo
        (live as unknown as { diametro: string }).diametro = targetDiamForAcc;
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
      if (!headOcc && !live.accesorioFin) {
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
    setCounts((prev) => {
      const cur = prev[storageKey] || {};
      return { ...prev, [storageKey]: { ...cur, [apId]: (cur[apId] || 0) + 1 } };
    });
  };

  const dec = (apId: string) => {
    if (!storageKey) return;
    if (target?.tipo === 'bajante') return; // solo lectura
    const curBefore = { ...(counts[storageKey] || {}) };
    const vBefore = (curBefore[apId] || 0) - 1;
    if (vBefore <= 0 && targetId) {
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
    setCounts((prev) => {
      const cur = { ...(prev[storageKey] || {}) };
      const v = (cur[apId] || 0) - 1;
      if (v <= 0) delete cur[apId];
      else cur[apId] = v;
      const next = { ...prev, [storageKey]: cur };
      if (Object.keys(cur).length === 0) delete next[storageKey];
      return next;
    });
  };

  const incAcc = (accId: string) => {
    if (!storageKey) return;
    setHidroData((prev) => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      acc[accId] = (acc[accId] || 0) + 1;
      const next = { ...prev, [storageKey]: { ...cur, accesorios: acc } };
      return next;
    });
  };

  const decAcc = (accId: string) => {
    if (!storageKey) return;
    setHidroData((prev) => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      const v = (acc[accId] || 0) - 1;
      if (v <= 0) delete acc[accId];
      else acc[accId] = v;
      return { ...prev, [storageKey]: { ...cur, accesorios: acc } };
    });
  };

  const gasAccMap = useMemo(() => {
    if (!targetId) return {};
    return gasAcc[targetId] || {};
  }, [gasAcc, targetId]);

  const incAccGas = (accId: string) => {
    if (!targetId) return;
    setGasAcc((prev) => {
      const cur = { ...(prev[targetId] || {}) };
      cur[accId] = (cur[accId] || 0) + 1;
      return { ...prev, [targetId]: cur };
    });
  };

  const decAccGas = (accId: string) => {
    if (!targetId) return;
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
                  disabled={isBajanteSan ? true : !!mergeKeys}
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
