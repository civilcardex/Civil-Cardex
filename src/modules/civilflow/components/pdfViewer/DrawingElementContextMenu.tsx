import { createContext, memo, useContext, useEffect, useRef, useState } from 'react';
import { bajanteLabel, ramalLabel } from '../../utils/accessoryAbbreviations';
import { normalizeDnLabel } from '../../utils/formatUtils';
import { pisoLbl, DIAM_BAN, DIAM_VENT, DIAM_BY_MAT, GAS_DN_LABELS } from '../../constants';
import {
  APARATOS_DEF,
  AF_UC_IDS,
  AC_UC_IDS,
  SAN_UC_IDS,
} from '../../constants/engineeringDataFixtures';
import { getAccessoryOptions } from '../../utils/accessoryOptions';
import { NETS, type PlanoBajante } from '../../lib/PlanoEngine/PlanoState';
import { BAJANTE_NETS, MONTANTE_NETS } from '../../lib/PlanoEngine/drawingCreations';
import { maxDiametroLabel } from '../../lib/PlanoEngine/PlanoEngineDrawing';
import { checkRamalAngles } from '../../lib/PlanoEngine/drawingAngles';
import {
  writeBajantePropToDrawing,
  writeAcoDiamToDrawing,
  writeContadorDiamToDrawing,
} from '../../utils/writeDiameterToDrawing';
import {
  applyBajanteAssociation,
  clearBajanteAssociation,
  areEndpointsAligned,
  type AssocEndpoint,
} from '../../utils/bajanteAssociation';
import {
  syncExtremeAccessoryToHidroData,
  bumpHidroAccesorio,
} from '../../utils/syncExtremeAccessory';
import { GAS, CAT_GAS } from '../../constants/engineeringDataGas';
import { VENTILACION, CONTADORES as CONTADORES_CAT } from '../../pages/catalog/catalogData';
import { DIAMETROS_AF } from '../../constants/hydraulicData';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type {
  PlanoElement,
  PlanoRamal,
  PlanoArea,
  PlanoGuideLine,
} from '../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../useWorkAreaState';
import type { PlanItem } from '../../context/PlansContext';
import type { MaterialItem } from '../../context/ProjectContext';

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
  contextMenuState: ContextMenuState;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  element: PlanoElement;
  selectedNivel: number | null;
  pisos: Piso[];
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  lowerFloorsRamales: LowerFloorRamales[];
  upperFloorGroup: LowerFloorRamales | null;
  planosCtx: { plans: PlanItem[] };
  mats: Record<string, MaterialItem[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
}

const DrawingElementContextMenuCtx = createContext<DrawingElementContextMenuContextValue | null>(
  null,
);

function useDrawingElementContextMenu(): DrawingElementContextMenuContextValue {
  const ctx = useContext(DrawingElementContextMenuCtx);
  if (!ctx)
    throw new Error(
      'useDrawingElementContextMenu must be used within DrawingElementContextMenuProvider',
    );
  return ctx;
}
const DrawingElementContextMenu_S2: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};
const DrawingElementContextMenu_dirBtn: React.CSSProperties = {
  padding: '3px 5px',
  textAlign: 'left',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  transition: 'all 0.1s',
  boxSizing: 'border-box',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  minWidth: 0,
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
const DrawingElementContextMenu_S7: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '4px 8px',
  maxHeight: 120,
  overflowY: 'auto',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  padding: 4,
};
const DrawingElementContextMenu_S8: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  fontSize: 11,
  color: '#b9caca',
  fontFamily: "'Geist',monospace",
};
const DrawingElementContextMenu_S9: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '4px 8px',
  maxHeight: 160,
  overflowY: 'auto',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  padding: 4,
};
const DrawingElementContextMenu_S13: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  cursor: 'pointer',
  background: '#1e2024',
  border: '1px dashed #00dce5',
  borderRadius: 4,
  color: '#00dce5',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  textAlign: 'center',
  fontWeight: 600,
};
const DrawingElementContextMenu_S22: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  fontSize: 12,
  color: '#b9caca',
  fontFamily: "'Geist',monospace",
  minWidth: 0,
};
const DrawingElementContextMenu_S23: React.CSSProperties = {
  position: 'absolute',
  zIndex: 101,
  background: '#1a1c20',
  border: '1px solid #3a494a',
  borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  padding: '4px',
  minWidth: 170,
  maxWidth: 320,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  overflow: 'hidden',
};

export interface LowerFloorRamales {
  planId: string | number;
  planName: string;
  npt: number | string;
  bajantes: PlanoBajante[];
  isCurrent: boolean;
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
  const oppositeParentDir =
    element.direccion === 'sube'
      ? 'baja'
      : element.direccion === 'baja'
        ? 'sube'
        : element.direccion;
  const ghostDir = isGhostClick
    ? gd && gd.direccion !== undefined
      ? gd.direccion
      : oppositeParentDir
    : element.direccion;

  const updateGhostField = (field: string, val: string) => {
    if (!engineRef.current) return;
    const gd2 = { ...(element.ghostData || {}) };
    const cd = { ...(gd2[currentGhostLabel] || {}) };
    (cd as Record<string, string>)[field] = val;
    gd2[currentGhostLabel] = cd;
    engineRef.current?.updateElementById(element.id, { ghostData: gd2 });
    const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
    if (fresh) {
      setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
      if (selElement?.id === element.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

  return (
    <>
      <div
        style={{
          fontSize: 12,
          color: '#849495',
          padding: '4px 8px',
          fontFamily: "'Geist',monospace",
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Dirección de flujo
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 3,
          padding: '0 6px 4px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {(isGhostClick ? ['Sube', 'Baja', 'Continua'] : ['Sube', 'Baja', 'Continua']).map((opt) => {
          const isActive = ghostDir === opt.toLowerCase();
          return (
            <button
              type="button"
              key={opt}
              onClick={() => {
                if (!engineRef.current) return;
                if (isGhostClick) {
                  updateGhostField('direccion', opt.toLowerCase());
                  engineRef.current?.render();
                  return;
                }
                const currentNpt = pisos.find((p) => p.n === selectedNivel)?.npt || 0;
                const allNpts = pisos.map((p) => p.npt).sort((a, b) => Number(a) - Number(b));
                const maxNpt = allNpts[allNpts.length - 1] || 0;
                const minNpt = allNpts[0] || 0;
                let updates: Record<string, unknown> = {};

                if (opt === 'Sube') {
                  updates = {
                    direccion: 'sube',
                    nptBase: currentNpt,
                    nptCima: maxNpt,
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                } else if (opt === 'Baja') {
                  // Flow-direction guard, second half: isRamalBajanteConnectionAllowed (in
                  // flowDirection.ts) only fires when a ramal endpoint is FIRST connected to a
                  // bajante. It never re-validates existing connections when the bajante's own
                  // direction is changed afterward — which is the far more common order in
                  // practice (draw the geometry, then set "Baja" here). Without this check, a
                  // bajante that already receives a ramal at that ramal's START (i.e. the ramal
                  // originates FROM the bajante, not into it) could silently be marked "baja"
                  // even though it would then be emitting flow instead of only receiving it.
                  const bajCode = element.code || element.id;
                  const emittingRamal = (element.recibeDeIds || [])
                    .map((rid) => engineRef.current?.ramales.find((r) => r.id === rid))
                    .find((ram) => ram && ram.ini === bajCode);
                  if (emittingRamal) {
                    engineRef.current?.triggerAlert(
                      'Dirección de flujo inconsistente',
                      `El ramal ${emittingRamal.label || emittingRamal.id} sale de este bajante (está conectado por su extremo inicial). Un bajante con dirección "baja" solo puede recibir flujo — desconecta o invierte ese ramal antes de cambiar la dirección.`,
                    );
                    return;
                  }
                  updates = {
                    direccion: 'baja',
                    nptBase: minNpt,
                    nptCima: currentNpt,
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                } else if (opt === 'Continua') {
                  updates = {
                    direccion: 'continua',
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                }
                if (Object.keys(updates).length > 0) {
                  engineRef.current?.updateElementById(element.id, updates);
                  // A montante's accessory (codo90rmSube/Baja at a ramal endpoint, or teeSube/Baja
                  // at a mid-body split) was written once at creation time and never re-synced when
                  // the direction changed afterward — always stayed whatever it was first set to.
                  // Re-derive it from the CURRENT direction here instead, locating the exact point
                  // by position (endpoint → codo, interior vertex → tee) rather than assuming it's
                  // always an endpoint.
                  if (
                    element.tipo === 'montante' &&
                    (updates.direccion === 'sube' || updates.direccion === 'baja')
                  ) {
                    const isSube = updates.direccion === 'sube';
                    const codoId = isSube ? 'codo90rmSube' : 'codo90rmBaja';
                    const teeId = isSube ? 'teeSube' : 'teeBaja';
                    const TOL = 0.5;
                    for (const rid of element.recibeDeIds || []) {
                      const ram = engineRef.current?.ramales.find((r) => r.id === rid);
                      if (!ram || !ram.pts?.length) continue;
                      const idx = ram.pts.findIndex(
                        ([px, py]) => Math.hypot(px - element.x, py - element.y) < TOL,
                      );
                      if (idx === -1) continue;
                      if (idx === 0)
                        engineRef.current?.updateElementById(ram.id, { accesorioInicio: codoId });
                      else if (idx === ram.pts.length - 1)
                        engineRef.current?.updateElementById(ram.id, { accesorioFin: codoId });
                      else
                        engineRef.current?.updateElementById(ram.id, {
                          accMed: { ...(ram.accMed || {}), [`accMed${idx}`]: teeId },
                        });
                    }
                  }
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
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
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = '#2563eb33';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = '#1e2024';
              }}
            >
              <div
                style={{
                  color: opt === 'Sube' ? '#00dce5' : opt === 'Baja' ? '#F04545' : '#FFEB3B',
                  flexShrink: 0,
                }}
              >
                {opt === 'Sube' ? '\u2B06' : opt === 'Baja' ? '\u2B07' : '\u279C'}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {opt}
              </span>
            </button>
          );
        })}
      </div>
      {!isGhostClick && (
        <button
          type="button"
          onClick={() => {
            if (!engineRef.current) return;
            const lvl = selectedNivel !== null ? pisoLbl(selectedNivel) : '';
            const isFantasma = element.isFantasma;
            // A bajante that already has a ramal/tributario connected to it can't become a
            // fantasma — the desplazamiento would visually detach it from what it's really
            // feeding, so block activation with an explicit warning instead.
            if (!isFantasma && (element.recibeDeIds?.length ?? 0) > 0) {
              engineRef.current.triggerAlert(
                'No se puede activar fantasma',
                'Este bajante ya tiene un ramal o tributario conectado. Desconéctalo antes de activar el desplazamiento.',
              );
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
                setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
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
          onMouseEnter={(e) => {
            if (!element.isFantasma) e.currentTarget.style.background = '#2563eb33';
          }}
          onMouseLeave={(e) => {
            if (!element.isFantasma)
              e.currentTarget.style.background = element.isFantasma
                ? 'rgba(245,166,35,0.12)'
                : 'transparent';
          }}
        >
          {element.isFantasma
            ? 'Desactivar desplazamiento del bajante'
            : 'Activar desplazamiento del bajante'}
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
  upperFloorGroup,
  planosCtx,
  triggerConfirm,
}: {
  element: PlanoBajante;
  isGhostClick?: boolean;
  selectedNivel: number | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: (el: PlanoElement | null) => void;
  setContextMenuState: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
  lowerFloorsRamales: LowerFloorRamales[];
  upperFloorGroup: LowerFloorRamales | null;
  planosCtx: { plans: PlanItem[] };
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
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
      setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
      if (selElement?.id === element.id) {
        setSelElement({ ...selElement, ghostData: gd2 });
      }
    }
  };

  // Mirror of the "Destino" onChange below but for the immediate-upper-floor "Origen" selector —
  // same logic as BajanteAsociacion.tsx's associateOrigin, duplicated here (not shared) because
  // this one reads/writes `element` (whatever was right-clicked, not necessarily selElement) and
  // syncs contextMenuState the same way the rest of this component's handlers do.
  const associateOrigin = (v: string | null) => {
    if (!engineRef.current) return;
    const eng = engineRef.current;
    const currentPlanId = String(eng._loadedPlanId ?? '');
    const target: AssocEndpoint = {
      planId: currentPlanId,
      id: element.id,
      x: element.x,
      y: element.y,
      net: element.net || 'san',
      dNominal: element.dNominal || '',
      code: element.code || element.id,
      nivelN: Number(eng.nivelActual?.n ?? 0),
      npt: Number(eng.nivelActual?.npt ?? 0),
    };
    const prevOrigen = element.origenId;
    const syncLocal = () => {
      const fresh = eng.bajantes.find((b) => b.id === element.id);
      if (fresh) setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
    };

    if (!v) {
      if (prevOrigen) {
        const [prevPlanId, prevBajId] = prevOrigen.split('|');
        if (prevPlanId && prevBajId)
          clearBajanteAssociation(
            eng,
            prevPlanId,
            prevBajId,
            element.net || 'san',
            `${currentPlanId}|${element.id}`,
            planosCtx.plans,
          );
      }
      eng.updateElementById(element.id, { origenId: null });
      syncLocal();
      if (selElement?.id === element.id) setSelElement({ ...selElement, origenId: null });
      writeBajantePropToDrawing(
        `${element.id}-${currentPlanId}`,
        element.net || 'san',
        'origenId',
        null,
        planosCtx.plans,
      );
      eng.render();
      return;
    }

    const [originPlanId, originBajanteId] = v.split('|');
    const originBaj = upperFloorGroup?.bajantes.find((b) => b.id === originBajanteId);
    if (!originBaj || originBaj.x == null || originBaj.y == null) {
      eng.triggerAlert(
        'No se pudo asociar',
        `No se encontró el bajante de origen (${originBajanteId}) en el piso superior. Intenta reabrir el panel o recargar el piso.`,
      );
      return;
    }
    const originPlan = planosCtx.plans.find((pl) => String(pl.id) === originPlanId);
    const source: AssocEndpoint = {
      planId: originPlanId,
      id: originBajanteId,
      x: originBaj.x,
      y: originBaj.y,
      net: target.net,
      dNominal: originBaj.dNominal || '',
      code: originBaj.code || originBajanteId,
      nivelN: originPlan?.nivel ?? 0,
      npt: Number(upperFloorGroup?.npt ?? 0),
    };

    const commit = () => {
      if (prevOrigen) {
        const [prevPlanId, prevBajId] = prevOrigen.split('|');
        if (prevPlanId && prevBajId)
          clearBajanteAssociation(
            eng,
            prevPlanId,
            prevBajId,
            element.net || 'san',
            `${currentPlanId}|${element.id}`,
            planosCtx.plans,
          );
      }
      applyBajanteAssociation(eng, source, target, planosCtx.plans);
      syncLocal();
      if (selElement?.id === element.id) setSelElement({ ...selElement, origenId: v });
    };

    if (areEndpointsAligned(source, target)) {
      commit();
      return;
    }
    triggerConfirm(
      'Crear fantasma de asociación',
      `${source.code} y ${target.code} no están alineados. Se creará un bajante fantasma en este piso, en la posición de ${source.code}. ¿Continuar?`,
      commit,
      'Aceptar',
    );
  };

  return (
    <>
      {!isGhostClick ? (
        <>
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: '4px 8px',
              borderTop: '1px solid #3a494a',
              marginTop: 4,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#849495',
                  fontFamily: "'Geist',monospace",
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Destino
              </div>
              <select
                value={element.descargaEnId || ''}
                aria-label="Destino"
                onChange={(e) => {
                  const v = e.target.value || null;
                  const eng = engineRef.current;
                  if (!eng) return;
                  const currentPlanId = String(eng._loadedPlanId ?? '');
                  const prevV = element.descargaEnId;
                  const syncLocal = () => {
                    const fresh = eng.bajantes.find((b) => b.id === element.id);
                    if (fresh)
                      setContextMenuState((prev) =>
                        prev ? { ...prev, element: { ...fresh } } : null,
                      );
                  };

                  if (!v) {
                    if (prevV)
                      clearBajanteAssociation(
                        eng,
                        currentPlanId,
                        element.id,
                        element.net || 'san',
                        prevV,
                        planosCtx.plans,
                      );
                    eng.updateElementById(element.id, { descargaEnId: null });
                    syncLocal();
                    if (selElement?.id === element.id)
                      setSelElement({ ...selElement, descargaEnId: null });
                    writeBajantePropToDrawing(
                      `${element.id}-${currentPlanId}`,
                      element.net || 'san',
                      'descargaEnId',
                      null,
                      planosCtx.plans,
                    );
                    eng.render();
                    return;
                  }

                  const [targetPlanId, targetBajanteId] = v.split('|');
                  const targetGroup = lowerFloorsRamales.find(
                    (g) => String(g.planId) === targetPlanId,
                  );
                  const targetBaj = targetGroup?.bajantes.find((b) => b.id === targetBajanteId);
                  if (!targetBaj || targetBaj.x == null || targetBaj.y == null) return;
                  const targetPlan = planosCtx.plans.find((pl) => String(pl.id) === targetPlanId);
                  const source: AssocEndpoint = {
                    planId: currentPlanId,
                    id: element.id,
                    x: element.x,
                    y: element.y,
                    net: element.net || 'san',
                    dNominal: element.dNominal || '',
                    code: element.code || element.id,
                    nivelN: Number(eng.nivelActual?.n ?? 0),
                    npt: Number(eng.nivelActual?.npt ?? 0),
                  };
                  const target: AssocEndpoint = {
                    planId: targetPlanId,
                    id: targetBajanteId,
                    x: targetBaj.x,
                    y: targetBaj.y,
                    net: source.net,
                    dNominal: targetBaj.dNominal || '',
                    code: targetBaj.code || targetBajanteId,
                    nivelN: targetPlan?.nivel ?? 0,
                    npt: Number(targetGroup?.npt ?? 0),
                  };

                  const commit = () => {
                    if (prevV)
                      clearBajanteAssociation(
                        eng,
                        currentPlanId,
                        element.id,
                        element.net || 'san',
                        prevV,
                        planosCtx.plans,
                      );
                    applyBajanteAssociation(eng, source, target, planosCtx.plans);
                    syncLocal();
                    if (selElement?.id === element.id) {
                      setSelElement({
                        ...selElement,
                        descargaEnId: v,
                        direccion: target.npt < source.npt ? 'baja' : 'sube',
                      });
                    }
                  };

                  if (areEndpointsAligned(source, target)) {
                    commit();
                    return;
                  }
                  triggerConfirm(
                    'Crear fantasma de asociación',
                    `${source.code} y ${target.code} no están alineados. Se creará un bajante fantasma en el piso de ${target.code}, en la posición de ${source.code}. ¿Continuar?`,
                    commit,
                    'Aceptar',
                  );
                }}
                style={{ ...DrawingElementContextMenu_S2, width: '85%' }}
              >
                <option value="">Sin destino</option>
                {lowerFloorsRamales.map((group) => {
                  const plano = planosCtx.plans.find(
                    (pl) => (pl.id as unknown as string) === group.planId,
                  );
                  const pLabel = plano?.nivel != null ? pisoLbl(plano.nivel) : group.planName;
                  const bajantesToShow = group.isCurrent
                    ? (group.bajantes || []).filter((b) => b.id !== element.id)
                    : group.bajantes || [];
                  const hasBajantes = bajantesToShow.length > 0;
                  return (
                    <optgroup key={group.planId} label={pLabel}>
                      {hasBajantes &&
                        bajantesToShow.map((b) => (
                          <option key={`${group.planId}|${b.id}`} value={`${group.planId}|${b.id}`}>
                            {b.code || b.id}
                          </option>
                        ))}
                      {!hasBajantes && (
                        <option value="" disabled>
                          Sin elementos disponibles
                        </option>
                      )}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#849495',
                  fontFamily: "'Geist',monospace",
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Diámetro
              </div>
              <select
                value={(() => {
                  const gd = element.ghostData?.[currentGhostLabel];
                  return isGhostClick
                    ? gd && gd.dNominal !== undefined
                      ? gd.dNominal
                      : element.dNominal || ''
                    : element.dNominal || '';
                })()}
                aria-label="Diámetro"
                onChange={(e) => {
                  const val = e.target.value;
                  if (isGhostClick) {
                    updateGhostField('dNominal', val);
                  } else {
                    // Validate: bajante diameter must not be smaller than connected ramales
                    if (val && element.recibeDeIds?.length && engineRef.current) {
                      const bajIn = diamPulgFromLabel(val.replace(/-/g, ' '));
                      if (bajIn > 0) {
                        for (const rid of element.recibeDeIds) {
                          const ram = engineRef.current.ramales.find((r) => r.id === rid);
                          if (!ram || !ram.diametro) continue;
                          const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
                          if (ramIn > 0 && ramIn > bajIn) {
                            engineRef.current?.triggerAlert(
                              'Diámetro no permitido',
                              `Diámetro del bajante no puede ser menor al del ramal conectado (${ram.diametro})`,
                            );
                            e.target.value = element.dNominal || '';
                            return;
                          }
                        }
                      }
                    }
                    const fields = { dNominal: val };
                    engineRef.current?.updateElementById(element.id, fields);
                    const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                    if (fresh) {
                      setContextMenuState((prev) =>
                        prev ? { ...prev, element: { ...fresh } } : null,
                      );
                      if (selElement?.id === element.id) {
                        setSelElement({ ...selElement, dNominal: fields.dNominal });
                      }
                    }
                  }
                }}
                style={DrawingElementContextMenu_S2}
              >
                <option value="">—</option>
                {(element.net === 'vent' ? DIAM_VENT : DIAM_BAN).map((d) => (
                  <option key={d.pulg} value={d.nom}>
                    {normalizeDnLabel(d.nom)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {upperFloorGroup && (
            <div style={{ padding: '0 8px 4px' }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#849495',
                  fontFamily: "'Geist',monospace",
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Origen (piso superior)
              </div>
              <select
                value={element.origenId || ''}
                aria-label="Origen"
                onChange={(e) => associateOrigin(e.target.value || null)}
                style={DrawingElementContextMenu_S2}
              >
                <option value="">Sin origen</option>
                {(() => {
                  const plano = planosCtx.plans.find(
                    (pl) => (pl.id as unknown as string) === upperFloorGroup.planId,
                  );
                  const pLabel =
                    plano?.nivel != null ? pisoLbl(plano.nivel) : upperFloorGroup.planName;
                  const bajantesToShow = upperFloorGroup.bajantes || [];
                  const hasBajantes = bajantesToShow.length > 0;
                  return (
                    <optgroup label={pLabel}>
                      {hasBajantes &&
                        bajantesToShow.map((b) => (
                          <option
                            key={`${upperFloorGroup.planId}|${b.id}`}
                            value={`${upperFloorGroup.planId}|${b.id}`}
                          >
                            {b.code || b.id}
                          </option>
                        ))}
                      {!hasBajantes && (
                        <option value="" disabled>
                          Sin elementos disponibles
                        </option>
                      )}
                    </optgroup>
                  );
                })()}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, padding: '0 8px 4px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#849495',
                  fontFamily: "'Geist',monospace",
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Llenado (R)
              </div>
              <select
                value={
                  element.bajR != null
                    ? Math.abs(element.bajR - 7 / 24) < 0.001
                      ? '7/24'
                      : '1/4'
                    : '7/24'
                }
                aria-label="Llenado (R)"
                onChange={(e) => {
                  const val = e.target.value;
                  const valNum = val === '7/24' ? 7 / 24 : 0.25;
                  engineRef.current?.updateElementById(element.id, { bajR: valNum });
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh)
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, bajR: valNum });
                  }
                }}
                style={DrawingElementContextMenu_S2}
              >
                <option value="7/24">7/24</option>
                <option value="1/4">1/4</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#849495',
                  fontFamily: "'Geist',monospace",
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Área
              </div>
              <select
                value={element.area_m2 || ''}
                aria-label="Área"
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  engineRef.current?.updateElementById(element.id, { area_m2: val });
                  setContextMenuState((prev) =>
                    prev ? { ...prev, element: { ...prev.element, area_m2: val } } : null,
                  );
                  if (selElement?.id === element.id) {
                    setSelElement({ ...selElement, area_m2: val });
                  }
                }}
                style={DrawingElementContextMenu_S2}
              >
                <option value="">Sin área</option>
                {(engineRef.current?.areas || [])
                  .filter((a) => a.net === element.net)
                  .map((a) => (
                    <option key={a.id} value={a.areaM2}>
                      {a.label} · {a.areaM2} m²
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 4, padding: '4px 8px', borderTop: '1px solid #3a494a' }}>
          <div
            style={{
              fontSize: 12,
              color: '#849495',
              fontFamily: "'Geist',monospace",
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Diámetro
          </div>
          <select
            value={(() => {
              const gd = element.ghostData?.[currentGhostLabel];
              return isGhostClick
                ? gd && gd.dNominal !== undefined
                  ? gd.dNominal
                  : element.dNominal || ''
                : element.dNominal || '';
            })()}
            aria-label="Diámetro"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                if (isGhostClick) {
                  updateGhostField('dNominal', val);
                } else {
                  // Validate: bajante diameter must not be smaller than connected ramales
                  if (val && element.recibeDeIds?.length) {
                    const bajIn = diamPulgFromLabel(val.replace(/-/g, ' '));
                    if (bajIn > 0) {
                      for (const rid of element.recibeDeIds) {
                        const ram = engineRef.current.ramales.find((r) => r.id === rid);
                        if (!ram || !ram.diametro) continue;
                        const ramIn = diamPulgFromLabel(ram.diametro.replace(/-/g, ' '));
                        if (ramIn > 0 && ramIn > bajIn) {
                          engineRef.current?.triggerAlert(
                            'Diámetro no permitido',
                            `Diámetro del bajante no puede ser menor al del ramal conectado (${ram.diametro})`,
                          );
                          e.target.value = element.dNominal || '';
                          return;
                        }
                      }
                    }
                  }
                  const fields = { dNominal: val };
                  engineRef.current?.updateElementById(element.id, fields);
                  const fresh = engineRef.current?.bajantes.find((b) => b.id === element.id);
                  if (fresh) {
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
                    if (selElement?.id === element.id) {
                      setSelElement({ ...selElement, dNominal: fields.dNominal });
                    }
                  }
                }
              }
            }}
            style={DrawingElementContextMenu_S2}
          >
            <option value="">—</option>
            {(element.net === 'vent' ? DIAM_VENT : DIAM_BAN).map((d) => (
              <option key={d.pulg} value={d.nom}>
                {normalizeDnLabel(d.nom)}
              </option>
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
      {!hasPts && !isGhostClick && ['san', 'll'].includes(activeNet) && (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '4px 8px',
              borderTop: '1px solid #3a494a',
              marginTop: 4,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: '#849495',
                fontFamily: "'Geist',monospace",
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Ramales asociados
            </div>
            <div style={DrawingElementContextMenu_S7}>
              {(() => {
                const bajRamales = (engineRef.current?.ramales || []).filter(
                  (r) => r.net === activeNet && r.tipo !== 'tributario',
                );
                if (bajRamales.length === 0)
                  return (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#6b8cae',
                        fontFamily: "'Geist',monospace",
                        gridColumn: 'span 2',
                      }}
                    >
                      Sin ramales
                    </div>
                  );
                const recibidos = bajEl.recibeDeIds || [];
                return bajRamales.map((r) => {
                  const isAssociated = recibidos.includes(r.id);
                  const rStart = r.pts?.[0];
                  const rEnd = r.pts?.[r.pts.length - 1];
                  const distStart = rStart
                    ? Math.hypot(rStart[0] - bajEl.x, rStart[1] - bajEl.y)
                    : Infinity;
                  const distEnd = rEnd
                    ? Math.hypot(rEnd[0] - bajEl.x, rEnd[1] - bajEl.y)
                    : Infinity;
                  const isAtStart = distStart <= distEnd;
                  return (
                    <label key={r.id} style={DrawingElementContextMenu_S8}>
                      <input
                        type="checkbox"
                        checked={isAssociated}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          // Read the live recibeDeIds off the engine's own bajante object rather
                          // than the closed-over `recibidos` snapshot — two checkboxes toggled
                          // before React re-renders between them would otherwise each compute
                          // newRecibe from the same stale array and clobber each other's change.
                          const liveBaj = engineRef.current?.bajantes.find(
                            (bb) => bb.id === bajEl.id,
                          );
                          const liveRecibe: string[] = liveBaj?.recibeDeIds || recibidos;
                          const newRecibe = checked
                            ? [...liveRecibe, r.id]
                            : liveRecibe.filter((id: string) => id !== r.id);
                          engineRef.current?.updateElementById(bajEl.id, {
                            recibeDeIds: newRecibe,
                          });
                          setContextMenuState((prev) =>
                            prev
                              ? { ...prev, element: { ...prev.element, recibeDeIds: newRecibe } }
                              : null,
                          );
                          if (selElement?.id === bajEl.id) {
                            setSelElement({ ...selElement, recibeDeIds: newRecibe });
                          }
                          const bajCode = bajEl.code || bajEl.id;
                          const currentIni = r.ini || '';
                          const currentFin = r.fin || '';
                          if (isAtStart) {
                            const newIni = checked
                              ? bajCode
                              : currentIni === bajCode
                                ? ''
                                : currentIni;
                            engineRef.current?.updateElementById(r.id, { ini: newIni });
                          } else {
                            const newFin = checked
                              ? bajCode
                              : currentFin === bajCode
                                ? ''
                                : currentFin;
                            engineRef.current?.updateElementById(r.id, { fin: newFin });
                          }
                          engineRef.current?.render();
                          engineRef.current?._markDirty();
                        }}
                        style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
                      />
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

      {hasPts &&
        ramalEndpoint &&
        (() => {
          const supNets = ['san', 'll', 'vent', 'af', 'ac', 'gas', 'rci', 'rec'];
          if (!supNets.includes(ramalEl.net)) return null;
          const ep = ramalEndpoint;

          const netDef = NETS.find((n) => n.id === ramalEl.net);

          return (
            <>
              <div
                style={{
                  padding: '4px 8px',
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 4,
                  flexWrap: 'wrap',
                }}
              >
                {(['bajante', 'montante'] as const)
                  .filter((bmLabel) =>
                    bmLabel === 'montante'
                      ? MONTANTE_NETS.includes(ramalEl.net)
                      : BAJANTE_NETS.includes(ramalEl.net),
                  )
                  .map((bmLabel) => {
                    const isMon = bmLabel === 'montante';
                    const pfx = isMon
                      ? netDef?.bmType === 'montante'
                        ? netDef?.bmPfx || 'MON'
                        : 'M' + (netDef?.lbl || 'MON')
                      : netDef?.bmPfx || 'B';
                    const existingExtreme = (engineRef.current?.bajantes || []).find(
                      (b) =>
                        Math.abs(b.x - ep.x) < 0.5 &&
                        Math.abs(b.y - ep.y) < 0.5 &&
                        b.net === ramalEl.net,
                    );
                    if (existingExtreme) return null;
                    const fieldAcc = ep.idx === 0 ? 'accesorioInicio' : 'accesorioFin';
                    const fieldApp = ep.idx === 0 ? 'aparatoInicio' : 'aparatoFin';
                    if (ramalEl[fieldAcc] || ramalEl[fieldApp]) return null;
                    return (
                      <button
                        type="button"
                        key={bmLabel}
                        onClick={() => {
                          const eng = engineRef.current;
                          if (!eng) return;
                          const cnt =
                            eng.bajantes.filter(
                              (b) => b.tipo === bmLabel && (!isMon || b.net === ramalEl.net),
                            ).length + 1;
                          const id = isMon ? pfx + cnt + '_' + ramalEl.net : pfx + cnt;
                          const code = isMon ? pfx + cnt : id;
                          const nl = eng.nivelActual;
                          eng.bajantes.push({
                            id,
                            net: ramalEl.net,
                            tipo: bmLabel,
                            code: code,
                            direccion: bmLabel === 'bajante' ? 'baja' : 'sube',
                            x: ep.x,
                            y: ep.y,
                            pisoBase: nl?.label ?? '',
                            pisoCima: nl?.label ?? '',
                            nptBase: nl?.npt ?? 0,
                            nptCima: nl?.npt ?? 0,
                            hVert: 0,
                            dNominal: '0',
                            recibeDeIds: [ramalEl.id],
                            alimentaIds: [],
                            descargaEnId: null,
                            ucAcum: 0,
                            ucExtra: 0,
                            area_m2: 0,
                            desplazamientos: {},
                            lblOffX: 0,
                            lblOffY: 0,
                            labelAngle: 0,
                            labelX: ep.x,
                            labelY: ep.y + 20,
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
                          const newlyCreated = eng.bajantes.find(
                            (b) => b.tipo === bmLabel && b.x === ep.x && b.y === ep.y,
                          );
                          if (newlyCreated) {
                            eng.selId = newlyCreated.id;
                            eng._emitSelect(newlyCreated);
                          }
                          eng._isGhostSel = false;
                          eng.render();
                          eng._markDirty();
                          setContextMenuState(null);
                        }}
                        style={DrawingElementContextMenu_S13}
                      >
                        + Crear {bmLabel}
                      </button>
                    );
                  })}
              </div>

              {(ramalEl.tipo === 'tributario' || ramalEl.tipo === 'ramal') &&
                ['san', 'af', 'ac', 'gas'].includes(ramalEl.net) &&
                (() => {
                  const isStart = ep.idx === 0;
                  const fieldAcc: 'accesorioInicio' | 'accesorioFin' = isStart
                    ? 'accesorioInicio'
                    : 'accesorioFin';
                  const fieldDiam: 'diametroInicio' | 'diametroFin' = isStart
                    ? 'diametroInicio'
                    : 'diametroFin';
                  const fieldApp: 'aparatoInicio' | 'aparatoFin' = isStart
                    ? 'aparatoInicio'
                    : 'aparatoFin';

                  const currentAcc = ramalEl[fieldAcc] || '';
                  const currentApp = ramalEl[fieldApp] || '';

                  const accOptions = getAccessoryOptions(ramalEl.net);
                  const aparatoIds =
                    ramalEl.net === 'af'
                      ? AF_UC_IDS
                      : ramalEl.net === 'ac'
                        ? AC_UC_IDS
                        : ramalEl.net === 'san'
                          ? SAN_UC_IDS
                          : APARATOS_DEF.filter((a) => a.grupo === 'g').map((a) => a.id);
                  const aparatoOptions = aparatoIds
                    .map((id) => APARATOS_DEF.find((a) => a.id === id))
                    .filter((a): a is (typeof APARATOS_DEF)[number] => !!a);

                  return (
                    <div
                      style={{
                        padding: '4px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        borderBottom: '1px solid #3a494a',
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: '#849495',
                          fontFamily: "'Geist',monospace",
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        Extremo {isStart ? 'Inicio (Aparato)' : 'Fin (Ramal)'}
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            color: '#849495',
                            marginBottom: 2,
                            textTransform: 'uppercase',
                          }}
                        >
                          Seleccionar Accesorio
                        </div>
                        <select
                          value={currentAcc}
                          aria-label="Seleccionar Accesorio"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              if (ramalEl[fieldApp]) {
                                engineRef.current?.triggerAlert(
                                  'Aparato existente',
                                  'Este extremo ya tiene un aparato. Elimínalo antes de asignar un accesorio.',
                                );
                                return;
                              }
                              const existingBm = (engineRef.current?.bajantes || []).find(
                                (b) =>
                                  Math.abs(b.x - ep.x) < 0.5 &&
                                  Math.abs(b.y - ep.y) < 0.5 &&
                                  b.net === ramalEl.net,
                              );
                              if (existingBm) {
                                engineRef.current?.triggerAlert(
                                  'Elemento existente',
                                  `Ya existe un ${existingBm.tipo} (${existingBm.code || existingBm.id}) en este extremo. Elimínalo antes de asignar un accesorio.`,
                                );
                                return;
                              }
                              if (
                                val === 'codoReventilado' &&
                                (diamPulgFromLabel(ramalEl.diametro || '') < 3 ||
                                  diamPulgFromLabel(ramalEl.diametro || '') > 4)
                              ) {
                                engineRef.current?.triggerAlert(
                                  'Diámetro no permitido',
                                  'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".',
                                );
                                return;
                              }
                              // If this extreme already has a different accessory, just replace it
                              // with the new selection instead of blocking with an alert.
                            }
                            if (engineRef.current) {
                              const accessoryVal = val as string;
                              if (accessoryVal === 'sifon' && ramalEl.net === 'san' && !isStart) {
                                engineRef.current.triggerAlert(
                                  'Revisar ubicación del sifón',
                                  'El sifón no puede recibir flujo.',
                                );
                                return;
                              }
                              if (
                                (accessoryVal === 'llaveTerminal' ||
                                  accessoryVal === 'teeLlaveTerminal') &&
                                isStart
                              ) {
                                engineRef.current.triggerAlert(
                                  'Revisar ubicación llave terminal',
                                  'La llave terminal debe recibir el flujo.',
                                );
                                return;
                              }
                              const oldVal = ramalEl[fieldAcc] || '';
                              const updates: Record<string, unknown> = { [fieldAcc]: val };
                              // Accessories no longer inherit the ramal's own diameter as a
                              // default — every accessory starts with no diameter selected.
                              engineRef.current.updateElementById(ramalEl.id, updates);
                              setContextMenuState((prev) =>
                                prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
                              );
                              if (selElement?.id === ramalEl.id) {
                                setSelElement({ ...selElement, ...updates });
                              }
                              engineRef.current.render();
                              engineRef.current._markDirty();
                              if (val !== oldVal && planosCtx?.plans) {
                                syncExtremeAccessoryToHidroData(
                                  ramalEl.id,
                                  fieldAcc,
                                  oldVal,
                                  val,
                                  planosCtx.plans,
                                );
                              }
                            }
                          }}
                          style={DrawingElementContextMenu_S2}
                        >
                          <option value="">Ninguno</option>
                          {accOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Diámetro del accesorio — defaults to ramal's own diameter, validates
                          the chosen value is not smaller than the ramal's. */}
                      {ramalEl[fieldAcc] &&
                        (() => {
                          const matShort = ramalEl.material || (ramalEl.net === 'san' ? 'PVC' : '');
                          const diamList =
                            (ramalEl.net === 'san' && DIAM_BY_MAT['PVC']) ||
                            DIAM_BY_MAT[matShort] ||
                            [];
                          if (diamList.length === 0) return null;
                          const currentDiam = ramalEl[fieldDiam] || '';
                          return (
                            <div style={{ marginTop: 6 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#849495',
                                  marginBottom: 2,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                }}
                              >
                                Diámetro del accesorio
                              </div>
                              <select
                                value={currentDiam}
                                aria-label="Diámetro del accesorio"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v && ramalEl.diametro) {
                                    const inchFrom = (d: string) => {
                                      const q = d.indexOf('"');
                                      return q > 0 ? d.slice(0, q) : d;
                                    };
                                    if (
                                      diamPulgFromLabel(inchFrom(v)) >
                                      diamPulgFromLabel(inchFrom(ramalEl.diametro))
                                    ) {
                                      engineRef.current?.triggerAlert(
                                        'Diámetro no permitido',
                                        'El diámetro del accesorio no puede ser mayor al diámetro del ramal.',
                                      );
                                      return;
                                    }
                                  }
                                  const u: Record<string, unknown> = { [fieldDiam]: v };
                                  engineRef.current?.updateElementById(ramalEl.id, u);
                                  setContextMenuState((prev) =>
                                    prev ? { ...prev, element: { ...prev.element, ...u } } : null,
                                  );
                                  if (selElement?.id === ramalEl.id) {
                                    setSelElement({ ...selElement, ...u });
                                  }
                                }}
                                style={DrawingElementContextMenu_S2}
                              >
                                <option value="">— Sin diámetro —</option>
                                {diamList.map((d) => {
                                  const idx = d.n.indexOf(' — ');
                                  const lbl = idx > 0 ? d.n.slice(0, idx) : d.n;
                                  return (
                                    <option key={d.n} value={d.n}>
                                      {lbl}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          );
                        })()}

                      {ramalEl.net !== 'san' && (
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              color: '#849495',
                              marginBottom: 2,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            Seleccionar Aparato
                          </div>
                          <select
                            value={currentApp}
                            aria-label="Seleccionar Aparato"
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                if (ramalEl[fieldAcc]) {
                                  engineRef.current?.triggerAlert(
                                    'Accesorio existente',
                                    'Este extremo ya tiene un accesorio. Elimínalo antes de asignar un aparato.',
                                  );
                                  return;
                                }
                                const existingBm = (engineRef.current?.bajantes || []).find(
                                  (b) =>
                                    Math.abs(b.x - ep.x) < 0.5 &&
                                    Math.abs(b.y - ep.y) < 0.5 &&
                                    b.net === ramalEl.net,
                                );
                                if (existingBm) {
                                  engineRef.current?.triggerAlert(
                                    'Elemento existente',
                                    `Ya existe un ${existingBm.tipo} (${existingBm.code || existingBm.id}) en este extremo. Elimínalo antes de asignar un aparato.`,
                                  );
                                  return;
                                }
                              }
                              if (engineRef.current) {
                                const updates: Record<string, unknown> = {
                                  [fieldApp]: val || null,
                                };
                                engineRef.current.updateElementById(ramalEl.id, updates);
                                setContextMenuState((prev) =>
                                  prev
                                    ? { ...prev, element: { ...prev.element, ...updates } }
                                    : null,
                                );
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
                            {aparatoOptions.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nombre}
                              </option>
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
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            padding: '4px 8px',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Asociar Bajante
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={
              (engineRef.current?.bajantes || []).find((b) => b.area_m2 === areaEl.areaM2)?.id || ''
            }
            aria-label="Asociar Bajante"
            onChange={(e) => {
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
            style={DrawingElementContextMenu_S2}
          >
            <option value="">— Sin bajante —</option>
            {(engineRef.current?.bajantes || [])
              .filter((b) => b.net === areaEl.net)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code || b.id}
                </option>
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
      diamList = GAS[0]?.rows.map((r) => ({ n: r.dn })) || [];
    } else {
      diamList = DIAM_BY_MAT[matShort] || [];
    }

    return (
      <>
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            padding: '4px 8px',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Diámetro de ramal
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value={ramalEl.diametro ? ramalEl.diametro.split(' — ')[0].trim() : ''}
            aria-label="Diámetro de ramal"
            onChange={(e) => {
              const val = e.target.value;
              if (engineRef.current) {
                // Single invariant: ramal.diam >= accesorio.diam, enforced here on the RAMAL
                // side (not on the accessory selectors, which allow picking any accessory
                // diameter freely) — a ramal can never be shrunk below whatever accessory
                // diameter is already attached to it.
                const inchFrom = (d: string) => {
                  const q = d.indexOf('"');
                  return q > 0 ? d.slice(0, q) : d;
                };
                const accDiamI = ramalEl.diametroInicio || '';
                const accDiamF = ramalEl.diametroFin || '';
                const accDiamNum = Math.max(
                  accDiamI ? diamPulgFromLabel(inchFrom(accDiamI)) : 0,
                  accDiamF ? diamPulgFromLabel(inchFrom(accDiamF)) : 0,
                );
                if (val && accDiamNum > 0 && diamPulgFromLabel(inchFrom(val)) < accDiamNum) {
                  engineRef.current.triggerAlert(
                    'Diámetro no permitido',
                    'El diámetro del ramal no puede ser menor al diámetro del accesorio conectado.',
                  );
                  return;
                }
                // Accessory diameter (diametroInicio/Fin) no longer has its own picker — it always
                // mirrors the ramal's own diameter, so it must be kept in sync here too, not just
                // set once when the accessory is first created.
                const updates = { diametro: val, diametroInicio: val, diametroFin: val };
                engineRef.current.updateElementById(ramalEl.id, updates);
                setContextMenuState((prev) =>
                  prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
                );
                if (selElement?.id === ramalEl.id) {
                  setSelElement({ ...selElement, ...updates });
                }
                if (activeNet === ramalEl.net) {
                  setDiamSel((prev) => ({ ...prev, [activeNet]: val }));
                }
                // Propagate to any downstream ramal auto-created by a tee-split merge FROM this
                // one — mergesFrom stores the [upstream, incoming] parent ids at the moment of
                // the split (PlanoEngineDrawing.ts), and that child's diametro was only ever
                // computed once, at creation time. Without this, changing a parent's diameter
                // afterward never reaches the already-created merged/auto-created ramal.
                const eng = engineRef.current;
                for (const child of eng.ramales) {
                  if (!child.mergesFrom || !child.mergesFrom.includes(ramalEl.id)) continue;
                  const [pid1, pid2] = child.mergesFrom;
                  const d1 =
                    pid1 === ramalEl.id
                      ? val
                      : eng.ramales.find((r) => r.id === pid1)?.diametro || '';
                  const d2 =
                    pid2 === ramalEl.id
                      ? val
                      : eng.ramales.find((r) => r.id === pid2)?.diametro || '';
                  const newChildDiam = maxDiametroLabel(d1, d2);
                  if (newChildDiam && newChildDiam !== child.diametro) {
                    eng.updateElementById(child.id, {
                      diametro: newChildDiam,
                      diametroInicio: newChildDiam,
                      diametroFin: newChildDiam,
                    });
                  }
                }
                eng.render();
              }
            }}
            style={DrawingElementContextMenu_S2}
          >
            <option value="">— Sin diámetro —</option>
            {diamList.map((d) => {
              const valClean = d.n.split(' — ')[0].trim();
              return (
                <option key={d.n} value={valClean}>
                  {normalizeDnLabel(valClean)}
                </option>
              );
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
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            padding: '4px 8px',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Contador: {bajEl.code || bajEl.id}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            padding: '4px 8px 0',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
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
                  setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
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
              <option key={c.dn} value={c.dn}>
                {normalizeDnLabel(c.dn)}"
              </option>
            ))}
          </select>
        </div>
        {(bajEl.net === 'af' || bajEl.net === 'gas') && (
          <div style={{ borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <div
              style={{
                fontSize: 12,
                color: '#22D3EE',
                padding: '4px 8px',
                fontFamily: "'Geist',monospace",
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {bajEl.net === 'gas' ? 'Conexión (Red → Contador)' : 'AC-01 (Red Pública → Contador)'}
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#849495',
                  fontFamily: "'Geist',monospace",
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Diámetro
              </div>
              <select
                value={bajEl.acoDiam || ''}
                aria-label="Diámetro"
                onChange={(e) => {
                  const val = e.target.value;
                  if (engineRef.current) {
                    engineRef.current?.updateElementById(bajEl.id, { acoDiam: val });
                    const fresh = engineRef.current?.bajantes.find((b) => b.id === bajEl.id);
                    if (fresh) {
                      setContextMenuState((prev) =>
                        prev ? { ...prev, element: { ...fresh } } : null,
                      );
                    }
                    engineRef.current?.render();
                    writeAcoDiamToDrawing(val, planosCtx.plans, bajEl.net || 'af');
                  }
                }}
                style={DrawingElementContextMenu_S2}
              >
                <option value="">— Sin diámetro —</option>
                {(bajEl.net === 'gas' ? GAS_DN_LABELS : DIAMETROS_AF.map((d) => d.nominal)).map(
                  (d) => (
                    <option key={d} value={d}>
                      {normalizeDnLabel(d)}
                    </option>
                  ),
                )}
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
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            padding: '4px 8px',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Calentador: {bajEl.code || bajEl.id}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#849495',
            padding: '4px 8px 0',
            fontFamily: "'Geist',monospace",
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
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
                  setContextMenuState((prev) => (prev ? { ...prev, element: { ...fresh } } : null));
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
            {CAT_GAS.filter((g) => g.id.startsWith('cal')).map((g) => (
              <option key={g.id} value={g.id}>
                {g.n}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  }

  return null;
}

function BajanteMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element } = ctx;
  const bajEl = element as PlanoBajante;
  const isGhostClick = contextMenuState.isGhostClick || false;
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(ctx.activeNet);

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
        upperFloorGroup={ctx.upperFloorGroup}
        planosCtx={ctx.planosCtx}
        triggerConfirm={ctx.triggerConfirm}
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
  );
}

function AreaMenu() {
  const ctx = useDrawingElementContextMenu();
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
  );
}

// Rotates pts[1] around pts[0] (the fixed pivot) by the given signed degree step, validating the
// result against the same angle rules a real ramal on that net would have to obey — so a guide
// line can never be rotated into an angle its later "Crear ramal" conversion wouldn't accept.
// Standard infinite-line/bounded-segment intersection: the guide is treated as an infinite line
// (it's a construction aid, often drawn short of the ramal it's meant to reference) while the
// ramal segment stays bounded to its own actual extent (s must land within [0,1], with a small
// tolerance for the ramal's own vertex sitting almost exactly on the guide's line).
function intersectGuideWithSegment(
  p0: number[],
  p1: number[],
  q0: number[],
  q1: number[],
): { x: number; y: number } | null {
  const dx1 = p1[0] - p0[0];
  const dy1 = p1[1] - p0[1];
  const dx2 = q1[0] - q0[0];
  const dy2 = q1[1] - q0[1];
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) return null;
  const dx3 = q0[0] - p0[0];
  const dy3 = q0[1] - p0[1];
  const s = (dx3 * dy1 - dy3 * dx1) / denom;
  if (s < -0.02 || s > 1.02) return null;
  return { x: q0[0] + s * dx2, y: q0[1] + s * dy2 };
}

// Finds the nearest ramal the guide line's (infinite) line crosses, returning that crossing point
// and the ramal segment's own direction — the rotate buttons form their angle relative to THIS,
// not to the guide's own current orientation, per the whole point of drawing a guide across a
// ramal in the first place.
function findGuideCrossing(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
): { point: [number, number]; angle: number } | null {
  const [p0, p1] = guide.pts;
  let best: { point: [number, number]; angle: number; dist: number } | null = null;
  for (const r of eng.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const hit = intersectGuideWithSegment(p0, p1, r.pts[i], r.pts[i + 1]);
      if (!hit) continue;
      const dist = Math.hypot(hit.x - p0[0], hit.y - p0[1]);
      if (!best || dist < best.dist) {
        const dx = r.pts[i + 1][0] - r.pts[i][0];
        const dy = r.pts[i + 1][1] - r.pts[i][1];
        best = { point: [hit.x, hit.y], angle: Math.atan2(dy, dx), dist };
      }
    }
  }
  return best;
}

// A crossed ramal segment gives TWO possible reference rays from the crossing point (its own
// direction, and the reverse) — "Superior"/"Inferior" lets the user pick which one the angle is
// measured from, since rotating 45° off one ray vs the other produces a mirrored result. Screen Y
// grows downward, so "Superior" = whichever ray points up (negative Y); ties (a horizontal ramal)
// fall back to whichever ray points left, an arbitrary but stable choice.
function pickSideAngle(rayAngle: number, side: 'sup' | 'inf'): number {
  const reverse = rayAngle + Math.PI;
  const raySinY = Math.sin(rayAngle);
  const upIsRay = Math.abs(raySinY) > 1e-6 ? raySinY < 0 : Math.cos(rayAngle) < 0;
  const upAngle = upIsRay ? rayAngle : reverse;
  const downAngle = upIsRay ? reverse : rayAngle;
  return side === 'sup' ? upAngle : downAngle;
}

// san/ll pipe only turns in 45° fittings, gas only in 90° — matches the same per-net rule
// `checkRamalAngles`/`drawingAngles.ts` uses elsewhere for real ramales, applied here as a UX
// filter over which rotate buttons even get shown (see GuideLineMenu below).
function netAllowedSteps(net: string): (45 | 90)[] {
  if (net === 'san' || net === 'll') return [45];
  if (net === 'gas') return [90];
  return [45, 90];
}

function rotateGuideLine(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
  deg: number,
  side: 'sup' | 'inf',
  setSelElement: (el: PlanoElement | null) => void,
  selElement: PlanoElement | null,
): void {
  const [p0, p1] = guide.pts;
  const crossing = findGuideCrossing(eng, guide);

  let pivot: [number, number];
  let farPt: number[];
  let baseAngle: number;
  if (crossing) {
    pivot = crossing.point;
    baseAngle = pickSideAngle(crossing.angle, side);
    const d0 = Math.hypot(p0[0] - pivot[0], p0[1] - pivot[1]);
    const d1 = Math.hypot(p1[0] - pivot[0], p1[1] - pivot[1]);
    farPt = d1 >= d0 ? p1 : p0;
  } else {
    pivot = [p0[0], p0[1]];
    baseAngle = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    farPt = p1;
  }
  const dist = Math.hypot(farPt[0] - pivot[0], farPt[1] - pivot[1]);
  const newAngle = baseAngle + (deg * Math.PI) / 180;
  const newFar: [number, number] = [
    pivot[0] + dist * Math.cos(newAngle),
    pivot[1] + dist * Math.sin(newAngle),
  ];
  // Pivot snaps exactly onto the crossing point (if one was found) — the guide should visibly
  // touch the ramal precisely at the angle it now forms with it, not wherever it happened to be
  // drawn originally.
  const newPts: [number, number][] = [pivot, newFar];

  if (!crossing && !checkRamalAngles(newPts, guide.net)) {
    eng.triggerAlert(
      'Ángulo no permitido',
      guide.net === 'san' || guide.net === 'll'
        ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
        : guide.net === 'gas'
          ? 'La red de gas solo permite ángulos de 90°.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°.',
    );
    return;
  }
  guide.pts = newPts;
  if (selElement?.id === guide.id) setSelElement({ ...guide });
  eng.render();
  eng._markDirty();
}

function GuideLineMenu() {
  const ctx = useDrawingElementContextMenu();
  const guide = ctx.element as PlanoGuideLine;
  const [side, setSide] = useState<'sup' | 'inf'>('sup');
  const allowedSteps = netAllowedSteps(guide.net);

  return (
    <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          fontSize: 12,
          color: '#849495',
          fontFamily: "'Geist',monospace",
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Línea guía
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#6b7280',
          fontFamily: "'Geist',monospace",
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Lado del cruce
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['sup', 'inf'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            style={{
              ...DrawingElementContextMenu_S13,
              flex: 1,
              textAlign: 'center',
              background:
                side === s ? 'rgba(245,166,35,0.18)' : DrawingElementContextMenu_S13.background,
              borderColor: side === s ? '#F5A623' : undefined,
            }}
          >
            {s === 'sup' ? 'Superior' : 'Inferior'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { lbl: '45° izq', deg: -45, step: 45 as const },
          { lbl: '45° der', deg: 45, step: 45 as const },
          { lbl: '90° izq', deg: -90, step: 90 as const },
          { lbl: '90° der', deg: 90, step: 90 as const },
        ]
          .filter(({ step }) => allowedSteps.includes(step))
          .map(({ lbl, deg }) => (
            <button
              key={lbl}
              type="button"
              onClick={() => {
                const eng = ctx.engineRef.current;
                if (!eng) return;
                rotateGuideLine(eng, guide, deg, side, ctx.setSelElement, ctx.selElement);
              }}
              style={{ ...DrawingElementContextMenu_S13, flex: 1, textAlign: 'center' }}
            >
              {lbl}
            </button>
          ))}
      </div>
      <button
        type="button"
        onClick={() => {
          const eng = ctx.engineRef.current;
          if (!eng) return;
          const netDef = NETS.find((n) => n.id === guide.net);
          const pfx = netDef?.lbl || 'R';
          if (!eng._netCounts[guide.net]) eng._netCounts[guide.net] = { ramal: 0, tributario: 0 };
          const cnt = ++eng._netCounts[guide.net].ramal;
          const ramId = `${pfx}${cnt}`;
          const [p0, p1] = guide.pts;
          const dx = p1[0] - p0[0];
          const dy = p1[1] - p0[1];
          const distMm = Math.hypot(dx, dy);
          let lblAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (lblAngle > 90) lblAngle -= 180;
          if (lblAngle < -90) lblAngle += 180;
          const perpX = -dy / (distMm || 1);
          const perpY = dx / (distMm || 1);
          eng.ramales.push({
            id: ramId,
            net: guide.net,
            tipo: 'ramal',
            padre: null,
            pts: [
              [p0[0], p0[1]],
              [p1[0], p1[1]],
            ],
            totalL: +eng.pxToM(distMm).toFixed(3),
            label: ramId,
            ini: '',
            fin: '',
            piso: String(eng.nivelActual?.n ?? ''),
            dz: '',
            uc: 0,
            labelX: (p0[0] + p1[0]) / 2 + perpX * 25,
            labelY: (p0[1] + p1[1]) / 2 + perpY * 25,
            labelAngle: Math.round(lblAngle),
            material: '',
            diametro: '',
            pendiente: 2,
            bloqueado: false,
          });
          eng.guideLines = eng.guideLines.filter((g) => g.id !== guide.id);
          eng.selId = ramId;
          if (ctx.selElement?.id === guide.id) ctx.setSelElement(null);
          eng._emitSelect(eng.ramales[eng.ramales.length - 1]);
          eng.render();
          eng._markDirty();
          ctx.setContextMenuState(null);
        }}
        style={DrawingElementContextMenu_S13}
      >
        + Crear ramal a partir de línea guía
      </button>
    </div>
  );
}

function MidRamalAccessorySelector({
  element,
  midRamalHit,
  engineRef,
  selElement,
  setSelElement,
  setContextMenuState,
}: {
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
      <div
        style={{
          fontSize: 12,
          color: '#849495',
          fontFamily: "'Geist',monospace",
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
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

          if (
            accId === 'codoReventilado' &&
            (diamPulgFromLabel(fresh.diametro || '') < 3 ||
              diamPulgFromLabel(fresh.diametro || '') > 4)
          ) {
            eng.triggerAlert(
              'Diámetro no permitido',
              'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".',
            );
            return;
          }

          if (existingKey) {
            const newAccMed = { ...(fresh.accMed || {}) };
            if (accId) {
              newAccMed[existingKey] = accId;
            } else {
              delete newAccMed[existingKey];
            }
            eng.updateElementById(element.id, { accMed: newAccMed });
            if (selElement?.id === element.id) setSelElement({ ...selElement, accMed: newAccMed });
            // Without this, `element` (contextMenuState's frozen snapshot from when the menu
            // opened) never reflects the write: the dropdown kept showing "Ninguno" after the
            // FIRST pick, and every pick after that fell into the "insert new vertex" branch
            // below instead of updating this one — leaving the old glyph on screen alongside
            // the new one, and "Ninguno" unable to find anything to delete.
            setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element, accMed: newAccMed } } : null,
            );
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
            if (selElement?.id === element.id)
              setSelElement({ ...(selElement as PlanoRamal), pts: newPts, accMed: shiftedAccMed });
            setContextMenuState((prev) =>
              prev
                ? {
                    ...prev,
                    element: {
                      ...(prev.element as PlanoRamal),
                      pts: newPts,
                      accMed: shiftedAccMed,
                    },
                  }
                : null,
            );
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
            if (TEE_LADO_LINKED.has(currentVal))
              bumpHidroAccesorio(element.net || 'af', 'teeLado', -1, element.id, planId);
            if (TEE_LADO_LINKED.has(accId))
              bumpHidroAccesorio(element.net || 'af', 'teeLado', 1, element.id, planId);
            // bumpHidroAccesorio writes straight to localStorage — FixturesPanel's sidebar
            // accessory counter only re-reads localStorage in response to this event (or its own
            // inc/dec calls), so without dispatching it here the count updates on disk but the
            // sidebar keeps showing the stale number until something else happens to trigger it.
            if (typeof window !== 'undefined')
              window.dispatchEvent(new CustomEvent('aparatos-clear'));
          }
          eng.render();
          eng._markDirty();
        }}
        style={DrawingElementContextMenu_S2}
      >
        <option value="">Ninguno</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RamalMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element, engineRef, selElement, setSelElement } = ctx;
  const ramalEl = element as PlanoRamal;

  // A midRamalHit landing exactly on an EXISTING accMed vertex (PlanoEngineHitTesting.ts checks
  // these before segment-body hits) reports segmentIdx = accMedIdx - 1 — i.e. accMedIdx =
  // segmentIdx + 1, same convention handleCreateMontanteMidBody/handleCreateTeeCapStub use.
  const hit = contextMenuState.midRamalHit;
  const existingTeeIdx = hit ? hit.segmentIdx + 1 : -1;
  const existingTeeType = hit ? ramalEl.accMed?.[`accMed${existingTeeIdx}`] : undefined;
  const isExistingTee =
    existingTeeType === 'teeDirecto' ||
    existingTeeType === 'teeSube' ||
    existingTeeType === 'teeBaja';
  // teeTapon/teeLlaveTerminal are self-contained glyphs (the free leg is already capped in the
  // marker itself, no real stub ramal) — they don't get the "+Tapón/+Llave" stub buttons below,
  // but the point is still occupied, so "Crear montante" must stay hidden there too.
  const isOccupiedTee =
    isExistingTee || existingTeeType === 'teeTapon' || existingTeeType === 'teeLlaveTerminal';

  return (
    <>
      {contextMenuState.midRamalHit &&
        !contextMenuState.ramalEndpoint &&
        !['san', 'll'].includes(ramalEl.net) &&
        getAccessoryOptions(ramalEl.net).length > 0 && (
          <MidRamalAccessorySelector
            element={ramalEl}
            midRamalHit={contextMenuState.midRamalHit}
            engineRef={ctx.engineRef}
            selElement={ctx.selElement}
            setSelElement={ctx.setSelElement}
            setContextMenuState={ctx.setContextMenuState}
          />
        )}
      {contextMenuState.midRamalHit &&
        !contextMenuState.ramalEndpoint &&
        ['af', 'ac'].includes(ramalEl.net) &&
        !isOccupiedTee && (
          <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                const eng = engineRef.current;
                const hit = contextMenuState.midRamalHit;
                if (!eng || !hit) return;
                eng.createMontanteMidBody(ramalEl.id, hit.x, hit.y, hit.segmentIdx);
                ctx.setContextMenuState(null);
              }}
              style={DrawingElementContextMenu_S13}
            >
              + Crear montante (auto-tee)
            </button>
          </div>
        )}
      {contextMenuState.midRamalHit &&
        !contextMenuState.ramalEndpoint &&
        ['af', 'ac'].includes(ramalEl.net) &&
        isExistingTee && (
          <div
            style={{
              padding: '4px 8px',
              borderTop: '1px solid #3a494a',
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: '#849495',
                fontFamily: "'Geist',monospace",
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Segmento libre de la tee
            </div>
            {(['tapon', 'llaveTerminal'] as const).map((accId) => (
              <button
                type="button"
                key={accId}
                onClick={() => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  eng.createTeeCapStub(ramalEl.id, existingTeeIdx, accId);
                  ctx.setContextMenuState(null);
                }}
                style={DrawingElementContextMenu_S13}
              >
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
      <div
        style={{
          padding: '4px 8px',
          borderTop: '1px solid #3a494a',
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={() => {
            const eng = engineRef.current;
            if (!eng) return;
            // Flip the ramal in place: reverses pts + swaps every endpoint-symmetric field.
            // Flow-direction arrow (rendered live from pts[0] vs pts[last]) flips automatically.
            const r = eng.ramales.find((x) => x.id === ramalEl.id);
            if (!r) return;
            const tmpPts = r.pts.map((p) => [...p]);
            r.pts = tmpPts.reverse();
            const tmpAcc = r.accesorioInicio;
            r.accesorioInicio = r.accesorioFin;
            r.accesorioFin = tmpAcc;
            const tmpDiam = r.diametroInicio;
            r.diametroInicio = r.diametroFin;
            r.diametroFin = tmpDiam;
            const tmpApp = r.aparatoInicio;
            r.aparatoInicio = r.aparatoFin;
            r.aparatoFin = tmpApp;
            const tmpIniFin = r.ini;
            r.ini = r.fin;
            r.fin = tmpIniFin;
            // accMed keys shift because interior vertices index in the new order.
            if (r.accMed) {
              const oldMed = r.accMed;
              const len = r.pts.length;
              const newMed: Record<string, string> = {};
              for (const [k, v] of Object.entries(oldMed)) {
                const m = k.match(/^accMed(\d+)$/);
                if (!m) continue;
                const oldIdx = parseInt(m[1], 10);
                const newIdx = len - 1 - oldIdx;
                newMed[`accMed${newIdx}`] = v;
              }
              r.accMed = newMed;
            }
            eng.render();
            eng._markDirty();
            ctx.setContextMenuState(null);
          }}
          style={DrawingElementContextMenu_S13}
        >
          ⇄ Invertir dirección del flujo
        </button>
      </div>
      <div
        style={{
          padding: '4px 8px',
          borderTop: '1px solid #3a494a',
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, color: '#e2e2e8', fontFamily: "'Geist',monospace" }}>
          Bloquear movimiento
        </span>
        <input
          type="checkbox"
          checked={!!ramalEl.bloqueado}
          aria-label="Bloquear movimiento"
          onChange={(e) => {
            const val = e.target.checked;
            if (engineRef.current) {
              engineRef.current?.updateElementById(ramalEl.id, { bloqueado: val });
              if (selElement?.id === ramalEl.id) {
                setSelElement({ ...selElement, bloqueado: val });
              }
              engineRef.current?.render();
            }
          }}
          style={{ accentColor: '#F5A623', cursor: 'pointer', margin: 0 }}
        />
      </div>
      {['san', 'll'].includes(ctx.activeNet) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '4px 8px',
            borderTop: '1px solid #3a494a',
            marginTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: '#849495',
              fontFamily: "'Geist',monospace",
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Bajantes asociados
          </div>
          <div style={DrawingElementContextMenu_S9}>
            {(() => {
              const currentId = ramalEl.id;
              const netBajantes = (engineRef.current?.bajantes || []).filter(
                (b) => b.net === ramalEl.net && b.id !== ramalEl.id && b.tipo !== 'tributario',
              );
              if (netBajantes.length === 0)
                return (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b8cae',
                      fontFamily: "'Geist',monospace",
                      gridColumn: 'span 4',
                    }}
                  >
                    Sin bajantes
                  </div>
                );
              return netBajantes.map((b) => {
                const isAssociated = (b.recibeDeIds || []).includes(currentId);
                return (
                  <label key={b.id} style={DrawingElementContextMenu_S22}>
                    <input
                      type="checkbox"
                      checked={isAssociated}
                      onChange={(e) => {
                        const recibidos = b.recibeDeIds || [];
                        const newRecibe = e.target.checked
                          ? [...recibidos, currentId]
                          : recibidos.filter((id: string) => id !== currentId);
                        const extraFields: Record<string, unknown> = { recibeDeIds: newRecibe };
                        if (e.target.checked) {
                          extraFields.descargaEnId = currentId;
                        } else if (
                          b.descargaEnId === currentId ||
                          b.descargaEnId?.endsWith('|' + currentId)
                        ) {
                          extraFields.descargaEnId = null;
                        }
                        engineRef.current?.updateElementById(b.id, extraFields);
                        if (selElement?.id === b.id) {
                          setSelElement({ ...selElement, ...extraFields });
                        }
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {bajanteLabel(b, engineRef.current?.nivelActual?.label)}
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        </div>
      )}
    </>
  );
}

function ContadorMenu() {
  const ctx = useDrawingElementContextMenu();
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
  );
}

function CalentadorMenu() {
  const ctx = useDrawingElementContextMenu();
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
  );
}

const CanalMenu_FIELD_LABELS: Record<'base' | 'altura', string> = {
  base: 'Base (cm)',
  altura: 'Altura (cm)',
};

// Free-text commit pattern (local edit buffer, commit on blur) — same as CanalDimField in
// RainChannelsCheck.tsx, since this file's other numeric fields are all <select> dropdowns and
// base/altura need arbitrary decimal entry instead.
function CanalDimInput({
  field,
  value,
  onCommit,
}: {
  field: 'base' | 'altura';
  value: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const display = editing ? text : value > 0 ? String(value) : '';
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder="0"
      aria-label={CanalMenu_FIELD_LABELS[field]}
      onFocus={() => {
        setEditing(true);
        setText(display);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        setText(raw);
      }}
      onBlur={() => {
        setEditing(false);
        const v = parseFloat(text) || 0;
        onCommit(text === '' ? 0 : v);
      }}
      style={DrawingElementContextMenu_S2}
    />
  );
}

function CanalMenu() {
  const { element, engineRef, selElement, setSelElement, setContextMenuState } =
    useDrawingElementContextMenu();
  const canal = element as PlanoBajante;

  const commit = (field: 'base' | 'altura', v: number) => {
    engineRef.current?.updateElementById(canal.id, { [field]: v });
    setContextMenuState((prev) =>
      prev ? { ...prev, element: { ...prev.element, [field]: v } } : null,
    );
    if (selElement?.id === canal.id) {
      setSelElement({ ...selElement, [field]: v });
    }
  };

  return (
    <>
      {(['base', 'altura'] as const).map((field) => (
        <div key={field} style={{ padding: '0 8px 8px' }}>
          <div
            style={{
              fontSize: 12,
              color: '#849495',
              fontFamily: "'Geist',monospace",
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {CanalMenu_FIELD_LABELS[field]}
          </div>
          <CanalDimInput
            field={field}
            value={canal[field] || 0}
            onCommit={(v) => commit(field, v)}
          />
        </div>
      ))}
    </>
  );
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
  upperFloorGroup: LowerFloorRamales | null;
  planosCtx: { plans: PlanItem[] };
  mats: Record<string, MaterialItem[]>;
  activeNet: string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
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
    upperFloorGroup: props.upperFloorGroup,
    planosCtx: props.planosCtx,
    mats: props.mats,
    activeNet: props.activeNet,
    setDiamSel: props.setDiamSel,
    triggerConfirm: props.triggerConfirm,
  };

  return (
    <DrawingElementContextMenuCtx.Provider value={ctxValue}>
      <DrawingElementContextMenuInner />
    </DrawingElementContextMenuCtx.Provider>
  );
});

function DrawingElementContextMenuInner() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState } = ctx;
  const menuRef = useRef<HTMLFormElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({
    x: contextMenuState?.x || 0,
    y: contextMenuState?.y || 0,
  });

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
  const isBajanteTipo =
    element.tipo === 'bajante' || element.tipo === 'montante' || element.id?.startsWith('B');
  const isArea = element.id?.startsWith('AR');
  // Guide lines also carry `pts` (reused for hit-testing) but must never fall into RamalMenu,
  // which assumes every PlanoRamal-only field (net-specific accessories, diameter, etc.) exists.
  const isGuide = element.id?.startsWith('GL');
  const hasPts = !!element.pts && !isGuide;
  const tipo = element.tipo;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
        }}
        onClick={() => ctx.setContextMenuState(null)}
        onContextMenu={(e) => e.preventDefault()}
      />
      <form
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú contextual de elemento"
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            const focusable = e.currentTarget.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;
            const first = focusable[0] as HTMLElement;
            const last = focusable[focusable.length - 1] as HTMLElement;
            if (e.shiftKey) {
              if (document.activeElement === first) {
                last.focus();
                e.preventDefault();
              }
            } else {
              if (document.activeElement === last) {
                first.focus();
                e.preventDefault();
              }
            }
          }
        }}
        style={{ ...DrawingElementContextMenu_S23, left: adjustedPos.x, top: adjustedPos.y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {isBajanteTipo && !hasPts ? (
          <BajanteMenu />
        ) : isArea ? (
          <AreaMenu />
        ) : isGuide ? (
          <GuideLineMenu />
        ) : hasPts ? (
          <RamalMenu />
        ) : tipo === 'contador' ? (
          <ContadorMenu />
        ) : tipo === 'calentador' ? (
          <CalentadorMenu />
        ) : tipo === 'canal' ? (
          <CanalMenu />
        ) : null}
      </form>
    </>
  );
}
