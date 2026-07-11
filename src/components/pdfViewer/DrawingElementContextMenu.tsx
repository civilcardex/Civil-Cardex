import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import { bajanteLabel } from "../../utils/accessoryAbbreviations";
import { normalizeDnLabel } from "../../utils/formatUtils";
import { pisoLbl, DIAM_BAN, DIAM_VENT, DIAM_BY_MAT, GAS_DN_LABELS, ACCESORIOS_HIDRO, SAN_ACCESORIOS, GAS_ACCESORIOS } from "../../constants";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { writeBajantePropToDrawing, writeAcoDiamToDrawing, writeContadorDiamToDrawing } from "../../utils/writeDiameterToDrawing";
import { syncExtremeAccessoryToHidroData } from "../../utils/syncExtremeAccessory";
import { GAS, CAT_GAS } from "../../constants/engineeringDataGas";
import { VENTILACION, CONTADORES as CONTADORES_CAT } from "../../pages/catalog/catalogData";
import { DIAMETROS_AF } from "../../constants/hydraulicData";
import { diamPulgFromLabel } from "../../utils/diamPulgFromLabel";
import PlanoEngine from "../../lib/PlanoEngine/PlanoEngine";

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  element: any; // was bajante
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  midRamalHit?: { segmentIdx: number; x: number; y: number } | null;
}

interface DrawingElementContextMenuContextValue {
  contextMenuState: ContextMenuState
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>
  element: any // was bajante
  selectedNivel: number | null
  pisos: any[]
  engineRef: React.MutableRefObject<PlanoEngine | null>
  selElement: Record<string, any> | null
  setSelElement: (el: Record<string, any> | null) => void
  lowerFloorsRamales: any[]
  planosCtx: { plans: any[] }
  mats: Record<string, any[]>
  activeNet: string
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

const DrawingElementContextMenuCtx = createContext<DrawingElementContextMenuContextValue | null>(null)

function useDrawingElementContextMenu(): DrawingElementContextMenuContextValue {
  const ctx = useContext(DrawingElementContextMenuCtx)
  if (!ctx) throw new Error('useDrawingElementContextMenu must be used within DrawingElementContextMenuProvider')
  return ctx
}
const DrawingElementContextMenu_S2: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_dirBtn: React.CSSProperties = {
  padding: '3px 5px',
  textAlign: 'left', fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer',
  borderRadius: 3, display: 'flex', alignItems: 'center', gap: 3,
  transition: 'all 0.1s', boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap',
  textOverflow: 'ellipsis', minWidth: 0,
};
const DrawingElementContextMenu_fantasmaBtn: React.CSSProperties = {
  border: 'none',
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: 11,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 4,
  borderTop: '1px solid #3a494a',
  width: '100%',
};
const DrawingElementContextMenu_S3: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S4: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S5: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S6: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S7: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 };
const DrawingElementContextMenu_S8: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: '#b9caca', fontFamily: "'Geist',monospace" };
const DrawingElementContextMenu_S9: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', maxHeight: 160, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 };
const DrawingElementContextMenu_S10: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: '#b9caca', fontFamily: "'Geist',monospace" };
const DrawingElementContextMenu_S11: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S12: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S13: React.CSSProperties = { width: '100%', padding: '6px 8px', cursor: 'pointer', background: '#1e2024', border: '1px dashed #00dce5', borderRadius: 4, color: '#00dce5', fontSize: 12, fontFamily: "'Geist',monospace", textAlign: 'center', fontWeight: 600, };
const DrawingElementContextMenu_S14: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S15: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S16: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S17: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S18: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const DrawingElementContextMenu_S21: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', maxHeight: 160, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 };
const DrawingElementContextMenu_S22: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 };
const DrawingElementContextMenu_S23: React.CSSProperties = { position: 'absolute', zIndex: 101, background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: '4px', minWidth: 170, maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' };




interface LowerFloorRamales {
  planId: string;
  planName: string;
  npt: number;
  ramales: any[];
}

function BajanteDirectionSelector({
  element,
  isGhostClick = false,
  selectedNivel,
  pisos,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
  element: any;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  pisos: any[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
  const gd = element.ghostData?.[currentGhostLabel];
  const ghostDir = isGhostClick ? (gd && gd.direccion !== undefined ? gd.direccion : element.direccion) : element.direccion;

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(element.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as any)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current?.updateElementById(element.id, { ghostData: gd2 });
    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
    if (fresh) {
      setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
      if (selElement?.id === element.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

  return (
    <>
      <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Dirección de flujo
      </div>
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 3, padding: '0 6px 4px', boxSizing: 'border-box', overflow: 'hidden', width: '100%' }}>
        {(isGhostClick ? ['Sube', 'Baja', 'Continua'] : ['Sube', 'Baja', 'Continua']).map(opt => {
          const isActive = (ghostDir === opt.toLowerCase());
          return (
            <button type="button"
              key={opt}
              onClick={() => {
                if (!engineRef.current) return;
                if (isGhostClick) {
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
                  updates = { direccion: 'sube', nptBase: currentNpt, nptCima: maxNpt, desplazamientos: { ...(element.desplazamientos || {}) } };
                } else if (opt === 'Baja') {
                  updates = { direccion: 'baja', nptBase: minNpt, nptCima: currentNpt, desplazamientos: { ...(element.desplazamientos || {}) } };
                } else if (opt === 'Continua') {
                  updates = { direccion: 'continua', desplazamientos: { ...(element.desplazamientos || {}) } };
                }
                if (Object.keys(updates).length > 0) {
                  engineRef.current?.updateElementById(element.id, updates);
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                  }
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, ...updates });
                  }
                }
              }}
              style={{
                ...DrawingElementContextMenu_dirBtn,
                background: isActive ? 'rgba(37,99,235,0.15)' : '#1e2024',
                border: `1px solid ${isActive ? '#2563eb' : '#3a494a'}`,
                color: isActive ? '#3b82f6' : '#e2e2e8',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2563eb33'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#1e2024'; }}
            >
              <div style={{ color: opt === 'Sube' ? '#00dce5' : opt === 'Baja' ? '#F04545' : '#FFEB3B', flexShrink: 0 }}>
                {opt === 'Sube' ? '\u2B06' : opt === 'Baja' ? '\u2B07' : '\u279C'}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{opt}</span>
            </button>
          );
        })}
      </div>
      {!isGhostClick && (
        <button type="button"
          onClick={() => {
            if (!engineRef.current) return;
            const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
            const isFantasma = element.isFantasma;
            const updates: any = { isFantasma: !isFantasma };
            if (!isFantasma && lvl) {
              const currentDesp = { ...(element.desplazamientos || {}) };
              if (!currentDesp[lvl]) {
                currentDesp[lvl] = { dx: 2, dy: 0 };
                updates.desplazamientos = currentDesp;
              }
            }
            engineRef.current?.updateElementById(element.id, updates);
            setTimeout(() => {
              const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
              if (fresh) {
                setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                if (selElement?.id === element.id) {
                  setSelElement({ ...selElement, ...updates });
                }
              }
            }, 50);
            engineRef.current?.render();
          }}
          style={{
            ...DrawingElementContextMenu_fantasmaBtn,
            background: element.isFantasma ? 'rgba(245,166,35,0.12)' : 'transparent',
            color: element.isFantasma ? '#F5A623' : '#e2e2e8',
          }}
          onMouseEnter={e => { if (!element.isFantasma) e.currentTarget.style.background = '#2563eb33'; }}
          onMouseLeave={e => { if (!element.isFantasma) e.currentTarget.style.background = element.isFantasma ? 'rgba(245,166,35,0.12)' : 'transparent'; }}
        >
          {element.isFantasma ? 'Desactivar desplazamiento del bajante' : 'Activar desplazamiento del bajante'}
        </button>
      )}
    </>
  );
}

function BajanteDiameterSelector({
  element,
  isGhostClick = false,
  selectedNivel,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  lowerFloorsRamales,
  planosCtx,
}: {
  element: any;
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
              <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destino</div>
              <select value={element.descargaEnId || ''} aria-label="Destino"
                onChange={e => {
                  const v = e.target.value || null;
                  engineRef.current?.updateElementById(element.id, { descargaEnId: v });
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                  if (fresh) setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, descargaEnId: v });
                  }
                  const bKey = `${element.id}-${engineRef.current?.planId}`;
                  writeBajantePropToDrawing(bKey, element.net || 'san', 'descargaEnId', v, planosCtx.plans);

                  if (v && engineRef.current) {
                    const oParts = v.split('|');
                    const oPlanId = oParts[0];
                    const oTgtId = oParts[1];
                    const lowerPl = lowerFloorsRamales.find((g: any) => String(g.planId) === String(oPlanId));
                    const targetBaj = lowerPl?.bajantes?.find((b: any) => String(b.id) === String(oTgtId));
                    if (targetBaj) {
                      const dist = Math.hypot(element.x - targetBaj.x, element.y - targetBaj.y);
                      if (dist > 0.05) {
                        const exists = engineRef.current.ramales.some((r: any) => 
                          (Math.hypot(r.pts[0][0] - element.x, r.pts[0][1] - element.y) < 0.5 &&
                           Math.hypot(r.pts[r.pts.length - 1][0] - targetBaj.x, r.pts[r.pts.length - 1][1] - targetBaj.y) < 0.5) ||
                          (Math.hypot(r.pts[0][0] - targetBaj.x, r.pts[0][1] - targetBaj.y) < 0.5 &&
                           Math.hypot(r.pts[r.pts.length - 1][0] - element.x, r.pts[r.pts.length - 1][1] - element.y) < 0.5)
                        );
                        if (!exists) {
                          const net = element.net || 'san';
                          const cnt = ++(engineRef.current._netCounts[net]['ramal']);
                          const newRamalId = 'R' + Date.now();
                          const netPfx = NETS.find(n => n.id === net)?.lbl || 'R';
                          const newRamal: any = {
                            id: newRamalId,
                            net,
                            tipo: 'ramal',
                            padre: null,
                            pts: [[element.x, element.y], [targetBaj.x, targetBaj.y]],
                            totalL: +(engineRef.current.pxToM(dist)).toFixed(3),
                            label: netPfx + cnt,
                            ini: '', fin: '',
                            piso: engineRef.current.nivelActual?.n ?? '',
                            dz: '', uc: 0,
                            labelX: (element.x + targetBaj.x) / 2,
                            labelY: (element.y + targetBaj.y) / 2,
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
                style={{ ...DrawingElementContextMenu_S2, width: '85%' }}>
                <option value="">Sin destino</option>
                {lowerFloorsRamales.map(group => {
                  const plano = planosCtx.plans.find((pl: any) => pl.id === group.planId);
                  const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                  const hasRamales = group.ramales && group.ramales.length > 0;
                  const hasBajantes = group.bajantes && group.bajantes.filter((b: any) => b.id !== element.id).length > 0;
                  return (
                    <optgroup key={group.planId} label={pLabel}>
                      {hasRamales && group.ramales.map((r: any) => (
                        <option key={`${group.planId}|${r.id}`} value={`${group.planId}|${r.id}`}>
                          Ramal: {r.label || r.id}
                        </option>
                      ))}
                      {hasBajantes && group.bajantes.filter((b: any) => b.id !== element.id).map((b: any) => (
                        <option key={`${group.planId}|${b.id}`} value={`${group.planId}|${b.id}`}>
                          Bajante: {b.code || b.id}
                        </option>
                      ))}
                      {!hasRamales && !hasBajantes && (
                        <option value="" disabled>Sin elementos disponibles</option>
                      )}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Diámetro</div>
              <select value={(() => {
                const gd = element.ghostData?.[currentGhostLabel];
                return isGhostClick ? (gd && gd.dNominal !== undefined ? gd.dNominal : (element.dNominal || '')) : (element.dNominal || '');
              })()}
                aria-label="Diámetro"
                onChange={e => {
                  const val = e.target.value;
                  if (isGhostClick && engineRef.current) {
                    const gd2 = { ...(element.ghostData || {}) };
                    const cd = { ...(gd2[currentGhostLabel] || {}) };
                    cd.dNominal = val;
                    gd2[currentGhostLabel] = cd;
                    const fields = { ghostData: gd2 };
                    engineRef.current?.updateElementById(element.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                      if (selElement?.id === element.id) {
                        setSelElement({ ...selElement, ghostData: fields.ghostData });
                      }
                    }
                  } else {
                    const fields = { dNominal: val };
                    engineRef.current?.updateElementById(element.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                      if (selElement?.id === element.id) {
                        setSelElement({ ...selElement, dNominal: fields.dNominal });
                      }
                    }
                  }
                }}
                style={DrawingElementContextMenu_S3}>
                <option value="">—</option>
                {(element.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
                  <option key={d.pulg} value={d.nom}>{normalizeDnLabel(d.nom)}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 8px 4px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Llenado (R)</div>
              <select value={element.bajR != null ? (Math.abs(element.bajR - 7 / 24) < 0.001 ? '7/24' : '1/4') : '7/24'} aria-label="Llenado (R)"
                onChange={e => {
                  const val = e.target.value;
                  const valNum = val === '7/24' ? 7 / 24 : 0.25;
                  engineRef.current?.updateElementById(element.id, { bajR: valNum });
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                  if (fresh) setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, bajR: valNum });
                  }
                }}
                style={DrawingElementContextMenu_S4}>
                <option value="7/24">7/24</option>
                <option value="1/4">1/4</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Área asociada</div>
              <select value={element.area_m2 || ''} aria-label="Área asociada"
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  engineRef.current?.updateElementById(element.id, { area_m2: val });
                  setContextMenuState((prev: any) => prev ? { ...prev, element: { ...prev.element, area_m2: val } } : null);
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, area_m2: val });
                  }
                }}
                style={DrawingElementContextMenu_S5}>
                <option value="">Sin área</option>
                {(engineRef.current?.areas || []).filter((a: any) => a.net === element.net).map((a: any) => (
                  <option key={a.id} value={a.areaM2}>{a.label} · {a.areaM2} m²</option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 4, padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
          <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Diámetro</div>
          <select value={(() => {
            const gd = element.ghostData?.[currentGhostLabel];
            return isGhostClick ? (gd && gd.dNominal !== undefined ? gd.dNominal : (element.dNominal || '')) : (element.dNominal || '');
          })()}
            aria-label="Diámetro"
            onChange={e => {
              const val = e.target.value;
              if (engineRef.current) {
                if (isGhostClick) {
                  const gd2 = { ...(element.ghostData || {}) };
                  const cd = { ...(gd2[currentGhostLabel] || {}) };
                  cd.dNominal = val;
                  gd2[currentGhostLabel] = cd;
                  const fields = { ghostData: gd2 };
                  engineRef.current?.updateElementById(element.id, fields);
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                    if (selElement?.id === element.id) {
                      setSelElement({ ...selElement, ghostData: fields.ghostData });
                    }
                  }
                } else {
                  const fields = { dNominal: val };
                  engineRef.current?.updateElementById(element.id, fields);
                  const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                    if (selElement?.id === element.id) {
                      setSelElement({ ...selElement, dNominal: fields.dNominal });
                    }
                  }
                }
              } 
            }}
            style={DrawingElementContextMenu_S6}>
            <option value="">—</option>
            {(element.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
              <option key={d.pulg} value={d.nom}>{normalizeDnLabel(d.nom)}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

function BajanteConnectionPanel({
  element,
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
  element: any;
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
  const hasPts = !!element.pts;

  return (
    <>
      {!hasPts && !isGhostClick && ["san", "ll"].includes(activeNet) && (
        <>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px',
            borderTop: '1px solid #3a494a', marginTop: 4
          }}>
            <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ramales asociados</div>
            <div style={DrawingElementContextMenu_S7}>
              {(() => {
                const bajRamales = (engineRef.current?.ramales || []).filter((r: any) => r.net === activeNet && r.tipo !== 'tributario');
                if (bajRamales.length === 0) return <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 2' }}>Sin ramales</div>;
                const recibidos = (element.recibeDeIds || []);
                return bajRamales.map((r: any) => {
                  const isAssociated = recibidos.includes(r.id);
                  const rStart = r.pts?.[0];
                  const rEnd = r.pts?.[r.pts.length - 1];
                  const distStart = rStart ? Math.hypot(rStart[0] - element.x, rStart[1] - element.y) : Infinity;
                  const distEnd = rEnd ? Math.hypot(rEnd[0] - element.x, rEnd[1] - element.y) : Infinity;
                  const isAtStart = distStart <= distEnd;
                  return (
                    <label key={r.id} style={DrawingElementContextMenu_S8}>
                      <input type="checkbox" checked={isAssociated}
                        onChange={e => {
                          const checked = e.target.checked;
                          const newRecibe = checked
                            ? [...recibidos, r.id]
                            : recibidos.filter((id: string) => id !== r.id);
                          engineRef.current?.updateElementById(element.id, { recibeDeIds: newRecibe });
                          setContextMenuState((prev: any) => prev ? { ...prev, element: { ...prev.element, recibeDeIds: newRecibe } } : null);
                          if (selElement?.id === element.id) {
                            setSelElement({ ...selElement, recibeDeIds: newRecibe });
                          }
                          const bajCode = element.code || element.id;
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
                      <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.label || r.id}{r.ini ? ` — ini: ${r.ini}` : ''}{r.fin ? ` / fin: ${r.fin}` : ''}
                      </span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4
          }}>
            <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
            <div style={DrawingElementContextMenu_S9}>
              {(() => {
                const netBajantes = (engineRef.current?.bajantes || []).filter((b: any) => b.net === element.net && b.id !== element.id && b.tipo !== 'tributario');
                if (netBajantes.length === 0) return <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
                const currentId = element.id;
                return netBajantes.map((b: any) => {
                  const isAssociated = (element.recibeDeIds || []).includes(b.id)
                    || (b.recibeDeIds || []).includes(currentId);
                  return (
                    <label key={b.id} style={DrawingElementContextMenu_S10}>
                      <input type="checkbox" checked={isAssociated}
                        onChange={e => {
                          const checked = e.target.checked;
                          const bajFresh = element.recibeDeIds || [];
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
                          if (refreshed) setContextMenuState((prev: any) => prev ? { ...prev, element: { ...refreshed } } : null);
                          if (selElement?.id === currentId) {
                            setSelElement({ ...selElement, recibeDeIds: newBajRecibe });
                          }
                          if (selElement?.id === b.id) {
                            setSelElement({ ...selElement, recibeDeIds: newOtherRecibe });
                          }
                          engineRef.current?.render();
                        }}
                        style={{ accentColor: '#2563eb', margin: 0, flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</span>
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
        if (!supNets.includes(element.net)) return null;
        const ep = ramalEndpoint;

        const netDef = NETS.find((n: any) => n.id === element.net);

        return (
          <>
            <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              {(['bajante', 'montante'] as const).map((bmLabel) => {
                const isMon = bmLabel === 'montante';
                const pfx = isMon
                  ? (netDef?.bmType === 'montante' ? (netDef?.bmPfx || 'MON') : ('M' + (netDef?.lbl || 'MON')))
                  : (netDef?.bmPfx || 'B');
                const existingExtreme = (engineRef.current?.bajantes || []).find((b: any) =>
                  Math.abs(b.x - ep.x) < 0.5 && Math.abs(b.y - ep.y) < 0.5
                  && b.net === element.net
                );
                if (existingExtreme) return null;
                const fieldAcc = ep.idx === 0 ? 'accesorioInicio' : 'accesorioFin';
                const fieldApp = ep.idx === 0 ? 'aparatoInicio' : 'aparatoFin';
                if (element[fieldAcc] || element[fieldApp]) return null;
                return (
                  <button type="button" key={bmLabel} onClick={() => {
                    const eng = engineRef.current;
                    if (!eng) return;
                    const cnt = eng.bajantes.filter((b: any) => b.tipo === bmLabel && (!isMon || b.net === element.net)).length + 1;
                    const id = isMon ? pfx + cnt + '_' + element.net : (pfx + cnt);
                    const code = isMon ? pfx + cnt : id;
                    const nl = eng.nivelActual;
                    eng.bajantes.push({
                      id, net: element.net,
                      tipo: bmLabel,
                      code: code,
                      direccion: bmLabel === 'bajante' ? 'baja' : 'sube',
                      x: ep.x, y: ep.y,
                      pisoBase: nl?.label ?? '',
                      pisoCima: nl?.label ?? '',
                      nptBase: nl?.npt ?? 0,
                      nptCima: nl?.npt ?? 0,
                      hVert: 0,
                      dNominal: '0', recibeDeIds: [element.id], alimentaIds: [], descargaEnId: null,
                      ucAcum: 0, ucExtra: 0, area_m2: 0,
                      desplazamientos: {},
                      lblOffX: 0, lblOffY: 0, labelAngle: 0,
                      labelX: ep.x, labelY: ep.y + 20,
                      bajR: 7 / 24,
                    });
                    // Auto-fill ramal's ini/fin
                    if (ep.idx === 0) {
                      eng.updateElementById(element.id, { ini: code });
                    } else {
                      eng.updateElementById(element.id, { fin: code });
                    }
                    // Lock the ramal so the newly snapped bajante can't be dragged away independently
                    eng.updateElementById(element.id, { bloqueado: true });
                    if (bmLabel === 'montante') {
                      eng._renumberMontantes();
                    } else {
                      eng._renumberBajantes(element.net);
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
                  }} style={DrawingElementContextMenu_S13}>+ Crear {bmLabel}</button>
                );
              })}
            </div>

            {(element.tipo === 'tributario' || element.tipo === 'ramal') && ['san', 'af', 'ac', 'gas'].includes(element.net) && (() => {
              const isStart = ep.idx === 0;
              const fieldAcc = isStart ? 'accesorioInicio' : 'accesorioFin';
              const fieldDiam = isStart ? 'diametroInicio' : 'diametroFin';

              const currentAcc = element[fieldAcc] || '';
              const currentDiam = element[fieldDiam] || element.diametro || '';

              const matList = mats?.[element.net] || [];
              const matShort = element.material || matList[0]?.val || '';
              const diamList = DIAM_BY_MAT[matShort] || [];

              const accOptions = getAccessoryOptions(element.net);

              return (
                <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid #3a494a', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Extremo {isStart ? 'Inicio (Aparato)' : 'Fin (Ramal)'}
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: '#849495', marginBottom: 2 }}>Seleccionar Accesorio</div>
                    <select
                      value={currentAcc}
                      aria-label="Seleccionar Accesorio"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const fieldApp = isStart ? 'aparatoInicio' : 'aparatoFin';
                          if (element[fieldApp]) {
                            engineRef.current?.triggerAlert('Aparato existente', 'Este extremo ya tiene un aparato. Elimínalo antes de asignar un accesorio.');
                            return;
                          }
                          const existingBm = (engineRef.current?.bajantes || []).find((b: any) =>
                            Math.abs(b.x - ep.x) < 0.5 && Math.abs(b.y - ep.y) < 0.5
                            && b.net === element.net
                          );
                          if (existingBm) {
                            engineRef.current?.triggerAlert('Elemento existente', `Ya existe un ${existingBm.tipo} (${existingBm.code || existingBm.id}) en este extremo. Elimínalo antes de asignar un accesorio.`);
                            return;
                          }
                          if (val === 'codoReventilado' && diamPulgFromLabel(element.diametro || '') < 3) {
                            engineRef.current?.triggerAlert('Diámetro mínimo', 'La tubería principal sanitaria con codo reventilado requiere mínimo 3" de diámetro.');
                            return;
                          }
                          // If this extreme already has a different accessory, just replace it
                          // with the new selection instead of blocking with an alert.
                        }
                        if (engineRef.current) {
                          const oldVal = element[fieldAcc] || '';
                          const updates: any = { [fieldAcc]: val };
                          if (val && !element[fieldDiam]) {
                            updates[fieldDiam] = element.diametro || '';
                          }
                          engineRef.current.updateElementById(element.id, updates);
                          setContextMenuState((prev: any) => prev ? { ...prev, element: { ...prev.element, ...updates } } : null);
                          if (selElement?.id === element.id) {
                            setSelElement({ ...selElement, ...updates });
                          }
                          engineRef.current.render();
                          engineRef.current._markDirty();
                          if (val !== oldVal && planosCtx?.plans) {
                            syncExtremeAccessoryToHidroData(element.id, fieldAcc, oldVal, val, planosCtx.plans);
                          }
                        }
                      }}
                      style={DrawingElementContextMenu_S11}
                    >
                      <option value="">Ninguno</option>
                      {accOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {currentAcc && (
                    <div>
                      <div style={{ fontSize: 12, color: '#849495', marginBottom: 2 }}>Diametro de Accesorio</div>
                      <select
                        value={currentDiam ? currentDiam.split(' — ')[0].trim() : ''}
                        aria-label="Diametro de Accesorio"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (engineRef.current) {
                            const updates = { [fieldDiam]: val };
                            engineRef.current.updateElementById(element.id, updates);
                            setContextMenuState((prev: any) => prev ? { ...prev, element: { ...prev.element, ...updates } } : null);
                            if (selElement?.id === element.id) {
                              setSelElement({ ...selElement, ...updates });
                            }
                            engineRef.current.render();
                            engineRef.current._markDirty();
                          }
                        }}
                        style={DrawingElementContextMenu_S12}
                      >
                        <option value="">Usar diametro de red</option>
                        {(currentAcc === 'sifon'
                          ? diamList.filter((d: any) => { const v = parseFloat(d.n); return v === 2 || v === 3 || v === 4; })
                          : diamList
                        ).map((d: any) => {
                          const valClean = d.n.split(' — ')[0].trim();
                          return <option key={d.n} value={valClean}>{normalizeDnLabel(valClean)}</option>;
                        })}
                      </select>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        );
      })()}
    </>
  );
}

function BajanteCodeEditor({
  element,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
  mats,
  activeNet,
  setDiamSel,
  planosCtx,
}: {
  element: any;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<any>>;
  mats: Record<string, any[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  planosCtx: { plans: any[] };
}) {
  const isArea = element.id?.startsWith('AR');
  const hasPts = !!element.pts;
  const tipo = element.tipo;

  if (isArea) {
    return (
      <>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Asociar Bajante
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={(engineRef.current?.bajantes || []).find((b: any) => b.area_m2 === element.areaM2)?.id || ''}
            aria-label="Asociar Bajante"
            onChange={e => {
              const bajanteId = e.target.value;
              (engineRef.current?.bajantes || []).forEach((b: any) => {
                if (b.area_m2 === element.areaM2) {
                  engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                }
              });
              if (bajanteId) {
                engineRef.current?.updateElementById(bajanteId, { area_m2: element.areaM2 });
              }
              engineRef.current?.render();
              setContextMenuState(null);
            }}
            style={DrawingElementContextMenu_S14}>
            <option value="">— Sin bajante —</option>
            {(engineRef.current?.bajantes || []).filter((b: any) => b.net === element.net).map((b: any) => (
              <option key={b.id} value={b.id}>{b.code || b.id}</option>
            ))}
          </select>
        </div>
      </>
    );
  }

  if (hasPts) {
    const isGas = element.net === 'gas';
    const isVen = element.net === 'vent';
    const matList = mats?.[element.net] || [];
    const matShort = element.material || matList[0]?.val || '—';
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
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Diámetro de ramal
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={element.diametro ? element.diametro.split(' — ')[0].trim() : ''}
            aria-label="Diámetro de ramal"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                engineRef.current?.updateElementById(element.id, { diametro: val });
                setContextMenuState((prev: any) => prev ? { ...prev, element: { ...prev.element, diametro: val } } : null);
                if (selElement?.id === element.id) {
                  setSelElement({ ...selElement, diametro: val });
                }
                if (activeNet === element.net) {
                  setDiamSel((prev: any) => ({ ...prev, [activeNet]: val }));
                }
                engineRef.current?.render();
              }
            }}
            style={DrawingElementContextMenu_S15}
          >
            <option value="">— Sin diámetro —</option>
            {diamList.map((d: any) => {
              const valClean = d.n.split(' — ')[0].trim();
              return <option key={d.n} value={valClean}>{normalizeDnLabel(valClean)}</option>;
            })}
          </select>
        </div>
      </>
    );
  }

  if (tipo === 'contador') {
    return (
      <>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Contador: {element.code || element.id}
        </div>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Diámetro del Contador
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={element.dNominal ? element.dNominal.replace(/"/g, '').trim() : ''}
            aria-label="Diámetro del Contador"
            onChange={(e) => {
              const val = e.target.value;
              const dNom = val ? `${val}"` : '';
              if (engineRef.current) {
                const fields = { dNominal: dNom };
                engineRef.current?.updateElementById(element.id, fields);
                const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                if (fresh) {
                  setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, dNominal: fields.dNominal });
                  }
                }
                engineRef.current?.render();
                writeContadorDiamToDrawing(dNom, planosCtx.plans, element.net || 'af');
              }
            }}
            style={DrawingElementContextMenu_S16}
          >
            <option value="">— Sin diámetro —</option>
              {CONTADORES_CAT.map((c: any) => (
                <option key={c.dn} value={c.dn}>{normalizeDnLabel(c.dn)}"</option>
              ))}
          </select>
        </div>
        {(element.net === 'af' || element.net === 'gas') && (
          <div style={{ borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <div style={{ fontSize: 12, color: '#22D3EE', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {element.net === 'gas' ? 'Conexión (Red → Contador)' : 'AC-01 (Red Pública → Contador)'}
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4 }}>Diámetro</div>
              <select
                value={element.acoDiam || ''}
                aria-label="Diámetro"
                onChange={(e) => {
                  const val = e.target.value;
                  if (engineRef.current) {
                    engineRef.current?.updateElementById(element.id, { acoDiam: val });
                    const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                    if (fresh) {
                      setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                    }
                    engineRef.current?.render();
                    writeAcoDiamToDrawing(val, planosCtx.plans, element.net || 'af');
                  }
                }}
                style={DrawingElementContextMenu_S17}
              >
                <option value="">— Sin diámetro —</option>
                {(element.net === 'gas' ? GAS_DN_LABELS : DIAMETROS_AF.map(d => d.nominal)).map(d => (
                  <option key={d} value={d}>{normalizeDnLabel(d)}</option>
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
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Calentador: {element.code || element.id}
        </div>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Equipo (Capacidad)
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={element.capacidad || ''}
            aria-label="Equipo (Capacidad)"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                const fields = { capacidad: val };
                engineRef.current?.updateElementById(element.id, fields);
                const fresh = engineRef.current?.bajantes.find((b: any) => b.id === element.id);
                if (fresh) {
                  setContextMenuState((prev: any) => prev ? { ...prev, element: { ...fresh } } : null);
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, capacidad: val });
                  }
                }
                engineRef.current?.render();
              }
            }}
            style={DrawingElementContextMenu_S18}
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

function getAccessoryOptions(netId: string) {
  if (netId === 'san') {
    return SAN_ACCESORIOS.filter(a => a.id === 'codo90rmSube' || a.id === 'codo90rmBaja' || a.id === 'codoReventilado' || a.id === 'sifon').map(a => ({ value: a.id, label: a.nombre }));
  }
  if (['ll', 'vent'].includes(netId)) {
    return SAN_ACCESORIOS.map(a => ({ value: a.id, label: a.nombre }));
  }
  if (netId === 'gas') {
    return GAS_ACCESORIOS.map(a => ({ value: a.id, label: a.nombre }));
  }
  if (['af', 'ac', 'rci', 'rec'].includes(netId)) {
    // AF/AC: válvulas, reducciones, ampliaciones, otros, y codos de subida/bajada (sin tees ni el resto de codos)
    return ACCESORIOS_HIDRO.filter(a => (a.cat !== 'Codos' && a.cat !== 'Tees') || a.id === 'codo90rmSube' || a.id === 'codo90rmBaja').map(a => ({ value: a.id, label: a.nombre }));
  }
  return [];
}

function BajanteMenu() {
  const ctx = useDrawingElementContextMenu()
  const { contextMenuState, element } = ctx
  const isGhostClick = contextMenuState.isGhostClick || false
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(ctx.activeNet)

  return (
    <>
      <BajanteDirectionSelector
        element={element}
        isGhostClick={isGhostClick}
        selectedNivel={ctx.selectedNivel}
        pisos={ctx.pisos}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
      />
      <BajanteDiameterSelector
        element={element}
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
          element={element}
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
  const ctx = useDrawingElementContextMenu()
  return (
    <BajanteCodeEditor
      element={ctx.element}
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

function MidRamalAccessorySelector({ element, midRamalHit, engineRef, selElement, setSelElement }: {
  element: any;
  midRamalHit: { segmentIdx: number; x: number; y: number };
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: Record<string, any> | null;
  setSelElement: (el: Record<string, any> | null) => void;
}) {
  const options = getAccessoryOptions(element.net);
  if (options.length === 0) return null;

  // If an accMed vertex already sits (almost) exactly at the clicked point, edit that one
  // instead of inserting a new vertex.
  const accMed = element.accMed || {};
  let existingKey: string | null = null;
  for (const k of Object.keys(accMed)) {
    const m = k.match(/^accMed(\d+)$/);
    if (!m) continue;
    const pt = element.pts?.[parseInt(m[1], 10)];
    if (pt && Math.hypot(pt[0] - midRamalHit.x, pt[1] - midRamalHit.y) < 2) {
      existingKey = k;
      break;
    }
  }
  const currentVal = existingKey ? accMed[existingKey] : '';

  return (
    <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
      <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Accesorio en cuerpo del ramal
      </div>
      <select
        value={currentVal}
        aria-label="Accesorio en cuerpo del ramal"
        onChange={(e) => {
          const accId = e.target.value;
          const eng = engineRef.current;
          if (!eng) return;
          const fresh = eng.ramales.find((r: any) => r.id === element.id);
          if (!fresh) return;

          if (accId === 'codoReventilado' && diamPulgFromLabel(fresh.diametro || '') < 3) {
            eng.triggerAlert('Diámetro mínimo', 'La tubería principal sanitaria con codo reventilado requiere mínimo 3" de diámetro.');
            return;
          }

          if (existingKey) {
            const newAccMed = { ...(fresh.accMed || {}) };
            if (accId) { newAccMed[existingKey] = accId; } else { delete newAccMed[existingKey]; }
            eng.updateElementById(element.id, { accMed: newAccMed });
            if (selElement?.id === element.id) setSelElement({ ...selElement, accMed: newAccMed });
          } else if (accId) {
            // Insert a new vertex at the clicked point (splitting the segment, not the ramal)
            // and attach the accessory there.
            const newIdx = midRamalHit.segmentIdx + 1;
            const newPts = fresh.pts.map((p: number[]) => [...p]);
            newPts.splice(newIdx, 0, [midRamalHit.x, midRamalHit.y]);
            // Existing accMed keys at/after the insertion point shift up by one index.
            const shiftedAccMed: Record<string, string> = {};
            for (const [k, v] of Object.entries(fresh.accMed || {})) {
              const m = k.match(/^accMed(\d+)$/);
              if (!m) continue;
              const idx = parseInt(m[1], 10);
              shiftedAccMed[`accMed${idx >= newIdx ? idx + 1 : idx}`] = v as string;
            }
            shiftedAccMed[`accMed${newIdx}`] = accId;
            eng.updateElementById(element.id, { pts: newPts, accMed: shiftedAccMed });
            if (selElement?.id === element.id) setSelElement({ ...selElement, pts: newPts, accMed: shiftedAccMed });
          }
          eng.render();
          eng._markDirty();
        }}
        style={DrawingElementContextMenu_S17}
      >
        <option value="">Ninguno</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function RamalMenu() {
  const ctx = useDrawingElementContextMenu()
  const { contextMenuState, element, engineRef, selElement, setSelElement } = ctx

  return (
    <>
      {contextMenuState.midRamalHit && !contextMenuState.ramalEndpoint && getAccessoryOptions(element.net).length > 0 && (
        <MidRamalAccessorySelector
          element={element}
          midRamalHit={contextMenuState.midRamalHit}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
        />
      )}
      {contextMenuState.ramalEndpoint && (
        <BajanteConnectionPanel
          element={element}
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
        element={element}
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
        <span style={{ fontSize: 12, color: '#e2e2e8', fontFamily: "'Geist',monospace" }}>Bloquear movimiento</span>
        <input type="checkbox" checked={!!element.bloqueado} aria-label="Bloquear movimiento"
          onChange={e => {
            const val = e.target.checked;
            if (engineRef.current) {
              engineRef.current?.updateElementById(element.id, { bloqueado: val });
              if (selElement?.id === element.id) {
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
          <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
          <div style={DrawingElementContextMenu_S21}>
            {(() => {
              const currentId = element.id;
              const netBajantes = (engineRef.current?.bajantes || []).filter((b: any) => b.net === element.net && b.id !== element.id && b.tipo !== 'tributario');
              if (netBajantes.length === 0) return <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
              return netBajantes.map((b: any) => {
                const isAssociated = (b.recibeDeIds || []).includes(currentId);
                return (
                  <label key={b.id} style={DrawingElementContextMenu_S22}>
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
                    <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</span>
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
  const ctx = useDrawingElementContextMenu()
  return (
    <BajanteCodeEditor
      element={ctx.element}
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
  const ctx = useDrawingElementContextMenu()
  return (
    <BajanteCodeEditor
      element={ctx.element}
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

interface DrawingElementContextMenuProps {
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

export default memo(function DrawingElementContextMenu(props: DrawingElementContextMenuProps) {
  const state = props.contextMenuState;
  if (!state || !state.visible) return null;

  const ctxValue: DrawingElementContextMenuContextValue = {
    contextMenuState: state,
    setContextMenuState: props.setContextMenuState,
    element: state.element,
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
    <DrawingElementContextMenuCtx.Provider value={ctxValue}>
      <DrawingElementContextMenuInner />
    </DrawingElementContextMenuCtx.Provider>
  )
})

function DrawingElementContextMenuInner() {
  const ctx = useDrawingElementContextMenu()
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

  const element = contextMenuState.element;
  const isBajanteTipo = element.tipo === 'bajante' || element.tipo === 'montante' || element.id?.startsWith('B');
  const isArea = element.id?.startsWith('AR');
  const hasPts = !!element.pts;
  const tipo = element.tipo;

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
        }} style={{ ...DrawingElementContextMenu_S23, left: adjustedPos.x, top: adjustedPos.y }} onContextMenu={(e) => e.preventDefault()}>
        {isBajanteTipo && !hasPts ? <BajanteMenu /> :
         isArea ? <AreaMenu /> :
         hasPts ? <RamalMenu /> :
         tipo === 'contador' ? <ContadorMenu /> :
         tipo === 'calentador' ? <CalentadorMenu /> : null}
      </form>
    </>
  );
}
