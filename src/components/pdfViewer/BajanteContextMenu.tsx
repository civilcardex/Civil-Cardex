/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from "react";
import PlanoEngine from "../../lib/PlanoEngine/PlanoEngine";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { DIAM_BAN, DIAM_VENT, DIAM_BY_MAT, pisoLbl } from "../../constants";
import { GAS } from "../../constants/engineeringDataGas";
import { VENTILACION, CONTADORES as CONTADORES_CAT } from "../../pages/catalog/catalogData";
import { DIAMETROS_AF } from "../../constants/hydraulicData";
import { writeAcoDiamToDrawing, writeContadorDiamToDrawing, writeBajantePropToDrawing } from "../../utils/writeDiameterToDrawing";
import { CAT_GAS } from "../../constants/engineeringDataGas";

const GAS_DN_LABELS: string[] = [];
for (const g of GAS) for (const r of g.rows) if (!GAS_DN_LABELS.includes(r.dn)) GAS_DN_LABELS.push(r.dn);

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  bajante: any;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
}

interface LowerFloorRamales {
  planId: string;
  planName: string;
  npt: number;
  ramales: any[];
}

interface BajanteContextMenuProps {
  contextMenuState: ContextMenuState | null;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  selectedNivel: number | null;
  pisos: any[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  lowerFloorsRamales: LowerFloorRamales[];
  planosCtx: { plans: any[] };
  mats: Record<string, any[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function BajanteContextMenu({
  contextMenuState,
  setContextMenuState,
  selectedNivel,
  pisos,
  engineRef,
  selElement,
  setSelElement,
  lowerFloorsRamales,
  planosCtx,
  mats,
  activeNet,
  setDiamSel,
}: BajanteContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x: contextMenuState?.x || 0, y: contextMenuState?.y || 0 });

  useEffect(() => {
    const el = menuRef.current;
    if (!el || !contextMenuState) return;
    const parentEl = el.offsetParent;
    if (!parentEl) return;
    const parentRect = parentEl.getBoundingClientRect();
    const menuRect = el.getBoundingClientRect();
    
    let newX = contextMenuState.x - parentRect.left;
    let newY = contextMenuState.y - parentRect.top;

    if (contextMenuState.x + menuRect.width + 10 > window.innerWidth) {
      newX = newX - menuRect.width - 5;
    } else {
      newX = newX + 5;
    }

    if (contextMenuState.y + menuRect.height + 10 > window.innerHeight) {
      newY = newY - menuRect.height - 5;
    } else {
      newY = newY + 5;
    }

    if (newX < 10) newX = 10;
    if (newY < 10) newY = 10;
    if (newX + menuRect.width > parentRect.width - 10) {
      newX = parentRect.width - menuRect.width - 10;
    }
    if (newY + menuRect.height > parentRect.height - 10) {
      newY = parentRect.height - menuRect.height - 10;
    }

    setAdjustedPos({ x: newX, y: newY });
  }, [contextMenuState?.x, contextMenuState?.y, contextMenuState?.visible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenuState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setContextMenuState]);

  if (!contextMenuState || !contextMenuState.visible) return null;

  const isBajanteTipo = contextMenuState.bajante.tipo === 'bajante' ||
    contextMenuState.bajante.tipo === 'montante' ||
    contextMenuState.bajante.id?.startsWith('B');

  const isArea = contextMenuState.bajante.id?.startsWith('AR');
  const hasPts = !!contextMenuState.bajante.pts;

  return (
    <>
      <div role="presentation" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100
      }} onClick={() => setContextMenuState(null)} onContextMenu={(e) => e.preventDefault()} />
      <div ref={menuRef} role="dialog" aria-label="Menú contextual de elemento" style={{
        position: 'absolute', left: adjustedPos.x, top: adjustedPos.y, zIndex: 101,
        background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: '4px', minWidth: 180, maxWidth: 320,
        display: 'flex', flexDirection: 'column', gap: 2,
      }} onContextMenu={(e) => e.preventDefault()}>
        {isBajanteTipo && !contextMenuState.bajante.pts ? (
          <>
            {(() => {
              const isGhost = contextMenuState.isGhostClick || false;
              const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
              const gd = contextMenuState.bajante.ghostData?.[currentGhostLabel];
              const ghostDir = isGhost ? (gd && gd.direccion !== undefined ? gd.direccion : contextMenuState.bajante.direccion) : contextMenuState.bajante.direccion;

              // eslint-disable-next-line react-hooks/refs
              const updateGhostField = (field: string, val: string) => {
                if (!engineRef.current) return;
                const gd = { ...(contextMenuState.bajante.ghostData || {}) };
                const cd = { ...(gd[currentGhostLabel] || {}) };
                (cd as any)[field] = val;
                gd[currentGhostLabel] = cd;
                engineRef.current?.updateElementById(contextMenuState.bajante.id, { ghostData: gd });
                const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                if (fresh) {
                  setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                  if (selElement?.id === contextMenuState.bajante.id) {
                    setSelElement({ ...selElement, ghostData: gd });
                  }
                }
              };

              return (<>
                <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Dirección de flujo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '0 8px 4px' }}>
                  {(isGhost ? ['Sube', 'Baja', 'Continua'] : ['Sube', 'Baja', 'Continua', 'Desplazamiento']).map(opt => {
                    const isActive = opt === 'Desplazamiento'
                      ? (!ghostDir && !!(contextMenuState.bajante.desplazamientos && contextMenuState.bajante.desplazamientos[currentGhostLabel]))
                      : (ghostDir === opt.toLowerCase());
                    return (
                      <button
                        key={opt}
                        onClick={() => {
                          if (engineRef.current) {
                            if (isGhost && opt !== 'Desplazamiento') {
                              updateGhostField('direccion', opt.toLowerCase());
                              engineRef.current?.render();
                              return;
                            }
                            const currentNpt = pisos.find(p => p.n === selectedNivel)?.npt || 0;
                            const allNpts = pisos.map(p => p.npt).sort((a, b) => a - b);
                            const maxNpt = allNpts[allNpts.length - 1] || 0;
                            const minNpt = allNpts[0] || 0;
                            let updates: any = {};

                            if (opt === 'Sube') {
                              const currentDesp = { ...(contextMenuState.bajante.desplazamientos || {}) };
                              updates = { direccion: 'sube', nptBase: currentNpt, nptCima: maxNpt, desplazamientos: currentDesp };
                            } else if (opt === 'Baja') {
                              const currentDesp = { ...(contextMenuState.bajante.desplazamientos || {}) };
                              updates = { direccion: 'baja', nptBase: minNpt, nptCima: currentNpt, desplazamientos: currentDesp };
                            } else if (opt === 'Continua') {
                              const currentDesp = { ...(contextMenuState.bajante.desplazamientos || {}) };
                              updates = { direccion: 'continua', desplazamientos: currentDesp };
                            } else if (opt === 'Desplazamiento') {
                              const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                              if (lvl) {
                                const currentDesp = contextMenuState.bajante.desplazamientos || {};
                                updates = {
                                  direccion: undefined,
                                  desplazamientos: {
                                    ...currentDesp,
                                    [lvl]: {
                                      dx: currentDesp[lvl]?.dx ?? 2,
                                      dy: currentDesp[lvl]?.dy ?? 0,
                                      Ldesvio: currentDesp[lvl]?.Ldesvio
                                    }
                                  }
                                };
                              }
                            }
                            if (Object.keys(updates).length > 0) {
                              engineRef.current?.updateElementById(contextMenuState.bajante.id, updates);
                              const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                              if (fresh) {
                                setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                              }
                              if (selElement?.id === contextMenuState.bajante.id) {
                                setSelElement({ ...selElement, ...updates });
                              }
                            }
                          }
                        }}
                        style={{
                          background: isActive ? 'rgba(37,99,235,0.15)' : '#1e2024',
                          border: `1px solid ${isActive ? '#2563eb' : '#3a494a'}`,
                          color: isActive ? '#3b82f6' : '#e2e2e8',
                          padding: '6px 8px',
                          textAlign: 'left', fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer',
                          borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6,
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) e.currentTarget.style.background = '#2563eb33';
                        }}
                        onMouseLeave={e => {
                          if (!isActive) e.currentTarget.style.background = '#1e2024';
                        }}
                      >
                        <div style={{ color: opt === 'Sube' ? '#00dce5' : opt === 'Baja' ? '#F04545' : '#FFEB3B' }}>
                          {opt === 'Sube' ? '⬆' : opt === 'Baja' ? '⬇' : opt === 'Continua' ? '➜' : '➡'}
                        </div>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </>);
            })()}

            {!contextMenuState.isGhostClick && (
              <button
                onClick={() => {
                  if (engineRef.current) {
                    const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                    const isFantasma = contextMenuState.bajante.isFantasma;
                    const updates: any = { isFantasma: !isFantasma };
                    if (!isFantasma && lvl) {
                      const currentDesp = { ...(contextMenuState.bajante.desplazamientos || {}) };
                      if (!currentDesp[lvl]) {
                        currentDesp[lvl] = { dx: 2, dy: 0 };
                        updates.desplazamientos = currentDesp;
                      }
                    }
                    engineRef.current?.updateElementById(contextMenuState.bajante.id, updates);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                    if (fresh) {
                      setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                    }
                    engineRef.current?.render();
                  }
                }}
                style={{
                  background: 'transparent', border: 'none', color: '#e2e2e8', padding: '6px 8px',
                  textAlign: 'left', fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer',
                  borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6,
                  marginTop: 4, borderTop: '1px solid #3a494a'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#2563eb33'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {contextMenuState.bajante.isFantasma ? 'Desactivar desplazamiento del bajante' : 'Activar desplazamiento del bajante'}
              </button>
            )}

            {!contextMenuState.isGhostClick ? (
              <>
                <div style={{ display: 'flex', gap: 6, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destino</div>
                    <select value={contextMenuState.bajante.descargaEnId || ''}
                      onChange={e => {
                        const v = e.target.value || null;
                        engineRef.current?.updateElementById(contextMenuState.bajante.id, { descargaEnId: v });
                        const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                        if (fresh) setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                        if (selElement?.id === contextMenuState.bajante.id) {
                          setSelElement({ ...selElement, descargaEnId: v });
                        }
                        const bKey = `${contextMenuState.bajante.id}-${engineRef.current?.planId}`;
                        writeBajantePropToDrawing(bKey, contextMenuState.bajante.net || 'san', 'descargaEnId', v, planosCtx.plans);

                        if (v && engineRef.current) {
                          const oParts = v.split('|');
                          const oPlanId = oParts[0];
                          const oTgtId = oParts[1];
                          const lowerPl = lowerFloorsRamales.find((g: any) => String(g.planId) === String(oPlanId));
                          const targetBaj = lowerPl?.bajantes?.find((b: any) => String(b.id) === String(oTgtId));
                          if (targetBaj) {
                            const dist = Math.hypot(contextMenuState.bajante.x - targetBaj.x, contextMenuState.bajante.y - targetBaj.y);
                            if (dist > 0.05) {
                              const exists = engineRef.current.ramales.some((r: any) => 
                                (Math.hypot(r.pts[0][0] - contextMenuState.bajante.x, r.pts[0][1] - contextMenuState.bajante.y) < 0.5 &&
                                 Math.hypot(r.pts[r.pts.length - 1][0] - targetBaj.x, r.pts[r.pts.length - 1][1] - targetBaj.y) < 0.5) ||
                                (Math.hypot(r.pts[0][0] - targetBaj.x, r.pts[0][1] - targetBaj.y) < 0.5 &&
                                 Math.hypot(r.pts[r.pts.length - 1][0] - contextMenuState.bajante.x, r.pts[r.pts.length - 1][1] - contextMenuState.bajante.y) < 0.5)
                              );
                              if (!exists) {
                                const net = contextMenuState.bajante.net || 'san';
                                const cnt = ++(engineRef.current._netCounts[net]['ramal']);
                                const newRamalId = 'R' + Date.now();
                                const netPfx = NETS.find(n => n.id === net)?.lbl || 'R';
                                const newRamal: any = {
                                  id: newRamalId,
                                  net,
                                  tipo: 'ramal',
                                  padre: null,
                                  pts: [[contextMenuState.bajante.x, contextMenuState.bajante.y], [targetBaj.x, targetBaj.y]],
                                  totalL: +(engineRef.current.pxToM(dist)).toFixed(3),
                                  label: netPfx + cnt,
                                  ini: '', fin: '',
                                  piso: engineRef.current.nivelActual?.n ?? '',
                                  dz: '', uc: 0,
                                  labelX: (contextMenuState.bajante.x + targetBaj.x) / 2,
                                  labelY: (contextMenuState.bajante.y + targetBaj.y) / 2,
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
                        const hasBajantes = group.bajantes && group.bajantes.filter((b: any) => b.id !== contextMenuState.bajante.id).length > 0;
                        return (
                          <optgroup key={group.planId} label={pLabel}>
                            {hasRamales && group.ramales.map((r: any) => (
                              <option key={`${group.planId}|${r.id}`} value={`${group.planId}|${r.id}`}>
                                Ramal: {r.label || r.id}
                              </option>
                            ))}
                            {hasBajantes && group.bajantes.filter((b: any) => b.id !== contextMenuState.bajante.id).map((b: any) => (
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
                      const dIsGhost = contextMenuState.isGhostClick || false;
                      const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                      const gd = contextMenuState.bajante.ghostData?.[dGhostLabel];
                      return dIsGhost ? (gd && gd.dNominal !== undefined ? gd.dNominal : (contextMenuState.bajante.dNominal || '')) : (contextMenuState.bajante.dNominal || '');
                    })()}
                      onChange={e => {
                        const val = e.target.value;
                        const dIsGhost = contextMenuState.isGhostClick || false;
                        if (dIsGhost && engineRef.current) {
                          const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                          const gd2 = { ...(contextMenuState.bajante.ghostData || {}) };
                          const cd = { ...(gd2[dGhostLabel] || {}) };
                          cd.dNominal = val;
                          gd2[dGhostLabel] = cd;
                          const fields = { ghostData: gd2 };
                          engineRef.current?.updateElementById(contextMenuState.bajante.id, fields);
                          const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                          if (fresh) {
                            setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                            if (selElement?.id === contextMenuState.bajante.id) {
                              setSelElement({ ...selElement, ghostData: fields.ghostData });
                            }
                          }
                        } else {
                          const fields = { dNominal: val };
                          engineRef.current?.updateElementById(contextMenuState.bajante.id, fields);
                          const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                          if (fresh) {
                            setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                            if (selElement?.id === contextMenuState.bajante.id) {
                              setSelElement({ ...selElement, dNominal: fields.dNominal });
                            }
                          }
                        }
                      }}
                      style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                      <option value="">—</option>
                      {(contextMenuState.bajante.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
                        <option key={d.pulg} value={d.nom}>{d.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, padding: '0 8px 4px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Llenado (R)</div>
                    <select value={contextMenuState.bajante.bajR != null ? (Math.abs(contextMenuState.bajante.bajR - 7 / 24) < 0.001 ? '7/24' : '1/4') : '7/24'}
                      onChange={e => {
                        const val = e.target.value;
                        const valNum = val === '7/24' ? 7 / 24 : 0.25;
                        engineRef.current?.updateElementById(contextMenuState.bajante.id, { bajR: valNum });
                        const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                        if (fresh) setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                        if (selElement?.id === contextMenuState.bajante.id) {
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
                    <select value={contextMenuState.bajante.area_m2 || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        engineRef.current?.updateElementById(contextMenuState.bajante.id, { area_m2: val });
                        setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, area_m2: val } } : null);
                        if (selElement?.id === contextMenuState.bajante.id) {
                          setSelElement({ ...selElement, area_m2: val });
                        }
                      }}
                      style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                      <option value="">— Sin área —</option>
                      {/* eslint-disable-next-line react-hooks/refs */}
                      {(engineRef.current?.areas || []).filter((a: any) => a.net === contextMenuState.bajante.net).map((a: any) => (
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
                  const dIsGhost = contextMenuState.isGhostClick || false;
                  const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                  const gd = contextMenuState.bajante.ghostData?.[dGhostLabel];
                  return dIsGhost ? (gd && gd.dNominal !== undefined ? gd.dNominal : (contextMenuState.bajante.dNominal || '')) : (contextMenuState.bajante.dNominal || '');
                })()}
                  onChange={e => {
                    const val = e.target.value;
                    const dIsGhost = contextMenuState.isGhostClick || false;
                    if (dIsGhost && engineRef.current) {
                      const dGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                      const gd2 = { ...(contextMenuState.bajante.ghostData || {}) };
                      const cd = { ...(gd2[dGhostLabel] || {}) };
                      cd.dNominal = val;
                      gd2[dGhostLabel] = cd;
                      const fields = { ghostData: gd2 };
                      engineRef.current?.updateElementById(contextMenuState.bajante.id, fields);
                      const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                      if (fresh) {
                        setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                        if (selElement?.id === contextMenuState.bajante.id) {
                          setSelElement({ ...selElement, ghostData: fields.ghostData });
                        }
                      }
                    } else {
                      const fields = { dNominal: val };
                      engineRef.current?.updateElementById(contextMenuState.bajante.id, fields);
                      const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                      if (fresh) {
                        setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                        if (selElement?.id === contextMenuState.bajante.id) {
                          setSelElement({ ...selElement, dNominal: fields.dNominal });
                        }
                      }
                    }
                  }}
                  style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                  <option value="">—</option>
                  {(contextMenuState.bajante.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
                    <option key={d.pulg} value={d.nom}>{d.nom}</option>
                  ))}
                </select>
              </div>
            )}

            {!contextMenuState.isGhostClick && ['san', 'll'].includes(activeNet) && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '4px 8px',
                borderTop: '1px solid #3a494a',
                marginTop: 4
              }}>
                <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ramales asociados</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
                  {(() => {
                    // eslint-disable-next-line react-hooks/refs
                    const bajRamales = (engineRef.current?.ramales || []).filter((r: any) => r.net === activeNet && r.tipo !== 'tributario');
                    if (bajRamales.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin ramales</div>;
                    const recibidos = (contextMenuState.bajante.recibeDeIds || []);
                    return bajRamales.map((r: any) => (
                      <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                        <input type="checkbox" checked={recibidos.includes(r.id)}
                          onChange={e => {
                            const newRecibe = e.target.checked
                              ? [...recibidos, r.id]
                              : recibidos.filter((id: string) => id !== r.id);
                            engineRef.current?.updateElementById(contextMenuState.bajante.id, { recibeDeIds: newRecibe });
                            setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, recibeDeIds: newRecibe } } : null);
                            if (selElement?.id === contextMenuState.bajante.id) {
                              setSelElement({ ...selElement, recibeDeIds: newRecibe });
                            }
                          }}
                          style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                      </label>
                    ));
                  })()}
                </div>
              </div>
            )}

            {!contextMenuState.isGhostClick && ['san', 'll'].includes(activeNet) && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4
              }}>
                <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
                  {(() => {
                    const netBajantes = (engineRef.current?.bajantes || []).filter((b: any) => b.net === contextMenuState.bajante.net && b.id !== contextMenuState.bajante.id && b.tipo !== 'tributario');
                    if (netBajantes.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
                    const currentId = contextMenuState.bajante.id;
                    return netBajantes.map((b: any) => {
                      const isAssociated = (contextMenuState.bajante.recibeDeIds || []).includes(b.id);
                      return (
                        <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                          <input type="checkbox" checked={isAssociated}
                            onChange={e => {
                              const recibidos = contextMenuState.bajante.recibeDeIds || [];
                              const newRecibe = e.target.checked
                                ? [...recibidos, b.id]
                                : recibidos.filter((id: string) => id !== b.id);
                              engineRef.current?.updateElementById(currentId, { recibeDeIds: newRecibe });
                              const fresh = engineRef.current?.bajantes.find((x: any) => x.id === currentId);
                              if (fresh) setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                              if (selElement?.id === currentId) {
                                setSelElement({ ...selElement, recibeDeIds: newRecibe });
                              }
                              engineRef.current?.render();
                            }}
                            style={{ accentColor: '#2563eb', margin: 0, flexShrink: 0 }} />
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.code || b.id}>{b.code || b.id}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </>
        ) : isArea ? (
          <>
            <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Asociar Bajante
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <select
                // eslint-disable-next-line react-hooks/refs
                value={(engineRef.current?.bajantes || []).find((b: any) => b.area_m2 === contextMenuState.bajante.areaM2)?.id || ''}
                onChange={e => {
                  const bajanteId = e.target.value;
                  (engineRef.current?.bajantes || []).forEach((b: any) => {
                    if (b.area_m2 === contextMenuState.bajante.areaM2) {
                      engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                    }
                  });
                  if (bajanteId) {
                    engineRef.current?.updateElementById(bajanteId, { area_m2: contextMenuState.bajante.areaM2 });
                  }
                  engineRef.current?.render();
                  setContextMenuState(null);
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                <option value="">— Sin bajante —</option>
                {/* eslint-disable-next-line react-hooks/refs */}
                {(engineRef.current?.bajantes || []).filter((b: any) => b.net === contextMenuState.bajante.net).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.code || b.id}</option>
                ))}
              </select>
            </div>
          </>
        ) : hasPts ? (
          <>
            {contextMenuState.ramalEndpoint && (() => {
              const supNets = ['san', 'll', 'vent', 'af', 'ac', 'gas', 'rci', 'rec'];
              if (!supNets.includes(contextMenuState.bajante.net)) return null;
              const ep = contextMenuState.ramalEndpoint;

              if (contextMenuState.bajante.tipo === 'tributario' && contextMenuState.bajante.net === 'san') {
                const isStart = ep.idx === 0;
                const fieldAcc = isStart ? 'accesorioInicio' : 'accesorioFin';
                const fieldDiam = isStart ? 'diametroInicio' : 'diametroFin';
                
                const currentAcc = contextMenuState.bajante[fieldAcc] || '';
                const currentDiam = contextMenuState.bajante[fieldDiam] || contextMenuState.bajante.diametro || '';
                
                const matList = mats?.[contextMenuState.bajante.net] || [];
                const matShort = contextMenuState.bajante.material || matList[0]?.val || '—';
                const diamList = DIAM_BY_MAT[matShort] || [];

                return (
                  <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid #3a494a', marginBottom: 4 }}>
                    <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Extremo {isStart ? 'Inicio (Aparato)' : 'Fin (Ramal)'}
                    </div>
                    
                    <div>
                      <div style={{ fontSize: 9, color: '#849495', marginBottom: 2 }}>Seleccionar Accesorio</div>
                      <select
                        value={currentAcc}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (engineRef.current) {
                            const updates: any = { [fieldAcc]: val };
                            if (val && !contextMenuState.bajante[fieldDiam]) {
                              updates[fieldDiam] = contextMenuState.bajante.diametro || '';
                            }
                            engineRef.current.updateElementById(contextMenuState.bajante.id, updates);
                            setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, ...updates } } : null);
                            if (selElement?.id === contextMenuState.bajante.id) {
                              setSelElement({ ...selElement, ...updates });
                            }
                            engineRef.current.render();
                            engineRef.current._markDirty();
                          }
                        }}
                        style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                      >
                        <option value="">Ninguno</option>
                        <option value="sifon">🧼 Sifón</option>
                        <option value="codoSube">🔩 Codo Sube</option>
                        <option value="codoBaja">🔩 Codo Baja</option>
                        <option value="codoReventilado">🔩 Codo reventilado</option>
                      </select>
                    </div>

                    {currentAcc && (
                      <div>
                        <div style={{ fontSize: 9, color: '#849495', marginBottom: 2 }}>Diámetro de Accesorio</div>
                        <select
                          value={currentDiam ? currentDiam.split(' — ')[0].trim() : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (engineRef.current) {
                              const updates = { [fieldDiam]: val };
                              engineRef.current.updateElementById(contextMenuState.bajante.id, updates);
                              setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, ...updates } } : null);
                              if (selElement?.id === contextMenuState.bajante.id) {
                                setSelElement({ ...selElement, ...updates });
                              }
                              engineRef.current.render();
                              engineRef.current._markDirty();
                            }
                          }}
                          style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                        >
                          <option value="">Usar diámetro de red</option>
                          {diamList.map((d: any) => {
                            const valClean = d.n.split(' — ')[0].trim();
                            return <option key={d.n} value={valClean}>{valClean}</option>;
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                );
              }

              const netDef = NETS.find((n: any) => n.id === contextMenuState.bajante.net);
              const bmLabel = netDef?.bmType === 'bajante' ? 'bajante' : 'montante';
              return (
                <div style={{ padding: '4px 8px' }}>
                  <button onClick={() => {
                    const eng = engineRef.current;
                    if (!eng) return;
                    const isMon = bmLabel === 'montante';
                    const pfx = netDef?.bmPfx || (isMon ? 'MON' : 'B');
                    const cnt = eng.bajantes.filter((b: any) => b.tipo === bmLabel && (!isMon || b.net === contextMenuState.bajante.net)).length + 1;
                    const id = isMon ? `${pfx}${cnt}_${contextMenuState.bajante.net}` : (pfx + cnt);
                    const code = isMon ? `${pfx}${cnt}` : id;
                    const nl = eng.nivelActual;
                    eng.bajantes.push({
                      id, net: contextMenuState.bajante.net,
                      tipo: bmLabel,
                      code: code,
                      direccion: bmLabel === 'bajante' ? 'baja' : 'sube',
                      x: ep.x, y: ep.y,
                      pisoBase: nl?.label ?? '',
                      pisoCima: nl?.label ?? '',
                      nptBase: nl?.npt ?? 0,
                      nptCima: nl?.npt ?? 0,
                      hVert: 0,
                      dNominal: '0', recibeDeIds: [contextMenuState.bajante.id], alimentaIds: [], descargaEnId: null,
                      ucAcum: 0, ucExtra: 0, area_m2: 0,
                      desplazamientos: {},
                      lblOffX: 0, lblOffY: 0, labelAngle: 0,
                      labelX: ep.x, labelY: ep.y + 20,
                      bajR: 7 / 24,
                    });
                    if (bmLabel === 'montante') {
                      eng._renumberMontantes();
                    } else {
                      eng._renumberBajantes(contextMenuState.bajante.net);
                    }
                    const newlyCreated = eng.bajantes.find(b => b.tipo === bmLabel && b.x === ep.x && b.y === ep.y);
                    if (newlyCreated) {
                      eng.selId = newlyCreated.id;
                      eng._emitSelect(newlyCreated);
                    }
                    eng._isGhostSel = false;
                    eng.render();
                    eng._markDirty();
                    setContextMenuState(null);
                  }} style={{
                    width: '100%', padding: '6px 8px', cursor: 'pointer',
                    background: '#1e2024', border: '1px dashed #00dce5', borderRadius: 4,
                    color: '#00dce5', fontSize: 11, fontFamily: "'Geist',monospace",
                    textAlign: 'center', fontWeight: 600,
                  }}>+ Crear {bmLabel}</button>
                </div>
              );
            })()}
            <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Diámetro de ramal
            </div>
            {(() => {
              const isGas = contextMenuState.bajante.net === 'gas';
              const isVen = contextMenuState.bajante.net === 'vent';
              const matList = mats?.[contextMenuState.bajante.net] || [];
              const matShort = contextMenuState.bajante.material || matList[0]?.val || '—';
              let diamList: any[] = [];
              if (isVen) {
                diamList = VENTILACION[0]?.rows.map((r: any) => ({ n: r.dn })) || [];
              } else if (isGas) {
                diamList = GAS[0]?.rows.map(r => ({ n: r.dn })) || [];
              } else {
                diamList = DIAM_BY_MAT[matShort] || [];
              }

              return (
                <div style={{ padding: '0 8px 8px' }}>
                  <select
                    value={contextMenuState.bajante.diametro ? contextMenuState.bajante.diametro.split(' — ')[0].trim() : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (engineRef.current) {
                        engineRef.current?.updateElementById(contextMenuState.bajante.id, { diametro: val });
                        setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, diametro: val } } : null);
                        if (selElement?.id === contextMenuState.bajante.id) {
                          setSelElement({ ...selElement, diametro: val });
                        }
                        if (activeNet === contextMenuState.bajante.net) {
                          setDiamSel(prev => ({ ...prev, [activeNet]: val }));
                        }
                        engineRef.current?.render();
                      }
                    }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                  >
                    <option value="">— Sin diámetro —</option>
                    {diamList.map((d: any) => {
                      const valClean = d.n.split(' — ')[0].trim();
                      return <option key={d.n} value={valClean}>{valClean}{isGas ? '"' : ''}</option>;
                    })}
                  </select>
                </div>
              );
            })()}

            <div style={{
              padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: 10, color: '#e2e2e8', fontFamily: "'Geist',monospace" }}>🔒 Bloquear movimiento</span>
              <input type="checkbox" checked={!!contextMenuState.bajante.bloqueado}
                onChange={e => {
                  const val = e.target.checked;
                  if (engineRef.current) {
                    engineRef.current?.updateElementById(contextMenuState.bajante.id, { bloqueado: val });
                    setContextMenuState(prev => prev ? { ...prev, bajante: { ...prev.bajante, bloqueado: val } } : null);
                    if (selElement?.id === contextMenuState.bajante.id) {
                      setSelElement({ ...selElement, bloqueado: val });
                    }
                    engineRef.current?.render();
                  }
                }}
                style={{ accentColor: '#F5A623', cursor: 'pointer', margin: 0 }} />
            </div>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4
            }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
                {(() => {
                  const netBajantes = (engineRef.current?.bajantes || []).filter((b: any) => b.net === contextMenuState.bajante.net && b.id !== contextMenuState.bajante.id && b.tipo !== 'tributario');
                  if (netBajantes.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
                  const currentId = contextMenuState.bajante.id;
                  return netBajantes.map((b: any) => {
                    const isAssociated = (b.recibeDeIds || []).includes(currentId);
                    return (
                      <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                        <input type="checkbox" checked={isAssociated}
                          onChange={e => {
                            const recibidos = b.recibeDeIds || [];
                            const newRecibe = e.target.checked
                              ? [...recibidos, currentId]
                              : recibidos.filter((id: string) => id !== currentId);
                            const extraFields: Record<string, any> = { recibeDeIds: newRecibe };
                            if (e.target.checked) {
                              extraFields.descargaEnId = currentId;
                            } else if (b.descargaEnId === currentId || b.descargaEnId?.endsWith('|' + currentId)) {
                              extraFields.descargaEnId = null;
                            }
                            engineRef.current?.updateElementById(b.id, extraFields);
                            setContextMenuState(prev => prev ? { ...prev } : null);
                            if (selElement?.id === b.id) {
                              setSelElement({ ...selElement, ...extraFields });
                            }
                          }}
                          style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.code || b.label || b.id}</span>
                      </label>
                    );
                  });
                })()}
              </div>
            </div>
          </>
        ) : contextMenuState.bajante.tipo === 'contador' ? (
          <>
            <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Contador: {contextMenuState.bajante.code || contextMenuState.bajante.id}
            </div>
            <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Diámetro del Contador
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <select
                value={contextMenuState.bajante.dNominal ? contextMenuState.bajante.dNominal.replace(/"/g, '').trim() : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const dNom = val ? `${val}"` : '';
                  if (engineRef.current) {
                    const fields = { dNominal: dNom };
                    engineRef.current?.updateElementById(contextMenuState.bajante.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                    if (fresh) {
                      setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                      if (selElement?.id === contextMenuState.bajante.id) {
                        setSelElement({ ...selElement, dNominal: fields.dNominal });
                      }
                    }
                    engineRef.current?.render();
                    // Persist to localStorage for design table to read
                    writeContadorDiamToDrawing(dNom, planosCtx.plans, contextMenuState.bajante.net || 'af');
                  }
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
              >
                <option value="">— Sin diámetro —</option>
                {CONTADORES_CAT.map((c: any) => (
                  <option key={c.dn} value={c.dn}>{c.dn}"</option>
                ))}
              </select>
            </div>
            {contextMenuState.bajante.net === 'af' || contextMenuState.bajante.net === 'gas' ? (
            <div style={{ borderTop: '1px solid #3a494a', marginTop: 4 }}>
              <div style={{ fontSize: 9, color: '#22D3EE', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {contextMenuState.bajante.net === 'gas' ? 'Conexión (Red → Contador)' : 'AC-01 (Red Pública → Contador)'}
              </div>
              <div style={{ padding: '0 8px 8px' }}>
                <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4 }}>Diámetro</div>
                <select
                  value={contextMenuState.bajante.acoDiam || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (engineRef.current) {
                      engineRef.current?.updateElementById(contextMenuState.bajante.id, { acoDiam: val });
                      const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                      if (fresh) {
                        setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                      }
                      engineRef.current?.render();
                      writeAcoDiamToDrawing(val, planosCtx.plans, contextMenuState.bajante.net || 'af');
                    }
                  }}
                  style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                >
                  <option value="">— Sin diámetro —</option>
                  {(contextMenuState.bajante.net === 'gas' ? GAS_DN_LABELS : DIAMETROS_AF.map(d => d.nominal)).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            ) : null}
          </>
        ) : contextMenuState.bajante.tipo === 'calentador' ? (
          <>
            <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Calentador: {contextMenuState.bajante.code || contextMenuState.bajante.id}
            </div>
            <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Equipo (Capacidad)
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <select
                value={contextMenuState.bajante.capacidad || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (engineRef.current) {
                    const fields = { capacidad: val };
                    engineRef.current?.updateElementById(contextMenuState.bajante.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === contextMenuState.bajante.id);
                    if (fresh) {
                      setContextMenuState(prev => prev ? { ...prev, bajante: { ...fresh } } : null);
                      if (selElement?.id === contextMenuState.bajante.id) {
                        setSelElement({ ...selElement, capacidad: val });
                      }
                    }
                    engineRef.current?.render();
                  }
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
              >
                <option value="">— Seleccionar —</option>
                {CAT_GAS.filter(g => g.id.startsWith('cal')).map(g => (
                  <option key={g.id} value={g.id}>{g.n}</option>
                ))}
              </select>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}