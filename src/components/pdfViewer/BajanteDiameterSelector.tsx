import { memo } from "react";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { pisoLbl, DIAM_BAN, DIAM_VENT } from "../../constants";
import { writeBajantePropToDrawing } from "../../utils/writeDiameterToDrawing";

interface BajanteDiameterSelectorProps {
  bajante: any;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  engineRef: React.MutableRefObject<any>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
  lowerFloorsRamales: any[];
  planosCtx: { plans: any[] };
}

function BajanteDiameterSelector({
  bajante,
  isGhostClick = false,
  selectedNivel,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  lowerFloorsRamales,
  planosCtx,
}: BajanteDiameterSelectorProps) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';

  return (
    <>
      {!isGhostClick ? (
        <>
          <div style={{ display: 'flex', gap: 6, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destino</div>
              <select value={bajante.descargaEnId || ''}
                onChange={e => {
                  const v = e.target.value || null;
                  engineRef.current?.updateElementById(bajante.id, { descargaEnId: v });
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                  if (fresh) setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                  if (selElement?.id === bajante.id) {
                    setSelElement({ ...selElement, descargaEnId: v });
                  }
                  const bKey = `${bajante.id}-${engineRef.current?.planId}`;
                  writeBajantePropToDrawing(bKey, bajante.net || 'san', 'descargaEnId', v, planosCtx.plans);

                  if (v && engineRef.current) {
                    const oParts = v.split('|');
                    const oPlanId = oParts[0];
                    const oTgtId = oParts[1];
                    const lowerPl = lowerFloorsRamales.find((g: any) => String(g.planId) === String(oPlanId));
                    const targetBaj = lowerPl?.bajantes?.find((b: any) => String(b.id) === String(oTgtId));
                    if (targetBaj) {
                      const dist = Math.hypot(bajante.x - targetBaj.x, bajante.y - targetBaj.y);
                      if (dist > 0.05) {
                        const exists = engineRef.current.ramales.some((r: any) => 
                          (Math.hypot(r.pts[0][0] - bajante.x, r.pts[0][1] - bajante.y) < 0.5 &&
                           Math.hypot(r.pts[r.pts.length - 1][0] - targetBaj.x, r.pts[r.pts.length - 1][1] - targetBaj.y) < 0.5) ||
                          (Math.hypot(r.pts[0][0] - targetBaj.x, r.pts[0][1] - targetBaj.y) < 0.5 &&
                           Math.hypot(r.pts[r.pts.length - 1][0] - bajante.x, r.pts[r.pts.length - 1][1] - bajante.y) < 0.5)
                        );
                        if (!exists) {
                          const net = bajante.net || 'san';
                          const cnt = ++(engineRef.current._netCounts[net]['ramal']);
                          const newRamalId = 'R' + Date.now();
                          const netPfx = NETS.find(n => n.id === net)?.lbl || 'R';
                          const newRamal: any = {
                            id: newRamalId,
                            net,
                            tipo: 'ramal',
                            padre: null,
                            pts: [[bajante.x, bajante.y], [targetBaj.x, targetBaj.y]],
                            totalL: +(engineRef.current.pxToM(dist)).toFixed(3),
                            label: netPfx + cnt,
                            ini: '', fin: '',
                            piso: engineRef.current.nivelActual?.n ?? '',
                            dz: '', uc: 0,
                            labelX: (bajante.x + targetBaj.x) / 2,
                            labelY: (bajante.y + targetBaj.y) / 2,
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
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                <option value="">— Sin destino —</option>
                {lowerFloorsRamales.map(group => {
                  const plano = planosCtx.plans.find((pl: any) => pl.id === group.planId);
                  const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                  const hasRamales = group.ramales && group.ramales.length > 0;
                  const hasBajantes = group.bajantes && group.bajantes.filter((b: any) => b.id !== bajante.id).length > 0;
                  return (
                    <optgroup key={group.planId} label={pLabel}>
                      {hasRamales && group.ramales.map((r: any) => (
                        <option key={`${group.planId}|${r.id}`} value={`${group.planId}|${r.id}`}>
                          Ramal: {r.label || r.id}
                        </option>
                      ))}
                      {hasBajantes && group.bajantes.filter((b: any) => b.id !== bajante.id).map((b: any) => (
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
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Diámetro</div>
              <select value={(() => {
                const dIsGhost = isGhostClick || false;
                const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                const gd = bajante.ghostData?.[dGhostLabel];
                return dIsGhost ? (gd && gd.dNominal !== undefined ? gd.dNominal : (bajante.dNominal || '')) : (bajante.dNominal || '');
              })()}
                onChange={e => {
                  const val = e.target.value;
                  const dIsGhost = isGhostClick || false;
                  if (dIsGhost && engineRef.current) {
                    const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                    const gd2 = { ...(bajante.ghostData || {}) };
                    const cd = { ...(gd2[dGhostLabel] || {}) };
                    cd.dNominal = val;
                    gd2[dGhostLabel] = cd;
                    const fields = { ghostData: gd2 };
                    engineRef.current?.updateElementById(bajante.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                      if (selElement?.id === bajante.id) {
                        setSelElement({ ...selElement, ghostData: fields.ghostData });
                      }
                    }
                  } else {
                    const fields = { dNominal: val };
                    engineRef.current?.updateElementById(bajante.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                      if (selElement?.id === bajante.id) {
                        setSelElement({ ...selElement, dNominal: fields.dNominal });
                      }
                    }
                  }
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                <option value="">—</option>
                {(bajante.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
                  <option key={d.pulg} value={d.nom}>{d.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 8px 4px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Llenado (R)</div>
              <select value={bajante.bajR != null ? (Math.abs(bajante.bajR - 7 / 24) < 0.001 ? '7/24' : '1/4') : '7/24'}
                onChange={e => {
                  const val = e.target.value;
                  const valNum = val === '7/24' ? 7 / 24 : 0.25;
                  engineRef.current?.updateElementById(bajante.id, { bajR: valNum });
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                  if (fresh) setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                  if (selElement?.id === bajante.id) {
                    setSelElement({ ...selElement, bajR: valNum });
                  }
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                <option value="7/24">7/24</option>
                <option value="1/4">1/4</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Área asociada</div>
              <select value={bajante.area_m2 || ''}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  engineRef.current?.updateElementById(bajante.id, { area_m2: val });
                  setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, area_m2: val } } : null);
                  if (selElement?.id === bajante.id) {
                    setSelElement({ ...selElement, area_m2: val });
                  }
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                <option value="">— Sin área —</option>
                {/* eslint-disable-next-line react-hooks/refs */}
                {(engineRef.current?.areas || []).filter((a: any) => a.net === bajante.net).map((a: any) => (
                  <option key={a.id} value={a.areaM2}>{a.label} · {a.areaM2} m²</option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 4, padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
          <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Diámetro</div>
          <select value={(() => {
            const gd = bajante.ghostData?.[currentGhostLabel];
            return isGhostClick ? (gd && gd.dNominal !== undefined ? gd.dNominal : (bajante.dNominal || '')) : (bajante.dNominal || '');
          })()}
            onChange={e => {
              const val = e.target.value;
              if (engineRef.current) {
                const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                if (isGhostClick) {
                  const gd2 = { ...(bajante.ghostData || {}) };
                  const cd = { ...(gd2[dGhostLabel] || {}) };
                  cd.dNominal = val;
                  gd2[dGhostLabel] = cd;
                  const fields = { ghostData: gd2 };
                  engineRef.current?.updateElementById(bajante.id, fields);
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                  if (fresh) {
                    setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                    if (selElement?.id === bajante.id) {
                      setSelElement({ ...selElement, ghostData: fields.ghostData });
                    }
                  }
                } else {
                  const fields = { dNominal: val };
                  engineRef.current?.updateElementById(bajante.id, fields);
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                  if (fresh) {
                    setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                    if (selElement?.id === bajante.id) {
                      setSelElement({ ...selElement, dNominal: fields.dNominal });
                    }
                  }
                }
              }
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">—</option>
            {(bajante.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
              <option key={d.pulg} value={d.nom}>{d.nom}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

export default memo(BajanteDiameterSelector);
