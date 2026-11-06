// Contexto del editor de tramos (panel derecho del visor): motor+selección+estilos
// compartidos por todos los editores de elemento (bajante, ramal, area, texto…).
import { createContext, useContext } from 'react';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement, PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import type { Piso } from '../../../lib/shared/projectTypes.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';

/**
 * Sonda estructural de la unión PlanoElement: permite inspeccionar `tipo`/`pts` (presentes en
 * algunos tipos de elemento, ausentes en otros) sin estrechar el tipo con los type guards
 * exportados en cada punto de acceso.
 */
export type ProbedElement = PlanoElement & {
  tipo?: string;
  pts?: number[][];
  labelAngle?: number;
  textAngle?: number;
  totalL?: number;
  net?: string;
};

/** Lo que el editor de tramos (panel derecho del visor) necesita: motor, selección, pisos/
 *  plans para sus selects de nivel, los 3 maps de elección (diámetro, material gas, pendiente)
 *  y el updater de campo del elemento seleccionado. */
export interface TramoEditorContextValue {
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  selElement: PlanoElement | null;
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  activeNet: string;
  /** Subred Rejillas de ventilación activa (áreas de sector NTC (Norma Tecnica Colombiana) 3631). */
  rejillasActive?: boolean;
  /** Escribe un campo en el elemento seleccionado y marca el dibujo sucio (guardar). */
  handleUpdateSel: (field: string, value: unknown) => void;
  /** Gira la etiqueta del tramo seleccionado (flecha apunta al otro segmento). */
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
  /** Confirm modal del visor (misma ventana que el menú contextual) — el panel de asociación
   *  de bomba lo usa para el aviso de desalineación. Opcional: los tests no lo montan. */
  triggerConfirm?: (title: string, message: string, onOk: () => void, okLabel?: string) => void;
}

/** Contexto React del editor de tramos (null fuera del provider). */
export const TramoEditorCtx = createContext<TramoEditorContextValue | null>(null);

/** Hook de acceso al contexto del editor de tramos; lanza si el componente vive fuera del provider (error de ensamblaje). */
export function useTramoEditorContext(): TramoEditorContextValue {
  const ctx = useContext(TramoEditorCtx);
  if (!ctx) throw new Error('useTramoEditorContext must be used within TramoEditor provider');
  return ctx;
}

/** ¿El ramal san tiene un codo reventilado (en un extremo o a mitad)? Decide si la tubería
 *  principal exige su mínimo de 3" y si el editor muestra el aviso de la unión vent↔san. */
export function ramalHasCodoReventilado(r: PlanoRamal | null): boolean {
  if (!r) return false;
  if (r.accesorioInicio === 'codoReventilado' || r.accesorioFin === 'codoReventilado') return true;
  return Object.values(r.accMed || {}).includes('codoReventilado');
}

// ── Estilos compartidos de los editores (inputs centrados, select, grid de checkboxes,
// filas de material) — un solo look en todo el panel derecho.

/** Select desplegable del editor de tramos: diámetro, material o nivel de piso. Ej: elegir 3" en el Ø del bajante. */
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
/** Input centrado del editor (números y textos cortos). Ej: el largo de un canal se escribe aquí y el valor queda al centro. */
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
/** Contenedor de casillas en 2 columnas con scroll (tope 120 px de alto) para listas largas. Ej: los aparatos marcados en el ramal. */
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
/** Fila de casilla dentro del grid (checkbox + etiqueta a 12 px). Ej: 'Lavamanos' en la lista de aparatos del bajante. */
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
/** Campo de solo lectura centrado: muestra valores que vienen del dibujo y no se pueden editar. Ej: la longitud del tramo seleccionado. */
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
/** Select centrado: mismo desplegable pero con el valor al centro, para las filas de material/Ø del ramal. Ej: el material del ramal de gas. */
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
/** Fila del material en el editor del ramal: reparte nombre y control a los extremos. Ej: 'Ferro cemento 3"' con su Ø al lado. */
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
/** El nombre del material dentro de MAT_ROW_STYLE: a 12 px y corta con «…» si no cabe. */
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
/** Input a media anchura (50 %) para compartir fila con otro campo. Ej: el código del elemento junto a su nivel. */
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
/** Input genérico de ancho completo del editor. Ej: la etiqueta (label) del tramo o su texto libre. */
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
/** Campo de solo lectura con fondo más apagado (texto a la izquierda). Ej: el área m² calculada del elemento. */
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
/** Botón violeta que gira la etiqueta del tramo (pareja de handleRotateLabel: la flecha apunta al otro segmento). */
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
