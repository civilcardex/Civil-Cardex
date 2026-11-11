/**
 * Barra de herramientas del visor de planos: herramientas por red (bajante, montante, canal, cotas, texto), atajos de teclado y estado de guardado.
 * La regla de qué herramienta aplica a qué red vive en toolbarNetTools.ts (isToolDisabledForNet) para que las dos rutas de render y los atajos no diverjan;
 * el markup de las dos rutas (colapsada/expandida) vive en toolbarButtons.tsx — extraído verbatim.
 * Ej: en gas el botón de bajante sale deshabilitado — solo san (Sanitaria), vent (Ventilación) y ll (Lluvias) lo usan.
 */
import { memo } from 'react';
import { buildNetTools } from './toolbarNetTools.ts';
import { ToolbarCollapsed, ToolbarExpanded } from './toolbarButtons.tsx';

// API pública conservada: ViewerStage importa STATUS; el motor (handleKeyDown.ts, creations/*)
// DUPLICA a propósito la regla isToolDisabledForNet y la cita en comentarios.
export { isToolDisabledForNet } from './toolbarNetTools.ts';
export { STATUS } from './toolbarButtons.tsx';
export type { ToolDef } from './toolbarNetTools.ts';

type NavFn = () => void;
type SelToolFn = (toolId: string) => void;
export type PdfViewerToolbarProps = {
  tool: string;
  tipoTramo: string;
  onTipoTramoSelect: (t: 'ramal' | 'tributario') => void;
  snapOn: boolean;
  gridOn: boolean;
  activeNet: string;
  currentFile: File | null;
  saveStatus: string;
  collapsed?: boolean;
  recolectoraActive: boolean;
  onSelectTool: SelToolFn;
  onSnapToggle: NavFn;
  onGridToggle: NavFn;
  onFit: NavFn;
  onSave: NavFn;
  onUndo: NavFn;
  onRedo: NavFn;
  onClear: NavFn;
  onClearGuides: NavFn;
  /** Motivo del último fallo de guardado a BD (evento civilflow_bd_save_error). */
  bdError?: string | null;
};

function PdfViewerToolbar_({
  tool,
  tipoTramo,
  onTipoTramoSelect,
  snapOn,
  gridOn,
  activeNet,
  currentFile,
  saveStatus,
  collapsed,
  recolectoraActive,
  onSelectTool,
  onSnapToggle,
  onGridToggle,
  onFit,
  onSave,
  onUndo,
  onRedo,
  onClear,
  onClearGuides,
  bdError,
}: PdfViewerToolbarProps) {
  // El RPC de guardado falla con 'suscripcion_requerida' cuando la suscripción venció: bdError
  // ya viaja como "reason: message", así que basta detectar el marcador en la cadena completa
  // (cubre el reason O el message).
  const esSuscripcionVencida = !!bdError && bdError.includes('suscripcion_requerida');
  const visibleTools = buildNetTools(activeNet, recolectoraActive);

  // Ramal principal / Tributario comparten la herramienta 'line' — el par tool+tipoTramo
  // decide el resaltado y el click fija ambos (mismo flujo que el viejo selector del panel
  // derecho, ahora solo en el panel izquierdo).
  const isToolActive = (id: string): boolean => {
    if (id === 'line-ramal') return tool === 'line' && tipoTramo === 'ramal';
    if (id === 'line-trib') return tool === 'line' && tipoTramo === 'tributario';
    return tool === id;
  };
  const onToolClick = (id: string): void => {
    if (id === 'line-ramal') {
      onTipoTramoSelect('ramal');
      onSelectTool('line');
      return;
    }
    if (id === 'line-trib') {
      onTipoTramoSelect('tributario');
      onSelectTool('line');
      return;
    }
    onSelectTool(id);
  };

  const routeProps = {
    visibleTools,
    isToolActive,
    onToolClick,
    snapOn,
    gridOn,
    onSnapToggle,
    onGridToggle,
    onFit,
    onSave,
    onUndo,
    onRedo,
    onClear,
    onClearGuides,
    currentFile,
    saveStatus,
    esSuscripcionVencida,
    bdError,
  };

  if (collapsed) return <ToolbarCollapsed {...routeProps} />;
  return <ToolbarExpanded {...routeProps} />;
}

const PdfViewerToolbar = memo(PdfViewerToolbar_);
export default PdfViewerToolbar;
