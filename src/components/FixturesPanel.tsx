import { useEffect, useMemo, useRef, useState } from 'react';
import { APARATOS_DEF, UD_BASE_INIT, ACCESORIOS_HIDRO, SAN_ACCESORIOS, GAS_ACCESORIOS, AF_UC_IDS, AC_UC_IDS } from '../constants';
import { NETS } from '../lib/PlanoEngine';
import { usePlans } from '../context/PlansContext';
import { useApparatus } from '../context/ApparatusContext';
import { writeSanDrawingSync, writeHydroDrawingSync } from '../utils/drawingSync';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import FixtureGrid from './fixtures/FixtureGrid';
import AccesoriosSection from './fixtures/AccessoriesSection';

const HIDROSAN_IDS = new Set(['af', 'ac', 'san']);
const GAS_ID = 'gas';

import { TRAZOS_PREFIX, GAS_ACC_KEY, APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY } from "../constants/storage-keys";

const UNIDAD = {
  uc: 'UC',
  ud: 'UD',
  qgas: 'm³/h',
};

const SAN_UD_IDS = new Set(UD_BASE_INIT.map(d => d.id));

function loadAll(): Record<string, any> {
  return loadFromStorage(APARATOS_BY_TRAMO_KEY, {}) as Record<string, any>;
}

function saveAll(map: Record<string, any>) {
  saveToStorage(APARATOS_BY_TRAMO_KEY, map);
}

function loadHidroData(): Record<string, any> {
  return loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
}

function saveHidroData(map: Record<string, any>) {
  saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
}

function loadGasAcc(): Record<string, any> {
  return loadFromStorage(GAS_ACC_KEY, {});
}

function saveGasAcc(map: Record<string, any>) {
  saveToStorage(GAS_ACC_KEY, map);
}

function unitFor(netId: string): string | null {
  const net = NETS.find(n => n.id === netId);
  if (!net) return null;
  if (netId === GAS_ID) return 'qgas';
  if (net.ucType === 'uc') return netId === 'ac' ? 'uc_ac' : 'uc_af';
  if (net.ucType === 'ud') return 'ud';
  return null;
}

function esAplicable(ap: any, netId: string, unitKey: string | null) {
  if (netId === GAS_ID) return ap.grupo === 'g' && (ap.qgas || 0) > 0;
  if (unitKey === 'ud') return SAN_UD_IDS.has(ap.id);
  if (unitKey === 'uc_af') return AF_UC_IDS.includes(ap.id);
  if (unitKey === 'uc_ac') return AC_UC_IDS.includes(ap.id);
  return false;
}

function isCountableTarget(el: any): boolean {
  if (!el) return false;
  return el.id?.startsWith('R') || el.id?.startsWith('B') || el.id?.startsWith('T');
}

export default function AparatosPanel({ activeNet, selElement }: { activeNet: string; selElement: any }) {
  const { plans } = usePlans();
  const { aps } = useApparatus();
  const [counts, setCounts] = useState<Record<string, any>>(loadAll);
  const [hidroData, setHidroData] = useState<Record<string, any>>(loadHidroData);
  const [gasAcc, setGasAcc] = useState<Record<string, any>>(loadGasAcc);
  const [open, setOpen] = useState(true);
  const [pulse, setPulse] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTargetRef = useRef<any>(null);


  useEffect(() => {
    setGasAcc(prev => {
      const next = { ...prev };
      let changed = false;
      for (const [tramoId, map] of Object.entries(next)) {
        if (!map || typeof map !== 'object') continue;
        const vals = Object.values(map).filter(v => typeof v === 'number');
        if (vals.length === 0 || vals.every(v => v <= 0)) {
          delete next[tramoId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    const existingIds = new Set<string>();
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      try {
        const data = loadFromStorage(TRAZOS_PREFIX + plano.id, null);
        if (!data) continue;
        for (const r of (data as any).ramales || []) {
          if (r.net === 'gas') existingIds.add(r.id);
        }
      } catch (_) {}
    }
    setGasAcc(prev => {
      let changed = false;
      const next: Record<string, any> = {};
      for (const id of existingIds) {
        if (prev[id]) next[id] = prev[id];
      }
      if (Object.keys(next).length !== Object.keys(prev).length) changed = true;
      return changed ? next : prev;
    });
  }, [plans]);

  useEffect(() => {
    const handleStorage = () => {
      setCounts(loadAll());
      setHidroData(loadHidroData());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => { saveAll(counts); }, [counts]);
  useEffect(() => { saveHidroData(hidroData); }, [hidroData]);
  useEffect(() => { saveGasAcc(gasAcc); }, [gasAcc]);

useEffect(() => {
try { writeSanDrawingSync(plans); } catch (e) { if (import.meta.env.DEV) console.error('AparatosPanel:', e); }
}, [counts, plans.length]);

useEffect(() => {
try { writeHydroDrawingSync(plans); } catch (e) { if (import.meta.env.DEV) console.error('AparatosPanel:', e); }
}, [counts, hidroData, plans.length]);

// También refrescar sync sanitaria cuando cambian datos de tramo (nSalidas)
useEffect(() => {
try { writeSanDrawingSync(plans); } catch (e) { if (import.meta.env.DEV) console.error('AparatosPanel:', e); }
}, [hidroData, plans.length]);

  const netId = activeNet;
  const isGas = netId === GAS_ID;
  const isHidro = HIDROSAN_IDS.has(netId);
  const isAfAc = netId === 'af' || netId === 'ac';
  const visible = isHidro || isGas;

  const unitKey = useMemo(() => unitFor(netId), [netId]);
  const unidadLbl = unitKey ? (UNIDAD as Record<string, string>)[unitKey] : '';

  const items = useMemo(() => {
    if (!unitKey) return [];
    const filtered = APARATOS_DEF.filter(ap => esAplicable(ap, netId, unitKey));
    const apsField = unitKey === 'ud' ? 'ud' : unitKey === 'uc_af' ? 'ucaf' : unitKey === 'uc_ac' ? 'ucac' : null;
    let result = filtered;
    if (apsField) {
      result = filtered.map(ap => {
        const fromAps = aps.find(p => p.id === ap.id);
        return fromAps ? { ...ap, [unitKey]: (fromAps as any)[apsField] || (ap as any)[unitKey] } : ap;
      });
    }
    if (unitKey === 'ud') {
      const order = UD_BASE_INIT.map(d => d.id);
      return result.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [netId, unitKey, aps]);

  const target = isCountableTarget(selElement) ? selElement : null;
  const targetId = target?.id || null;
  const targetLbl = target?.label || target?.code || target?.id || '';
  const storageKey = targetId ? `${netId}_${targetId}` : null;

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

  const currentMap = useMemo(() => {
    if (!storageKey) return {};
    return counts[storageKey] || {};
  }, [counts, storageKey]);

  const curHidro = useMemo(() => {
    if (!storageKey) return { accesorios: {}, Lh: 0, nSalidas: 0 };
    return hidroData[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 };
  }, [hidroData, storageKey]);

  const total = useMemo(() => {
    if (!storageKey) return 0;
    let s = 0;
    for (const ap of items) {
      const u = (ap as any)[unitKey || ''] || 0;
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
    setCounts(prev => {
      const cur = prev[storageKey] || {};
      return { ...prev, [storageKey]: { ...cur, [apId]: (cur[apId] || 0) + 1 } };
    });
  };

  const dec = (apId: string) => {
    if (!storageKey) return;
    setCounts(prev => {
      const cur = { ...(prev[storageKey] || {}) };
      const v = (cur[apId] || 0) - 1;
      if (v <= 0) delete cur[apId]; else cur[apId] = v;
      const next = { ...prev, [storageKey]: cur };
      if (Object.keys(cur).length === 0) delete next[storageKey];
      return next;
    });
  };

  const reset = () => {
    if (!storageKey) return;
    setCounts(prev => {
      const next = { ...prev };
      delete next[storageKey];
      return next;
    });
    setHidroData(prev => {
      const next = { ...prev };
      delete next[storageKey];
      return next;
    });
  };

  const incAcc = (accId: string) => {
    if (!storageKey) return;
    setHidroData(prev => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      acc[accId] = (acc[accId] || 0) + 1;
      const next = { ...prev, [storageKey]: { ...cur, accesorios: acc } };
      return next;
    });
  };

  const decAcc = (accId: string) => {
    if (!storageKey) return;
    setHidroData(prev => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      const v = (acc[accId] || 0) - 1;
      if (v <= 0) delete acc[accId]; else acc[accId] = v;
      return { ...prev, [storageKey]: { ...cur, accesorios: acc } };
    });
  };

  const setHidroField = (field: string, val: any) => {
    if (!storageKey) return;
    setHidroData(prev => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      return { ...prev, [storageKey]: { ...cur, [field]: val } };
    });
  };

  const gasAccMap = useMemo(() => {
    if (!targetId) return {};
    return gasAcc[targetId] || {};
  }, [gasAcc, targetId]);

  const incAccGas = (accId: string) => {
    if (!targetId) return;
    setGasAcc(prev => {
      const cur = { ...(prev[targetId] || {}) };
      cur[accId] = (cur[accId] || 0) + 1;
      return { ...prev, [targetId]: cur };
    });
  };

  const decAccGas = (accId: string) => {
    if (!targetId) return;
    setGasAcc(prev => {
      const cur = { ...(prev[targetId] || {}) };
      const v = (cur[accId] || 0) - 1;
      if (v <= 0) delete cur[accId]; else cur[accId] = v;
      const next = { ...prev };
      if (Object.keys(cur).length === 0) delete next[targetId]; else next[targetId] = cur;
      return next;
    });
  };

  if (!visible) {
    return (
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: 'var(--txt3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          Cuantificación de aparatos
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt2)', fontFamily: "'Geist',monospace", padding: '4px 0', lineHeight: 1.5 }}>
          Esta red no cuantifica aparatos sanitarios.
        </div>
      </div>
    );
  }

  const netObj = NETS.find(n => n.id === netId);
  const accent = netObj?.col || '#2563EB';

  const headerLbl = isGas ? '⛽ Gasodomésticos' : '🚿 Aparatos';
  const isActive = !!targetId;
  const containerStyle = {
    borderBottom: '1px solid #3a494a',
    background: pulse ? 'rgba(37,99,235,.10)' : 'transparent',
    transition: 'background .8s ease',
    boxShadow: pulse ? `inset 0 0 0 1px ${accent}` : 'none',
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 8px', background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: isActive ? accent : 'transparent',
            border: isActive ? 'none' : '1px solid #3a494a',
            flexShrink: 0,
            boxShadow: isActive ? `0 0 8px ${accent}` : 'none',
          }} />
          <span style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {headerLbl}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: accent,
            fontFamily: "'Geist',monospace", background: 'rgba(37,99,235,.1)',
            border: `1px solid ${accent}55`,
            borderRadius: 3, padding: '1px 7px',
          }}>
            {totalStr} {unidadLbl}
          </span>
          <span style={{ fontSize: 10, color: 'var(--txt2)', fontFamily: "'Geist',monospace" }}>
            {open ? '▾' : '▸'}
          </span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 10px 10px' }}>
          {targetId ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 9, color: 'var(--txt2)', fontFamily: "'Geist',monospace",
              textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, padding: '0 2px',
            }}>
              <span>Asignado a <span style={{ color: accent, fontWeight: 700 }}>{targetLbl}</span></span>
              {Object.keys(currentMap).some(k => currentMap[k] > 0) && (
                <button onClick={reset} style={{
                  background: 'transparent', border: 'none', color: '#ffb4ab',
                  fontSize: 9, fontFamily: "'Geist',monospace", cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: 1, padding: 0,
                }}>↺ Restablecer</button>
              )}
            </div>
          ) : (
            <div style={{
              fontSize: 9, color: 'var(--txt2)', fontFamily: "'Geist',monospace",
              textAlign: 'center', marginBottom: 6, padding: '2px 0',
            }}>
              {isGas ? 'Selecciona un tramo de gas' : 'Selecciona un ramal/bajante en el dibujo'}
            </div>
          )}

          <div style={{
            opacity: targetId ? 1 : 0.45,
            pointerEvents: targetId ? 'auto' : 'none',
            transition: 'opacity .25s',
            filter: targetId ? 'none' : 'grayscale(.6)',
          }}>
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
              <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '24px 0', textAlign: 'center' }}>
                No hay aparatos en esta red. Dibuje ramales en el visor para agregarlos.
              </div>
            )}
          </div>
        </div>
      )}

      {isAfAc && (
        <AccesoriosSection
          targetId={targetId}
          curHidro={curHidro}
          incAcc={incAcc}
          decAcc={decAcc}
          accent={accent}
          items={ACCESORIOS_HIDRO}
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
}

