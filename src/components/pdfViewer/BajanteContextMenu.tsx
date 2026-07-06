import { memo, useEffect, useRef, useState } from "react";
import { bajanteLabel } from "../../utils/accessoryAbbreviations";
import { pisoLbl, DIAM_BAN, DIAM_VENT, DIAM_BY_MAT, GAS_DN_LABELS } from "../../constants";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { writeBajantePropToDrawing, writeAcoDiamToDrawing, writeContadorDiamToDrawing } from "../../utils/writeDiameterToDrawing";
import { syncExtremeAccessoryToHidroData } from "../../utils/syncExtremeAccessory";
import { GAS, CAT_GAS } from "../../constants/engineeringDataGas";
import { VENTILACION, CONTADORES as CONTADORES_CAT } from "../../pages/catalog/catalogData";
import { DIAMETROS_AF } from "../../constants/hydraulicData";
import { BajanteContextMenuCtx, useBajanteContextMenu, type BajanteContextMenuContextValue, type ContextMenuState } from "./BajanteContextMenuContext";
import type PlanoEngine from "../../lib/PlanoEngine/PlanoEngine";

interface LowerFloorRamales {
  planId: string;
  planName: string;
  npt: number;
  ramales: any[];
}

function BajanteDirectionSelector({
  bajante,
  isGhostClick = false,
  selectedNivel,
  pisos,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
  bajante: any;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  pisos: any[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
  const gd = bajante.ghostData?.[currentGhostLabel];
  const ghostDir = isGhostClick ? (gd && gd.direccion !== undefined ? gd.direccion : bajante.direccion) : bajante.direccion;

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(bajante.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as any)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current?.updateElementById(bajante.id, { ghostData: gd2 });
    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
    if (fresh) {
      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
      if (selElement?.id === bajante.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

  return (
    <>
      <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Dirección de flujo
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '0 8px 4px' }}>
        {(isGhostClick ? ['Sube', 'Baja', 'Continua'] : ['Sube', 'Baja', 'Continua', 'Desplazamiento']).map(opt => {
          const isActive = opt === 'Desplazamiento'
            ? (!ghostDir && !!(bajante.desplazamientos && bajante.desplazamientos[currentGhostLabel]))
            : (ghostDir === opt.toLowerCase());
          return (
            <button
              key={opt}
              onClick={() => {
                if (engineRef.current) {
                  if (isGhostClick && opt !== 'Desplazamiento') {
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
                    updates = { direccion: 'sube', nptBase: currentNpt, nptCima: maxNpt, desplazamientos: { ...(bajante.desplazamientos || {}) } };
                  } else if (opt === 'Baja') {
                    updates = { direccion: 'baja', nptBase: minNpt, nptCima: currentNpt, desplazamientos: { ...(bajante.desplazamientos || {}) } };
                  } else if (opt === 'Continua') {
                    updates = { direccion: 'continua', desplazamientos: { ...(bajante.desplazamientos || {}) } };
                  } else if (opt === 'Desplazamiento') {
                    const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
                    if (lvl) {
                      const currentDesp = bajante.desplazamientos || {};
                      updates = {
                        direccion: undefined,
                        desplazamientos: {
                          ...currentDesp,
                          [lvl]: { dx: currentDesp[lvl]?.dx ?? 2, dy: currentDesp[lvl]?.dy ?? 0, Ldesvio: currentDesp[lvl]?.Ldesvio }
                        }
                      };
                    }
                  }
                  if (Object.keys(updates).length > 0) {
                    engineRef.current?.updateElementById(bajante.id, updates);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                    }
                    if (selElement?.id === bajante.id) {
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
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2563eb33'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#1e2024'; }}
            >
              <div style={{ color: opt === 'Sube' ? '#00dce5' : opt === 'Baja' ? '#F04545' : '#FFEB3B' }}>
                {opt === 'Sube' ? '\u2B06' : opt === 'Baja' ? '\u2B07' : opt === 'Continua' ? '\u279C' : '\u27A1'}
              </div>
              {opt}
            </button>
          );
        })}
      </div>

      {!isGhostClick && (
        <button
          onClick={() => {
            if (engineRef.current) {
              const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
              const isFantasma = bajante.isFantasma;
              const updates: any = { isFantasma: !isFantasma };
              if (!isFantasma && lvl) {
                const currentDesp = { ...(bajante.desplazamientos || {}) };
                if (!currentDesp[lvl]) {
                  currentDesp[lvl] = { dx: 2, dy: 0 };
                  updates.desplazamientos = currentDesp;
                }
              }
              engineRef.current?.updateElementById(bajante.id, updates);
              const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
              if (fresh) {
                setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
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
          {bajante.isFantasma ? 'Desactivar desplazamiento del bajante' : 'Activar desplazamiento del bajante'}
        </button>
      )}
    </>
  );
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
}: {
  bajante: any;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
  lowerFloorsRamales: any[];
  planosCtx: { plans: any[] };
}) {
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
                const gd = bajante.ghostData?.[currentGhostLabel];
                return isGhostClick ? (gd && gd.dNominal !== undefined ? gd.dNominal : (bajante.dNominal || '')) : (bajante.dNominal || '');
              })()}
                onChange={e => {
                  const val = e.target.value;
                  if (isGhostClick && engineRef.current) {
                    const gd2 = { ...(bajante.ghostData || {}) };
                    const cd = { ...(gd2[currentGhostLabel] || {}) };
                    cd.dNominal = val;
                    gd2[currentGhostLabel] = cd;
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
                if (isGhostClick) {
                  const gd2 = { ...(bajante.ghostData || {}) };
                  const cd = { ...(gd2[currentGhostLabel] || {}) };
                  cd.dNominal = val;
                  gd2[currentGhostLabel] = cd;
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

function BajanteConnectionPanel({
  bajante,
  isGhostClick = false,
  ramalEndpoint,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  mats,
  activeNet,
  planosCtx,
}: {
  bajante: any;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
  mats: Record<string, any[]>;
  activeNet: string;
  planosCtx?: { plans: any[] };
}) {
  const hasPts = !!bajante.pts;

  return (
    <>
      {!hasPts && !isGhostClick && ["san", "ll"].includes(activeNet) && (
        <>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px',
            borderTop: '1px solid #3a494a', marginTop: 4
          }}>
            <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ramales asociados</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
              {(() => {
                const bajRamales = (engineRef.current?.ramales || []).filter((r: any) => r.net === activeNet && r.tipo !== 'tributario');
                if (bajRamales.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin ramales</div>;
                const recibidos = (bajante.recibeDeIds || []);
                return bajRamales.map((r: any) => {
                  const isAssociated = recibidos.includes(r.id);
                  const rStart = r.pts?.[0];
                  const rEnd = r.pts?.[r.pts.length - 1];
                  const distStart = rStart ? Math.hypot(rStart[0] - bajante.x, rStart[1] - bajante.y) : Infinity;
                  const distEnd = rEnd ? Math.hypot(rEnd[0] - bajante.x, rEnd[1] - bajante.y) : Infinity;
                  const isAtStart = distStart <= distEnd;
                  return (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                      <input type="checkbox" checked={isAssociated}
                        onChange={e => {
                          const checked = e.target.checked;
                          const newRecibe = checked
                            ? [...recibidos, r.id]
                            : recibidos.filter((id: string) => id !== r.id);
                          engineRef.current?.updateElementById(bajante.id, { recibeDeIds: newRecibe });
                          setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, recibeDeIds: newRecibe } } : null);
                          if (selElement?.id === bajante.id) {
                            setSelElement({ ...selElement, recibeDeIds: newRecibe });
                          }
                          const bajCode = bajante.code || bajante.id;
                          const currentIni = r.ini || '';
                          const currentFin = r.fin || '';
                          if (isAtStart) {
                            const newIni = checked ? bajCode : (currentIni === bajCode ? '' : currentIni);
                            engineRef.current?.updateElementById(r.id, { ini: newIni });
                          } else {
                            const newFin = checked ? bajCode : (currentFin === bajCode ? '' : currentFin);
                            engineRef.current?.updateElementById(r.id, { fin: newFin });
                          }
                          engineRef.current?.render();
                          engineRef.current?._markDirty();
                        }}
                        style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4
          }}>
            <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
              {(() => {
                const netBajantes = (engineRef.current?.bajantes || []).filter((b: any) => b.net === bajante.net && b.id !== bajante.id && b.tipo !== 'tributario');
                if (netBajantes.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
                const currentId = bajante.id;
                return netBajantes.map((b: any) => {
                  const isAssociated = (bajante.recibeDeIds || []).includes(b.id)
                    || (b.recibeDeIds || []).includes(currentId);
                  return (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                      <input type="checkbox" checked={isAssociated}
                        onChange={e => {
                          const checked = e.target.checked;
                          const bajFresh = bajante.recibeDeIds || [];
                          const otherFresh = b.recibeDeIds || [];

                          const newBajRecibe = checked
                            ? (bajFresh.includes(b.id) ? bajFresh : [...bajFresh, b.id])
                            : bajFresh.filter((id: string) => id !== b.id);
                          const newOtherRecibe = checked
                            ? (otherFresh.includes(currentId) ? otherFresh : [...otherFresh, currentId])
                            : otherFresh.filter((id: string) => id !== currentId);

                          engineRef.current?.updateElementById(currentId, { recibeDeIds: newBajRecibe });
                          engineRef.current?.updateElementById(b.id, { recibeDeIds: newOtherRecibe });
                          const refreshed = engineRef.current?.bajantes.find((x: any) => x.id === currentId);
                          if (refreshed) setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...refreshed } } : null);
                          if (selElement?.id === currentId) {
                            setSelElement({ ...selElement, recibeDeIds: newBajRecibe });
                          }
                          if (selElement?.id === b.id) {
                            setSelElement({ ...selElement, recibeDeIds: newOtherRecibe });
                          }
                          engineRef.current?.render();
                        }}
                        style={{ accentColor: '#2563eb', margin: 0, flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={bajanteLabel(b, engineRef.current?.nivelActual?.label)}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>
        </>
      )}

      {hasPts && ramalEndpoint && (() => {
        const supNets = ['san', 'll', 'vent', 'af', 'ac', 'gas', 'rci', 'rec'];
        if (!supNets.includes(bajante.net)) return null;
        const ep = ramalEndpoint;

        const netDef = NETS.find((n: any) => n.id === bajante.net);
        const bmLabel = netDef?.bmType === 'bajante' ? 'bajante' : 'montante';

        return (
          <>
            {(bajante.tipo === 'tributario' || bajante.tipo === 'ramal') && ['san', 'af', 'ac'].includes(bajante.net) && (() => {
              const isStart = ep.idx === 0;
              const fieldAcc = isStart ? 'accesorioInicio' : 'accesorioFin';
              const fieldDiam = isStart ? 'diametroInicio' : 'diametroFin';

              const currentAcc = bajante[fieldAcc] || '';
              const currentDiam = bajante[fieldDiam] || bajante.diametro || '';

              const matList = mats?.[bajante.net] || [];
              const matShort = bajante.material || matList[0]?.val || '';
              const diamList = DIAM_BY_MAT[matShort] || [];

              const accOptions = bajante.net === 'san'
                ? [
                    { value: 'sifon', label: 'Sifón' },
                    { value: 'codoSube', label: 'Codo Sube' },
                    { value: 'codoBaja', label: 'Codo Baja' },
                    { value: 'codoReventilado', label: 'Codo reventilado' },
                  ]
                : [
                    { value: 'valvCompuerta', label: 'Válvula compuerta' },
                    { value: 'valvGlobo', label: 'Válvula globo' },
                    { value: 'valvCheque', label: 'Válvula cheque' },
                    { value: 'valvAngulo', label: 'Válvula ángulo' },
                  ];

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
                          const oldVal = bajante[fieldAcc] || '';
                          const updates: any = { [fieldAcc]: val };
                          if (val && !bajante[fieldDiam]) {
                            updates[fieldDiam] = bajante.diametro || '';
                          }
                          engineRef.current.updateElementById(bajante.id, updates);
                          setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, ...updates } } : null);
                          if (selElement?.id === bajante.id) {
                            setSelElement({ ...selElement, ...updates });
                          }
                          engineRef.current.render();
                          engineRef.current._markDirty();
                          if (val !== oldVal && planosCtx?.plans) {
                            syncExtremeAccessoryToHidroData(bajante.id, fieldAcc, oldVal, val, planosCtx.plans);
                          }
                        }
                      }}
                      style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                    >
                      <option value="">Ninguno</option>
                      {accOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {currentAcc && (
                    <div>
                      <div style={{ fontSize: 9, color: '#849495', marginBottom: 2 }}>Diametro de Accesorio</div>
                      <select
                        value={currentDiam ? currentDiam.split(' — ')[0].trim() : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (engineRef.current) {
                            const updates = { [fieldDiam]: val };
                            engineRef.current.updateElementById(bajante.id, updates);
                            setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, ...updates } } : null);
                            if (selElement?.id === bajante.id) {
                              setSelElement({ ...selElement, ...updates });
                            }
                            engineRef.current.render();
                            engineRef.current._markDirty();
                          }
                        }}
                        style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
                      >
                        <option value="">Usar diametro de red</option>
                        {(currentAcc === 'sifon'
                          ? diamList.filter((d: any) => { const v = parseFloat(d.n); return v === 2 || v === 3 || v === 4; })
                          : diamList
                        ).map((d: any) => {
                          const valClean = d.n.split(' — ')[0].trim();
                          return <option key={d.n} value={valClean}>{valClean}</option>;
                        })}
                      </select>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ padding: '4px 8px' }}>
              <button onClick={() => {
                const eng = engineRef.current;
                if (!eng) return;
                const isMon = bmLabel === 'montante';
                const pfx = netDef?.bmPfx || (isMon ? 'MON' : 'B');
                const cnt = eng.bajantes.filter((b: any) => b.tipo === bmLabel && (!isMon || b.net === bajante.net)).length + 1;
                const id = isMon ? pfx + cnt + '_' + bajante.net : (pfx + cnt);
                const code = isMon ? pfx + cnt : id;
                const nl = eng.nivelActual;
                eng.bajantes.push({
                  id, net: bajante.net,
                  tipo: bmLabel,
                  code: code,
                  direccion: bmLabel === 'bajante' ? 'baja' : 'sube',
                  x: ep.x, y: ep.y,
                  pisoBase: nl?.label ?? '',
                  pisoCima: nl?.label ?? '',
                  nptBase: nl?.npt ?? 0,
                  nptCima: nl?.npt ?? 0,
                  hVert: 0,
                  dNominal: '0', recibeDeIds: [bajante.id], alimentaIds: [], descargaEnId: null,
                  ucAcum: 0, ucExtra: 0, area_m2: 0,
                  desplazamientos: {},
                  lblOffX: 0, lblOffY: 0, labelAngle: 0,
                  labelX: ep.x, labelY: ep.y + 20,
                  bajR: 7 / 24,
                });
                if (bmLabel === 'montante') {
                  eng._renumberMontantes();
                } else {
                  eng._renumberBajantes(bajante.net);
                }
                const newlyCreated = eng.bajantes.find((b: any) => b.tipo === bmLabel && b.x === ep.x && b.y === ep.y);
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
          </>
        );
      })()}
    </>
  );
}

function BajanteCodeEditor({
  bajante,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  mats,
  activeNet,
  setDiamSel,
  planosCtx,
}: {
  bajante: any;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
  mats: Record<string, any[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  planosCtx: { plans: any[] };
}) {
  const isArea = bajante.id?.startsWith('AR');
  const hasPts = !!bajante.pts;
  const tipo = bajante.tipo;

  if (isArea) {
    return (
      <>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Asociar Bajante
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={(engineRef.current?.bajantes || []).find((b: any) => b.area_m2 === bajante.areaM2)?.id || ''}
            onChange={e => {
              const bajanteId = e.target.value;
              (engineRef.current?.bajantes || []).forEach((b: any) => {
                if (b.area_m2 === bajante.areaM2) {
                  engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                }
              });
              if (bajanteId) {
                engineRef.current?.updateElementById(bajanteId, { area_m2: bajante.areaM2 });
              }
              engineRef.current?.render();
              setContextMenuState(null);
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">— Sin bajante —</option>
            {(engineRef.current?.bajantes || []).filter((b: any) => b.net === bajante.net).map((b: any) => (
              <option key={b.id} value={b.id}>{b.code || b.id}</option>
            ))}
          </select>
        </div>
      </>
    );
  }

  if (hasPts) {
    const isGas = bajante.net === 'gas';
    const isVen = bajante.net === 'vent';
    const matList = mats?.[bajante.net] || [];
    const matShort = bajante.material || matList[0]?.val || '—';
    let diamList: any[] = [];
    if (isVen) {
      diamList = VENTILACION[0]?.rows.map((r: any) => ({ n: r.dn })) || [];
    } else if (isGas) {
      diamList = GAS[0]?.rows.map(r => ({ n: r.dn })) || [];
    } else {
      diamList = DIAM_BY_MAT[matShort] || [];
    }

    return (
      <>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Diámetro de ramal
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajante.diametro ? bajante.diametro.split(' — ')[0].trim() : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                engineRef.current?.updateElementById(bajante.id, { diametro: val });
                setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...prev.bajante, diametro: val } } : null);
                if (selElement?.id === bajante.id) {
                  setSelElement({ ...selElement, diametro: val });
                }
                if (activeNet === bajante.net) {
                  setDiamSel((prev: any) => ({ ...prev, [activeNet]: val }));
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
      </>
    );
  }

  if (tipo === 'contador') {
    return (
      <>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Contador: {bajante.code || bajante.id}
        </div>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Diámetro del Contador
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajante.dNominal ? bajante.dNominal.replace(/"/g, '').trim() : ''}
            onChange={(e) => {
              const val = e.target.value;
              const dNom = val ? `${val}"` : '';
              if (engineRef.current) {
                const fields = { dNominal: dNom };
                engineRef.current?.updateElementById(bajante.id, fields);
                const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                if (fresh) {
                  setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                  if (selElement?.id === bajante.id) {
                    setSelElement({ ...selElement, dNominal: fields.dNominal });
                  }
                }
                engineRef.current?.render();
                writeContadorDiamToDrawing(dNom, planosCtx.plans, bajante.net || 'af');
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
        {(bajante.net === 'af' || bajante.net === 'gas') && (
          <div style={{ borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <div style={{ fontSize: 9, color: '#22D3EE', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {bajante.net === 'gas' ? 'Conexión (Red → Contador)' : 'AC-01 (Red Pública → Contador)'}
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4 }}>Diámetro</div>
              <select
                value={bajante.acoDiam || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (engineRef.current) {
                    engineRef.current?.updateElementById(bajante.id, { acoDiam: val });
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                    }
                    engineRef.current?.render();
                    writeAcoDiamToDrawing(val, planosCtx.plans, bajante.net || 'af');
                  }
                }}
                style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}
              >
                <option value="">— Sin diámetro —</option>
                {(bajante.net === 'gas' ? GAS_DN_LABELS : DIAMETROS_AF.map(d => d.nominal)).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </>
    );
  }

  if (tipo === 'calentador') {
    return (
      <>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Calentador: {bajante.code || bajante.id}
        </div>
        <div style={{ fontSize: 9, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Equipo (Capacidad)
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajante.capacidad || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                const fields = { capacidad: val };
                engineRef.current?.updateElementById(bajante.id, fields);
                const fresh = engineRef.current?.bajantes.find((b: any) => b.id === bajante.id);
                if (fresh) {
                  setContextMenuState((prev: any) => prev ? { ...prev, bajante: { ...fresh } } : null);
                  if (selElement?.id === bajante.id) {
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
    );
  }

  return null;
}

/* ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Variant components — explicit, composed, no boolean props
 * ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――― */

function BajanteMenu() {
  const ctx = useBajanteContextMenu()
  const { contextMenuState, bajante } = ctx
  const isGhostClick = contextMenuState.isGhostClick || false
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(ctx.activeNet)

  return (
    <>
      <BajanteDirectionSelector
        bajante={bajante}
        isGhostClick={isGhostClick}
        selectedNivel={ctx.selectedNivel}
        pisos={ctx.pisos}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
      />
      <BajanteDiameterSelector
        bajante={bajante}
        isGhostClick={isGhostClick}
        selectedNivel={ctx.selectedNivel}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
        lowerFloorsRamales={ctx.lowerFloorsRamales}
        planosCtx={ctx.planosCtx}
      />
      {isSanOrLl && (
        <BajanteConnectionPanel
          bajante={bajante}
          isGhostClick={isGhostClick}
          ramalEndpoint={null}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
          setContextMenuState={ctx.setContextMenuState}
          mats={ctx.mats}
          activeNet={ctx.activeNet}
          planosCtx={ctx.planosCtx}
        />
      )}
    </>
  )
}

function AreaMenu() {
  const ctx = useBajanteContextMenu()
  return (
    <BajanteCodeEditor
      bajante={ctx.bajante}
      engineRef={ctx.engineRef}
      selElement={ctx.selElement}
      setSelElement={ctx.setSelElement}
      setContextMenuState={ctx.setContextMenuState}
      mats={ctx.mats}
      activeNet={ctx.activeNet}
      setDiamSel={ctx.setDiamSel}
      planosCtx={ctx.planosCtx}
    />
  )
}

function RamalMenu() {
  const ctx = useBajanteContextMenu()
  const { contextMenuState, bajante, engineRef, selElement, setSelElement } = ctx

  return (
    <>
      {contextMenuState.ramalEndpoint && (
        <BajanteConnectionPanel
          bajante={bajante}
          isGhostClick={contextMenuState.isGhostClick || false}
          ramalEndpoint={contextMenuState.ramalEndpoint}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
          setContextMenuState={ctx.setContextMenuState}
          mats={ctx.mats}
          activeNet={ctx.activeNet}
          planosCtx={ctx.planosCtx}
        />
      )}
      <BajanteCodeEditor
        bajante={bajante}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
        mats={ctx.mats}
        activeNet={ctx.activeNet}
        setDiamSel={ctx.setDiamSel}
        planosCtx={ctx.planosCtx}
      />
      <div style={{
        padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: 10, color: '#e2e2e8', fontFamily: "'Geist',monospace" }}>Bloquear movimiento</span>
        <input type="checkbox" checked={!!bajante.bloqueado}
          onChange={e => {
            const val = e.target.checked;
            if (engineRef.current) {
              engineRef.current?.updateElementById(bajante.id, { bloqueado: val });
              if (selElement?.id === bajante.id) {
                setSelElement({ ...selElement, bloqueado: val });
              }
              engineRef.current?.render();
            }
          }}
          style={{ accentColor: '#F5A623', cursor: 'pointer', margin: 0 }} />
      </div>
      {['san', 'll'].includes(ctx.activeNet) && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4
        }}>
          <div style={{ fontSize: 9, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 }}>
            {(() => {
              const currentId = bajante.id;
              const netBajantes = (engineRef.current?.bajantes || []).filter((b: any) => b.net === bajante.net && b.id !== bajante.id && b.tipo !== 'tributario');
              if (netBajantes.length === 0) return <div style={{ fontSize: 9, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
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
                        if (selElement?.id === b.id) {
                          setSelElement({ ...selElement, ...extraFields });
                        }
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</span>
                  </label>
                );
              });
            })()}
          </div>
        </div>
      )}
    </>
  )
}

function ContadorMenu() {
  const ctx = useBajanteContextMenu()
  return (
    <BajanteCodeEditor
      bajante={ctx.bajante}
      engineRef={ctx.engineRef}
      selElement={ctx.selElement}
      setSelElement={ctx.setSelElement}
      setContextMenuState={ctx.setContextMenuState}
      mats={ctx.mats}
      activeNet={ctx.activeNet}
      setDiamSel={ctx.setDiamSel}
      planosCtx={ctx.planosCtx}
    />
  )
}

function CalentadorMenu() {
  const ctx = useBajanteContextMenu()
  return (
    <BajanteCodeEditor
      bajante={ctx.bajante}
      engineRef={ctx.engineRef}
      selElement={ctx.selElement}
      setSelElement={ctx.setSelElement}
      setContextMenuState={ctx.setContextMenuState}
      mats={ctx.mats}
      activeNet={ctx.activeNet}
      setDiamSel={ctx.setDiamSel}
      planosCtx={ctx.planosCtx}
    />
  )
}

/* ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Main component — provider wrapper + dispatch
 * ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――― */

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

export default memo(function BajanteContextMenu(props: BajanteContextMenuProps) {
  const state = props.contextMenuState;
  if (!state || !state.visible) return null;

  const ctxValue: BajanteContextMenuContextValue = {
    contextMenuState: state,
    setContextMenuState: props.setContextMenuState,
    bajante: state.bajante,
    selectedNivel: props.selectedNivel,
    pisos: props.pisos,
    engineRef: props.engineRef,
    selElement: props.selElement,
    setSelElement: props.setSelElement,
    lowerFloorsRamales: props.lowerFloorsRamales,
    planosCtx: props.planosCtx,
    mats: props.mats,
    activeNet: props.activeNet,
    setDiamSel: props.setDiamSel,
  }

  return (
    <BajanteContextMenuCtx.Provider value={ctxValue}>
      <BajanteContextMenuInner />
    </BajanteContextMenuCtx.Provider>
  )
})

function BajanteContextMenuInner() {
  const ctx = useBajanteContextMenu()
  const { contextMenuState } = ctx
  const menuRef = useRef<HTMLFormElement>(null);
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
      if (e.key === 'Escape') ctx.setContextMenuState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctx.setContextMenuState]);

  const bajante = contextMenuState.bajante;
  const isBajanteTipo = bajante.tipo === 'bajante' || bajante.tipo === 'montante' || bajante.id?.startsWith('B');
  const isArea = bajante.id?.startsWith('AR');
  const hasPts = !!bajante.pts;
  const tipo = bajante.tipo;

  return (
    <>
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100
      }} onClick={() => ctx.setContextMenuState(null)} onContextMenu={(e) => e.preventDefault()} />
      <form ref={menuRef} role="dialog" aria-modal="true" aria-label="Menú contextual de elemento" onSubmit={e => e.preventDefault()} onKeyDown={e => {
          if (e.key === 'Tab') {
            const focusable = e.currentTarget.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            const first = focusable[0] as HTMLElement;
            const last = focusable[focusable.length - 1] as HTMLElement;
            if (e.shiftKey) {
              if (document.activeElement === first) { last.focus(); e.preventDefault(); }
            } else {
              if (document.activeElement === last) { first.focus(); e.preventDefault(); }
            }
          }
        }} style={{
        position: 'absolute', left: adjustedPos.x, top: adjustedPos.y, zIndex: 101,
        background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: '4px', minWidth: 150, maxWidth: 280,
        display: 'flex', flexDirection: 'column', gap: 2,
      }} onContextMenu={(e) => e.preventDefault()}>
        {isBajanteTipo && !hasPts ? <BajanteMenu /> :
         isArea ? <AreaMenu /> :
         hasPts ? <RamalMenu /> :
         tipo === 'contador' ? <ContadorMenu /> :
         tipo === 'calentador' ? <CalentadorMenu /> : null}
      </form>
    </>
  );
}
