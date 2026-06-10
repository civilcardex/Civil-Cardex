import { useEffect, useMemo, useRef, useState } from 'react';
import { APARATOS_DEF, UD_BASE_INIT, ACCESORIOS_HIDRO, SAN_ACCESORIOS, GAS_ACCESORIOS, AF_UC_IDS, AC_UC_IDS, APARATO_IMG } from '../constants';
import { NETS } from '../lib/PlanoEngine';
import { usePlanos } from '../context/PlansContext';
import { useApparatus } from '../context/ApparatusContext';
import { writeSanDrawingSync } from '../utils/sanitaryDrawingSync';
import { writeHidroDrawingSync } from '../utils/hydroDrawingSync';

const HIDROSAN_IDS = new Set(['af', 'ac', 'san']);
const GAS_ID = 'gas';

const STORAGE_KEY = 'civilflow_aparatos_by_tramo_v2';
const HIDRO_DATA_KEY = 'civilflow_tramo_hidro_data_v3';
const GAS_ACC_KEY = 'civilflow_gas_accesorios';

const UNIDAD = {
  uc: 'UC',
  ud: 'UD',
  qgas: 'm³/h',
};

const SAN_UD_IDS = new Set(UD_BASE_INIT.map(d => d.id));

function corto(sigla) {
  return (sigla || '').replace(/:$/, '').trim();
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (typeof data !== 'object' || !data) return {};
    let cleaned = false;
    for (const [tramoId, counts] of Object.entries(data)) {
      if (!counts || typeof counts !== 'object') continue;
      const vals = Object.values(counts).filter(v => typeof v === 'number');
      const allOne = vals.length > 0 && vals.every(v => v === 1);
      if (allOne) {
        delete data[tramoId];
        cleaned = true;
      }
    }
    if (cleaned) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.error('AparatosPanel:', e); }
    }
    return data;
  } catch (_) { return {}; }
}

function saveAll(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (e) { console.error('AparatosPanel:', e); }
}

function loadHidroData() {
  try { return JSON.parse(localStorage.getItem(HIDRO_DATA_KEY)) || {}; } catch (_) { return {}; }
}

function saveHidroData(map) {
  try { localStorage.setItem(HIDRO_DATA_KEY, JSON.stringify(map)); } catch (e) { console.error('AparatosPanel:', e); }
}

function loadGasAcc() {
  try { return JSON.parse(localStorage.getItem(GAS_ACC_KEY)) || {}; } catch (_) { return {}; }
}

function saveGasAcc(map) {
  try { localStorage.setItem(GAS_ACC_KEY, JSON.stringify(map)); } catch (e) { console.error('AparatosPanel:', e); }
}

function unitFor(netId) {
  const net = NETS.find(n => n.id === netId);
  if (!net) return null;
  if (netId === GAS_ID) return 'qgas';
  if (net.ucType === 'uc') return netId === 'ac' ? 'uc_ac' : 'uc_af';
  if (net.ucType === 'ud') return 'ud';
  return null;
}

function esAplicable(ap, netId, unitKey) {
  if (netId === GAS_ID) return ap.grupo === 'g' && (ap.qgas || 0) > 0;
  if (unitKey === 'ud') return SAN_UD_IDS.has(ap.id);
  if (unitKey === 'uc_af') return AF_UC_IDS.includes(ap.id);
  if (unitKey === 'uc_ac') return AC_UC_IDS.includes(ap.id);
  return false;
}

function isCountableTarget(el) {
  if (!el) return false;
  return el.id?.startsWith('R') || el.id?.startsWith('B') || el.id?.startsWith('T');
}

export default function AparatosPanel({ activeNet, selElement }) {
  const { planos } = usePlanos();
  const { aps } = useApparatus();
  const [counts, setCounts] = useState(loadAll);
  const [hidroData, setHidroData] = useState(loadHidroData);
  const [gasAcc, setGasAcc] = useState(loadGasAcc);
  const [open, setOpen] = useState(true);
  const [pulse, setPulse] = useState(false);
  const containerRef = useRef(null);
  const lastTargetRef = useRef(null);

  useEffect(() => {
    setCounts(prev => {
      const next = { ...prev };
      let changed = false;
      for (const [tramoId, map] of Object.entries(next)) {
        if (!map || typeof map !== 'object') continue;
        const vals = Object.values(map).filter(v => typeof v === 'number');
        if (vals.length > 0 && vals.every(v => v === 1)) {
          delete next[tramoId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

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
    const TRAZOS_PREFIX = 'civilflow_trazos_';
    const existingIds = new Set();
    for (const plano of planos) {
      if (!plano || plano.status !== 'confirmed') continue;
      try {
        const raw = localStorage.getItem(TRAZOS_PREFIX + plano.id);
        if (!raw) continue;
        const data = JSON.parse(raw);
        for (const r of data.ramales || []) {
          if (r.net === 'gas') existingIds.add(r.id);
        }
      } catch (_) {}
    }
    setGasAcc(prev => {
      let changed = false;
      const next = {};
      for (const id of existingIds) {
        if (prev[id]) next[id] = prev[id];
      }
      if (Object.keys(next).length !== Object.keys(prev).length) changed = true;
      return changed ? next : prev;
    });
  }, [planos]);

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
try { writeSanDrawingSync(planos); } catch (e) { console.error('AparatosPanel:', e); }
}, [counts, planos.length]);

useEffect(() => {
try { writeHidroDrawingSync(planos); } catch (e) { console.error('AparatosPanel:', e); }
}, [counts, hidroData, planos.length]);

// También refrescar sync sanitaria cuando cambian datos de tramo (nSalidas)
useEffect(() => {
try { writeSanDrawingSync(planos); } catch (e) { console.error('AparatosPanel:', e); }
}, [hidroData, planos.length]);

  const netId = activeNet;
  const isGas = netId === GAS_ID;
  const isHidro = HIDROSAN_IDS.has(netId);
  const isAfAc = netId === 'af' || netId === 'ac';
  const visible = isHidro || isGas;

  const unitKey = useMemo(() => unitFor(netId), [netId]);
  const unidadLbl = unitKey ? UNIDAD[unitKey] : '';

  const items = useMemo(() => {
    if (!unitKey) return [];
    const filtered = APARATOS_DEF.filter(ap => esAplicable(ap, netId, unitKey));
    const apsField = unitKey === 'ud' ? 'ud' : unitKey === 'uc_af' ? 'ucaf' : unitKey === 'uc_ac' ? 'ucac' : null;
    let result = filtered;
    if (apsField) {
      result = filtered.map(ap => {
        const fromAps = aps.find(p => p.id === ap.id);
        return fromAps ? { ...ap, [unitKey]: fromAps[apsField] || ap[unitKey] } : ap;
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

  // hidro data for current target
  const curHidro = useMemo(() => {
    if (!storageKey) return { accesorios: {}, Lh: 0, nSalidas: 0 };
    return hidroData[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 };
  }, [hidroData, storageKey]);

  const total = useMemo(() => {
    if (!storageKey) return 0;
    let s = 0;
    for (const ap of items) {
      const u = ap[unitKey] || 0;
      s += (currentMap[ap.id] || 0) * u;
    }
    return s;
  }, [items, currentMap, unitKey, storageKey]);

  const totalStr = useMemo(() => {
    if (Number.isInteger(total)) return String(total);
    return total.toFixed(2);
  }, [total]);

  const inc = (apId) => {
    if (!storageKey) return;
    setCounts(prev => {
      const cur = prev[storageKey] || {};
      return { ...prev, [storageKey]: { ...cur, [apId]: (cur[apId] || 0) + 1 } };
    });
  };

  const dec = (apId) => {
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

  // Accessory operations
  const incAcc = (accId) => {
    if (!storageKey) return;
    setHidroData(prev => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      acc[accId] = (acc[accId] || 0) + 1;
      const next = { ...prev, [storageKey]: { ...cur, accesorios: acc } };
      return next;
    });
  };

  const decAcc = (accId) => {
    if (!storageKey) return;
    setHidroData(prev => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      const acc = { ...(cur.accesorios || {}) };
      const v = (acc[accId] || 0) - 1;
      if (v <= 0) delete acc[accId]; else acc[accId] = v;
      return { ...prev, [storageKey]: { ...cur, accesorios: acc } };
    });
  };

  const setHidroField = (field, val) => {
    if (!storageKey) return;
    setHidroData(prev => {
      const cur = { ...(prev[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 }) };
      return { ...prev, [storageKey]: { ...cur, [field]: val } };
    });
  };

  // Gas accessory operations
  const gasAccMap = useMemo(() => {
    if (!targetId) return {};
    return gasAcc[targetId] || {};
  }, [gasAcc, targetId]);

  const incAccGas = (accId) => {
    if (!targetId) return;
    setGasAcc(prev => {
      const cur = { ...(prev[targetId] || {}) };
      cur[accId] = (cur[accId] || 0) + 1;
      return { ...prev, [targetId]: cur };
    });
  };

  const decAccGas = (accId) => {
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
      {/* ── MAIN HEADER ── */}
      <button onClick={() => setOpen(o => !o)} style={{
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

      {/* ── APARATOS SECTION ── */}
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
                }}>↺ Reset</button>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {items.map(ap => {
                const c = currentMap[ap.id] || 0;
                const u = ap[unitKey] || 0;
                const abbr = corto(ap.sigla);
                const active = c > 0;
                const uStr = Number.isInteger(u) ? String(u) : u.toFixed(2).replace(/\.?0+$/, '');
                return (
                    <div key={ap.id}
                      title={targetId ? ap.nombre : `Asigna un tramo primero`}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                        background: active ? 'rgba(37,99,235,.12)' : 'var(--bg2)',
                        border: `1px solid ${active ? accent : 'var(--line)'}`,
                        borderRadius: 4, overflow: 'hidden',
                        transition: 'all .12s',
                      }}>
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '4px 2px 2px', gap: 1, cursor: targetId ? 'pointer' : 'default',
                        minHeight: 48,
                      }} onClick={() => targetId && inc(ap.id)}>
                        <span style={{ fontSize: 17, lineHeight: 1 }}>{APARATO_IMG[ap.id] ? <img src={APARATO_IMG[ap.id]} alt="" style={{width:24,height:24,verticalAlign:'middle'}} /> : '•'}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: .3, color: active ? accent : '#b9caca', fontFamily: "'Geist',monospace", textTransform: 'uppercase' }}>{abbr}</span>
                        <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, color: 'var(--txt2)', fontFamily: "'Geist',monospace", padding: '1px 4px', marginTop: 1, background: 'rgba(0,0,0,.25)', border: '1px solid var(--bg4)', borderRadius: 2 }}>{uStr} {unidadLbl}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${active ? accent + '55' : 'var(--bg4)'}`, background: active ? 'rgba(37,99,235,.06)' : 'transparent' }}>
                        <button onClick={(e) => { e.stopPropagation(); targetId && dec(ap.id); }} disabled={!targetId || c === 0}
                          style={{ flex: 1, padding: '2px 0', background: 'transparent', color: c === 0 || !targetId ? 'var(--line)' : '#ffb4ab', cursor: c === 0 || !targetId ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, fontFamily: "'Geist',monospace", border: 'none', borderRight: `1px solid ${active ? accent + '55' : 'var(--bg4)'}` }}>−</button>
                        <div style={{ flex: 1.2, textAlign: 'center', fontSize: 10, fontWeight: 800, lineHeight: '14px', color: c > 0 ? accent : 'var(--txt2)', fontFamily: "'Geist',monospace", background: c > 0 ? 'rgba(37,99,235,.18)' : 'transparent' }}>{c}</div>
                        <button onClick={(e) => { e.stopPropagation(); targetId && inc(ap.id); }} disabled={!targetId}
                          style={{ flex: 1, padding: '2px 0', background: 'transparent', color: !targetId ? 'var(--line)' : accent, cursor: !targetId ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, fontFamily: "'Geist',monospace", border: 'none', borderLeft: `1px solid ${active ? accent + '55' : 'var(--bg4)'}` }}>+</button>
                      </div>
                  </div>
                );
              })}
            </div>
            {items.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--txt2)', fontFamily: "'Geist',monospace", padding: '6px 0', textAlign: 'center' }}>
                No hay aparatos aplicables a esta red.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACCESORIOS SECTION ── */}
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
      {netId === 'san' && (
        <AccesoriosSection
          targetId={targetId}
          curHidro={curHidro}
          incAcc={incAcc}
          decAcc={decAcc}
          accent={accent}
          items={SAN_ACCESORIOS}
        />
      )}
      {isGas && (
        <GasAccesoriosSection
          targetId={targetId}
          gasAccMap={gasAccMap}
          incAccGas={incAccGas}
          decAccGas={decAccGas}
          accent={accent}
        />
      )}
    </div>
  );
}

/* ── ACCESORIOS SECTION ── */
function AccesoriosSection({ targetId, curHidro, incAcc, decAcc, accent, items = ACCESORIOS_HIDRO }) {
  const [accOpen, setAccOpen] = useState(true);
  const acc = curHidro.accesorios || {};

  return (
    <div style={{ borderBottom: '1px solid #3a494a' }}>
      <button onClick={() => setAccOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
        borderTop: '1px solid var(--bg4)', textAlign: 'left',
      }}>
        <span style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          🔩 Accesorios
        </span>
        <span style={{ fontSize: 10, color: 'var(--txt2)', fontFamily: "'Geist',monospace" }}>
          {accOpen ? '▾' : '▸'}
        </span>
      </button>
      {accOpen && (
        <div style={{
          padding: '0 10px 10px',
          opacity: targetId ? 1 : 0.45, pointerEvents: targetId ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {items.map(a => {
              const v = acc[a.id] || 0;
              return (
                <div key={a.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                  background: v > 0 ? 'rgba(37,99,235,.12)' : 'var(--bg2)',
                  border: `1px solid ${v > 0 ? accent : 'var(--line)'}`,
                  borderRadius: 4, overflow: 'hidden', transition: 'all .12s',
                }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '3px 2px 1px', gap: 1, cursor: targetId ? 'pointer' : 'default', minHeight: 42,
                  }} onClick={() => targetId && incAcc(a.id)}>
                    <img src={a.icono} alt={a.nombre} style={{width:26,height:26,objectFit:'contain'}} />
                    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: .2, color: v > 0 ? accent : '#b9caca', fontFamily: "'Geist',monospace", textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1 }}>{a.nombre}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, background: v > 0 ? 'rgba(37,99,235,.06)' : 'transparent' }}>
                    <button onClick={(e) => { e.stopPropagation(); targetId && decAcc(a.id); }} disabled={!targetId || v === 0}
                      style={{ flex: 1, padding: '1px 0', border: 'none', borderRight: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, background: 'transparent', color: v === 0 || !targetId ? 'var(--line)' : '#ffb4ab', cursor: v === 0 || !targetId ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 800, lineHeight: 1, fontFamily: "'Geist',monospace" }}>−</button>
                    <div style={{ flex: 1.2, textAlign: 'center', fontSize: 10, fontWeight: 800, lineHeight: '14px', color: v > 0 ? accent : 'var(--txt2)', fontFamily: "'Geist',monospace", background: v > 0 ? 'rgba(37,99,235,.18)' : 'transparent' }}>{v}</div>
                    <button onClick={(e) => { e.stopPropagation(); targetId && incAcc(a.id); }} disabled={!targetId}
                      style={{ flex: 1, padding: '1px 0', border: 'none', borderLeft: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, background: 'transparent', color: !targetId ? 'var(--line)' : accent, cursor: !targetId ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 800, lineHeight: 1, fontFamily: "'Geist',monospace" }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── GAS ACCESORIOS SECTION ── */
function GasAccesoriosSection({ targetId, gasAccMap, incAccGas, decAccGas, accent }) {
  const [accOpen, setAccOpen] = useState(true);

  return (
    <div style={{ borderBottom: '1px solid #3a494a' }}>
      <button onClick={() => setAccOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
        borderTop: '1px solid var(--bg4)', textAlign: 'left',
      }}>
        <span style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          🔩 Accesorios
        </span>
        <span style={{ fontSize: 10, color: 'var(--txt2)', fontFamily: "'Geist',monospace" }}>
          {accOpen ? '▾' : '▸'}
        </span>
      </button>
      {accOpen && (
        <div style={{
          padding: '0 10px 10px',
          opacity: targetId ? 1 : 0.45, pointerEvents: targetId ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {GAS_ACCESORIOS.map(a => {
              const v = gasAccMap[a.id] || 0;
              return (
                <div key={a.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                  background: v > 0 ? 'rgba(37,99,235,.12)' : 'var(--bg2)',
                  border: `1px solid ${v > 0 ? accent : 'var(--line)'}`,
                  borderRadius: 4, overflow: 'hidden', transition: 'all .12s',
                }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '3px 2px 1px', gap: 1, cursor: targetId ? 'pointer' : 'default', minHeight: 42,
                  }} onClick={() => targetId && incAccGas(a.id)}>
                    <img src={a.icono} alt={a.nombre} style={{width:26,height:26,objectFit:'contain'}} />
                    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: .2, color: v > 0 ? accent : '#b9caca', fontFamily: "'Geist',monospace", textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1 }}>{a.nombre}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, background: v > 0 ? 'rgba(37,99,235,.06)' : 'transparent' }}>
                    <button onClick={(e) => { e.stopPropagation(); targetId && decAccGas(a.id); }} disabled={!targetId || v === 0}
                      style={{ flex: 1, padding: '1px 0', border: 'none', borderRight: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, background: 'transparent', color: v === 0 || !targetId ? 'var(--line)' : '#ffb4ab', cursor: v === 0 || !targetId ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 800, lineHeight: 1, fontFamily: "'Geist',monospace" }}>−</button>
                    <div style={{ flex: 1.2, textAlign: 'center', fontSize: 10, fontWeight: 800, lineHeight: '14px', color: v > 0 ? accent : 'var(--txt2)', fontFamily: "'Geist',monospace", background: v > 0 ? 'rgba(37,99,235,.18)' : 'transparent' }}>{v}</div>
                    <button onClick={(e) => { e.stopPropagation(); targetId && incAccGas(a.id); }} disabled={!targetId}
                      style={{ flex: 1, padding: '1px 0', border: 'none', borderLeft: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, background: 'transparent', color: !targetId ? 'var(--line)' : accent, cursor: !targetId ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 800, lineHeight: 1, fontFamily: "'Geist',monospace" }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── DATOS DE TRAMO SECTION ── */
function TramoDataSection({ targetId, curHidro, setHidroField, showLh, netId }) {
  const [dataOpen, setDataOpen] = useState(true);

  const vLh = curHidro.Lh ?? 0;
  const vNS = curHidro.nSalidas ?? 0;

  return (
    <div style={{ borderBottom: '1px solid #3a494a' }}>
      <button onClick={() => setDataOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
        borderTop: '1px solid var(--bg4)', textAlign: 'left',
      }}>
        <span style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          📐 Datos de Tramo
        </span>
        <span style={{ fontSize: 10, color: 'var(--txt2)', fontFamily: "'Geist',monospace" }}>
          {dataOpen ? '▾' : '▸'}
        </span>
      </button>
      {dataOpen && (
        <div style={{
          padding: '0 10px 10px',
          opacity: targetId ? 1 : 0.45, pointerEvents: targetId ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {showLh && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Lh (m)</div>
                <input type="number" value={vLh} min={0} step={0.1} disabled={!targetId}
                  onChange={e => setHidroField('Lh', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '4px 6px', background: 'var(--bg3)', border: '1px solid #3a494a', borderRadius: 3, color: 'var(--txt)', fontSize: 11, fontFamily: "'Geist',monospace" }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                {netId === 'san' ? 'Descargas' : 'No. descargas'}
              </div>
              <input type="number" value={vNS} min={0} step={1} disabled={!targetId}
                onChange={e => setHidroField('nSalidas', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg3)', border: '1px solid #3a494a', borderRadius: 3, color: 'var(--txt)', fontSize: 11, fontFamily: "'Geist',monospace" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}