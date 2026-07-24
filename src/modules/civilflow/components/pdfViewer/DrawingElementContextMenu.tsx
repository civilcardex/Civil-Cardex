import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import { bajanteLabel, ramalLabel } from "../../utils/accessoryAbbreviations";
import { normalizeDnLabel } from "../../utils/formatUtils";
import { pisoLbl, DIAM_BAN, DIAM_VENT, DIAM_BY_MAT, GAS_DN_LABELS } from "../../constants";
import { APARATOS_DEF, AF_UC_IDS, AC_UC_IDS, SAN_UC_IDS } from "../../constants/engineeringDataFixtures";
import { getAccessoryOptions } from "../../utils/accessoryOptions";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import { BAJANTE_NETS, MONTANTE_NETS } from "../../lib/PlanoEngine/drawingCreations";
import { writeBajantePropToDrawing, writeAcoDiamToDrawing, writeContadorDiamToDrawing } from "../../utils/writeDiameterToDrawing";
import { syncExtremeAccessoryToHidroData, bumpHidroAccesorio } from "../../utils/syncExtremeAccessory";
import { GAS, CAT_GAS } from "../../constants/engineeringDataGas";
import { VENTILACION, CONTADORES as CONTADORES_CAT } from "../../pages/catalog/catalogData";
import { DIAMETROS_AF } from "../../constants/hydraulicData";
import { diamPulgFromLabel } from "../../utils/diamPulgFromLabel";
import PlanoEngine from "../../lib/PlanoEngine/PlanoEngine";
import type { PlanoElement, PlanoRamal, PlanoBajante, PlanoArea } from "../../lib/PlanoEngine/PlanoState";
import type { Piso } from "../useWorkAreaState";
import type { PlanItem } from "../../context/PlansContext";
import type { MaterialItem } from "../../context/ProjectContext";

// Structural probe of a PlanoElement union: lets code sniff `tipo`/`pts` (present on some
// element kinds, absent on others) the same way the engine's own runtime dispatch does,
// without narrowing via the exported type guards at every access site.
type ProbedElement = PlanoElement & { tipo?: string; pts?: number[][] };

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  element: PlanoElement;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  midRamalHit?: { segmentIdx: number; x: number; y: number } | null;
}

interface DrawingElementContextMenuContextValue {
  contextMenuState: ContextMenuState
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>
  element: PlanoElement
  selectedNivel: number | null
  pisos: Piso[]
  engineRef: React.MutableRefObject<PlanoEngine | null>
  selElement: PlanoElement | null
  setSelElement: (el: PlanoElement | null) => void
  lowerFloorsRamales: LowerFloorRamales[]
  planosCtx: { plans: PlanItem[] }
  mats: Record<string, MaterialItem[]>
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
  textAlign: 'left', fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer',
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
const DrawingElementContextMenu_S7: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 };
const DrawingElementContextMenu_S8: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: '#b9caca', fontFamily: "'Geist',monospace" };
const DrawingElementContextMenu_S9: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', maxHeight: 160, overflowY: 'auto', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, padding: 4 };
const DrawingElementContextMenu_S13: React.CSSProperties = { width: '100%', padding: '6px 8px', cursor: 'pointer', background: '#1e2024', border: '1px dashed #00dce5', borderRadius: 4, color: '#00dce5', fontSize: 12, fontFamily: "'Geist',monospace", textAlign: 'center', fontWeight: 600, };
const DrawingElementContextMenu_S22: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 };
const DrawingElementContextMenu_S23: React.CSSProperties = { position: 'absolute', zIndex: 101, background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: '4px', minWidth: 170, maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' };




export interface LowerFloorRamales {
  planId: string | number;
  planName: string;
  npt: number | string;
  bajantes: PlanoBajante[];
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
  element: PlanoBajante;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  pisos: Piso[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
  const gd = element.ghostData?.[currentGhostLabel];
  const ghostDir = isGhostClick ? (gd && gd.direccion !== undefined ? gd.direccion : element.direccion) : element.direccion;

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(element.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as Record<string, string>)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current?.updateElementById(element.id, { ghostData: gd2 });
    const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
    if (fresh) {
      setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
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
                const allNpts = pisos.map(p => p.npt).sort((a, b) => Number(a) - Number(b));
                const maxNpt = allNpts[allNpts.length - 1] || 0;
                const minNpt = allNpts[0] || 0;
                let updates: Record<string, unknown> = {};

                if (opt === 'Sube') {
                  updates = { direccion: 'sube', nptBase: currentNpt, nptCima: maxNpt, desplazamientos: { ...(element.desplazamientos || {}) } };
                } else if (opt === 'Baja') {
                  updates = { direccion: 'baja', nptBase: minNpt, nptCima: currentNpt, desplazamientos: { ...(element.desplazamientos || {}) } };
                } else if (opt === 'Continua') {
                  updates = { direccion: 'continua', desplazamientos: { ...(element.desplazamientos || {}) } };
                }
                if (Object.keys(updates).length > 0) {
                  engineRef.current?.updateElementById(element.id, updates);
                  // A montante's accessory (codo90rmSube/Baja at a ramal endpoint, or teeSube/Baja
                  // at a mid-body split) was written once at creation time and never re-synced when
                  // the direction changed afterward — always stayed whatever it was first set to.
                  // Re-derive it from the CURRENT direction here instead, locating the exact point
                  // by position (endpoint → codo, interior vertex → tee) rather than assuming it's
                  // always an endpoint.
                  if (element.tipo === 'montante' && (updates.direccion === 'sube' || updates.direccion === 'baja')) {
                    const isSube = updates.direccion === 'sube';
                    const codoId = isSube ? 'codo90rmSube' : 'codo90rmBaja';
                    const teeId = isSube ? 'teeSube' : 'teeBaja';
                    const TOL = 0.5;
                    for (const rid of element.recibeDeIds || []) {
                      const ram = engineRef.current?.ramales.find((r) => r.id === rid);
                      if (!ram || !ram.pts?.length) continue;
                      const idx = ram.pts.findIndex(([px, py]) => Math.hypot(px - element.x, py - element.y) < TOL);
                      if (idx === -1) continue;
                      if (idx === 0) engineRef.current?.updateElementById(ram.id, { accesorioInicio: codoId });
                      else if (idx === ram.pts.length - 1) engineRef.current?.updateElementById(ram.id, { accesorioFin: codoId });
                      else engineRef.current?.updateElementById(ram.id, { accMed: { ...(ram.accMed || {}), [`accMed${idx}`]: teeId } });
                    }
                  }
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
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
            // A bajante that already has a ramal/tributario connected to it can't become a
            // fantasma — the desplazamiento would visually detach it from what it's really
            // feeding, so block activation with an explicit warning instead.
            if (!isFantasma && (element.recibeDeIds?.length ?? 0) > 0) {
              engineRef.current.triggerAlert('No se puede activar fantasma', 'Este bajante ya tiene un ramal o tributario conectado. Desconéctalo antes de activar el desplazamiento.');
              return;
            }
            const updates: Record<string, unknown> = { isFantasma: !isFantasma };
            if (!isFantasma && lvl) {
              const currentDesp = { ...(element.desplazamientos || {}) };
              if (!currentDesp[lvl]) {
                currentDesp[lvl] = { dx: 2, dy: 0 };
                updates.desplazamientos = currentDesp;
              }
            }
            engineRef.current?.updateElementById(element.id, updates);
            setTimeout(() => {
              const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
              if (fresh) {
                setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
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
  element: PlanoBajante;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  lowerFloorsRamales: LowerFloorRamales[];
  planosCtx: { plans: PlanItem[] };
}) {
  const currentGhostLabel = selectedNivel !== null ? pisoLbl(selectedNivel) : '';

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(element.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as Record<string, string>)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current.updateElementById(element.id, { ghostData: gd2 });
    const fresh = engineRef.current.bajantes.find((b) => b.id === element.id);
    if (fresh) {
      setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
      if (selElement?.id === element.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

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
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, descargaEnId: v });
                  }
                  const bKey = `${element.id}-${engineRef.current?.planId}`;
                  writeBajantePropToDrawing(bKey, element.net || 'san', 'descargaEnId', v, planosCtx.plans);
                  // Associating stacks THIS bajante (current floor, in the viewer) on top of a
                  // lower-floor one — a real riser is a straight vertical pipe, so this one must
                  // sit at the exact same plan x/y as the lower-floor target. The target stays
                  // put; this one (the floor being viewed/edited) snaps to it immediately.
                  if (v) {
                    const [targetPlanId, targetBajanteId] = v.split('|');
                    const targetGroup = lowerFloorsRamales.find((g) => String(g.planId) === targetPlanId);
                    const targetBaj = targetGroup?.bajantes.find((b) => b.id === targetBajanteId);
                    if (targetBaj && targetBaj.x != null && targetBaj.y != null) {
                      // Shift the label by the same delta as the bajante itself — labelX/labelY
                      // are an absolute plan position, not an offset relative to x/y, so moving
                      // x/y alone left the label sitting back at the old spot (same delta pattern
                      // handleDragMove.ts already uses when dragging a bajante by hand).
                      const dxMove = targetBaj.x - element.x;
                      const dyMove = targetBaj.y - element.y;
                      const newLabelX = element.labelX != null ? element.labelX + dxMove : undefined;
                      const newLabelY = element.labelY != null ? element.labelY + dyMove : undefined;
                      const moveFields: Record<string, number> = { x: targetBaj.x, y: targetBaj.y };
                      if (newLabelX != null) moveFields.labelX = newLabelX;
                      if (newLabelY != null) moveFields.labelY = newLabelY;
                      engineRef.current?.updateElementById(element.id, moveFields);
                      const moved = engineRef.current?.bajantes.find((b) => b.id === element.id);
                      if (moved) setContextMenuState((prev) => prev ? { ...prev, element: { ...moved } } : null);
                      if (selElement?.id === element.id) {
                        setSelElement({ ...selElement, ...moveFields });
                      }
                      for (const [field, val] of Object.entries(moveFields)) {
                        writeBajantePropToDrawing(bKey, element.net || 'san', field, val, planosCtx.plans);
                      }
                    }
                  }
                }}
                style={{ ...DrawingElementContextMenu_S2, width: '85%' }}>
                <option value="">Sin destino</option>
                {lowerFloorsRamales.map(group => {
                  const plano = planosCtx.plans.find((pl) => (pl.id as unknown as string) === group.planId);
                  const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                  const hasBajantes = group.bajantes && group.bajantes.filter((b) => b.id !== element.id).length > 0;
                  return (
                    <optgroup key={group.planId} label={pLabel}>
                      {hasBajantes && group.bajantes.filter((b) => b.id !== element.id).map((b) => (
                        <option key={`${group.planId}|${b.id}`} value={`${group.planId}|${b.id}`}>
                          {b.code || b.id}
                        </option>
                      ))}
                      {!hasBajantes && (
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
                  if (isGhostClick) {
                    updateGhostField('dNominal', val);
                  } else {
                    const fields = { dNominal: val };
                    engineRef.current?.updateElementById(element.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                    if (fresh) {
                      setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
                      if (selElement?.id === element.id) {
                        setSelElement({ ...selElement, dNominal: fields.dNominal });
                      }
                    }
                  }
                }}
                style={DrawingElementContextMenu_S2}>
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
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, bajR: valNum });
                  }
                }}
                style={DrawingElementContextMenu_S2}>
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
                  setContextMenuState((prev) => prev ? { ...prev, element: { ...prev.element, area_m2: val } } : null);
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, area_m2: val });
                  }
                }}
                style={DrawingElementContextMenu_S2}>
                <option value="">Sin área</option>
                {(engineRef.current?.areas || []).filter((a) => a.net === element.net).map((a) => (
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
                  updateGhostField('dNominal', val);
                } else {
                  const fields = { dNominal: val };
                  engineRef.current?.updateElementById(element.id, fields);
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
                    if (selElement?.id === element.id) {
                      setSelElement({ ...selElement, dNominal: fields.dNominal });
                    }
                  }
                }
              } 
            }}
            style={DrawingElementContextMenu_S2}>
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
  activeNet,
  planosCtx,
}: {
  element: PlanoBajante | PlanoRamal;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  activeNet: string;
  planosCtx?: { plans: PlanItem[] };
}) {
  const hasPts = !!(element as Partial<PlanoRamal>).pts;
  const bajEl = element as PlanoBajante;
  const ramalEl = element as PlanoRamal;

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
                const bajRamales = (engineRef.current?.ramales || []).filter((r) => r.net === activeNet && r.tipo !== 'tributario');
                if (bajRamales.length === 0) return <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 2' }}>Sin ramales</div>;
                const recibidos = (bajEl.recibeDeIds || []);
                return bajRamales.map((r) => {
                  const isAssociated = recibidos.includes(r.id);
                  const rStart = r.pts?.[0];
                  const rEnd = r.pts?.[r.pts.length - 1];
                  const distStart = rStart ? Math.hypot(rStart[0] - bajEl.x, rStart[1] - bajEl.y) : Infinity;
                  const distEnd = rEnd ? Math.hypot(rEnd[0] - bajEl.x, rEnd[1] - bajEl.y) : Infinity;
                  const isAtStart = distStart <= distEnd;
                  return (
                    <label key={r.id} style={DrawingElementContextMenu_S8}>
                      <input type="checkbox" checked={isAssociated}
                        onChange={e => {
                          const checked = e.target.checked;
                          // Read the live recibeDeIds off the engine's own bajante object rather
                          // than the closed-over `recibidos` snapshot — two checkboxes toggled
                          // before React re-renders between them would otherwise each compute
                          // newRecibe from the same stale array and clobber each other's change.
                          const liveBaj = engineRef.current?.bajantes.find((bb) => bb.id === bajEl.id);
                          const liveRecibe: string[] = liveBaj?.recibeDeIds || recibidos;
                          const newRecibe = checked
                            ? [...liveRecibe, r.id]
                            : liveRecibe.filter((id: string) => id !== r.id);
                          engineRef.current?.updateElementById(bajEl.id, { recibeDeIds: newRecibe });
                          setContextMenuState((prev) => prev ? { ...prev, element: { ...prev.element, recibeDeIds: newRecibe } } : null);
                          if (selElement?.id === bajEl.id) {
                            setSelElement({ ...selElement, recibeDeIds: newRecibe });
                          }
                          const bajCode = bajEl.code || bajEl.id;
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
                        {ramalLabel(r, engineRef.current?.nivelActual?.label)}
                      </span>
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
        if (!supNets.includes(ramalEl.net)) return null;
        const ep = ramalEndpoint;

        const netDef = NETS.find((n) => n.id === ramalEl.net);

        return (
          <>
            <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              {(['bajante', 'montante'] as const)
                .filter((bmLabel) => bmLabel === 'montante' ? MONTANTE_NETS.includes(ramalEl.net) : BAJANTE_NETS.includes(ramalEl.net))
                .map((bmLabel) => {
                const isMon = bmLabel === 'montante';
                const pfx = isMon
                  ? (netDef?.bmType === 'montante' ? (netDef?.bmPfx || 'MON') : ('M' + (netDef?.lbl || 'MON')))
                  : (netDef?.bmPfx || 'B');
                const existingExtreme = (engineRef.current?.bajantes || []).find((b) =>
                  Math.abs(b.x - ep.x) < 0.5 && Math.abs(b.y - ep.y) < 0.5
                  && b.net === ramalEl.net
                );
                if (existingExtreme) return null;
                const fieldAcc = ep.idx === 0 ? 'accesorioInicio' : 'accesorioFin';
                const fieldApp = ep.idx === 0 ? 'aparatoInicio' : 'aparatoFin';
                if (ramalEl[fieldAcc] || ramalEl[fieldApp]) return null;
                return (
                  <button type="button" key={bmLabel} onClick={() => {
                    const eng = engineRef.current;
                    if (!eng) return;
                    const cnt = eng.bajantes.filter((b) => b.tipo === bmLabel && (!isMon || b.net === ramalEl.net)).length + 1;
                    const id = isMon ? pfx + cnt + '_' + ramalEl.net : (pfx + cnt);
                    const code = isMon ? pfx + cnt : id;
                    const nl = eng.nivelActual;
                    eng.bajantes.push({
                      id, net: ramalEl.net,
                      tipo: bmLabel,
                      code: code,
                      direccion: bmLabel === 'bajante' ? 'baja' : 'sube',
                      x: ep.x, y: ep.y,
                      pisoBase: nl?.label ?? '',
                      pisoCima: nl?.label ?? '',
                      nptBase: nl?.npt ?? 0,
                      nptCima: nl?.npt ?? 0,
                      hVert: 0,
                      dNominal: '0', recibeDeIds: [ramalEl.id], alimentaIds: [], descargaEnId: null,
                      ucAcum: 0, ucExtra: 0, area_m2: 0,
                      desplazamientos: {},
                      lblOffX: 0, lblOffY: 0, labelAngle: 0,
                      labelX: ep.x, labelY: ep.y + 20,
                      bajR: 7 / 24,
                    });
                    // Auto-fill ramal's ini/fin
                    if (ep.idx === 0) {
                      eng.updateElementById(ramalEl.id, { ini: code });
                    } else {
                      eng.updateElementById(ramalEl.id, { fin: code });
                    }
                    // Lock the ramal so the newly snapped bajante can't be dragged away independently
                    eng.updateElementById(ramalEl.id, { bloqueado: true });
                    if (bmLabel === 'montante') {
                      eng._renumberMontantes();
                    } else {
                      eng._renumberBajantes(ramalEl.net);
                    }
                    const newlyCreated = eng.bajantes.find((b) => b.tipo === bmLabel && b.x === ep.x && b.y === ep.y);
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

            {(ramalEl.tipo === 'tributario' || ramalEl.tipo === 'ramal') && ['san', 'af', 'ac', 'gas'].includes(ramalEl.net) && (() => {
              const isStart = ep.idx === 0;
              const fieldAcc: 'accesorioInicio' | 'accesorioFin' = isStart ? 'accesorioInicio' : 'accesorioFin';
              const fieldDiam: 'diametroInicio' | 'diametroFin' = isStart ? 'diametroInicio' : 'diametroFin';
              const fieldApp: 'aparatoInicio' | 'aparatoFin' = isStart ? 'aparatoInicio' : 'aparatoFin';

              const currentAcc = ramalEl[fieldAcc] || '';
              const currentApp = ramalEl[fieldApp] || '';

              const accOptions = getAccessoryOptions(ramalEl.net);
              const aparatoIds = ramalEl.net === 'af' ? AF_UC_IDS : ramalEl.net === 'ac' ? AC_UC_IDS : ramalEl.net === 'san' ? SAN_UC_IDS : APARATOS_DEF.filter(a => a.grupo === 'g').map(a => a.id);
              const aparatoOptions = aparatoIds.map(id => APARATOS_DEF.find(a => a.id === id)).filter((a): a is typeof APARATOS_DEF[number] => !!a);

              return (
                <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid #3a494a', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Extremo {isStart ? 'Inicio (Aparato)' : 'Fin (Ramal)'}
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: '#849495', marginBottom: 2, textTransform: 'uppercase' }}>Seleccionar Accesorio</div>
                    <select
                      value={currentAcc}
                      aria-label="Seleccionar Accesorio"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          if (ramalEl[fieldApp]) {
                            engineRef.current?.triggerAlert('Aparato existente', 'Este extremo ya tiene un aparato. Elimínalo antes de asignar un accesorio.');
                            return;
                          }
                          const existingBm = (engineRef.current?.bajantes || []).find((b) =>
                            Math.abs(b.x - ep.x) < 0.5 && Math.abs(b.y - ep.y) < 0.5
                            && b.net === ramalEl.net
                          );
                          if (existingBm) {
                            engineRef.current?.triggerAlert('Elemento existente', `Ya existe un ${existingBm.tipo} (${existingBm.code || existingBm.id}) en este extremo. Elimínalo antes de asignar un accesorio.`);
                            return;
                          }
                          if (val === 'codoReventilado' && (diamPulgFromLabel(ramalEl.diametro || '') < 3 || diamPulgFromLabel(ramalEl.diametro || '') > 4)) {
                            engineRef.current?.triggerAlert('Diámetro no permitido', 'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".');
                            return;
                          }
                          // If this extreme already has a different accessory, just replace it
                          // with the new selection instead of blocking with an alert.
                        }
                        if (engineRef.current) {
                          const oldVal = ramalEl[fieldAcc] || '';
                          const updates: Record<string, unknown> = { [fieldAcc]: val };
                          if (val && !ramalEl[fieldDiam]) {
                            updates[fieldDiam] = ramalEl.diametro || '';
                          }
                          engineRef.current.updateElementById(ramalEl.id, updates);
                          setContextMenuState((prev) => prev ? { ...prev, element: { ...prev.element, ...updates } } : null);
                          if (selElement?.id === ramalEl.id) {
                            setSelElement({ ...selElement, ...updates });
                          }
                          engineRef.current.render();
                          engineRef.current._markDirty();
                          if (val !== oldVal && planosCtx?.plans) {
                            syncExtremeAccessoryToHidroData(ramalEl.id, fieldAcc, oldVal, val, planosCtx.plans);
                          }
                        }
                      }}
                      style={DrawingElementContextMenu_S2}
                    >
                      <option value="">Ninguno</option>
                      {accOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Diámetro de accesorio ya no es editable por separado — siempre es el
                      diámetro del ramal (ver el "Diámetro de ramal" selector y el onChange que
                      mantiene diametroInicio/diametroFin sincronizados). */}

                  {ramalEl.net !== 'san' && (
                  <div>
                    <div style={{ fontSize: 12, color: '#849495', marginBottom: 2 }}>Seleccionar Aparato</div>
                    <select
                      value={currentApp}
                      aria-label="Seleccionar Aparato"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          if (ramalEl[fieldAcc]) {
                            engineRef.current?.triggerAlert('Accesorio existente', 'Este extremo ya tiene un accesorio. Elimínalo antes de asignar un aparato.');
                            return;
                          }
                          const existingBm = (engineRef.current?.bajantes || []).find((b) =>
                            Math.abs(b.x - ep.x) < 0.5 && Math.abs(b.y - ep.y) < 0.5
                            && b.net === ramalEl.net
                          );
                          if (existingBm) {
                            engineRef.current?.triggerAlert('Elemento existente', `Ya existe un ${existingBm.tipo} (${existingBm.code || existingBm.id}) en este extremo. Elimínalo antes de asignar un aparato.`);
                            return;
                          }
                        }
                        if (engineRef.current) {
                          const updates: Record<string, unknown> = { [fieldApp]: val || null };
                          engineRef.current.updateElementById(ramalEl.id, updates);
                          setContextMenuState((prev) => prev ? { ...prev, element: { ...prev.element, ...updates } } : null);
                          if (selElement?.id === ramalEl.id) {
                            setSelElement({ ...selElement, ...updates });
                          }
                          engineRef.current.render();
                          engineRef.current._markDirty();
                        }
                      }}
                      style={DrawingElementContextMenu_S2}
                    >
                      <option value="">Ninguno</option>
                      {aparatoOptions.map(a => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
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
  element: PlanoElement;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  mats: Record<string, MaterialItem[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  planosCtx: { plans: PlanItem[] };
}) {
  const probed = element as ProbedElement;
  const isArea = probed.id?.startsWith('AR');
  const hasPts = !!probed.pts;
  const tipo = probed.tipo;

  if (isArea) {
    const areaEl = element as PlanoArea;
    return (
      <>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Asociar Bajante
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={(engineRef.current?.bajantes || []).find((b) => b.area_m2 === areaEl.areaM2)?.id || ''}
            aria-label="Asociar Bajante"
            onChange={e => {
              const bajanteId = e.target.value;
              (engineRef.current?.bajantes || []).forEach((b) => {
                if (b.area_m2 === areaEl.areaM2) {
                  engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                }
              });
              if (bajanteId) {
                engineRef.current?.updateElementById(bajanteId, { area_m2: areaEl.areaM2 });
              }
              engineRef.current?.render();
              setContextMenuState(null);
            }}
            style={DrawingElementContextMenu_S2}>
            <option value="">— Sin bajante —</option>
            {(engineRef.current?.bajantes || []).filter((b) => b.net === areaEl.net).map((b) => (
              <option key={b.id} value={b.id}>{b.code || b.id}</option>
            ))}
          </select>
        </div>
      </>
    );
  }

  if (hasPts) {
    const ramalEl = element as PlanoRamal;
    const isGas = ramalEl.net === 'gas';
    const isVen = ramalEl.net === 'vent';
    const matList = mats?.[ramalEl.net] || [];
    const matShort = ramalEl.material || matList[0]?.val || '—';
    let diamList: Array<{ n: string }> = [];
    if (isVen) {
      diamList = VENTILACION[0]?.rows.map((r) => ({ n: r.dn })) || [];
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
            value={ramalEl.diametro ? ramalEl.diametro.split(' — ')[0].trim() : ''}
            aria-label="Diámetro de ramal"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                // Accessory diameter (diametroInicio/Fin) no longer has its own picker — it always
                // mirrors the ramal's own diameter, so it must be kept in sync here too, not just
                // set once when the accessory is first created.
                const updates = { diametro: val, diametroInicio: val, diametroFin: val };
                engineRef.current?.updateElementById(ramalEl.id, updates);
                setContextMenuState((prev) => prev ? { ...prev, element: { ...prev.element, ...updates } } : null);
                if (selElement?.id === ramalEl.id) {
                  setSelElement({ ...selElement, ...updates });
                }
                if (activeNet === ramalEl.net) {
                  setDiamSel((prev) => ({ ...prev, [activeNet]: val }));
                }
                engineRef.current?.render();
              }
            }}
            style={DrawingElementContextMenu_S2}
          >
            <option value="">— Sin diámetro —</option>
            {diamList.map((d) => {
              const valClean = d.n.split(' — ')[0].trim();
              return <option key={d.n} value={valClean}>{normalizeDnLabel(valClean)}</option>;
            })}
          </select>
        </div>
      </>
    );
  }

  if (tipo === 'contador') {
    const bajEl = element as PlanoBajante;
    return (
      <>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Contador: {bajEl.code || bajEl.id}
        </div>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Diámetro del Contador
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajEl.dNominal ? bajEl.dNominal.replace(/"/g, '').trim() : ''}
            aria-label="Diámetro del Contador"
            onChange={(e) => {
              const val = e.target.value;
              const dNom = val ? `${val}"` : '';
              if (engineRef.current) {
                const fields = { dNominal: dNom };
                engineRef.current?.updateElementById(bajEl.id, fields);
                const fresh = engineRef.current?.bajantes.find((b) => b.id === bajEl.id);
                if (fresh) {
                  setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
                  if (selElement?.id === bajEl.id) {
                    setSelElement({ ...selElement, dNominal: fields.dNominal });
                  }
                }
                engineRef.current?.render();
                writeContadorDiamToDrawing(dNom, planosCtx.plans, bajEl.net || 'af');
              }
            }}
            style={DrawingElementContextMenu_S2}
          >
            <option value="">— Sin diámetro —</option>
              {CONTADORES_CAT.map((c) => (
                <option key={c.dn} value={c.dn}>{normalizeDnLabel(c.dn)}"</option>
              ))}
          </select>
        </div>
        {(bajEl.net === 'af' || bajEl.net === 'gas') && (
          <div style={{ borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <div style={{ fontSize: 12, color: '#22D3EE', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {bajEl.net === 'gas' ? 'Conexión (Red → Contador)' : 'AC-01 (Red Pública → Contador)'}
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4 }}>Diámetro</div>
              <select
                value={bajEl.acoDiam || ''}
                aria-label="Diámetro"
                onChange={(e) => {
                  const val = e.target.value;
                  if (engineRef.current) {
                    engineRef.current?.updateElementById(bajEl.id, { acoDiam: val });
                    const fresh = engineRef.current?.bajantes.find((b) => b.id === bajEl.id);
                    if (fresh) {
                      setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
                    }
                    engineRef.current?.render();
                    writeAcoDiamToDrawing(val, planosCtx.plans, bajEl.net || 'af');
                  }
                }}
                style={DrawingElementContextMenu_S2}
              >
                <option value="">— Sin diámetro —</option>
                {(bajEl.net === 'gas' ? GAS_DN_LABELS : DIAMETROS_AF.map(d => d.nominal)).map(d => (
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
    const bajEl = element as PlanoBajante;
    return (
      <>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Calentador: {bajEl.code || bajEl.id}
        </div>
        <div style={{ fontSize: 12, color: '#849495', padding: '4px 8px 0', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Equipo (Capacidad)
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={bajEl.capacidad || ''}
            aria-label="Equipo (Capacidad)"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                const fields = { capacidad: val };
                engineRef.current?.updateElementById(bajEl.id, fields);
                const fresh = engineRef.current?.bajantes.find((b) => b.id === bajEl.id);
                if (fresh) {
                  setContextMenuState((prev) => prev ? { ...prev, element: { ...fresh } } : null);
                  if (selElement?.id === bajEl.id) {
                    setSelElement({ ...selElement, capacidad: val });
                  }
                }
                engineRef.current?.render();
              }
            }}
            style={DrawingElementContextMenu_S2}
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

function BajanteMenu() {
  const ctx = useDrawingElementContextMenu()
  const { contextMenuState, element } = ctx
  const bajEl = element as PlanoBajante
  const isGhostClick = contextMenuState.isGhostClick || false
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(ctx.activeNet)

  return (
    <>
      <BajanteDirectionSelector
        element={bajEl}
        isGhostClick={isGhostClick}
        selectedNivel={ctx.selectedNivel}
        pisos={ctx.pisos}
        engineRef={ctx.engineRef}
        selElement={ctx.selElement}
        setSelElement={ctx.setSelElement}
        setContextMenuState={ctx.setContextMenuState}
      />
      <BajanteDiameterSelector
        element={bajEl}
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
          element={bajEl}
          isGhostClick={isGhostClick}
          ramalEndpoint={null}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
          setContextMenuState={ctx.setContextMenuState}
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

function MidRamalAccessorySelector({ element, midRamalHit, engineRef, selElement, setSelElement, setContextMenuState }: {
  element: PlanoRamal;
  midRamalHit: { segmentIdx: number; x: number; y: number };
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
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
          const fresh = eng.ramales.find((r) => r.id === element.id);
          if (!fresh) return;

          if (accId === 'codoReventilado' && (diamPulgFromLabel(fresh.diametro || '') < 3 || diamPulgFromLabel(fresh.diametro || '') > 4)) {
            eng.triggerAlert('Diámetro no permitido', 'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".');
            return;
          }

          if (existingKey) {
            const newAccMed = { ...(fresh.accMed || {}) };
            if (accId) { newAccMed[existingKey] = accId; } else { delete newAccMed[existingKey]; }
            eng.updateElementById(element.id, { accMed: newAccMed });
            if (selElement?.id === element.id) setSelElement({ ...selElement, accMed: newAccMed });
            // Without this, `element` (contextMenuState's frozen snapshot from when the menu
            // opened) never reflects the write: the dropdown kept showing "Ninguno" after the
            // FIRST pick, and every pick after that fell into the "insert new vertex" branch
            // below instead of updating this one — leaving the old glyph on screen alongside
            // the new one, and "Ninguno" unable to find anything to delete.
            setContextMenuState((prev) => prev ? { ...prev, element: { ...prev.element, accMed: newAccMed } } : null);
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
            setContextMenuState((prev) => prev ? { ...prev, element: { ...prev.element, pts: newPts, accMed: shiftedAccMed } } : null);
          }
          // teeTapon/teeLlaveTerminal aren't offered in the sidebar accessory counter anymore
          // (they're pure body glyphs, chosen only from this dropdown) — but they still count as
          // a through-tee for friction-loss purposes, same as a manually-tallied "Tee paso
          // lado". Bump/unbump that tally automatically so switching away from one of these two
          // doesn't leave an orphaned count behind.
          const TEE_LADO_LINKED = new Set(['teeTapon', 'teeLlaveTerminal']);
          if (currentVal !== accId) {
            // _loadedPlanId, NOT eng.planId — the latter is declared on the engine but never
            // assigned, so it's always undefined; using it wrote the tally under key
            // `${net}_${id}_` (empty planId) while the sidebar reads `${net}_${id}_${realPlanId}`,
            // so the count landed in a key nothing ever displayed.
            const planId = eng._loadedPlanId ?? '';
            if (TEE_LADO_LINKED.has(currentVal)) bumpHidroAccesorio(element.net || 'af', 'teeLado', -1, element.id, planId);
            if (TEE_LADO_LINKED.has(accId)) bumpHidroAccesorio(element.net || 'af', 'teeLado', 1, element.id, planId);
            // bumpHidroAccesorio writes straight to localStorage — FixturesPanel's sidebar
            // accessory counter only re-reads localStorage in response to this event (or its own
            // inc/dec calls), so without dispatching it here the count updates on disk but the
            // sidebar keeps showing the stale number until something else happens to trigger it.
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('aparatos-clear'));
          }
          eng.render();
          eng._markDirty();
        }}
        style={DrawingElementContextMenu_S2}
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
  const ramalEl = element as PlanoRamal

  // A midRamalHit landing exactly on an EXISTING accMed vertex (PlanoEngineHitTesting.ts checks
  // these before segment-body hits) reports segmentIdx = accMedIdx - 1 — i.e. accMedIdx =
  // segmentIdx + 1, same convention handleCreateMontanteMidBody/handleCreateTeeCapStub use.
  const hit = contextMenuState.midRamalHit;
  const existingTeeIdx = hit ? hit.segmentIdx + 1 : -1;
  const existingTeeType = hit ? ramalEl.accMed?.[`accMed${existingTeeIdx}`] : undefined;
  const isExistingTee = existingTeeType === 'teeDirecto' || existingTeeType === 'teeSube' || existingTeeType === 'teeBaja';
  // teeTapon/teeLlaveTerminal are self-contained glyphs (the free leg is already capped in the
  // marker itself, no real stub ramal) — they don't get the "+Tapón/+Llave" stub buttons below,
  // but the point is still occupied, so "Crear montante" must stay hidden there too.
  const isOccupiedTee = isExistingTee || existingTeeType === 'teeTapon' || existingTeeType === 'teeLlaveTerminal';

  return (
    <>
      {contextMenuState.midRamalHit && !contextMenuState.ramalEndpoint && !['san', 'll'].includes(ramalEl.net) && getAccessoryOptions(ramalEl.net).length > 0 && (
        <MidRamalAccessorySelector
          element={ramalEl}
          midRamalHit={contextMenuState.midRamalHit}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
          setContextMenuState={ctx.setContextMenuState}
        />
      )}
      {contextMenuState.midRamalHit && !contextMenuState.ramalEndpoint && ['af', 'ac'].includes(ramalEl.net) && !isOccupiedTee && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
          <button type="button"
            onClick={() => {
              const eng = engineRef.current;
              const hit = contextMenuState.midRamalHit;
              if (!eng || !hit) return;
              eng.createMontanteMidBody(ramalEl.id, hit.x, hit.y, hit.segmentIdx);
              ctx.setContextMenuState(null);
            }}
            style={DrawingElementContextMenu_S13}>
            + Crear montante (auto-tee)
          </button>
        </div>
      )}
      {contextMenuState.midRamalHit && !contextMenuState.ramalEndpoint && ['af', 'ac'].includes(ramalEl.net) && isExistingTee && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Segmento libre de la tee
          </div>
          {(['tapon', 'llaveTerminal'] as const).map((accId) => (
            <button type="button" key={accId}
              onClick={() => {
                const eng = engineRef.current;
                if (!eng) return;
                eng.createTeeCapStub(ramalEl.id, existingTeeIdx, accId);
                ctx.setContextMenuState(null);
              }}
              style={DrawingElementContextMenu_S13}>
              + {accId === 'tapon' ? 'Tapón' : 'Llave Terminal'}
            </button>
          ))}
        </div>
      )}
      {contextMenuState.ramalEndpoint && (
        <BajanteConnectionPanel
          element={ramalEl}
          isGhostClick={contextMenuState.isGhostClick || false}
          ramalEndpoint={contextMenuState.ramalEndpoint}
          engineRef={ctx.engineRef}
          selElement={ctx.selElement}
          setSelElement={ctx.setSelElement}
          setContextMenuState={ctx.setContextMenuState}
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
        <input type="checkbox" checked={!!ramalEl.bloqueado} aria-label="Bloquear movimiento"
          onChange={e => {
            const val = e.target.checked;
            if (engineRef.current) {
              engineRef.current?.updateElementById(ramalEl.id, { bloqueado: val });
              if (selElement?.id === ramalEl.id) {
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
          <div style={{ fontSize: 12, color: '#849495', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociados</div>
          <div style={DrawingElementContextMenu_S9}>
            {(() => {
              const currentId = ramalEl.id;
              const netBajantes = (engineRef.current?.bajantes || []).filter((b) => b.net === ramalEl.net && b.id !== ramalEl.id && b.tipo !== 'tributario');
              if (netBajantes.length === 0) return <div style={{ fontSize: 12, color: '#6b8cae', fontFamily: "'Geist',monospace", gridColumn: 'span 4' }}>Sin bajantes</div>;
              return netBajantes.map((b) => {
                const isAssociated = (b.recibeDeIds || []).includes(currentId);
                return (
                  <label key={b.id} style={DrawingElementContextMenu_S22}>
                    <input type="checkbox" checked={isAssociated}
                      onChange={e => {
                        const recibidos = b.recibeDeIds || [];
                        const newRecibe = e.target.checked
                          ? [...recibidos, currentId]
                          : recibidos.filter((id: string) => id !== currentId);
                        const extraFields: Record<string, unknown> = { recibeDeIds: newRecibe };
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
  pisos: Piso[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  lowerFloorsRamales: LowerFloorRamales[];
  planosCtx: { plans: PlanItem[] };
  mats: Record<string, MaterialItem[]>;
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

  const element = contextMenuState.element as ProbedElement;
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
