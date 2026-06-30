/* eslint-disable react-hooks/refs */
import React from 'react';

interface BajanteAsociacionProps {
  selElement: Record<string, any> | null;
  setSelElement: (el: any) => void;
  selectedNivel: number | null;
  pisoLbl: (n: number) => string;
  lowerFloorsRamales: any[];
  planosCtx: any;
  engineRef: React.RefObject<any>;
}

export default function BajanteAsociacion({
  selElement,
  setSelElement,
  selectedNivel,
  pisoLbl,
  lowerFloorsRamales,
  planosCtx,
  engineRef,
}: BajanteAsociacionProps) {
  // eslint-disable-next-line react-hooks/refs
  if (!(selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante') && !engineRef.current?._isGhostSel)) {
    return null;
  }

  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a", opacity: 1, pointerEvents: 'auto' }}>
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
        Asociación de bajante
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 8, color: '#6b8cae', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: .5 }}>Origen (piso actual)</div>
          <div style={{ padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#6b8cae", fontSize: 10, fontFamily: "'Geist',monospace" }}>
            {selectedNivel !== null ? pisoLbl(selectedNivel) : '—'}
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
                const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
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
  );
}
