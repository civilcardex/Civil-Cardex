import AparatosPanel from "../FixturesPanel";
import TramoEditor, { DIAM_DEFAULT_BY_NET } from "./TramoEditor";
import PdfViewerDrawnElements from "./PdfViewerDrawnElements";
import PlanoEngine from "../../lib/PlanoEngine";
import { pisoCorto } from "../../constants/helpers";

interface LowerFloorRamales {
  planId: string;
  planName: string;
  npt: number;
  ramales: any[];
}

interface NetworkSidebarProps {
  selectedNivel: number | null;
  setSelectedNivel: (n: number | null) => void;
  pisos: any[];
  planos: any[];
  onSelectPlan: (idx: number) => void;
  tool: string;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  pendSel: Record<string, number>;
  pendInput: string;
  mats: Record<string, any[]>;
  lowerFloorsRamales: LowerFloorRamales[];
  planosCtx: { plans: any[] };
  tipoTramo: string;
  setTipoTramo: (t: string) => void;
  padreTributarioId: string | null;
  setPadreTributarioId: (id: string | null) => void;
  drawnElements: any[];
  scaleM: string;
  matLongName: (short: string) => string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPendInput: React.Dispatch<React.SetStateAction<string>>;
  handleUpdateSel: (field: string, value: any) => void;
  handleRotateLabel: () => void;
  handleDelete: () => void;
}

const TIPOS_TRAMO = [
  { id: "ramal", label: "Ramal" },
  { id: "tributario", label: "Tributario" },
];

export default function NetworkSidebar({
  selectedNivel,
  setSelectedNivel,
  pisos,
  planos,
  onSelectPlan,
  tool,
  selElement,
  setSelElement,
  engineRef,
  diamSel,
  gasMatSel,
  pendSel,
  pendInput,
  mats,
  lowerFloorsRamales,
  planosCtx,
  tipoTramo,
  setTipoTramo,
  padreTributarioId,
  setPadreTributarioId,
  drawnElements,
  scaleM,
  matLongName,
  setDiamSel,
  setGasMatSel,
  setPendSel,
  setPendInput,
  handleUpdateSel,
  handleRotateLabel,
  handleDelete,
}: NetworkSidebarProps) {
  return (
    <div className="visor-sidebar-right" style={{
      width: 210, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "#14161a", borderLeft: "1px solid #3a494a",
      overflowY: "auto", overflowX: "hidden",
      transition: 'opacity 0.2s',
    }}>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Nivel</div>
        <select aria-label="Seleccionar nivel" value={selectedNivel ?? ''} onChange={e => {
          const v = e.target.value ? Number(e.target.value) : null;
          setSelectedNivel(v);
          if (v !== null) {
            const idx = planos.findIndex(p => p.nivel === v && p.status === 'confirmed');
            if (idx >= 0 && onSelectPlan) onSelectPlan(idx);
          }
        }}
          style={{ width: '100%', padding: "5px 8px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
          <option value="">— Seleccionar piso —</option>
          {[...pisos].sort((a, b) => b.n - a.n).map(s => {
            const tienePlano = planos.some(p => p.nivel === s.n && p.status === 'confirmed');
            return <option key={s.id} value={s.n}>{tienePlano ? '🟢 ' : ''}{pisoCorto(s.n)} ({s.npt} m)</option>;
          })}
        </select>
        {selectedNivel !== null && (() => {
          const planoAsoc = planos.find(p => p.nivel === selectedNivel && p.status === 'confirmed');
          if (!planoAsoc) return null;
          return (
            <div style={{ marginTop: 8, padding: '6px 10px', background: '#1e2024', borderRadius: 3, border: '1px solid rgba(0,220,229,.2)' }}>
              <div style={{ fontSize: 11, color: '#00dce5', fontFamily: "'Geist',monospace", fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>📄 {planoAsoc.name}</div>
              <div style={{ fontSize: 10, color: '#6b8cae', fontFamily: "'Geist',monospace", marginTop: 2 }}>Escala 1:{planoAsoc.scale}</div>
            </div>
          );
        })()}
      </div>

      <div style={{
        opacity: (tool === 'sel' && !selElement) ? 0.35 : 1,
        pointerEvents: (tool === 'sel' && !selElement) ? 'none' : 'auto',
        transition: 'opacity 0.2s',
      }}>
        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>¿Qué voy a dibujar?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TIPOS_TRAMO.map(tp => (
              <button key={tp.id} onClick={() => setTipoTramo(tp.id)}
                style={{
                  padding: "7px 10px", background: tipoTramo === tp.id ? "#2563EB22" : "#1e2024",
                  border: `1px solid ${tipoTramo === tp.id ? "#2563EB" : "#3a494a"}`,
                  borderRadius: "3px", cursor: "pointer", width: "100%",
                  display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start",
                  transition: "all .12s",
                }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: tipoTramo === tp.id ? "#2563EB" : "#b9caca", fontFamily: "'Geist',monospace" }}>
                  {tp.id === 'ramal' ? '📏 Ramal principal' : tp.id === 'tributario' ? '🔀 Tributario' : tp.label}
                </div>
                <div style={{ fontSize: 9, color: "#6b8cae", fontFamily: "'Geist',monospace", textAlign: "left" }}>
                  {tp.id === 'ramal' ? 'Trazos principales de la red activa' : tp.id === 'tributario' ? 'Ramificaciones que conectan al ramal principal' : ''}
                </div>
              </button>
            ))}
          </div>
          {tipoTramo === 'tributario' && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: padreTributarioId ? 'rgba(37,99,235,.12)' : '#1e2024', border: `1px solid ${padreTributarioId ? '#2563EB' : '#3a494a'}`, borderRadius: 3 }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Padre (ramal asignado)</div>
              <select aria-label="Seleccionar ramal padre tributario" value={padreTributarioId || ''}
                onChange={e => {
                  const v = e.target.value || null;
                  setPadreTributarioId(v);
                  if (engineRef.current) engineRef.current.setPadreTributario(v as any);
                }}
                style={{ width: '100%', padding: '5px 8px', background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3, color: padreTributarioId ? '#2563EB' : '#6b8cae', fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                <option value="">— Seleccionar ramal padre —</option>
                {drawnElements.filter(el => el.type === 'ramal' && el.tipo === 'ramal').map(el => (
                  <option key={el.id} value={el.id}>{el.label}{el.totalL ? ` · ${typeof el.totalL === 'number' ? el.totalL.toFixed(2) : el.totalL}m` : ''}</option>
                ))}
              </select>
              {drawnElements.filter(el => el.type === 'ramal' && el.tipo === 'ramal').length === 0 && (
                <div style={{ fontSize: 10, color: '#ffb4ab', fontFamily: "'Geist',monospace", marginTop: 6, lineHeight: 1.4 }}>
                  No hay ramales principales en esta red. Dibuja primero un ramal antes de crear tributarios.
                </div>
              )}
              {padreTributarioId && (
                <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", marginTop: 4, lineHeight: 1.4 }}>
                  El primer punto se conectará automáticamente al ramal seleccionado.
                </div>
              )}
            </div>
          )}
        </div>

        <TramoEditor
          selElement={selElement}
          activeNet={selElement?.net || ''}
          engineRef={engineRef}
          diamSel={diamSel}
          gasMatSel={gasMatSel}
          pendSel={pendSel}
          pendInput={pendInput}
          mats={mats}
          matLongName={matLongName}
          setDiamSel={setDiamSel}
          setGasMatSel={setGasMatSel}
          setPendSel={setPendSel}
          setPendInput={setPendInput}
          setSelElement={setSelElement}
          handleUpdateSel={handleUpdateSel}
          handleRotateLabel={handleRotateLabel}
          handleDelete={handleDelete}
        />

        {selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante') && !engineRef.current?._isGhostSel && (
          <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a", opacity: 1, pointerEvents: 'auto' }}>
            <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              Asociación de bajante
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 8, color: '#6b8cae', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: .5 }}>Origen (piso actual)</div>
                <div style={{ padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#6b8cae", fontSize: 10, fontFamily: "'Geist',monospace" }}>
                  {selectedNivel !== null ? pisoCorto(selectedNivel) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: '#6b8cae', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: .5 }}>Destino</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <select aria-label="Seleccionar destino de descarga" value={selElement.descargaEnId || ''}
                    onChange={e => {
                      const v = e.target.value || null;
                      if (engineRef.current) {
                        engineRef.current.updateSelected({ descargaEnId: v });
                        setSelElement({ ...selElement, descargaEnId: v });
                      }
                    }}
                    style={{ flex: 1, padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                    <option value="">— Sin destino —</option>
                    {lowerFloorsRamales.map(group => {
                      const plano = planosCtx.plans.find((pl: any) => pl.id === group.planId);
                      const pLabel = plano?.nivel != null ? pisoCorto(plano.nivel) : group.planName;
                      return (
                        <optgroup key={group.planId} label={pLabel + (group.ramales.length === 0 ? ' (sin ramales)' : '')}>
                          {group.ramales.length > 0 ? group.ramales.map((r: any) => (
                            <option key={`${group.planId}|${r.id}`} value={`${group.planId}|${r.id}`}>
                              {r.label || r.id}
                            </option>
                          )) : (
                            <option value="" disabled>— Sin ramales disponibles —</option>
                          )}
                        </optgroup>
                      );
                    })}
                  </select>
                  {selElement.descargaEnId && (
                    <button onClick={() => {
                      if (engineRef.current) {
                        engineRef.current.updateSelected({ descargaEnId: null });
                        setSelElement({ ...selElement, descargaEnId: null });
                      }
                    }}
                      style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 10 }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Escala</div>
          <div style={{ padding: "5px 8px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace" }}>
            {(() => {
              const planoAsoc = planos.find(p => p.nivel === selectedNivel && p.status === 'confirmed');
              if (planoAsoc && planoAsoc.scale) return <span>1:{planoAsoc.scale}</span>;
              const map: Record<string, string> = { '0.5': '1:50', '0.75': '1:75', '1.0': '1:100', '1.25': '1:125', '2.0': '1:200' };
              return <span>{map[scaleM] || '1:100'}</span>;
            })()}
          </div>
        </div>

        {!(selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante' || selElement.tipo === 'area' || selElement.id?.startsWith('AR'))) && (
          <AparatosPanel activeNet={selElement?.net || ''} selElement={selElement} planId={''} />
        )}

        <PdfViewerDrawnElements
          drawnElements={drawnElements}
          activeNet={selElement?.net || ''}
          selElement={selElement}
          engineRef={engineRef}
        />

        <div style={{ flex: 1 }} />
      </div>
    </div>
  );
}