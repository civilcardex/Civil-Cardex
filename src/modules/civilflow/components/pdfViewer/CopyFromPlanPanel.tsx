import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { devError } from '../../../../utils/devError';
import { pisoLbl } from '../../constants';
import { loadFromStorage, saveTrazosToDB } from '../../services/storageService';
import {
  copyDrawingFromPlan,
  type CopyOpciones,
  type CopySourceSelection,
} from '../../utils/copyDrawingFromPlan';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoNet } from '../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../lib/shared/projectTypes';
import type { PlanItem } from '../../context/PlansContext';

interface SrcPlanElement {
  id: string;
  net: string;
  tipo: string;
  direccion?: string;
  isFantasma?: boolean;
  ghostData?: Record<string, unknown> | null;
  desplazamientos?: Record<string, unknown> | null;
  pisoBase?: string;
}
interface SrcPlanData {
  ramales?: SrcPlanElement[];
  bajantes?: SrcPlanElement[];
  crossFloorGhosts?: unknown[];
}
const CopyFromPlanPanel_S1: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  background: '#1a1c21',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};
const CopyFromPlanPanel_S2: React.CSSProperties = {
  maxHeight: 160,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  background: '#181a1e',
  borderRadius: 3,
  padding: '4px 0',
  border: '1px solid rgba(0,220,229,.08)',
};
const CopyFromPlanPanel_S3: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  color: '#c8c8d0',
  padding: '2px 2px',
  borderRadius: 2,
  userSelect: 'none',
};
const CopyFromPlanPanel_S4: React.CSSProperties = {
  fontFamily: "'Geist',monospace",
  fontSize: 12,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  userSelect: 'none',
  fontWeight: 600,
  transition: 'color .15s',
};
const CopyFromPlanPanel_S5: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  fontSize: 12,
  userSelect: 'none',
  padding: '1px 2px',
  borderRadius: 2,
  transition: 'background .1s',
};
const CopyFromPlanPanel_S6: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  border: 'none',
  borderRadius: 3,
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  fontWeight: 700,
  letterSpacing: 1,
  transition: 'all .15s',
};

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
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  currentId: string | number | undefined;
  currentIdRef: React.MutableRefObject<string | number | undefined>;
  planosCtx: { plans: PlanItem[] };
  pisos: Piso[];
  visibleNets: PlanoNet[];
}

function CopyFromPlanPanel_({
  engineRef,
  currentId,
  currentIdRef,
  planosCtx,
  pisos,
  visibleNets,
}: CopyFromPlanPanelProps) {
  const [open, setOpen] = useState(false);
  const [srcPlanId, setSrcPlanId] = useState<string | null>(null);
  const [netSelections, setNetSelections] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  // Modal de fantasmas: null = cerrado; si el origen tiene fantasmas se pregunta qué copiar.
  const [fantModal, setFantModal] = useState(false);
  const [fantPick, setFantPick] = useState<'fantasmas' | 'originales' | 'ambos'>('ambos');

  // Escape cierra el modal (listener a nivel documento: el dialog no captura teclado).
  useEffect(() => {
    if (!fantModal) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setFantModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fantModal]);

  const currentNivel = useMemo(() => {
    const targetId = currentId || currentIdRef.current;
    if (!targetId) return undefined;
    const p = planosCtx.plans.find((pl) => String(pl.id) === String(targetId));
    return p ? p.nivel : undefined;
  }, [planosCtx.plans, currentId, currentIdRef]);

  const otherPlans = useMemo(
    () =>
      planosCtx.plans.filter((p) => {
        if (p.nivel == null) return false;
        const isSame = String(p.id) === String(currentId || currentIdRef.current);
        const sameFloor = currentNivel !== undefined && p.nivel === currentNivel;
        return !isSame && !sameFloor;
      }),
    [planosCtx.plans, currentId, currentIdRef, currentNivel],
  );

  const srcPlan = useMemo(
    () => otherPlans.find((p) => String(p.id) === srcPlanId),
    [otherPlans, srcPlanId],
  );

  const srcPlanData = useMemo((): SrcPlanData | null => {
    if (!srcPlanId) return null;
    const raw = loadFromStorage(`trazos_${srcPlanId}`, null);
    if (!raw) return null;
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return d as SrcPlanData;
  }, [srcPlanId]);

  // ¿El piso origen tiene bajantes FANTASMA? (orig. usuario) = direccion 'sube' (los
  // autocreados por la asociación cuando dos bajantes no están alineados).
  const origenConFantasmas = useMemo(() => {
    const d = srcPlanData;
    if (!d) return false;
    return (d.bajantes || []).some((b) => b.direccion === 'sube');
  }, [srcPlanData]);

  const availableNets = useMemo(() => {
    if (!srcPlanData) return [];
    const srcRams: SrcPlanElement[] = srcPlanData.ramales || [];
    const srcBajs: SrcPlanElement[] = srcPlanData.bajantes || [];
    const allNets = new Set<string>();
    for (const r of srcRams) allNets.add(r.net);
    for (const b of srcBajs) allNets.add(b.net);
    return visibleNets.filter((n) => allNets.has(n.id));
  }, [srcPlanData, visibleNets]);

  const getTiposForNet = useCallback(
    (netId: string) => {
      if (!srcPlanData) return new Set<string>();
      const srcRams: SrcPlanElement[] = srcPlanData.ramales || [];
      const srcBajs: SrcPlanElement[] = srcPlanData.bajantes || [];
      const tipos = new Set<string>();
      for (const r of srcRams) {
        if (r.net === netId) tipos.add(r.tipo);
      }
      for (const b of srcBajs) {
        if (b.net === netId) tipos.add(b.tipo);
      }
      if (srcBajs.some((b) => b.tipo === 'red_publica')) tipos.add('red_publica');
      if (srcBajs.some((b) => b.tipo === 'contador')) tipos.add('contador');
      if (srcBajs.some((b) => b.tipo === 'calentador')) tipos.add('calentador');
      return tipos;
    },
    [srcPlanData],
  );

  const handleNetToggle = useCallback((netId: string, tipoId: string) => {
    setNetSelections((prev) => {
      const next = { ...prev };
      const s = new Set(prev[netId] || []);
      if (s.has(tipoId)) s.delete(tipoId);
      else s.add(tipoId);
      if (s.size === 0) delete next[netId];
      else next[netId] = s;
      return next;
    });
  }, []);

  const handleToggleAllForNet = useCallback(
    (netId: string, checked: boolean) => {
      setNetSelections((prev) => {
        const next = { ...prev };
        if (checked) {
          const tipos = getTiposForNet(netId);
          next[netId] = new Set(tipos);
        } else {
          delete next[netId];
        }
        return next;
      });
    },
    [getTiposForNet],
  );

  const doCopy = useCallback(
    async (modo: CopyOpciones['fantasmas']) => {
      const eng = engineRef.current;
      const targetId = currentId || currentIdRef.current || '';
      if (!eng || !targetId || !srcPlanId || Object.keys(netSelections).length === 0) return;

      setFeedback(null);
      setBusy(true);
      try {
        const selections: CopySourceSelection[] = Object.entries(netSelections).map(
          ([netId, tipos]) => ({
            netId,
            tipos: new Set(tipos),
          }),
        );

        const result = copyDrawingFromPlan(
          eng,
          String(targetId),
          srcPlanId,
          selections,
          {
            // Alineación de láminas (mismo punto físico del AutoCAD marcado como origen de
            // calibración en cada piso): sin esto, una lámina desalineada respecto a la del piso
            // origen dejaba la copia a metros de donde debía — cotas distintas entre pisos.
            origenSrc:
              planosCtx.plans.find((pl) => String(pl.id) === String(srcPlanId))?.origen ?? null,
            origenDst:
              planosCtx.plans.find((pl) => String(pl.id) === String(targetId))?.origen ?? null,
          },
          { fantasmas: modo },
        );

        if (result.copied > 0) {
          try {
            const work = eng.saveWork();
            if (work) {
              work.ts = Date.now();
              await saveTrazosToDB(String(targetId), work);
            }
          } catch {
            /* ignore */
          }
          setFeedback({
            ok: true,
            msg: `✓ ${result.copied} elemento${result.copied !== 1 ? 's' : ''} copiado${result.copied !== 1 ? 's' : ''}`,
          });
        } else {
          let msg = 'No se copiaron elementos';
          if (result.skippedNets.length > 0) msg += ': ' + result.skippedNets.join(', ');
          setFeedback({ ok: false, msg });
        }
      } catch {
        setFeedback({ ok: false, msg: 'Error al copiar' });
      } finally {
        setBusy(false);
      }
    },
    [engineRef, srcPlanId, netSelections, currentId, currentIdRef, planosCtx.plans],
  );

  // Con fantasmas en el origen: preguntar qué copiar; sin ellos: copia directa.
  const handleCopy = useCallback(() => {
    // [CF-COPIA] diagnóstico DEV: por qué sale/no sale el modal de fantasmas.
    devError(
      `[CF-COPIA] click COPIAR origen=${String(srcPlanId)} origenConFantasmas=${origenConFantasmas} bajantes=${JSON.stringify(
        (srcPlanData?.bajantes || []).map((b) => ({
          id: b.id,
          direccion: (b as { direccion?: string }).direccion ?? '—',
        })),
      )}`,
    );
    // Modal SIEMPRE que la selección incluya bajantes (orig. usuario): pregunta si copia
    // originales, fantasmas o ambos. Sin bajantes en la selección, copia directo.
    const hayBajantes = Object.values(netSelections).some(
      (tipos) => tipos.has('bajante') || tipos.has('montante'),
    );
    if (hayBajantes) {
      setFantPick('ambos');
      setFantModal(true);
      return;
    }
    void doCopy('ambos');
  }, [netSelections, doCopy]);

  const hasSelection = Object.keys(netSelections).length > 0;

  if (otherPlans.length === 0) return null;

  const RADIO_ROW: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    cursor: 'pointer',
    fontSize: 12.5,
    color: 'var(--txt)',
  };

  return (
    <div
      style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid #3a494a',
        background: open
          ? 'linear-gradient(180deg, rgba(0,220,229,.04) 0%, transparent 100%)'
          : 'transparent',
        borderLeft: open ? '2px solid #00dce5' : '2px solid transparent',
        transition: 'background .2s, border-color .2s',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          ...CopyFromPlanPanel_S4,
          color: open ? '#00dce5' : '#849495',
          background: 'none',
          border: 'none',
          padding: 0,
          width: '100%',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5 }}>
          Copiar elementos
        </span>
        <span
          style={{
            fontSize: 12,
            color: open ? '#00dce5' : '#5a7a7a',
            padding: '1px 5px',
            borderRadius: 3,
            background: open ? 'rgba(0,220,229,.12)' : 'transparent',
            transition: 'color .15s, background-color .15s',
          }}
        >
          {open ? '▼' : '▶'}
        </span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <select
            value={srcPlanId || ''}
            aria-label="Seleccionar plano de origen"
            onChange={(e) => {
              setSrcPlanId(e.target.value || null);
              setNetSelections({});
              setFeedback(null);
            }}
            style={CopyFromPlanPanel_S1}
          >
            <option value="">— Seleccionar origen —</option>
            {otherPlans.map((p) => {
              const piso = pisos.find((s) => String(s.n) === String(p.nivel));
              return (
                <option key={p.id} value={p.id}>
                  {piso ? pisoLbl(piso.n) : `Nv. ${p.nivel}`} — {p.name || p.id}
                </option>
              );
            })}
          </select>

          {srcPlan && availableNets.length > 0 && (
            <div style={CopyFromPlanPanel_S2}>
              {availableNets.map((net) => {
                const tipos = getTiposForNet(net.id);
                const selTipos = netSelections[net.id] || new Set();
                const allSelected = tipos.size > 0 && [...tipos].every((t) => selTipos.has(t));
                const someSelected = selTipos.size > 0 && !allSelected;

                return (
                  <div
                    key={net.id}
                    style={{
                      borderBottom: '1px solid rgba(58,73,74,.3)',
                      padding: '3px 6px',
                    }}
                  >
                    <label style={CopyFromPlanPanel_S3}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={() => handleToggleAllForNet(net.id, !allSelected)}
                        style={{ accentColor: net.col }}
                      />
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          display: 'inline-block',
                          background: net.col,
                          flexShrink: 0,
                          boxShadow: someSelected ? `0 0 6px ${net.col}` : 'none',
                        }}
                      />
                      <span style={{ color: '#c8c8d0', fontWeight: 400 }}>{net.name}</span>
                    </label>

                    {tipos.size > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          padding: '2px 0 2px 22px',
                        }}
                      >
                        {NET_OPTIONS.filter((opt) => tipos.has(opt.id)).map((opt) => (
                          <label
                            key={opt.id}
                            style={{
                              ...CopyFromPlanPanel_S5,
                              color: selTipos.has(opt.id) ? '#d0d0e0' : '#7a8a8a',
                              background: selTipos.has(opt.id)
                                ? 'rgba(255,255,255,.03)'
                                : 'transparent',
                            }}
                          >
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
            <div
              style={{
                fontSize: 12,
                color: '#6b8cae',
                padding: '6px 8px',
                background: '#181a1e',
                borderRadius: 3,
                textAlign: 'center',
              }}
            >
              El plano origen no tiene datos de redes
            </div>
          )}

          {feedback && (
            <div
              style={{
                fontSize: 12,
                fontFamily: "'Geist',monospace",
                padding: '4px 6px',
                borderRadius: 3,
                background: feedback.ok ? 'rgba(45,125,70,.15)' : 'rgba(220,50,50,.15)',
                color: feedback.ok ? '#4ade80' : '#f87171',
                textAlign: 'center',
              }}
            >
              {feedback.msg}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasSelection || busy}
              style={{
                ...CopyFromPlanPanel_S6,
                background:
                  hasSelection && !busy ? 'linear-gradient(135deg, #1a8a4e, #2dbb6a)' : '#2a2d32',
                color: hasSelection && !busy ? '#fff' : '#5a5d62',
                cursor: hasSelection && !busy ? 'pointer' : 'default',
                boxShadow: hasSelection && !busy ? '0 1px 6px rgba(26,138,78,.4)' : 'none',
                textShadow: hasSelection && !busy ? '0 1px 2px rgba(0,0,0,.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (hasSelection && !busy) e.currentTarget.style.filter = 'brightness(1.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              {busy ? '⌛ Copiando…' : 'COPIAR'}
            </button>
          </div>
        </div>
      )}

      {createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: fantModal ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Qué copiar con fantasmas"
            style={{
              background: 'var(--bg2)',
              color: 'var(--txt)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: 16,
              minWidth: 300,
              boxShadow: '0 8px 32px rgba(0,0,0,.5)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              El piso origen tiene bajantes fantasmas entre pisos
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 8 }}>
              ¿Qué deseas copiar al piso actual?
            </div>
            <label style={RADIO_ROW}>
              <input
                type="radio"
                name="fant-copia"
                checked={fantPick === 'fantasmas'}
                onChange={() => setFantPick('fantasmas')}
              />
              Solo fantasmas
            </label>
            <label style={RADIO_ROW}>
              <input
                type="radio"
                name="fant-copia"
                checked={fantPick === 'originales'}
                onChange={() => setFantPick('originales')}
              />
              Solo originales
            </label>
            <label style={RADIO_ROW}>
              <input
                type="radio"
                name="fant-copia"
                checked={fantPick === 'ambos'}
                onChange={() => setFantPick('ambos')}
              />
              Ambos
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setFantModal(false)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--txt2)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setFantModal(false);
                  void doCopy(fantPick);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'linear-gradient(135deg, #1a8a4e, #2dbb6a)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Copiar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export const CopyFromPlanPanel = memo(CopyFromPlanPanel_);
