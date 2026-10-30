import type {
  CSSProperties,
  Dispatch,
  MutableRefObject,
  ReactNode,
  RefObject,
  SetStateAction,
} from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { ElementItem } from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement, PlanoNet } from '../../lib/PlanoEngine/PlanoState.ts';
import type { Piso } from '../../lib/shared/projectTypes.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';
import type { MaterialItem } from '../../context/ProjectContext.tsx';
import type {
  ContextMenuState,
  LowerFloorRamales,
  ProbedElement,
} from './drawingElementContextMenu/context.ts';
import type { ConfirmState, AccesorioModalState } from './useViewerDialogs.ts';
import PdfViewerToolbar, { STATUS } from './PdfViewerToolbar.tsx';
import PdfViewerNetworkBar from './PdfViewerNetworkBar.tsx';
import PdfCanvas from './PdfCanvas.tsx';
import ViewerMobileChrome from './ViewerMobileChrome.tsx';
import TextInputOverlay from './TextInputOverlay.tsx';
import DrawingElementContextMenu from './drawingElementContextMenu';
import ConfirmDialog from './ConfirmDialog.tsx';
import AccesorioModal from './FittingModal.tsx';
import PdfViewerRightSidebar from './PdfViewerRightSidebar.tsx';
import { SR_ONLY_STYLE } from '../../../../components/shared/sharedStyles.ts';

/**
 * El escenario del visor: barra de redes, control de grosor, sidebars, canvas del PDF, diálogos
 * y botones de colapso — el DOM exacto que vivía en el return de PdfViewer, ahora recibiendo
 * todo por props. Solo presentación: los handlers se definen en el orquestador.
 *
 * Ejemplo: el clic en "◀" del borde derecho llama a setRightCollapsed(true) del orquestador,
 * que recomputa dynamicRightStyle y la sidebar se pliega igual que siempre.
 */
export interface ViewerStageProps {
  // ── Barra de redes ──
  finalVisibleNets: PlanoNet[];
  activeNet: string;
  hiddenNets: Set<string>;
  lockedNets: Set<string>;
  handleSelectNet: (id: string) => void;
  handleToggleHidden: (id: string) => void;
  handleToggleLocked: (id: string) => void;
  scaleText: ReactNode;
  /** Cierre del visor (prefetch + validación + guardado) — vive en el orquestador. */
  onCloseNetworkBar: () => void;
  // ── Grosor de líneas ──
  lineWidthScale: number;
  setLineWidthScale: Dispatch<SetStateAction<number>>;
  // ── Layout / responsive ──
  isMobile: boolean;
  isNarrow: boolean;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  setLeftCollapsed: Dispatch<SetStateAction<boolean>>;
  setRightCollapsed: Dispatch<SetStateAction<boolean>>;
  dynamicLeftStyle: CSSProperties;
  dynamicRightStyle: CSSProperties;
  // ── Guardado ──
  saveStatus: string;
  bdError: string | null;
  // ── Toolbar ──
  tool: string;
  tipoTramo: string;
  setTipoTramo: Dispatch<SetStateAction<string>>;
  snapOn: boolean;
  gridOn: boolean;
  setTool: Dispatch<SetStateAction<string>>;
  currentFile: File;
  recolectoraActive: boolean;
  handleSnapToggle: () => void;
  handleGridToggle: () => void;
  handleFit: () => void;
  handleSave: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleClear: () => void;
  handleClearGuides: () => void;
  // ── Canvas / motor ──
  engineRef: MutableRefObject<PlanoEngine | null>;
  cwRef: RefObject<HTMLDivElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  pdfCanvasRef: RefObject<HTMLCanvasElement | null>;
  drawCanvasRef: RefObject<HTMLCanvasElement | null>;
  error: string | null;
  loading: boolean;
  cambioPiso: boolean;
  selectedNivel: number | null;
  pisos: Piso[];
  planos: PlanItem[];
  // ── Overlays y diálogos ──
  textOverlay: { x: number; y: number; value: string; cb: (text: string) => void } | null;
  setTextOverlay: Dispatch<
    SetStateAction<{ x: number; y: number; value: string; cb: (text: string) => void } | null>
  >;
  textInputRef: RefObject<HTMLInputElement | null>;
  contextMenuState: ContextMenuState | null;
  setContextMenuState: Dispatch<SetStateAction<ContextMenuState | null>>;
  selElement: ProbedElement | null;
  setSelElement: Dispatch<SetStateAction<ProbedElement | null>>;
  lowerFloorsRamales: LowerFloorRamales[];
  upperFloorGroup: LowerFloorRamales | null;
  planosCtx: { plans: PlanItem[] };
  mats: Record<string, MaterialItem[]>;
  setDiamSel: Dispatch<SetStateAction<Record<string, string>>>;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => void;
  confirmState: ConfirmState;
  setConfirmState: Dispatch<SetStateAction<ConfirmState>>;
  accesorioModal: AccesorioModalState;
  setAccesorioModal: Dispatch<SetStateAction<AccesorioModalState>>;
  onAccesorioSelected: (ramalId: string, point: number[], _net: string, accId: string) => void;
  // ── Sidebar derecha ──
  rightSidebarOpacity: CSSProperties;
  rejillasActive: boolean;
  esCotaSel: boolean;
  esAreaRejillas: boolean;
  currentId: number;
  currentIdRef: RefObject<string | number | undefined>;
  setSelectedNivel: Dispatch<SetStateAction<number | null>>;
  onSelectPlan: (idx: number) => void;
  planoAsocInfo: ReactNode;
  diamSel: Record<string, string>;
  gasMatSel: Record<string, string>;
  setGasMatSel: Dispatch<SetStateAction<Record<string, string>>>;
  pendSel: Record<string, number>;
  setPendSel: Dispatch<SetStateAction<Record<string, number>>>;
  pendInput: string;
  setPendInput: Dispatch<SetStateAction<string>>;
  handleUpdateSel: (field: string, value: unknown) => void;
  handleRotateLabel: () => void;
  loadingPlanRef: MutableRefObject<boolean>;
  drawnElements: ElementItem[];
}

const mainContainerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  background: '#111317',
  border: '1px solid #3a494a',
  overflow: 'hidden',
};
const PdfViewer_S4: CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};
const PdfViewer_S5: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 40,
  width: 16,
  height: 24,
  background: '#14161a',
  border: '1px solid #3a494a',
  color: '#22c55e',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontSize: 12,
} as const;
// Barra izquierda colapsada conserva una franja estrecha de iconos (herramientas + snap +
// acciones) en vez de desaparecer a 0 — coherente con el render colapsado de la propia
// toolbar en PdfViewerToolbar.tsx. La usa también el orquestador (ancho de dynamicLeftStyle).
export const LEFT_COLLAPSED_WIDTH = 44;

export function ViewerStage(props: ViewerStageProps) {
  const {
    finalVisibleNets,
    activeNet,
    hiddenNets,
    lockedNets,
    handleSelectNet,
    handleToggleHidden,
    handleToggleLocked,
    scaleText,
    onCloseNetworkBar,
    lineWidthScale,
    setLineWidthScale,
    isMobile,
    isNarrow,
    leftCollapsed,
    rightCollapsed,
    setLeftCollapsed,
    setRightCollapsed,
    dynamicLeftStyle,
    dynamicRightStyle,
    saveStatus,
    bdError,
    tool,
    tipoTramo,
    setTipoTramo,
    snapOn,
    gridOn,
    setTool,
    currentFile,
    recolectoraActive,
    handleSnapToggle,
    handleGridToggle,
    handleFit,
    handleSave,
    handleUndo,
    handleRedo,
    handleClear,
    handleClearGuides,
    engineRef,
    cwRef,
    containerRef,
    pdfCanvasRef,
    drawCanvasRef,
    error,
    loading,
    cambioPiso,
    selectedNivel,
    pisos,
    planos,
    textOverlay,
    setTextOverlay,
    textInputRef,
    contextMenuState,
    setContextMenuState,
    selElement,
    setSelElement,
    lowerFloorsRamales,
    upperFloorGroup,
    planosCtx,
    mats,
    setDiamSel,
    triggerConfirm,
    confirmState,
    setConfirmState,
    accesorioModal,
    setAccesorioModal,
    onAccesorioSelected,
    rightSidebarOpacity,
    rejillasActive,
    esCotaSel,
    esAreaRejillas,
    currentId,
    currentIdRef,
    setSelectedNivel,
    onSelectPlan,
    planoAsocInfo,
    diamSel,
    gasMatSel,
    setGasMatSel,
    pendSel,
    setPendSel,
    pendInput,
    setPendInput,
    handleUpdateSel,
    handleRotateLabel,
    loadingPlanRef,
    drawnElements,
  } = props;

  return (
    <div style={mainContainerStyle}>
      <PdfViewerNetworkBar
        nets={finalVisibleNets}
        activeNet={activeNet}
        hiddenNets={hiddenNets}
        lockedNets={lockedNets}
        onSelectNet={handleSelectNet}
        onToggleHidden={handleToggleHidden}
        onToggleLocked={handleToggleLocked}
        scaleText={scaleText}
        onClose={onCloseNetworkBar}
      />

      {/* Grosor de líneas: deslizador que define el grosor de TODAS las líneas y elementos de la
          zona de dibujo (orig. usuario). Persistido por plano vía serializeWork → cf_planos. */}
      <div
        style={{
          height: 30,
          flexShrink: 0,
          background: '#14161a',
          borderBottom: '1px solid #2a3435',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
        }}
      >
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: '#6b8cae',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Grosor:
        </div>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={lineWidthScale}
          aria-label="Grosor de líneas"
          // Commit-on-release: cada evento `input` disparaba la cascada completa de
          // _markDirty (recálculo de red + snapshot de undo + autosave) ×25 por arrastre,
          // y llenaba el historial de undo de pasos de 0.1× de grosor. El arrastre solo
          // redibuza; UN dirty al soltar consolida guardado + undo.
          onChange={(e) => {
            const v = Number(e.target.value);
            setLineWidthScale(v);
            const eng = engineRef.current;
            if (eng) {
              eng.lineWidthScale = v;
              eng.scheduleRender();
            }
          }}
          onPointerUp={() => {
            const eng = engineRef.current;
            if (eng) eng._markDirty();
          }}
          // Teclado: flechas/Home/End sobre el range disparan onChange pero NUNCA
          // pointerup — sin esto el ajuste vía teclado se pierde al recargar.
          onKeyUp={() => {
            const eng = engineRef.current;
            if (eng) eng._markDirty();
          }}
          style={{ width: 140, accentColor: '#F5A623' }}
        />
        <div
          style={{
            padding: '2px 8px',
            background: '#1e2024',
            border: '1px solid #2a3435',
            color: '#8AB4D6',
            fontSize: 12,
            fontFamily: "'Geist',monospace",
          }}
        >
          {lineWidthScale.toFixed(1)}×
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', minWidth: 0 }}>
        <div className="visor-sidebar" data-tour="toolbar" style={dynamicLeftStyle}>
          <h2 style={SR_ONLY_STYLE}>Panel de capas</h2>
          <div
            style={{
              height: 3,
              flexShrink: 0,
              transition: 'background .3s',
              background: bdError ? '#ef4444' : STATUS[saveStatus]?.color || STATUS.error.color,
            }}
          />
          {!isMobile && (
            <PdfViewerToolbar
              tool={tool}
              tipoTramo={tipoTramo}
              onTipoTramoSelect={(t) => setTipoTramo(t)}
              snapOn={snapOn}
              gridOn={gridOn}
              activeNet={activeNet}
              currentFile={currentFile}
              saveStatus={saveStatus}
              bdError={bdError}
              collapsed={leftCollapsed}
              recolectoraActive={recolectoraActive}
              onSelectTool={setTool}
              onSnapToggle={handleSnapToggle}
              onGridToggle={handleGridToggle}
              onFit={handleFit}
              onSave={handleSave}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClear}
              onClearGuides={handleClearGuides}
            />
          )}
        </div>

        <div
          data-tour="canvas"
          style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}
        >
          <h2 style={SR_ONLY_STYLE}>Visor de planos</h2>
          <ViewerMobileChrome
            isMobile={isMobile}
            isNarrow={isNarrow}
            currentFile={currentFile ?? null}
            onFit={handleFit}
            onZoomStep={(f) => engineRef.current?.zoomStep(f)}
          />

          <PdfCanvas
            cwRef={cwRef}
            containerRef={containerRef}
            pdfCanvasRef={pdfCanvasRef}
            drawCanvasRef={drawCanvasRef}
            currentFile={currentFile}
            error={error}
            loading={loading}
            cambioPiso={cambioPiso}
            selectedNivel={selectedNivel}
            pisos={pisos}
            planos={planos}
            tool={tool}
            snapOn={snapOn}
          />
        </div>

        {/* Diálogos */}
        <TextInputOverlay
          textOverlay={textOverlay}
          setTextOverlay={setTextOverlay}
          textInputRef={textInputRef}
        />
        <DrawingElementContextMenu
          contextMenuState={contextMenuState}
          setContextMenuState={setContextMenuState}
          selectedNivel={selectedNivel}
          pisos={pisos}
          engineRef={engineRef}
          selElement={selElement as PlanoElement | null}
          setSelElement={setSelElement}
          lowerFloorsRamales={lowerFloorsRamales}
          upperFloorGroup={upperFloorGroup}
          planosCtx={planosCtx}
          mats={mats}
          activeNet={activeNet}
          setDiamSel={setDiamSel}
          triggerConfirm={triggerConfirm}
        />
        <ConfirmDialog confirmState={confirmState} setConfirmState={setConfirmState} />
        <AccesorioModal
          modalState={accesorioModal}
          onClose={() => setAccesorioModal((prev) => ({ ...prev, isOpen: false }))}
          onSelect={onAccesorioSelected}
        />

        {/* Barra lateral derecha (componente: pdfViewer/PdfViewerRightSidebar) */}
        <PdfViewerRightSidebar
          style={dynamicRightStyle}
          srOnlyStyle={SR_ONLY_STYLE}
          selectStyle={PdfViewer_S4}
          rightSidebarOpacity={rightSidebarOpacity}
          tool={tool}
          selElement={selElement}
          setSelElement={setSelElement}
          activeNet={activeNet}
          rejillasActive={rejillasActive}
          esCotaSel={esCotaSel}
          esAreaRejillas={esAreaRejillas}
          engineRef={engineRef}
          currentId={currentId}
          currentIdRef={currentIdRef}
          planosCtx={planosCtx}
          pisos={pisos}
          planos={planos}
          selectedNivel={selectedNivel}
          setSelectedNivel={setSelectedNivel}
          onSelectPlan={onSelectPlan}
          planoAsocInfo={planoAsocInfo}
          finalVisibleNets={finalVisibleNets}
          diamSel={diamSel}
          setDiamSel={setDiamSel}
          gasMatSel={gasMatSel}
          setGasMatSel={setGasMatSel}
          pendSel={pendSel}
          setPendSel={setPendSel}
          pendInput={pendInput}
          setPendInput={setPendInput}
          mats={mats}
          handleUpdateSel={handleUpdateSel}
          handleRotateLabel={handleRotateLabel}
          lowerFloorsRamales={lowerFloorsRamales}
          upperFloorGroup={upperFloorGroup}
          setConfirmState={setConfirmState}
          loadingPlanRef={loadingPlanRef}
          drawnElements={drawnElements}
        />

        <button
          type="button"
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          style={{
            ...PdfViewer_S5,
            left: leftCollapsed ? LEFT_COLLAPSED_WIDTH : 180,
            borderLeft: '1px solid #3a494a',
            borderRadius: 3,
            transition: 'left 0.2s ease',
          }}
          title={leftCollapsed ? 'Expandir barra izquierda' : 'Colapsar barra izquierda'}
          aria-label={leftCollapsed ? 'Expandir barra izquierda' : 'Colapsar barra izquierda'}
        >
          {leftCollapsed ? '▶' : '◀'}
        </button>

        <button
          type="button"
          onClick={() => setRightCollapsed(!rightCollapsed)}
          style={{
            ...PdfViewer_S5,
            right: rightCollapsed ? 0 : 210,
            borderRight: rightCollapsed ? '1px solid #3a494a' : 'none',
            borderRadius: 3,
            transition: 'right 0.2s ease',
          }}
          title={rightCollapsed ? 'Expandir barra derecha' : 'Colapsar barra derecha'}
          aria-label={rightCollapsed ? 'Expandir barra derecha' : 'Colapsar barra derecha'}
        >
          {rightCollapsed ? '◀' : '▶'}
        </button>
      </div>
    </div>
  );
}
