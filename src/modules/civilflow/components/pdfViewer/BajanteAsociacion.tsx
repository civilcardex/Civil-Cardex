
import React from 'react';
import { writeBajantePropToDrawing } from '../../utils/writeDiameterToDrawing';
import { createConnectingRamalIfNeeded } from '../../utils/createConnectingRamal';
const BajanteAsociacion_S1: React.CSSProperties = { flex: 1, padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };


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

  if (!(selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante') && !engineRef.current?._isGhostSel)) {
    return null;
  }

  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a", opacity: 1, pointerEvents: 'auto' }}>
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#849495", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
        Asociación de bajante
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: .5 }}>Origen (piso actual)</div>
          <div style={{ padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#6b8cae", fontSize: 12, fontFamily: "'Geist',monospace" }}>
            {selectedNivel !== null ? pisoLbl(selectedNivel) : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: .5 }}>Destino</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select aria-label="Seleccionar destino de descarga" value={selElement.descargaEnId || ''}
              onChange={e => {
                const v = e.target.value || null;
                if (engineRef.current) {
                  engineRef.current.updateSelected({ descargaEnId: v });
                  setSelElement({ ...selElement, descargaEnId: v });
                  const bKey = `${selElement.id}-${engineRef.current.planId}`;
                  writeBajantePropToDrawing(bKey, selElement.net || 'san', 'descargaEnId', v, planosCtx.plans);

                  if (v) {
                    createConnectingRamalIfNeeded(engineRef.current, selElement.x, selElement.y, selElement.net, v, lowerFloorsRamales);
                  }
                }
              }}
              style={BajanteAsociacion_S1}>
              <option value="">Sin destino</option>
              {lowerFloorsRamales.map(group => {
                const plano = planosCtx.plans.find((pl: any) => pl.id === group.planId);
                const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                const hasBajantes = group.bajantes && group.bajantes.filter((b: any) => b.id !== selElement.id).length > 0;
                return (
                  <optgroup key={group.planId} label={pLabel}>
                    {hasBajantes && group.bajantes.filter((b: any) => b.id !== selElement.id).map((b: any) => (
                      <option key={`${group.planId}|${b.id}`} value={`${group.planId}|${b.id}`}>
                        Bajante: {b.code || b.id}
                      </option>
                    ))}
                    {!hasBajantes && (
                      <option value="" disabled>— Sin elementos disponibles —</option>
                    )}
                  </optgroup>
                );
              })}
            </select>
            {selElement.descargaEnId && (
              <button type="button" onClick={() => {
                if (engineRef.current) {
                  engineRef.current.updateSelected({ descargaEnId: null });
                  setSelElement({ ...selElement, descargaEnId: null });
                  const bKey = `${selElement.id}-${engineRef.current.planId}`;
                  writeBajantePropToDrawing(bKey, selElement.net || 'san', 'descargaEnId', null, planosCtx.plans);
                }
              }}
                style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 12 }}>
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
