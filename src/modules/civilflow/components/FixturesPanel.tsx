import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  APARATOS_DEF,
  UD_BASE_INIT,
  ACCESORIOS_HIDRO,
  GAS_ACCESORIOS,
  AF_UC_IDS,
  AC_UC_IDS,
} from '../constants';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import { usePlans } from '../context/PlansContext';
import { useApparatus } from '../context/ApparatusContext';
import { writeSanDrawingSync, writeHydroDrawingSync } from '../utils/drawingSync';
import type { DrawingData } from '../utils/drawingSync';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import FixtureGrid from './fixtures/FixtureGrid';
import AccesoriosSection from './fixtures/AccessoriesSection';
import { devError } from '../../../utils/devError';
import { resolveJunctionEntrant } from '../utils/flowDirection';

const HIDROSAN_IDS = new Set(['af', 'ac', 'san']);
const GAS_ID = 'gas';

import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';
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

const UNIDAD = {
  uc: 'UC',
  ud: 'UD',
  qgas: 'm³/h',
};

const SAN_UD_IDS = new Set(UD_BASE_INIT.map((d) => d.id));

type CountsMap = Record<string, Record<string, number>>;
interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}
type HidroDataMap = Record<string, HidroDataEntry>;
type GasAccMap = Record<string, Record<string, number>>;

function loadAll(): CountsMap {
  return loadFromStorage(APARATOS_BY_TRAMO_KEY, {}) as CountsMap;
}

function saveAll(map: CountsMap) {
  saveToStorage(APARATOS_BY_TRAMO_KEY, map);
}

function loadHidroData(): HidroDataMap {
  return loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
}

function saveHidroData(map: HidroDataMap) {
  saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
}

function loadGasAcc(): GasAccMap {
  const raw = loadFromStorage<GasAccMap>(GAS_ACC_KEY, {});
  const next: GasAccMap = { ...raw };
  for (const [tramoId, map] of Object.entries(next)) {
    if (!map || typeof map !== 'object') continue;
    const vals = Object.values(map).filter((v) => typeof v === 'number');
    if (vals.length === 0 || vals.every((v) => v <= 0)) {
      delete next[tramoId];
    }
  }
  return next;
}

function saveGasAcc(map: GasAccMap) {
  saveToStorage(GAS_ACC_KEY, map);
}

type ApUnitKey = 'qgas' | 'uc_ac' | 'uc_af' | 'ud';

function unitFor(netId: string): ApUnitKey | null {
  const net = NETS.find((n) => n.id === netId);
  if (!net) return null;
  if (netId === GAS_ID) return 'qgas';
  if (net.ucType === 'uc') return netId === 'ac' ? 'uc_ac' : 'uc_af';
  if (net.ucType === 'ud') return 'ud';
  return null;
}

function esAplicable(ap: (typeof APARATOS_DEF)[number], netId: string, unitKey: ApUnitKey | null) {
  if (netId === GAS_ID) return ap.grupo === 'g' && (ap.qgas || 0) > 0;
  if (unitKey === 'ud') return SAN_UD_IDS.has(ap.id);
  if (unitKey === 'uc_af') return AF_UC_IDS.includes(ap.id);
  if (unitKey === 'uc_ac') return AC_UC_IDS.includes(ap.id);
  return false;
}

interface SelectableTarget {
  id?: string;
  tipo?: string;
  label?: string;
  code?: string;
  mergesFrom?: [string, string];
  net?: string;
  pts?: number[][];
  _tribReversed?: boolean;
}

function isCountableTarget(el: SelectableTarget | null): boolean {
  if (!el) return false;
  return (
    el.id?.startsWith('R') ||
    el.id?.startsWith('B') ||
    el.id?.startsWith('T') ||
    el.tipo === 'calentador'
  );
}

const AparatosPanel = memo(function AparatosPanel_({
  activeNet,
  selElement,
  planId,
}: {
  activeNet: string;
  selElement: SelectableTarget | null;
  planId?: string | number;
}) {
  const { plans } = usePlans();
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
        // ignore
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

  // A heater bajante is always an AC element (net 'ac') even though the user anchors it while on
  // the AF network — its fixtures must land on `ac_<id>_<planId>` so the synthetic AC-01-{id}
  // ramal (buildTramos) picks them up on the heater-selection table. Using activeNet here would
  // write them under `af_<id>_<planId>` and the heater table would read nothing.
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

  // All ramales for the current plan (raw storage, not the live engine) — needed to find, for
  // AF/AC/gas, which ramal actually accumulates a junction's combined UC. That's no longer always
  // the auto-created ramal (mergesFrom only ever lives on it) — it's whichever of the three
  // participants' flow direction actually enters the junction (see waterNetworkRows.ts).
  // Deliberately NOT memoized by planId alone — the drawing (a new split, a flipped direction)
  // changes constantly while this panel stays open on the same plan, with no dedicated
  // "geometry changed" event to invalidate a cache against. A plain localStorage read is cheap
  // enough to redo on every render, so it re-reads fresh instead of going stale mid-session.
  const allRamalesForPlan = planId
    ? loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + planId, null)?.ramales || []
    : [];

  // Merge sources' keys — an auto-created ramal (from a mid-body junction split) starts with no
  // aparatos of its own; the ramal that DISPLAYS the combined UC (which may be the auto-created
  // one, or one of its two sources — whichever's flow enters the junction) must instead mirror
  // the combined counts of the OTHER two participants, read-only, so the user isn't left staring
  // at zeros/partials for a segment that visibly carries all of them. Recomputed plainly every
  // render (not useMemo) since it depends on allRamalesForPlan, itself re-read fresh every render.
  const mergeKeys = (() => {
    if (!target?.id || !netId) return null;
    const keyFor = (id: string) => (planId ? `${netId}_${id}_${planId}` : `${netId}_${id}`);
    // If target is the auto-created ramal, its own mergesFrom is the source pair; otherwise
    // find the auto-created ramal that lists target as one of its two sources.
    const isAutoCreated = !!target.mergesFrom;
    const hostR = isAutoCreated
      ? target
      : allRamalesForPlan.find((r) => r.net === netId && r.mergesFrom?.includes(target.id!));
    if (!hostR?.mergesFrom) return null;
    const [aId, bId] = hostR.mergesFrom;
    if (!aId || !bId) return null;
    // `hostR.mergesFrom` is always [existing.id, incoming.id] by construction
    // (PlanoEngineDrawing.ts, autoSplitJunctionAndSumFlow). Which of the three ramales at this
    // junction (existing, hostR=downstream, incoming) DISPLAYS the combined total is decided
    // purely by current flow direction — not fixed to "existing" or "the auto-created one":
    // junctionHasOutgoingFlow already guarantees at least one of the three flows OUT of the
    // junction, so with three ramales the split is always 2-vs-1, and the lone dissenter (the one
    // whose direction disagrees with the other two) is the entrant. Matches
    // waterNetworkRows.ts / WaterNetworkDesign.tsx.
    if (!hostR.id || !hostR.pts || hostR.pts.length === 0) return null;
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
    if (entrantId !== target.id) return null;
    return [aId, hostR.id!, bId].filter((id) => id !== target.id).map(keyFor);
  })();

  const currentMap = useMemo(() => {
    if (!storageKey) return {};
    const own = counts[storageKey] || {};
    if (!mergeKeys) return own;
    const merged: Record<string, number> = { ...own };
    for (const k of mergeKeys) {
      for (const [apId, v] of Object.entries(counts[k] || {})) {
        merged[apId] = (merged[apId] || 0) + v;
      }
    }
    return merged;
  }, [counts, storageKey, mergeKeys]);

  const curHidro = useMemo(() => {
    if (!storageKey) return { accesorios: {}, Lh: 0, nSalidas: 0 };
    const own = hidroData[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 };
    if (!mergeKeys) return own;
    const acc: Record<string, number> = { ...(own.accesorios || {}) };
    for (const k of mergeKeys) {
      for (const [accId, v] of Object.entries(hidroData[k]?.accesorios || {})) {
        acc[accId] = (acc[accId] || 0) + v;
      }
    }
    return { ...own, accesorios: acc };
  }, [hidroData, storageKey, mergeKeys]);

  const total = useMemo(() => {
    if (!storageKey) return 0;
    let s = 0;
    for (const ap of items) {
      const u = (unitKey ? ap[unitKey] : undefined) || 0;
      s += (currentMap[ap.id] || 0) * u;
    }
    return s;
  }, [items, currentMap, unitKey, storageKey]);

  const totalStr = useMemo(() => {
    if (Number.isInteger(total)) return String(total);
    return total.toFixed(2);
  }, [total]);

  const inc = (apId: string) => {
    if (!storageKey) return;
    setCounts((prev) => {
      const cur = prev[storageKey] || {};
      return { ...prev, [storageKey]: { ...cur, [apId]: (cur[apId] || 0) + 1 } };
    });
  };

  const dec = (apId: string) => {
    if (!storageKey) return;
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
          incAcc={incAcc}
          decAcc={decAcc}
          accent={accent}
          items={ACCESORIOS_HIDRO.filter(
            (a) =>
              ![
                'teeDirecto',
                'teeSube',
                'teeBaja',
                'teeTapon',
                'teeLlaveTerminal',
                'tapon',
                'llaveTerminal',
              ].includes(a.id),
          )}
        />
      )}
      {isGas && (
        <AccesoriosSection
          targetId={targetId}
          curHidro={{ accesorios: gasAccMap }}
          incAcc={incAccGas}
          decAcc={decAccGas}
          accent={accent}
          items={GAS_ACCESORIOS}
        />
      )}
    </div>
  );
});
export default AparatosPanel;
