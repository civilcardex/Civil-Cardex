import { createContext, useContext } from 'react';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../../lib/shared/projectTypes';
import type { PlanItem } from '../../../context/PlansContext';

// Sonda estructural de la unión PlanoElement: permite inspeccionar `tipo`/`pts` (presentes en
// algunos tipos de elemento, ausentes en otros) sin estrechar el tipo con los type guards exportados
// en cada punto de acceso.
export type ProbedElement = PlanoElement & {
  tipo?: string;
  pts?: number[][];
  labelAngle?: number;
  textAngle?: number;
  totalL?: number;
  net?: string;
};

export interface TramoEditorContextValue {
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  activeNet: string;
  handleUpdateSel: (field: string, value: unknown) => void;
  handleRotateLabel: () => void;
  diamSel: Record<string, string>;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  gasMatSel: Record<string, string>;
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  pendSel: Record<string, number>;
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  pendInput: string;
  setPendInput: React.Dispatch<React.SetStateAction<string>>;
  mats: Record<string, Array<{ val: string }>> | null;
  matLongName: (short: string) => string;
  plans?: PlanItem[];
  pisos?: Piso[];
}

export const TramoEditorCtx = createContext<TramoEditorContextValue | null>(null);

export function useTramoEditorContext(): TramoEditorContextValue {
  const ctx = useContext(TramoEditorCtx);
  if (!ctx) throw new Error('useTramoEditorContext must be used within TramoEditor provider');
  return ctx;
}

// Una tubería principal sanitaria solo necesita el mínimo de 3" cuando realmente lleva un codo
// reventilado (en un extremo o en medio) — no cualquier ramal de la red principal.
export function ramalHasCodoReventilado(r: PlanoRamal | null): boolean {
  if (!r) return false;
  if (r.accesorioInicio === 'codoReventilado' || r.accesorioFin === 'codoReventilado') return true;
  return Object.values(r.accMed || {}).includes('codoReventilado');
}

export const SELECT_STYLE: React.CSSProperties = {
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
export const INPUT_CENTER_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  textAlign: 'center',
};
export const CHECK_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '4px 8px',
  maxHeight: 120,
  overflowY: 'auto',
  padding: '4px',
  background: '#1a1c20',
  border: '1px solid #3a494a',
  borderRadius: 3,
};
export const CHECK_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  fontSize: 12,
  color: '#b9caca',
  fontFamily: "'Geist',monospace",
  minWidth: 0,
};
export const READONLY_CENTER_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '3px 5px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  textAlign: 'center',
};
export const SELECT_CENTER_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
  textAlign: 'center',
};
export const MAT_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  padding: '3px 8px',
  background: '#1a1c20',
  border: '1px solid #282a2e',
  borderRadius: 3,
};
export const MAT_NAME_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#b9caca',
  fontFamily: "'Geist',monospace",
  fontWeight: 600,
  textAlign: 'right',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
export const INPUT_50_STYLE: React.CSSProperties = {
  width: '50%',
  padding: '3px 5px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
};
export const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '3px 5px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  minWidth: 0,
};
export const READONLY_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '3px 5px',
  background: '#1a1c1f',
  border: '1px solid #2a3435',
  borderRadius: 3,
  color: '#b9caca',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
};
export const ROTATE_LABEL_BTN_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px',
  background: 'rgba(168,85,247,.1)',
  border: '1px solid rgba(168,85,247,.35)',
  borderRadius: 3,
  color: '#C084FC',
  cursor: 'pointer',
  fontFamily: "'Geist',monospace",
  fontSize: 12,
  fontWeight: 700,
};
