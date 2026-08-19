import { createContext, useContext } from 'react';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoBajante, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../../lib/shared/projectTypes';
import type { PlanItem } from '../../../context/PlansContext';
import type { MaterialItem } from '../../../context/ProjectContext';
import type { UcMoveModalState } from '../UcMoveModal';

// Sonda estructural de la unión PlanoElement: permite al código inspeccionar `tipo`/`pts`
// (presentes en algunos tipos de elemento y ausentes en otros) igual que hace el dispatch
// en tiempo de ejecución del engine, sin tener que estrechar el tipo con los guards
// exportados en cada punto de acceso.
export type ProbedElement = PlanoElement & { tipo?: string; pts?: number[][] };

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  element: PlanoElement;
  isGhostClick?: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  midRamalHit?: { segmentIdx: number; x: number; y: number } | null;
}

export interface LowerFloorRamales {
  planId: string | number;
  planName: string;
  npt: number | string;
  bajantes: PlanoBajante[];
  isCurrent: boolean;
}

export interface DrawingElementContextMenuContextValue {
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
  /** Abre el modal "Cambio de dirección de flujo" y CIERRA el menú contextual (el modal vive
   *  portaleado a body, fuera del menú — el plano queda visible y el modal movible). */
  openUcMove: (state: UcMoveModalState) => void;
  /** Doble inversión de dirección con posible traslado de UC — vive en el raíz porque el modal
   *  puede confirmarse con el menú ya cerrado. */
  doInvert: (ramal: PlanoRamal, targetId: string | null) => void;
  /** Lee las UC asignadas de un ramal (para decidir si el modal de reasignación es necesario). */
  readUcInfo: (ramal: PlanoRamal) => { planId: string | number | null; total: number };
}

const DrawingElementContextMenuCtx = createContext<DrawingElementContextMenuContextValue | null>(
  null,
);

export function useDrawingElementContextMenu(): DrawingElementContextMenuContextValue {
  const ctx = useContext(DrawingElementContextMenuCtx);
  if (!ctx)
    throw new Error(
      'useDrawingElementContextMenu must be used within DrawingElementContextMenuProvider',
    );
  return ctx;
}

export { DrawingElementContextMenuCtx };

export const MENU_SELECT_STYLE: React.CSSProperties = {
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
export const MENU_DIR_BTN_STYLE: React.CSSProperties = {
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
export const MENU_FANTASMA_BTN_STYLE: React.CSSProperties = {
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
export const MENU_GRID_2COL_STYLE: React.CSSProperties = {
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
export const MENU_CHECK_LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  fontSize: 11,
  color: '#b9caca',
  fontFamily: "'Geist',monospace",
};
export const MENU_GRID_2COL_TALL_STYLE: React.CSSProperties = {
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
export const MENU_ACTION_BTN_STYLE: React.CSSProperties = {
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
export const MENU_CHECK_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  fontSize: 12,
  color: '#b9caca',
  fontFamily: "'Geist',monospace",
  minWidth: 0,
};
export const MENU_PANEL_STYLE: React.CSSProperties = {
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

export const MENU_SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#849495',
  padding: '4px 8px',
  fontFamily: "'Geist',monospace",
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

export const MENU_SECTION_LABEL_ROW_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#849495',
  fontFamily: "'Geist',monospace",
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
