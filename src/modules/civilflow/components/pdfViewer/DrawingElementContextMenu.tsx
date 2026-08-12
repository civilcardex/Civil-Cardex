import { createContext, memo, useContext, useEffect, useRef, useState } from 'react';
import { bajanteLabel, ramalLabel } from '../../utils/accessoryAbbreviations';
import { normalizeDnLabel } from '../../utils/formatUtils';
import {
  pisoLbl,
  pisoCorto,
  buildBajanteVisualLabel,
  matFullName,
  DIAM_BAN,
  DIAM_VENT,
  DIAM_BY_MAT,
  GAS_DN_LABELS,
} from '../../constants';
import { loadFromStorage } from '../../services/storageService';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys';
import {
  APARATOS_DEF,
  AF_UC_IDS,
  AC_UC_IDS,
  SAN_UC_IDS,
} from '../../constants/engineeringDataFixtures';
import { getAccessoryOptions } from '../../utils/accessoryOptions';
import { NETS, allocNetNumber, type PlanoBajante } from '../../lib/PlanoEngine/PlanoState';
import { BAJANTE_NETS, MONTANTE_NETS } from '../../lib/PlanoEngine/drawingCreations';
import {
  maxDiametroLabel,
  autoSplitJunctionAndSumFlow,
  codoPolarityOk,
  flipRamalFlow,
  flowEndsAt,
  ramalFlowDirectionCheck,
} from '../../lib/PlanoEngine/PlanoEngineDrawing';
import {
  junctionRespectsTributarioDirection,
  directNeighborRamales,
} from '../../utils/flowDirection';
import {
  checkRamalAngles,
  detectAccesorioTrigger,
  _firstSegmentAngle,
} from '../../lib/PlanoEngine/drawingAngles';
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
  syncExtremeAparatoToCounts,
  bumpHidroAccesorio,
  moveAllAparatoCounts,
} from '../../utils/syncExtremeAccessory';
import { writeHydroDrawingSync } from '../../utils/drawingSync';
import UcMoveModal, { type UcMoveModalState } from './UcMoveModal';
import { GAS, CAT_GAS } from '../../constants/engineeringDataGas';
import {
  VENTILACION,
  CONTADORES as CONTADORES_CAT,
  NETS_WITH_MULTIPLE_MATERIALS,
} from '../../pages/catalog/catalogData';
import { DIAMETROS_AF } from '../../constants/hydraulicData';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { matchDiamOption } from '../../utils/diamOptionMatch';
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

// Sonda estructural de la unión PlanoElement: permite al código inspeccionar `tipo`/`pts`
// (presentes en algunos tipos de elemento y ausentes en otros) igual que hace el dispatch
// en tiempo de ejecución del engine, sin tener que estrechar el tipo con los guards
// exportados en cada punto de acceso.
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
                  // Guarda de dirección de flujo, espejo de la rama 'Baja' de abajo: un bajante
                  // "sube" solo debe ENTREGAR flujo. Si ya llega un ramal a este bajante
                  // (conectado por su FIN), marcarlo "sube" haría que recibiera flujo que solo
                  // debería emitir — se bloquea el cambio en lugar de producir en silencio una
                  // contradicción entre la dirección del bajante y sus conexiones.
                  const bajCode = element.code || element.id;
                  const arrivingRamal = (element.recibeDeIds || [])
                    .map((rid) => engineRef.current?.ramales.find((r) => r.id === rid))
                    .find((ram) => ram && ram.fin === bajCode);
                  if (arrivingRamal) {
                    engineRef.current?.triggerAlert(
                      'Dirección de flujo inconsistente',
                      `El ramal ${arrivingRamal.label || arrivingRamal.id} llega a este bajante (está conectado por su extremo final). Un bajante con dirección "sube" solo puede entregar flujo — desconecta o invierte ese ramal antes de cambiar la dirección.`,
                    );
                    return;
                  }
                  updates = {
                    direccion: 'sube',
                    nptBase: currentNpt,
                    nptCima: maxNpt,
                    desplazamientos: { ...(element.desplazamientos || {}) },
                  };
                } else if (opt === 'Baja') {
                  // Guarda de dirección de flujo, segunda parte: isRamalBajanteConnectionAllowed
                  // (en flowDirection.ts) solo se dispara cuando un extremo de ramal se conecta
                  // POR PRIMERA VEZ a un bajante. Nunca revalida las conexiones existentes cuando
                  // después se cambia la dirección del propio bajante — que es el orden mucho más
                  // común en la práctica (dibujar la geometría y luego fijar "Baja" aquí). Sin
                  // esta comprobación, un bajante que ya recibe un ramal por su INICIO (es decir,
                  // el ramal nace DEL bajante, no entra a él) podría marcarse "baja" en silencio
                  // aunque entonces estaría emitiendo flujo en lugar de solo recibirlo.
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
                  // El accesorio de un montante (codo90rmSube/Baja en extremo de ramal, o
                  // teeSube/Baja en división a mitad de cuerpo) se escribió una sola vez al
                  // crearse y nunca se resincronizó al cambiar la dirección después — siempre se
                  // quedaba con el valor inicial. Aquí se recalcula a partir de la dirección
                  // ACTUAL, localizando el punto exacto por posición (extremo → codo, vértice
                  // interior → tee) en lugar de asumir que siempre es un extremo.
                  if (
                    element.tipo === 'montante' &&
                    (updates.direccion === 'sube' || updates.direccion === 'baja')
                  ) {
                    const isSube = updates.direccion === 'sube';
                    const codoId = isSube ? 'codo90rmSube' : 'codo90rmBaja';
                    const teeId = isSube ? 'teeSube' : 'teeBaja';
                    const TOL = 0.5;
                    // Ítems 12/13: validar la polaridad del codo contra el flujo del ramal ANTES
                    // de escribir — codoSube exige que el flujo LLEGUE al punto, codoBaja que
                    // SALGA. Sin esto, cambiar la dirección del montante podía escribir un codo
                    // contradictorio con la flecha del ramal.
                    for (const rid of element.recibeDeIds || []) {
                      const ram = engineRef.current?.ramales.find((r) => r.id === rid);
                      if (!ram || !ram.pts?.length) continue;
                      const idx = ram.pts.findIndex(
                        ([px, py]) => Math.hypot(px - element.x, py - element.y) < TOL,
                      );
                      if (idx === -1) continue;
                      const pt = ram.pts[idx];
                      if (idx === 0 || idx === ram.pts.length - 1) {
                        if (!codoPolarityOk(ram, pt, codoId, TOL)) {
                          engineRef.current?.triggerAlert(
                            'Polaridad de codo incorrecta',
                            isSube
                              ? 'El codo 90° sube exige que la cola de la flecha apunte a este punto (el flujo debe salir de aquí hacia el codo). Invierte la dirección del ramal o usa "baja".'
                              : 'El codo 90° baja exige que la cabeza de la flecha apunte a este punto (el flujo debe llegar aquí desde el codo). Invierte la dirección del ramal o usa "sube".',
                          );
                          return;
                        }
                      }
                    }
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
            // Un bajante que ya tiene un ramal/tributario conectado no puede convertirse en
            // fantasma — el desplazamiento lo separaría visualmente de lo que realmente está
            // alimentando, así que se bloquea la activación con una advertencia explícita.
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

  // Sincronización en tiempo real del desplegable "Origen (piso superior)": `upperFloorGroup`
  // es estado de PdfViewer que solo vuelve a leer su piso objetivo cuando cambia la SELECCIÓN —
  // una asociación creada o eliminada aquí (o desde el panel BajanteAsociacion, o desde el menú
  // "Destino" del otro piso) nunca toca esas dependencias, así que la lista de opciones quedaría
  // desactualizada. Se vuelve a leer el storage del piso superior cada vez que cambian el
  // elemento de este menú o sus punteros entre pisos (writeBajantePropToDrawing persiste en
  // TRAZOS_PREFIX + planId, por lo que la relectura ve los datos recién guardados).
  const [freshUpperBajantes, setFreshUpperBajantes] = useState<PlanoBajante[] | null>(null);
  useEffect(() => {
    if (!upperFloorGroup || upperFloorGroup.isCurrent) {
      setFreshUpperBajantes(null);
      return;
    }
    const isRiser = (b: PlanoBajante) =>
      b.tipo !== 'contador' && b.tipo !== 'calentador' && b.tipo !== 'red_publica';
    const data = loadFromStorage<{ bajantes?: PlanoBajante[] } | null>(
      TRAZOS_PREFIX + upperFloorGroup.planId,
      null,
    );
    setFreshUpperBajantes(
      (data?.bajantes || []).filter((b) => b.net === (element.net || '') && isRiser(b)) || null,
    );
  }, [upperFloorGroup, element.id, element.origenId, element.descargaEnId, element.net]);

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

  // Espejo del onChange de "Destino" (más abajo) pero para el selector "Origen" del piso
  // inmediatamente superior — misma lógica que associateOrigin en BajanteAsociacion.tsx,
  // duplicada aquí (no compartida) porque esta versión lee/escribe `element` (lo que se haya
  // clicado con botón derecho, no necesariamente selElement) y sincroniza contextMenuState
  // igual que el resto de handlers de este componente.
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
      const originPlan = planosCtx.plans.find((pl) => String(pl.id) === originPlanId);
      eng.triggerAlert(
        'No se pudo asociar',
        `No se encontró el bajante ${buildBajanteVisualLabel(
          { code: originBajanteId },
          originPlan?.nivel != null ? pisoCorto(originPlan.nivel) : undefined,
        )} en el piso superior. Intenta reabrir el panel o recargar el piso.`,
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
    const srcLabel = buildBajanteVisualLabel(
      { code: source.code },
      originPlan?.nivel != null ? pisoCorto(originPlan.nivel) : undefined,
    );
    const tgtLabel = buildBajanteVisualLabel(
      { code: target.code },
      selectedNivel !== null ? pisoCorto(selectedNivel) : undefined,
    );
    triggerConfirm(
      'Crear fantasma de asociación',
      `${srcLabel} y ${tgtLabel} no están alineados. Se creará un bajante fantasma en este piso, en la posición de ${srcLabel}. ¿Continuar?`,
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
                  const srcLabel = buildBajanteVisualLabel(
                    { code: source.code },
                    selectedNivel !== null ? pisoCorto(selectedNivel) : undefined,
                  );
                  const tgtLabel = buildBajanteVisualLabel(
                    { code: target.code },
                    targetPlan?.nivel != null ? pisoCorto(targetPlan.nivel) : undefined,
                  );
                  triggerConfirm(
                    'Crear fantasma de asociación',
                    `${srcLabel} y ${tgtLabel} no están alineados. Se creará un bajante fantasma en el piso de origen, en la posición de ${srcLabel}. ¿Continuar?`,
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
                            {buildBajanteVisualLabel(
                              b,
                              plano?.nivel != null ? pisoCorto(plano.nivel) : undefined,
                            )}
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
                    // Validación: el diámetro del bajante no puede ser menor que el de los
                    // ramales conectados
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
                  const bajantesToShow = freshUpperBajantes ?? (upperFloorGroup.bajantes || []);
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
                  // Validación: el diámetro del bajante no puede ser menor que el de los
                  // ramales conectados
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
                          // Se lee recibeDeIds en vivo del objeto bajante del engine en lugar
                          // de la copia `recibidos` capturada en el closure — si se alternan dos
                          // checkboxes antes de que React re-renderice entre ellos, cada uno
                          // calcularía newRecibe desde el mismo array obsoleto y pisaría el
                          // cambio del otro.
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
                            // Sin dirección por defecto — una dirección vacía no puede violar
                            // la regla de flujo ('sube' solo emite, 'baja' solo recibe). La
                            // dirección se asigna después mediante las opciones Sube/Baja, que
                            // validan las conexiones del ramal antes de aplicarla.
                            direccion: undefined,
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
                          // Relleno automático del ini/fin del ramal
                          if (ep.idx === 0) {
                            eng.updateElementById(ramalEl.id, { ini: code });
                          } else {
                            eng.updateElementById(ramalEl.id, { fin: code });
                          }
                          // Se bloquea el ramal para que el bajante recién anclado no pueda
                          // arrastrarse de forma independiente
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
                ['san', 'af', 'ac', 'gas', 'vent'].includes(ramalEl.net) &&
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
                              // Ítem 2 (reventilado): el codo reventilado NO puede recibir
                              // flujo — si el flujo del ramal sanitario termina en el extremo
                              // (lo recibe), bloquear. Solo es válido en el extremo DESDE donde
                              // fluye el ramal (junto al sifón del aparato).
                              if (val === 'codoReventilado' && ramalEl.net === 'san') {
                                const epPt: number[] = [ep.x, ep.y];
                                if (flowEndsAt(ramalEl, epPt, 0.5)) {
                                  engineRef.current?.triggerAlert(
                                    'Codo reventilado no puede recibir flujo',
                                    'El codo reventilado debe colocarse en el extremo DESDE donde fluye el ramal sanitario. Invierte la dirección del ramal.',
                                  );
                                  return;
                                }
                              }
                              // Ítems 4/5 (polaridad sube/baja) en extremo: sube solo ENTREGA
                              // (cola de la flecha al extremo — flujo SALE de ahí); baja solo
                              // RECIBE (cabeza de la flecha al extremo — flujo LLEGA ahí). Se
                              // valida contra el ramal VIVO del engine (el snapshot `ramalEl`
                              // puede estar stale si el flujo cambió tras abrir el menú).
                              if (
                                (val === 'codoSube' ||
                                  val === 'codoBaja' ||
                                  val === 'codo90rmSube' ||
                                  val === 'codo90rmBaja') &&
                                engineRef.current
                              ) {
                                const live = engineRef.current.ramales.find(
                                  (r) => r.id === ramalEl.id,
                                );
                                const target = live || ramalEl;
                                if (!codoPolarityOk(target, [ep.x, ep.y], val, 0.5)) {
                                  const isSube = val === 'codoSube' || val === 'codo90rmSube';
                                  engineRef.current.triggerAlert(
                                    'Polaridad de codo incorrecta',
                                    isSube
                                      ? 'El codo 90° sube solo puede entregar flujo: la cola de la flecha debe apuntar al extremo (el flujo sale de ahí hacia el codo).'
                                      : 'El codo 90° baja solo puede recibir flujo: la cabeza de la flecha debe apuntar al extremo (el flujo llega ahí desde el codo).',
                                  );
                                  return;
                                }
                              }
                              // Si este extremo ya tiene un accesorio distinto, se reemplaza
                              // directamente por la nueva selección en lugar de bloquear con alerta.
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
                              // El accesorio hereda el diámetro del ramal como valor por defecto:
                              // si el ramal ya tiene diámetro asignado, el accesorio nuevo nace
                              // con ese mismo diámetro (resuelto al valor canónico del selector);
                              // si no, queda "Ninguno".
                              if (val && !oldVal) {
                                const aMatShort =
                                  ramalEl.material || (ramalEl.net === 'san' ? 'PVC' : '');
                                const aDiamList =
                                  (ramalEl.net === 'san' && DIAM_BY_MAT['PVC']) ||
                                  DIAM_BY_MAT[aMatShort] ||
                                  [];
                                updates[fieldDiam] = matchDiamOption(aDiamList, ramalEl.diametro);
                              }
                              engineRef.current.updateElementById(ramalEl.id, updates);
                              setContextMenuState((prev) =>
                                prev ? { ...prev, element: { ...prev.element, ...updates } } : null,
                              );
                              if (selElement?.id === ramalEl.id) {
                                setSelElement({ ...selElement, ...updates });
                              }
                              engineRef.current.render();
                              // Mismo orden que ExtremeAccessoryEditor: el sync de conteos debe
                              // correr ANTES del reconcile de _markDirty, o el bump +1 duplica el
                              // accesorio en hidroData (reducción contada dos veces en el resumen).
                              if (val !== oldVal && planosCtx?.plans) {
                                syncExtremeAccessoryToHidroData(
                                  ramalEl.id,
                                  fieldAcc,
                                  oldVal,
                                  val,
                                  planosCtx.plans,
                                );
                              }
                              engineRef.current._markDirty();
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
                          const currentDiam =
                            matchDiamOption(diamList, ramalEl[fieldDiam]) ||
                            matchDiamOption(diamList, ramalEl.diametro) ||
                            '';
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
                                    // Leer el diámetro del ramal fresco del engine — el snapshot
                                    // ramalEl puede estar stale si el ramal se editó desde
                                    // TramoEditor mientras el menú estaba abierto.
                                    const fresh = engineRef.current?.ramales.find(
                                      (x) => x.id === ramalEl.id,
                                    );
                                    const ramalDiam = fresh?.diametro || ramalEl.diametro;
                                    if (
                                      ramalDiam &&
                                      diamPulgFromLabel(inchFrom(v)) >
                                        diamPulgFromLabel(inchFrom(ramalDiam))
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

                      {ramalEl.net !== 'san' && ramalEl.net !== 'vent' && (
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
                                const oldApp = ramalEl[fieldApp] || '';
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
                                if (planosCtx?.plans) {
                                  syncExtremeAparatoToCounts(
                                    ramalEl.id,
                                    oldApp,
                                    val || '',
                                    planosCtx.plans,
                                  );
                                }
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
              .filter((b) => b.net === areaEl.net && b.tipo !== 'canal')
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
        {NETS_WITH_MULTIPLE_MATERIALS.has(ramalEl.net) && (
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
              Material de ramal
            </div>
            <div style={{ padding: '0 8px 8px' }}>
              <select
                value={ramalEl.material || ''}
                aria-label="Material de ramal"
                onChange={(e) => {
                  const val = e.target.value;
                  const eng = engineRef.current;
                  if (!eng) return;
                  eng.updateElementById(ramalEl.id, { material: val });
                  const fresh = eng.ramales.find((x) => x.id === ramalEl.id);
                  if (fresh) {
                    setContextMenuState((prev) =>
                      prev ? { ...prev, element: { ...fresh } } : null,
                    );
                  }
                  // La lista de diámetros depende del material (DIAM_BY_MAT): si el diámetro
                  // actual ya no existe para el material nuevo, se resetea (junto con los
                  // diámetros de accesorio espejados) para que el ramal nunca conserve un
                  // diametro obsoleto.
                  const updates: Record<string, string> = { material: val };
                  if (!isVen && !isGas) {
                    const nd = DIAM_BY_MAT[val] || [];
                    const cur = ramalEl.diametro ? ramalEl.diametro.split(' — ')[0].trim() : '';
                    if (cur && !nd.some((d) => d.n.split(' — ')[0].trim() === cur)) {
                      updates.diametro = '';
                      updates.diametroInicio = '';
                      updates.diametroFin = '';
                    }
                  }
                  if (Object.keys(updates).length > 1 || updates.material !== ramalEl.material) {
                    eng.updateElementById(ramalEl.id, updates);
                  }
                  if (selElement?.id === ramalEl.id) {
                    setSelElement({ ...selElement, ...updates });
                  }
                  if (activeNet === ramalEl.net) {
                    setDiamSel((prev) => ({ ...prev, [activeNet]: '' }));
                  }
                  eng.render();
                }}
                style={DrawingElementContextMenu_S2}
              >
                <option value="">— Sin material —</option>
                {matList.map((m) => (
                  <option key={m.id} value={m.val}>
                    {matFullName(m.val)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
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
                // Invariante única: ramal.diam >= accesorio.diam, impuesta aquí del lado del
                // RAMAL (no en los selectores de accesorio, que dejan elegir cualquier
                // diámetro libremente) — un ramal nunca puede reducirse por debajo del
                // diámetro del accesorio que ya tiene conectado.
                const inchFrom = (d: string) => {
                  const q = d.indexOf('"');
                  return q > 0 ? d.slice(0, q) : d;
                };
                // Leer datos frescos del engine — el snapshot ramalEl puede estar stale
                // si el usuario cambió el diámetro desde TramoEditor mientras el menú estaba abierto.
                const fresh = engineRef.current?.ramales.find((x) => x.id === ramalEl.id);
                const liveAccDiamI =
                  (fresh?.diametroInicio as string) || ramalEl.diametroInicio || '';
                const liveAccDiamF = (fresh?.diametroFin as string) || ramalEl.diametroFin || '';
                const accDiamNum = Math.max(
                  liveAccDiamI ? diamPulgFromLabel(inchFrom(liveAccDiamI)) : 0,
                  liveAccDiamF ? diamPulgFromLabel(inchFrom(liveAccDiamF)) : 0,
                );
                if (val && accDiamNum > 0 && diamPulgFromLabel(inchFrom(val)) < accDiamNum) {
                  const accINum = liveAccDiamI ? diamPulgFromLabel(inchFrom(liveAccDiamI)) : 0;
                  const accFNum = liveAccDiamF ? diamPulgFromLabel(inchFrom(liveAccDiamF)) : 0;
                  const blockEnd = accINum >= accFNum ? 'INICIO' : 'FIN';
                  const blockDiam = accINum >= accFNum ? liveAccDiamI : liveAccDiamF;
                  // eslint-disable-next-line no-console
                  console.warn('[ContextMenu-ramal] alerta diametro', {
                    id: ramalEl.id,
                    val,
                    liveAccDiamI,
                    liveAccDiamF,
                    accDiamNum,
                    parsedNew: diamPulgFromLabel(inchFrom(val)),
                  });
                  engineRef.current.triggerAlert(
                    'Diámetro no permitido',
                    `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${blockEnd} (${blockDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
                  );
                  return;
                }
                // NO sobrescribir diametroInicio/Fin: el accesorio conserva su propio diámetro
                // (la invariante permite accesorios más angostos que el ramal). Forzarlos al
                // diámetro del ramal hacía que el siguiente cambio de diámetro alertara siempre:
                // el accesorio quedaba con el valor anterior del ramal y bloqueaba cualquier
                // reducción posterior, aunque el accesorio real fuera menor.
                const updates = { diametro: val };
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
                // Propagar a cualquier ramal aguas abajo auto-creado por una fusión de división
                // en tee DESDE este — mergesFrom guarda los ids de los padres [aguas arriba,
                // entrante] en el momento de la división (PlanoEngineDrawing.ts), y el diametro
                // de ese hijo solo se calculó una vez, al crearlo. Sin esto, cambiar el
                // diámetro de un padre después nunca llega al ramal fusionado/auto-creado ya
                // existente. Aplica a todas las redes: el hijo siempre sigue al mayor (max).
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

// Rota pts[1] alrededor de pts[0] (el pivote fijo) en el paso de grados con signo dado,
// validando el resultado contra las mismas reglas de ángulo que debería obedecer un ramal
// real de esa red — así una línea guía nunca puede quedar rotada a un ángulo que su
// conversión posterior "Crear ramal" no aceptaría.
// Intersección estándar línea infinita/segmento acotado: la guía se trata como línea
// infinita (es una ayuda de construcción, a menudo dibujada corta del ramal al que debe
// referenciar) mientras el segmento del ramal queda acotado a su extensión real (s debe
// caer en [0,1], con una tolerancia pequeña para el vértice del propio ramal que yace casi
// exactamente sobre la línea de la guía).
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

// Busca el ramal más cercano que cruce la línea (infinita) de la guía y devuelve ese punto de
// cruce junto con la dirección del propio segmento del ramal — los botones de rotación forman
// su ángulo respecto a ESTA, no a la orientación actual de la guía, que es precisamente el
// sentido de dibujar una guía a través de un ramal.
function findGuideCrossing(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
): { point: [number, number]; angle: number; ramalId: string } | null {
  const [p0, p1] = guide.pts;
  let best: { point: [number, number]; angle: number; dist: number; ramalId: string } | null = null;
  for (const r of eng.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const hit = intersectGuideWithSegment(p0, p1, r.pts[i], r.pts[i + 1]);
      if (!hit) continue;
      const dist = Math.hypot(hit.x - p0[0], hit.y - p0[1]);
      if (!best || dist < best.dist) {
        const dx = r.pts[i + 1][0] - r.pts[i][0];
        const dy = r.pts[i + 1][1] - r.pts[i][1];
        best = { point: [hit.x, hit.y], angle: Math.atan2(dy, dx), dist, ramalId: r.id };
      }
    }
  }
  return best;
}

// Un segmento de ramal cruzado da DOS rayos de referencia posibles desde el punto de cruce
// (su propia dirección y la inversa) — "Superior"/"Inferior" permite al usuario elegir desde
// cuál se mide el ángulo, ya que rotar 45° desde un rayo o desde el otro produce un resultado
// espejado. La Y de pantalla crece hacia abajo, así que "Superior" = el rayo que apunta hacia
// arriba (Y negativa); en empates (ramal horizontal) se cae al rayo que apunta a la izquierda,
// una elección arbitraria pero estable.
function pickSideAngle(rayAngle: number, side: 'sup' | 'inf'): number {
  const reverse = rayAngle + Math.PI;
  const raySinY = Math.sin(rayAngle);
  const upIsRay = Math.abs(raySinY) > 1e-6 ? raySinY < 0 : Math.cos(rayAngle) < 0;
  const upAngle = upIsRay ? rayAngle : reverse;
  const downAngle = upIsRay ? reverse : rayAngle;
  return side === 'sup' ? upAngle : downAngle;
}

// La tubería san/ll/vent solo gira con codos de 45°; AF/AC y gas solo de 90° — coincide con la
// misma regla por red que `checkRamalAngles`/`drawingAngles.ts` aplica en otros sitios para los
// ramales reales, aplicada aquí como filtro de UX sobre qué botones de rotación se muestran
// (ver GuideLineMenu más abajo).
function netAllowedSteps(net: string): (45 | 90)[] {
  if (net === 'san' || net === 'll' || net === 'vent') return [45];
  return [90];
}

// Una guía se dibuja con `net: activeNet` fijado en el momento de dibujarla — si el usuario
// cambia de red activa después (o la dibujó con la red "equivocada" activa por descuido), ese
// campo queda desalineado con lo que la guía realmente está cruzando en el plano. Los botones de
// ángulo, la validación y el ramal/tributario que finalmente se crea deben reflejar SIEMPRE la
// red del ramal real que la guía toca, no el valor congelado al dibujarla — así el menú "detecta
// automáticamente" la red correcta en vez de exigir que el usuario la haya elegido bien de
// antemano. Si la guía no cruza ningún ramal (línea guía libre), no hay nada que detectar y se
// conserva `guide.net` como mejor valor disponible.
function resolveGuideNet(eng: PlanoEngine, guide: PlanoGuideLine): string {
  const crossing = findGuideCrossing(eng, guide);
  if (!crossing) return guide.net;
  const ramal = eng.ramales.find((r) => r.id === crossing.ramalId);
  return ramal?.net || guide.net;
}

function rotateGuideLine(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
  deg: number,
  side: 'sup' | 'inf',
  setSelElement: (el: PlanoElement | null) => void,
  selElement: PlanoElement | null,
): void {
  // Resolver siempre el objeto VIVO de eng.guideLines por id, nunca confiar en la referencia
  // `guide` recibida — el menú contextual puede guardar una copia desconectada.
  const liveGuide = eng.guideLines.find((g) => g.id === guide.id) || guide;
  const [p0, p1] = liveGuide.pts;
  const crossing = findGuideCrossing(eng, liveGuide);
  const effectiveNet = resolveGuideNet(eng, liveGuide);

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
  const newPts: [number, number][] = [pivot, newFar];

  if (!crossing && !checkRamalAngles(newPts, effectiveNet)) {
    eng.triggerAlert(
      'Ángulo no permitido',
      effectiveNet === 'san' || effectiveNet === 'll'
        ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
        : effectiveNet === 'gas'
          ? 'La red de gas solo permite ángulos de 90°. Usar línea guía para ajustar ángulo.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
    );
    return;
  }
  liveGuide.pts = newPts;
  if (selElement?.id === liveGuide.id) setSelElement({ ...liveGuide });
  eng.render();
  eng._markDirty();
}

function guideAngleAlertMessage(net: string, tipo: string): string {
  if (net === 'san' || net === 'll' || net === 'vent')
    return 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.';
  if (net === 'gas')
    return 'La red de gas solo permite ángulos de 90°. Usar línea guía para ajustar ángulo.';
  if ((net === 'af' || net === 'ac') && tipo === 'tributario')
    return 'Los tributarios de AF/AC solo permiten ángulos de 90°. Usar línea guía para ajustar ángulo.';
  return 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.';
}

function GuideLineMenu() {
  const ctx = useDrawingElementContextMenu();
  const guide = ctx.element as PlanoGuideLine;
  const [side, setSide] = useState<'sup' | 'inf'>('sup');
  const eng = ctx.engineRef.current;
  // Detecta la red real desde el ramal que la guía está cruzando en este momento — no la red que
  // estaba activa cuando se dibujó la guía — así los botones de ángulo mostrados siempre
  // coinciden con la red que efectivamente se va a crear/rotar.
  const effectiveNet = eng ? resolveGuideNet(eng, guide) : guide.net;
  const allowedSteps = netAllowedSteps(effectiveNet);

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
          const liveGuide = eng.guideLines.find((g) => g.id === guide.id) || guide;
          const netDef = NETS.find((n) => n.id === effectiveNet);
          const pfx = netDef?.lbl || 'R';
          const cnt = allocNetNumber(eng, effectiveNet, 'ramal', (n) =>
            eng.ramales.some((r) => r.id === `${pfx}${n}` || r.label === `${pfx}${n}`),
          );
          const ramId = `${pfx}${cnt}`;
          const [p0, p1] = liveGuide.pts;
          // El flujo se dibuja desde pts[0] hacia el último punto (renderRamales.ts) — se
          // orienta el nuevo ramal para que su flujo apunte siempre al ramal sobre el que se
          // dibujó esta guía (el cruce ES la conexión que crea), desde el extremo de la guía
          // más cercano primero.
          const crossing = findGuideCrossing(eng, liveGuide);
          let pStart: [number, number] = [p0[0], p0[1]];
          let pEnd: [number, number] = [p1[0], p1[1]];
          if (crossing) {
            const d0 = Math.hypot(crossing.point[0] - p0[0], crossing.point[1] - p0[1]);
            const d1 = Math.hypot(crossing.point[0] - p1[0], crossing.point[1] - p1[1]);
            if (d0 < d1) {
              pStart = [p1[0], p1[1]];
              pEnd = [p0[0], p0[1]];
            }
          }
          // Una guía se dibuja a mano alzada, así que su ángulo no está garantizado sobre la
          // rejilla de la red — crear el ramal igualmente produciría en silencio una tubería
          // ilegal. Se valida primero (misma regla que finishRamal); si falla, se conserva la
          // guía para que el usuario pueda rotarla.
          if (!checkRamalAngles([pStart, pEnd], effectiveNet, 'ramal')) {
            eng.triggerAlert('Ángulo no permitido', guideAngleAlertMessage(effectiveNet, 'ramal'));
            return;
          }
          // Sin auto-orientación aquí: si la dirección de flujo del ramal creado no coincide con
          // la del ramal cruzado, autoSplitJunctionAndSumFlow muestra la alerta y bloquea la
          // unión (item 1). La auto-orientación al crear queda solo para tributarios (item 10).
          const distMm = Math.hypot(pEnd[0] - pStart[0], pEnd[1] - pStart[1]);
          const newRamal: PlanoRamal = {
            id: ramId,
            net: effectiveNet,
            tipo: 'ramal',
            padre: null,
            pts: [pStart, pEnd],
            totalL: +eng.pxToM(distMm).toFixed(3),
            label: ramId,
            ini: '',
            fin: '',
            piso: String(eng.nivelActual?.n ?? ''),
            dz: '',
            uc: 0,
            // Ítem 1: etiqueta en el punto medio del trazo REAL [pStart,pEnd] con el ángulo de
            // su primer segmento (igual que los ramales manuales: labelOffset 0 + _firstSegmentAngle)
            // — el gap perpendicular del render queda justo arriba del trazo. Antes usaba el
            // ángulo de la guía original sin reordenar, que quedaba 180° fuera cuando el cruce
            // invertía pStart/pEnd, tirando la etiqueta al lado opuesto del trazo.
            labelX: (pStart[0] + pEnd[0]) / 2,
            labelY: (pStart[1] + pEnd[1]) / 2,
            labelAngle: _firstSegmentAngle([pStart, pEnd]),
            material: '',
            diametro: '',
            pendiente: 2,
            bloqueado: false,
          };
          // Ítem 5: un vent creado desde guía que termina fluyendo HACIA una unión san (codo
          // reventilado) se bloquea aquí — autoSplitJunctionAndSumFlow solo valida uniones a
          // mitad de cuerpo, no extremo-con-extremo, así que sin este chequeo el vent se creaba
          // recibiendo flujo en el extremo de un ramal sanitario.
          if (effectiveNet === 'vent') {
            const flowErr = ramalFlowDirectionCheck(eng, newRamal, [newRamal], 0.5);
            if (flowErr) {
              eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
              return;
            }
          }
          eng.ramales.push(newRamal);
          // Igual que un ramal terminado a mano (finishRamal): si el extremo cae a mitad del
          // cuerpo de otro ramal, ese ramal se parte en existing+downstream y el nuevo se suma
          // como incoming — antes esto solo empujaba el ramal suelto, sin dividir nada, así que
          // una guía dibujada sobre el cuerpo de un ramal existente dejaba un cruce en T sin
          // partir de verdad (sin mergesFrom, sin acumulación de UC/UD).
          autoSplitJunctionAndSumFlow(eng, newRamal);
          eng.guideLines = eng.guideLines.filter((g) => g.id !== guide.id);
          eng.selId = ramId;
          if (ctx.selElement?.id === guide.id) ctx.setSelElement(null);
          eng._emitSelect(newRamal);
          eng.render();
          eng._markDirty();
          // Mismo disparador que finishRamal (PlanoEngineDrawing.ts) para AF/AC/gas — sin esto,
          // un ramal creado desde línea guía nunca ofrecía elegir el tipo de tee/codo en la
          // unión que se acaba de formar, a diferencia de uno dibujado a mano.
          if (
            (newRamal.net === 'af' || newRamal.net === 'ac' || newRamal.net === 'gas') &&
            eng.triggerAccesorioModal
          ) {
            const trigger = detectAccesorioTrigger(eng, newRamal.id);
            if (trigger) eng.triggerAccesorioModal(trigger);
          }
          ctx.setContextMenuState(null);
        }}
        style={DrawingElementContextMenu_S13}
      >
        + Crear ramal a partir de línea guía
      </button>
      <button
        type="button"
        onClick={() => {
          const eng = ctx.engineRef.current;
          if (!eng) return;
          const liveGuide = eng.guideLines.find((g) => g.id === guide.id) || guide;
          const crossing = findGuideCrossing(eng, liveGuide);
          if (!crossing) {
            eng.triggerAlert(
              'Sin cruce con ramal',
              'La línea guía no cruza ningún ramal. Dibújala sobre un ramal existente para crear un tributario que conecte a él.',
            );
            return;
          }
          const padre = eng.ramales.find((r) => r.id === crossing.ramalId);
          if (!padre) return;
          // El flujo del tributario se dibuja desde pts[0] hacia el último punto — se orienta
          // para que la cabeza apunte AL cruce (la intersección con el ramal padre que
          // alimenta).
          const [p0, p1] = liveGuide.pts;
          const d0 = Math.hypot(crossing.point[0] - p0[0], crossing.point[1] - p0[1]);
          const d1 = Math.hypot(crossing.point[0] - p1[0], crossing.point[1] - p1[1]);
          const pStart: [number, number] = d0 < d1 ? [p1[0], p1[1]] : [p0[0], p0[1]];
          const pEnd: [number, number] = [crossing.point[0], crossing.point[1]];
          // La red del tributario es SIEMPRE la del padre real que la guía está cruzando (no la
          // red que estaba activa cuando se dibujó la guía) — el padre ya se resolvió arriba, así
          // que `padre.net` es la fuente de verdad, no `guide.net`.
          if (!checkRamalAngles([pStart, pEnd], padre.net, 'tributario')) {
            eng.triggerAlert(
              'Ángulo no permitido',
              guideAngleAlertMessage(padre.net, 'tributario'),
            );
            return;
          }
          // San/ll/vent: mismo pre-alineamiento que el botón "Crear ramal" — sin esto,
          // autoSplitJunctionAndSumFlow aborta en silencio la división cuando el sentido no
          // coincide con el del padre (tributario queda suelto, sin símbolo, con la alerta
          // "Dirección de flujo incorrecta"). En af/ac/gas esto se sobrescribe de todos modos más
          // abajo (autoSplitJunctionAndSumFlow fuerza la cola del tributario hacia la unión sin
          // importar lo que se ponga aquí), así que fijarlo igual no interfiere.
          let tribReversedForFlow: boolean | undefined;
          if (padre.net === 'san' || padre.net === 'll' || padre.net === 'vent') {
            if (padre.pts && padre.pts.length >= 2) {
              const e0 = padre.pts[0];
              const e1 = padre.pts[padre.pts.length - 1];
              const flowEx = padre._tribReversed
                ? [e0[0] - e1[0], e0[1] - e1[1]]
                : [e1[0] - e0[0], e1[1] - e0[1]];
              const flowNew = [pEnd[0] - pStart[0], pEnd[1] - pStart[1]];
              if (flowNew[0] * flowEx[0] + flowNew[1] * flowEx[1] <= 0) {
                tribReversedForFlow = true;
              }
            }
          }
          const padreLabel = padre.label || padre.id || '';
          const cnt = allocNetNumber(eng, padre.net, 'tributario', (n) =>
            eng.ramales.some((r) => r.label === `T${n}${padreLabel}`),
          );
          const tId = 'T' + Date.now();
          const distMm = Math.hypot(pEnd[0] - pStart[0], pEnd[1] - pStart[1]);
          const label = `T${cnt}${padre.label || padre.id || ''}`;
          const newTrib: PlanoRamal = {
            id: tId,
            net: padre.net,
            tipo: 'tributario',
            padre: padre.id,
            pts: [pStart, pEnd],
            totalL: +eng.pxToM(distMm).toFixed(3),
            label,
            ini: '',
            fin: '',
            piso: String(eng.nivelActual?.n ?? ''),
            dz: '',
            uc: 0,
            nSalidas: 1,
            // Ítem 1: etiqueta en el punto medio del trazo real [pStart,pEnd] con el ángulo de
            // su primer segmento (igual que los ramales manuales).
            labelX: (pStart[0] + pEnd[0]) / 2,
            labelY: (pStart[1] + pEnd[1]) / 2,
            labelAngle: _firstSegmentAngle([pStart, pEnd]),
            material: '',
            diametro: '',
            pendiente: 2,
            bloqueado: true,
            _tribReversed: tribReversedForFlow,
          };
          // Ítem 5: un tributario vent creado desde guía que termina fluyendo HACIA la unión san
          // (recibiendo flujo en el codo reventilado) se bloquea aquí — autoSplit no valida
          // uniones extremo-con-extremo.
          if (padre.net === 'vent') {
            const flowErr = ramalFlowDirectionCheck(eng, newTrib, [newTrib], 0.5);
            if (flowErr) {
              eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
              return;
            }
          }
          eng.ramales.push(newTrib);
          // Igual que un tributario terminado a mano sobre su padre: parte al padre en
          // existing+downstream en el punto de cruce y fija la dirección del tributario (cola
          // hacia la unión) — antes esto solo empujaba el tributario suelto sin partir el padre,
          // dejando una T sin dividir de verdad (sin mergesFrom, sin acumulación de UC) y con la
          // dirección de flujo por defecto (equivocada) del tributario.
          autoSplitJunctionAndSumFlow(eng, newTrib);
          eng.guideLines = eng.guideLines.filter((g) => g.id !== guide.id);
          eng.selId = tId;
          if (ctx.selElement?.id === guide.id) ctx.setSelElement(null);
          eng._emitSelect(newTrib);
          eng.render();
          eng._markDirty();
          // Mismo disparador que finishRamal (PlanoEngineDrawing.ts) para AF/AC/gas — sin esto,
          // un tributario creado desde línea guía nunca ofrecía elegir el tipo de tee/codo en la
          // unión con su padre, a diferencia de uno dibujado a mano.
          if (
            (newTrib.net === 'af' || newTrib.net === 'ac' || newTrib.net === 'gas') &&
            eng.triggerAccesorioModal
          ) {
            const trigger = detectAccesorioTrigger(eng, newTrib.id);
            if (trigger) eng.triggerAccesorioModal(trigger);
          }
          ctx.setContextMenuState(null);
        }}
        style={DrawingElementContextMenu_S13}
      >
        + Crear tributario a partir de línea guía
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
  // La 'llaveTerminal' simple solo tiene sentido en un extremo real del ramal (termina la
  // tubería allí) — en el cuerpo debe ir mediante 'teeLlaveTerminal' (un tee con la pierna
  // libre tapada), por eso se excluye la válvula pelada de este selector de cuerpo aunque
  // getAccessoryOptions la incluya para el editor de extremos.
  const options = getAccessoryOptions(element.net).filter((o) => o.value !== 'llaveTerminal');
  if (options.length === 0) return null;

  // Si ya existe un vértice accMed (casi) exactamente en el punto clicado, se edita ese
  // en lugar de insertar un vértice nuevo.
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

          // Ítems 12/13: polaridad del codo de 90° sube/baja en el CUERPO — en el cuerpo el
          // flujo pasa de largo (ni llega ni sale), así que ni sube ni baja son válidos ahí.
          if (
            accId === 'codoSube' ||
            accId === 'codoBaja' ||
            accId === 'codo90rmSube' ||
            accId === 'codo90rmBaja'
          ) {
            if (!codoPolarityOk(fresh, [midRamalHit.x, midRamalHit.y], accId, 0.5)) {
              const isSube = accId === 'codoSube' || accId === 'codo90rmSube';
              eng.triggerAlert(
                'Polaridad de codo incorrecta',
                isSube
                  ? 'El codo 90° sube solo puede entregar flujo: colócalo en un extremo hacia donde fluye el ramal, no en el cuerpo.'
                  : 'El codo 90° baja solo puede recibir flujo: colócalo en un extremo desde donde fluye el ramal, no en el cuerpo.',
              );
              return;
            }
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
            // Sin esto, `element` (la copia congelada de contextMenuState del momento en que se
            // abrió el menú) nunca refleja la escritura: el desplegable seguía mostrando
            // "Ninguno" tras la PRIMERA elección, y cada elección posterior caía en la rama de
            // "insertar vértice nuevo" (más abajo) en vez de actualizar este — dejando el
            // glifo antiguo en pantalla junto al nuevo, y "Ninguno" sin encontrar nada que
            // eliminar.
            setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element, accMed: newAccMed } } : null,
            );
          } else if (accId) {
            // Se inserta un vértice nuevo en el punto clicado (dividiendo el segmento, no el
            // ramal) y se ancla allí el accesorio.
            const newIdx = midRamalHit.segmentIdx + 1;
            const newPts = fresh.pts.map((p: number[]) => [...p]);
            newPts.splice(newIdx, 0, [midRamalHit.x, midRamalHit.y]);
            // Las claves accMed existentes en/después del punto de inserción se desplazan un
            // índice hacia arriba.
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
          // teeTapon/teeLlaveTerminal ya no se ofrecen en el contador de accesorios del panel
          // lateral (son glifos puros de cuerpo, elegidos solo desde este desplegable) — pero
          // siguen contando como tee de paso a efectos de pérdida de carga, igual que un "Tee
          // paso lado" contabilizado manualmente. Se incrementa/decrementa ese conteo
          // automáticamente para que cambiar de uno de estos dos no deje un conteo huérfano.
          const TEE_LADO_LINKED = new Set(['teeTapon', 'teeLlaveTerminal']);
          if (currentVal !== accId) {
            // _loadedPlanId, NO eng.planId — este último está declarado en el engine pero nunca
            // se asigna, así que siempre es undefined; usarlo escribía el conteo bajo la clave
            // `${net}_${id}_` (planId vacío) mientras el panel lateral lee
            // `${net}_${id}_${realPlanId}`, con lo que el conteo caía en una clave que nada
            // mostraba jamás.
            const planId = eng._loadedPlanId ?? '';
            if (TEE_LADO_LINKED.has(currentVal))
              bumpHidroAccesorio(element.net || 'af', 'teeLado', -1, element.id, planId);
            if (TEE_LADO_LINKED.has(accId))
              bumpHidroAccesorio(element.net || 'af', 'teeLado', 1, element.id, planId);
            // bumpHidroAccesorio escribe directo en localStorage — el contador de accesorios
            // del panel lateral de FixturesPanel solo vuelve a leer localStorage en respuesta
            // a este evento (o a sus propias llamadas inc/dec), así que sin despacharlo aquí
            // el conteo se actualiza en disco pero el panel sigue mostrando el número
            // obsoleto hasta que algo más lo dispare.
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

// ¿El punto p cae sobre el CUERPO (mitad de segmento) de pts? Excluye extremos (t<0.02/0.98),
// que se validan por coincidencia de vértice aparte.
function pointOnRamalBody(pts: number[][], p: number[], tol: number): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) {
      if (Math.hypot(p[0] - a[0], p[1] - a[1]) < tol) return true;
      continue;
    }
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    if (t < 0.02 || t > 0.98) continue;
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    if (Math.hypot(p[0] - px, p[1] - py) < tol) return true;
  }
  return false;
}

// Un ramal que participa en cualquier unión con otros ramales no debe ver invertido su sentido
// de flujo: invertir pts invalidaría cada extremo compartido, el vínculo con el tributario
// padre, los glifos tee/yee de accMed en la unión y las asignaciones accesorioInicio/Fin de
// los ramales conectados. "Interconexión" = comparte extremo con otro ramal, tiene tributarios
// colgados, es él mismo tributario, o lleva marcadores de unión (accMed / cruces bilaterales /
// pares de ids).
function ramalHasInterconnections(eng: PlanoEngine | null, ramal: PlanoRamal): boolean {
  if (!eng) return false;
  const TOL = 0.5;
  const eps = [ramal.pts[0], ramal.pts[ramal.pts.length - 1]];
  // Ítem 11: este ramal es la mitad (aguas arriba o abajo) de una división auto-split — su
  // dirección no se puede invertir sin romper la cadena mergesFrom.
  if (ramal.mergesFrom) return true;
  for (const other of eng.ramales) {
    if (other.id === ramal.id) continue;
    const sameGroup =
      other.net === ramal.net ||
      ((other.net === 'san' || other.net === 'vent') &&
        (ramal.net === 'san' || ramal.net === 'vent'));
    if (!sameGroup) continue;
    if (other.padre === ramal.id) return true;
    if (other.tipo === 'tributario' && ramal.tipo === 'tributario' && other.padre === ramal.padre)
      continue;
    // otro ramal fue partido por este (o referencia este en una cadena de splits)
    if (other.mergesFrom && other.mergesFrom.includes(ramal.id)) return true;
    // extremo-contra-extremo (comportamiento viejo)
    for (const pt of other.pts) {
      if (eps.some((e) => Math.hypot(e[0] - pt[0], e[1] - pt[1]) < TOL)) return true;
    }
    // Ítem 11: extremo del OTRO sentado sobre el CUERPO de este ramal (p. ej. un vent sobre el
    // cuerpo de un san — la unión reventilado no divide, así que antes no se detectaba) y
    // extremo de ESTE sentado sobre el cuerpo del otro.
    for (const pt of other.pts) {
      if (pointOnRamalBody(ramal.pts, pt, TOL)) return true;
    }
    for (const myEp of eps) {
      if (pointOnRamalBody(other.pts, myEp, TOL)) return true;
    }
  }
  // Ítem 11: bajante/montante tocando los extremos — vía recibeDeIds o por posición (con el
  // desplazamiento del piso actual). Invertir el ramal voltearía ini/fin que referencian el
  // código del bajante.
  const lvl = eng.nivelActual?.label ?? '';
  for (const b of eng.bajantes) {
    if (b.recibeDeIds?.includes(ramal.id)) return true;
    const disp = b.desplazamientos?.[lvl] || {};
    const bx = b.x + (disp.dx || 0);
    const by = b.y + (disp.dy || 0);
    if (eps.some((e) => Math.hypot(e[0] - bx, e[1] - by) < TOL)) return true;
  }
  if (ramal.tipo === 'tributario') return true;
  if (ramal.accMed && Object.keys(ramal.accMed).length > 0) return true;
  return false;
}

function RamalMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element, engineRef, selElement, setSelElement } = ctx;
  const ramalEl = element as PlanoRamal;
  const [ucMoveState, setUcMoveState] = useState<UcMoveModalState>({
    isOpen: false,
    sourceLabel: '',
    options: [],
  });

  // Un midRamalHit que cae exactamente sobre un vértice accMed EXISTENTE (PlanoEngineHitTesting.ts
  // los comprueba antes que los impactos de cuerpo de segmento) reporta segmentIdx = accMedIdx - 1
  // — es decir, accMedIdx = segmentIdx + 1, misma convención que usan
  // handleCreateMontanteMidBody/handleCreateTeeCapStub.
  const hit = contextMenuState.midRamalHit;
  const existingTeeIdx = hit ? hit.segmentIdx + 1 : -1;
  const existingTeeType = hit ? ramalEl.accMed?.[`accMed${existingTeeIdx}`] : undefined;
  const isExistingTee =
    existingTeeType === 'teeDirecto' ||
    existingTeeType === 'teeSube' ||
    existingTeeType === 'teeBaja';
  // teeTapon/teeLlaveTerminal son glifos autocontenidos (la pierna libre ya viene tapada en el
  // propio marcador, sin ramal stub real) — no reciben los botones de stub "+Tapón/+Llave" de
  // abajo, pero el punto sigue ocupado, así que "Crear montante" también debe permanecer oculto
  // allí.
  const isOccupiedTee =
    isExistingTee || existingTeeType === 'teeTapon' || existingTeeType === 'teeLlaveTerminal';

  // F1: al invertir la dirección de un ramal interconectado (af/ac/gas, no tributario) con UC
  // asignadas y al menos un vecino directo, el usuario elige a qué ramal de la conexión se
  // mueven las unidades de consumo. Sin UC o sin vecinos → toggle directo sin modal.
  const readUcInfo = (): { planId: string | number | null; total: number } => {
    const all =
      loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {}) || {};
    for (const p of ctx.planosCtx?.plans || []) {
      if (p.status !== 'confirmed') continue;
      const rec = all[`${ramalEl.net}_${ramalEl.id}_${p.id}`];
      if (rec && Object.keys(rec).length > 0) {
        const total = Object.values(rec).reduce((s, n) => s + (n || 0), 0);
        if (total > 0) return { planId: p.id, total };
      }
    }
    return { planId: null, total: 0 };
  };

  const doInvert = (targetId: string | null) => {
    const val = !ramalEl._tribReversed;
    const eng = engineRef.current;
    if (!eng) return;
    eng.updateElementById(ramalEl.id, { _tribReversed: val });
    const fresh = eng.ramales.find((x) => x.id === ramalEl.id);
    // Cuando un tributario participa en la unión de cualquiera de los dos extremos,
    // la regla se endurece a "exactamente 1 entrada" (ver
    // junctionRespectsTributarioDirection) — "al menos 1 salida" no basta ahí, porque
    // el tributario ya aporta su propia salida fija sin importar qué pase con el
    // resto del grupo (existing/downstream podrían quedar los dos como salida o los
    // dos como entrada, y "al menos 1 salida" no lo detectaría).
    const okAtBothEnds = fresh
      ? [fresh.pts[0], fresh.pts[fresh.pts.length - 1]].every((ep) =>
          junctionRespectsTributarioDirection(eng.ramales, ramalEl.net, ep),
        )
      : true;
    if (!okAtBothEnds) {
      eng.updateElementById(ramalEl.id, { _tribReversed: !val });
      eng.triggerAlert(
        'Conexión sin salida',
        'Toda conexión en esta red debe tener al menos un ramal con dirección de flujo saliendo de ella.',
      );
      eng.render();
      return;
    }
    if (targetId) {
      const ucInfo = readUcInfo();
      if (ucInfo.planId != null) {
        moveAllAparatoCounts(ramalEl.net, ramalEl.id, targetId, ucInfo.planId);
        writeHydroDrawingSync(ctx.planosCtx?.plans || []);
      }
    }
    if (selElement?.id === ramalEl.id) {
      setSelElement({ ...selElement, _tribReversed: val });
    }
    eng.render();
    eng._markDirty();
    ctx.setContextMenuState(null);
  };

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
      {contextMenuState.ramalEndpoint && ramalEl.net === 'af' && !isOccupiedTee && (
        <div style={{ padding: '4px 8px', borderTop: '1px solid #3a494a', marginTop: 4 }}>
          <button
            type="button"
            onClick={() => {
              const eng = engineRef.current;
              const ep = contextMenuState.ramalEndpoint;
              if (!eng || !ep) return;
              eng.createCalentadorMidBody(ramalEl.id, ep.x, ep.y, ep.idx);
              ctx.setContextMenuState(null);
            }}
            style={DrawingElementContextMenu_S13}
          >
            + Agregar calentador
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
        {!ramalHasInterconnections(engineRef.current, ramalEl) && (
          <button
            type="button"
            onClick={() => {
              const eng = engineRef.current;
              if (!eng) return;
              // Invierte el ramal en su sitio: revierte pts + intercambia todo campo simétrico
              // respecto a los extremos.
              // La flecha de dirección de flujo (dibujada en vivo desde pts[0] vs pts[last])
              // se invierte automáticamente.
              const r = eng.ramales.find((x) => x.id === ramalEl.id);
              if (!r) return;
              // Un solo flip (involución) reemplazó el código inline de pts.reverse + swaps de
              // extremos + reindex de accMed.
              flipRamalFlow(r);
              // Ítems 2/5/11: tras invertir, el ramal puede quedar fluyendo contra la dirección
              // del ramal en el otro extremo (o un vent puede quedar llegando a una unión
              // reventilado). Se valida y, si viola, se deshace (un segundo flip restaura).
              const flowErr = ['san', 'll', 'vent'].includes(r.net)
                ? ramalFlowDirectionCheck(eng, r, [], 0.5)
                : null;
              if (flowErr) {
                flipRamalFlow(r);
                eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
                eng.render();
                return;
              }
              eng.render();
              eng._markDirty();
              ctx.setContextMenuState(null);
            }}
            style={DrawingElementContextMenu_S13}
          >
            ⇄ Invertir dirección del flujo
          </button>
        )}
        {/* Los tributarios de AF/AC/gas nunca muestran este botón — su dirección de flujo es fija
            (cola siempre hacia la unión, ver autoSplitJunctionAndSumFlow) y no se puede cambiar,
            así que la unión que crean queda siempre garantizada como 2 salidas + 1 entrada. */}
        {ramalHasInterconnections(engineRef.current, ramalEl) &&
          ['af', 'ac', 'gas'].includes(ramalEl.net) &&
          ramalEl.tipo !== 'tributario' && (
            <button
              type="button"
              aria-pressed={!!ramalEl._tribReversed}
              style={
                ramalEl._tribReversed
                  ? { ...DrawingElementContextMenu_S13, background: '#00dce5', color: '#1e2024' }
                  : DrawingElementContextMenu_S13
              }
              onClick={() => {
                const eng = engineRef.current;
                if (!eng) return;
                // F1: con UC asignadas y vecinos directos en la conexión, el usuario elige a
                // qué ramal se mueven las unidades de consumo antes de invertir. Sin UC o sin
                // vecinos → toggle directo, sin modal.
                const ucInfo = readUcInfo();
                if (ucInfo.total > 0) {
                  const neighbors = directNeighborRamales(eng.ramales, ramalEl);
                  if (neighbors.length > 0) {
                    setUcMoveState({
                      isOpen: true,
                      sourceLabel: ramalLabel(ramalEl),
                      options: neighbors.map((n) => ({ id: n.id, label: ramalLabel(n) })),
                    });
                    return;
                  }
                }
                doInvert(null);
              }}
            >
              ⇄ Invertir dirección de flujo
            </button>
          )}
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
          Bloquear Movimiento-Longitud
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
      <UcMoveModal
        state={ucMoveState}
        onConfirm={(targetId) => {
          doInvert(targetId);
          setUcMoveState({ isOpen: false, sourceLabel: '', options: [] });
        }}
        onCancel={() => {
          setUcMoveState({ isOpen: false, sourceLabel: '', options: [] });
          ctx.setContextMenuState(null);
        }}
      />
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

const CanalMenu_FIELD_LABELS: Record<'base' | 'altura' | 'longitud', string> = {
  base: 'Base (cm)',
  altura: 'Altura (cm)',
  longitud: 'Longitud (cm)',
};

// Patrón de commit con texto libre (buffer de edición local, commit al perder el foco) — igual
// que CanalDimField en RainChannelsCheck.tsx, ya que los demás campos numéricos de este archivo
// son todos desplegables <select> y base/altura necesitan entrada decimal arbitraria.
function CanalDimInput({
  field,
  value,
  onCommit,
}: {
  field: 'base' | 'altura' | 'longitud';
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
      onKeyDown={(e) => {
        // Enter commitea el cambio (mismo comportamiento que el resto de campos numéricos)
        if (e.key === 'Enter') e.currentTarget.blur();
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

  const commit = (field: 'base' | 'altura' | 'longitud', v: number) => {
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
      {(['base', 'longitud', 'altura'] as const).map((field) => (
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
          Asociar bajante externo
        </div>
        <select
          value={canal.bajanteExternoId || ''}
          aria-label="Asociar bajante externo"
          onChange={(e) => {
            const v = e.target.value || null;
            engineRef.current?.updateElementById(canal.id, { bajanteExternoId: v });
            setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element, bajanteExternoId: v } } : null,
            );
            if (selElement?.id === canal.id) {
              setSelElement({ ...selElement, bajanteExternoId: v });
            }
            engineRef.current?.render();
          }}
          style={DrawingElementContextMenu_S2}
        >
          <option value="">— Sin bajante —</option>
          {(engineRef.current?.bajantes || [])
            .filter((b) => b.net === 'll' && b.tipo !== 'canal')
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

  // Guard anti-pisado (bug 1a): cuando el menú se abre con clic derecho, `state.element` es el
  // hit fresco del motor y `selElement` puede ser una selección VIEJA del clic izquierdo con el
  // mismo id — sincronizar ahí pisaría el hit con datos anteriores. Se recuerda qué elemento
  // abrió el menú (openHitRef, por identidad de id) y qué selElement existía en ese momento
  // (selAtOpenRef): el sync solo procede si selElement CAMBIÓ después de abrir el menú (mutación
  // del propio menú o nueva selección del mismo elemento), nunca con la selección previa.
  const openHitRef = useRef<{ element: PlanoElement | null; sel: PlanoElement | null } | null>(
    null,
  );

  // Cuando cambia el id del elemento del menú (nuevo clic derecho), se re-ancla el hit y la
  // selección vigente en ese instante.
  useEffect(() => {
    if (openHitRef.current?.element?.id !== state?.element?.id) {
      openHitRef.current = { element: state?.element ?? null, sel: props.selElement };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.element]);

  // Cuando associate (BajanteAsociacion), associateOrigin, o cualquier toggle in-place del menú
  // (bloquear movimiento, invertir dirección de flujo, etc.) actualizan selElement, el menú
  // contextual usa su propia copia del elemento (contextMenuState.element). Sincronizarla para
  // que checkboxes/botones reflejen siempre el valor más reciente. Antes el arreglo de
  // dependencias solo miraba el `id` de cada lado — un toggle que cambia un campo (ej.
  // `bloqueado`) sin cambiar el id nunca volvía a disparar este efecto, así que
  // contextMenuState.element se quedaba con el valor viejo y el checkbox no se actualizaba en
  // vivo aunque el motor y `selElement` sí lo hicieran. Ahora se compara la referencia completa
  // de `selElement`, no solo su id — y se exige que `selElement` sea posterior a la apertura
  // del menú (ver openHitRef arriba).
  useEffect(() => {
    const selId = (props.selElement as { id?: string } | null)?.id;
    const ctxId = state?.element?.id;
    if (
      selId &&
      ctxId &&
      selId === ctxId &&
      props.selElement !== state?.element &&
      props.selElement !== openHitRef.current?.sel
    ) {
      props.setContextMenuState((prev) =>
        prev ? { ...prev, element: props.selElement as never } : null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selElement, state?.element]);

  if (!state || !state.visible) return null;

  const ctxValue = {
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
  const { contextMenuState, setContextMenuState } = ctx;
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
  }, [contextMenuState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenuState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setContextMenuState]);

  const element = contextMenuState.element as ProbedElement;
  const isBajanteTipo =
    element.tipo === 'bajante' || element.tipo === 'montante' || element.id?.startsWith('B');
  const isArea = element.id?.startsWith('AR');
  // Las líneas guía también llevan `pts` (reutilizado para la detección de clics) pero nunca
  // deben caer en RamalMenu, que asume que existe todo campo exclusivo de PlanoRamal
  // (accesorios por red, diámetro, etc.).
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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
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
