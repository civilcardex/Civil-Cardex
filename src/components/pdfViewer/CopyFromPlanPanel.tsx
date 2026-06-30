import { memo, useCallback, useMemo, useState } from "react";
import { pisoLbl } from "../../constants";
import { loadFromStorage } from "../../services/storageService";
import { copyDrawingFromPlan, type CopySourceSelection } from "../../utils/copyDrawingFromPlan";

const NET_OPTIONS = [
  { id: 'ramal', label: 'Ramales' },
  { id: 'tributario', label: 'Tributarios' },
  { id: 'bajante', label: 'Bajantes' },
  { id: 'montante', label: 'Montantes' },
  { id: 'contador', label: 'Contadores' },
  { id: 'calentador', label: 'Calentadores' },
  { id: 'red_publica', label: 'Red pública' },
];

interface CopyFromPlanPanelProps {
  engineRef: React.MutableRefObject<any>;
  currentId: string;
  currentIdRef: React.MutableRefObject<string>;
  planosCtx: { plans: any[] };
  pisos: any[];
  visibleNets: any[];
}

function CopyFromPlanPanel_({ engineRef, currentId, currentIdRef, planosCtx, pisos, visibleNets }: CopyFromPlanPanelProps) {
  const [open, setOpen] = useState(false);
  const [srcPlanId, setSrcPlanId] = useState<string | null>(null);
  const [netSelections, setNetSelections] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const currentNivel = useMemo(() => {
    const targetId = currentId || currentIdRef.current;
    if (!targetId) return undefined;
    const p = planosCtx.plans.find((pl: any) => String(pl.id) === String(targetId));
    return p ? p.nivel : undefined;
  }, [planosCtx.plans, currentId, currentIdRef]);

  const otherPlans = useMemo(() =>
    planosCtx.plans.filter((p: any) => {
      if (p.nivel == null) return false;
      const isSame = String(p.id) === String(currentId || currentIdRef.current);
      const sameFloor = currentNivel !== undefined && p.nivel === currentNivel;
      return !isSame && !sameFloor;
    }),
  [planosCtx.plans, currentId, currentIdRef, currentNivel]);

  const srcPlan = useMemo(() => otherPlans.find((p: any) => String(p.id) === srcPlanId), [otherPlans, srcPlanId]);

  const srcPlanData = useMemo(() => {
    if (!srcPlanId) return null;
    const raw = loadFromStorage(`trazos_${srcPlanId}`, null);
    if (!raw) return null;
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return d;
  }, [srcPlanId]);

  const availableNets = useMemo(() => {
    if (!srcPlanData) return [];
    const srcRams: any[] = srcPlanData.ramales || [];
    const srcBajs: any[] = srcPlanData.bajantes || [];
    const allNets = new Set<string>();
    for (const r of srcRams) allNets.add(r.net);
    for (const b of srcBajs) allNets.add(b.net);
    return visibleNets.filter((n: any) => allNets.has(n.id));
  }, [srcPlanData, visibleNets]);

  const getTiposForNet = useCallback((netId: string) => {
    if (!srcPlanData) return new Set<string>();
    const srcRams: any[] = srcPlanData.ramales || [];
    const srcBajs: any[] = srcPlanData.bajantes || [];
    const tipos = new Set<string>();
    for (const r of srcRams) { if (r.net === netId) tipos.add(r.tipo); }
    for (const b of srcBajs) { if (b.net === netId) tipos.add(b.tipo); }
    if (srcBajs.some((b: any) => b.tipo === 'red_publica')) tipos.add('red_publica');
    if (srcBajs.some((b: any) => b.tipo === 'contador')) tipos.add('contador');
    if (srcBajs.some((b: any) => b.tipo === 'calentador')) tipos.add('calentador');
    return tipos;
  }, [srcPlanData]);

  const handleNetToggle = useCallback((netId: string, tipoId: string) => {
    setNetSelections(prev => {
      const next = { ...prev };
      const s = new Set(prev[netId] || []);
      if (s.has(tipoId)) s.delete(tipoId); else s.add(tipoId);
      if (s.size === 0) delete next[netId]; else next[netId] = s;
      return next;
    });
  }, []);

  const handleToggleAllForNet = useCallback((netId: string, checked: boolean) => {
    setNetSelections(prev => {
      const next = { ...prev };
      if (checked) {
        const tipos = getTiposForNet(netId);
        next[netId] = new Set(tipos);
      } else {
        delete next[netId];
      }
      return next;
    });
  }, [getTiposForNet]);

  const handleCopy = useCallback(async () => {
    const eng = engineRef.current;
    const targetId = currentId || currentIdRef.current || '';
    if (!eng || !targetId || !srcPlanId || Object.keys(netSelections).length === 0) return;

    setFeedback(null);
    setBusy(true);
    try {
      const selections: CopySourceSelection[] = Object.entries(netSelections).map(([netId, tipos]) => ({
        netId,
        tipos: new Set(tipos),
      }));

      const result = copyDrawingFromPlan(eng, targetId, srcPlanId, selections);

      if (result.copied > 0) {
        try {
          const { saveTrazosToDB } = await import('../../services/storageService');
          const work = eng.saveWork();
          if (work) {
            (work as any).ts = Date.now();
            await saveTrazosToDB(targetId, work);
          }
        } catch { }
        setFeedback({ ok: true, msg: `✓ ${result.copied} elemento${result.copied !== 1 ? 's' : ''} copiado${result.copied !== 1 ? 's' : ''}` });
      } else {
        let msg = 'No se copiaron elementos';
        if (result.skippedNets.length > 0) msg += ': ' + result.skippedNets.join(', ');
        setFeedback({ ok: false, msg });
      }
    } catch (e) {
      setFeedback({ ok: false, msg: 'Error al copiar' });
    } finally {
      setBusy(false);
    }
  }, [engineRef, srcPlanId, netSelections, currentId, currentIdRef]);

  const hasSelection = Object.keys(netSelections).length > 0;

  if (otherPlans.length === 0) return null;

  return (
    <div style={{
      padding: "10px 12px 8px",
      borderBottom: "1px solid #3a494a",
      background: open ? 'linear-gradient(180deg, rgba(0,220,229,.04) 0%, transparent 100%)' : 'transparent',
      borderLeft: open ? '2px solid #00dce5' : '2px solid transparent',
      transition: 'background .2s, border-color .2s',
    }}>
      <div
        onClick={() => setOpen(prev => !prev)}
        style={{
          fontFamily: "'Geist',monospace", fontSize: 10,
          color: open ? '#00dce5' : '#849495',
          marginBottom: 6,
          textTransform: "uppercase", letterSpacing: 1.5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          userSelect: 'none', fontWeight: 600,
          transition: 'color .15s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
          Copiar redes
        </span>
        <span style={{
          fontSize: 9, color: open ? '#00dce5' : '#5a7a7a',
          padding: '1px 5px', borderRadius: 3,
          background: open ? 'rgba(0,220,229,.12)' : 'transparent',
          transition: 'all .15s',
        }}>
          {open ? '▼' : '▶'}
        </span>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <select
            value={srcPlanId || ''}
            onChange={e => {
              setSrcPlanId(e.target.value || null);
              setNetSelections({});
              setFeedback(null);
            }}
            style={{
              width: '100%', padding: "4px 6px", background: "#1a1c21",
              border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8",
              fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer',
            }}
          >
            <option value="">— Seleccionar origen —</option>
            {otherPlans.map((p: any) => {
              const piso = pisos.find(s => String(s.n) === String(p.nivel));
              return (
                <option key={p.id} value={p.id}>
                  {piso ? pisoLbl(piso.n) : `Nv. ${p.nivel}`} — {p.name || p.id}
                </option>
              );
            })}
          </select>

          {srcPlan && availableNets.length > 0 && (
            <div style={{
              maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
              background: '#181a1e', borderRadius: 3, padding: '4px 0',
              border: '1px solid rgba(0,220,229,.08)',
            }}>
              {availableNets.map((net: any) => {
                const tipos = getTiposForNet(net.id);
                const selTipos = netSelections[net.id] || new Set();
                const allSelected = tipos.size > 0 && [...tipos].every(t => selTipos.has(t));
                const someSelected = selTipos.size > 0 && !allSelected;

                return (
                  <div key={net.id} style={{
                    borderBottom: '1px solid rgba(58,73,74,.3)',
                    padding: '3px 6px',
                  }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                      fontSize: 11, fontFamily: "'Geist',monospace", color: '#c8c8d0',
                      padding: '2px 2px', borderRadius: 2, userSelect: 'none',
                    }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected; }}
                        onChange={() => handleToggleAllForNet(net.id, !allSelected)}
                        style={{ accentColor: net.col }}
                      />
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                        background: net.col, flexShrink: 0,
                        boxShadow: someSelected ? `0 0 6px ${net.col}` : 'none',
                      }} />
                      <span style={{ color: '#c8c8d0', fontWeight: 400 }}>{net.name}</span>
                    </label>

                    {tipos.size > 0 && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 1,
                        padding: '2px 0 2px 22px',
                      }}>
                        {NET_OPTIONS.filter(opt => tipos.has(opt.id)).map(opt => (
                          <label key={opt.id} style={{
                            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                            fontSize: 10, color: selTipos.has(opt.id) ? '#d0d0e0' : '#7a8a8a',
                            userSelect: 'none', padding: '1px 2px',
                            borderRadius: 2,
                            background: selTipos.has(opt.id) ? 'rgba(255,255,255,.03)' : 'transparent',
                            transition: 'background .1s',
                          }}>
                            <input
                              type="checkbox"
                              checked={selTipos.has(opt.id)}
                              onChange={() => handleNetToggle(net.id, opt.id)}
                              style={{ accentColor: net.col }}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {srcPlan && availableNets.length === 0 && (
            <div style={{
              fontSize: 10, color: '#6b8cae', padding: '6px 8px',
              background: '#181a1e', borderRadius: 3, textAlign: 'center',
            }}>
              El plano origen no tiene datos de redes
            </div>
          )}

          {feedback && (
            <div style={{
              fontSize: 10, fontFamily: "'Geist',monospace", padding: '4px 6px', borderRadius: 3,
              background: feedback.ok ? 'rgba(45,125,70,.15)' : 'rgba(220,50,50,.15)',
              color: feedback.ok ? '#4ade80' : '#f87171',
              textAlign: 'center',
            }}>
              {feedback.msg}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <button
              onClick={handleCopy}
              disabled={!hasSelection || busy}
              style={{
                flex: 1, padding: '6px 0', border: 'none', borderRadius: 3,
                background: hasSelection && !busy
                  ? 'linear-gradient(135deg, #1a8a4e, #2dbb6a)'
                  : '#2a2d32',
                color: hasSelection && !busy ? '#fff' : '#5a5d62',
                fontSize: 11, fontFamily: "'Geist',monospace", fontWeight: 700,
                letterSpacing: 1,
                cursor: hasSelection && !busy ? 'pointer' : 'default',
                transition: 'all .15s',
                boxShadow: hasSelection && !busy ? '0 1px 6px rgba(26,138,78,.4)' : 'none',
                textShadow: hasSelection && !busy ? '0 1px 2px rgba(0,0,0,.3)' : 'none',
              }}
              onMouseEnter={e => {
                if (hasSelection && !busy) e.currentTarget.style.filter = 'brightness(1.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              {busy ? '⌛ Copiando…' : 'COPIAR'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const CopyFromPlanPanel = memo(CopyFromPlanPanel_);
