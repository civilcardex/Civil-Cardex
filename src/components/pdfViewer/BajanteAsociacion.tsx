
import React from 'react';
import { writeBajantePropToDrawing } from '../../utils/writeDiameterToDrawing';
import { NETS } from '../../lib/PlanoEngine/PlanoState';

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
                  const bKey = `${selElement.id}-${engineRef.current.planId}`;
                  writeBajantePropToDrawing(bKey, selElement.net || 'san', 'descargaEnId', v, planosCtx.plans);

                  if (v) {
                    const oParts = v.split('|');
                    const oPlanId = oParts[0];
                    const oTgtId = oParts[1];
                    const lowerPl = lowerFloorsRamales.find((g: any) => String(g.planId) === String(oPlanId));
                    const targetBaj = lowerPl?.bajantes?.find((b: any) => String(b.id) === String(oTgtId));
                    if (targetBaj) {
                      const dist = Math.hypot(selElement.x - targetBaj.x, selElement.y - targetBaj.y);
                      if (dist > 0.05) {
                        const exists = engineRef.current.ramales.some((r: any) => 
                          (Math.hypot(r.pts[0][0] - selElement.x, r.pts[0][1] - selElement.y) < 0.5 &&
                           Math.hypot(r.pts[r.pts.length - 1][0] - targetBaj.x, r.pts[r.pts.length - 1][1] - targetBaj.y) < 0.5) ||
                          (Math.hypot(r.pts[0][0] - targetBaj.x, r.pts[0][1] - targetBaj.y) < 0.5 &&
                           Math.hypot(r.pts[r.pts.length - 1][0] - selElement.x, r.pts[r.pts.length - 1][1] - selElement.y) < 0.5)
                        );
                        if (!exists) {
                          const net = selElement.net || 'san';
                          const cnt = ++(engineRef.current._netCounts[net]['ramal']);
                          const newRamalId = 'R' + Date.now();
                          const netPfx = NETS.find(n => n.id === net)?.lbl || 'R';
                          const newRamal: any = {
                            id: newRamalId,
                            net,
                            tipo: 'ramal',
                            padre: null,
                            pts: [[selElement.x, selElement.y], [targetBaj.x, targetBaj.y]],
                            totalL: +(engineRef.current.pxToM(dist)).toFixed(3),
                            label: netPfx + cnt,
                            ini: '', fin: '',
                            piso: engineRef.current.nivelActual?.n ?? '',
                            dz: '', uc: 0,
                            labelX: (selElement.x + targetBaj.x) / 2,
                            labelY: (selElement.y + targetBaj.y) / 2,
                            labelAngle: 0,
                            material: '',
                            diametro: '',
                            pendiente: 1.5,
                            bloqueado: true,
                          };
                          engineRef.current.ramales.push(newRamal);
                          engineRef.current._markDirty();
                          engineRef.current.render();
                        }
                      }
                    }
                  }
                }
              }}
              style={{ flex: 1, padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
              <option value="">— Sin destino —</option>
              {lowerFloorsRamales.map(group => {
                const plano = planosCtx.plans.find((pl: any) => pl.id === group.planId);
                const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                const hasRamales = group.ramales && group.ramales.length > 0;
                const hasBajantes = group.bajantes && group.bajantes.filter((b: any) => b.id !== selElement.id).length > 0;
                return (
                  <optgroup key={group.planId} label={pLabel}>
                    {hasRamales && group.ramales.map((r: any) => (
                      <option key={`${group.planId}|${r.id}`} value={`${group.planId}|${r.id}`}>
                        Ramal: {r.label || r.id}
                      </option>
                    ))}
                    {hasBajantes && group.bajantes.filter((b: any) => b.id !== selElement.id).map((b: any) => (
                      <option key={`${group.planId}|${b.id}`} value={`${group.planId}|${b.id}`}>
                        Bajante: {b.code || b.id}
                      </option>
                    ))}
                    {!hasRamales && !hasBajantes && (
                      <option value="" disabled>— Sin elementos disponibles —</option>
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
                  const bKey = `${selElement.id}-${engineRef.current.planId}`;
                  writeBajantePropToDrawing(bKey, selElement.net || 'san', 'descargaEnId', null, planosCtx.plans);
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
