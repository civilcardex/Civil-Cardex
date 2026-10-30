/** Barra lateral derecha del visor: selector de nivel, copia entre pisos y los paneles de edición (tramo, asociación de bajante/montante, aparatos, elementos dibujados) según lo seleccionado. */
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoElement } from '../../lib/PlanoEngine/PlanoState.ts';
import type { Piso } from '../../lib/shared/projectTypes.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';
import type { MaterialItem } from '../../context/ProjectContext.tsx';
import type { LowerFloorRamales } from './drawingElementContextMenu/context.ts';
import type { ProbedElement } from './drawingElementContextMenu/context.ts';
import type { ConfirmState } from './useViewerDialogs.ts';
import { matLongName, pisoLbl } from '../../constants';
import { CopyFromPlanPanel } from './CopyFromPlanPanel.tsx';
import TramoEditor from './tramoEditor';
import BajanteAsociacion from './BajanteAssociation';
import AparatosPanel from '../FixturesPanel.tsx';
import PdfViewerDrawnElements from './PdfViewerDrawnElements.tsx';

interface PdfViewerRightSidebarProps {
  style: CSSProperties;
  srOnlyStyle: CSSProperties;
  selectStyle: CSSProperties;
  rightSidebarOpacity: CSSProperties;
  tool: string;
  selElement: ProbedElement | null;
  setSelElement: Dispatch<SetStateAction<ProbedElement | null>>;
  activeNet: string;
  rejillasActive: boolean;
  esCotaSel: boolean;
  esAreaRejillas: boolean;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  currentId: number | undefined;
  currentIdRef: React.RefObject<string | number | undefined>;
  planosCtx: { plans: PlanItem[] };
  pisos: Piso[];
  planos: PlanItem[];
  selectedNivel: number | null;
  setSelectedNivel: Dispatch<SetStateAction<number | null>>;
  onSelectPlan?: (idx: number) => void;
  planoAsocInfo: React.ReactNode;
  finalVisibleNets: Array<{ id: string; name?: string }>;
  diamSel: Record<string, string>;
  setDiamSel: Dispatch<SetStateAction<Record<string, string>>>;
  gasMatSel: Record<string, string>;
  setGasMatSel: Dispatch<SetStateAction<Record<string, string>>>;
  pendSel: Record<string, number>;
  setPendSel: Dispatch<SetStateAction<Record<string, number>>>;
  pendInput: string;
  setPendInput: Dispatch<SetStateAction<string>>;
  mats: Record<string, MaterialItem[]>;
  handleUpdateSel: (field: string, value: unknown) => void;
  handleRotateLabel: () => void;
  lowerFloorsRamales: LowerFloorRamales[];
  upperFloorGroup: LowerFloorRamales | null;
  setConfirmState: Dispatch<SetStateAction<ConfirmState>>;
  loadingPlanRef: React.MutableRefObject<boolean>;
  drawnElements: Array<{ id?: string }>;
}

/** Barra lateral derecha del visor: selector de nivel (con estado de plano confirmado),
 *  copia entre pisos y los paneles de edición (tramo, asociación de bajante, aparatos,
 *  elementos dibujados). Extraída verbatim de PdfViewer — mismo markup, mismos handlers. */
export function PdfViewerRightSidebar({
  style,
  srOnlyStyle,
  selectStyle,
  rightSidebarOpacity,
  tool,
  selElement,
  setSelElement,
  activeNet,
  rejillasActive,
  esCotaSel,
  esAreaRejillas,
  engineRef,
  currentId,
  currentIdRef,
  planosCtx,
  pisos,
  planos,
  selectedNivel,
  setSelectedNivel,
  onSelectPlan,
  planoAsocInfo,
  finalVisibleNets,
  diamSel,
  setDiamSel,
  gasMatSel,
  setGasMatSel,
  pendSel,
  setPendSel,
  pendInput,
  setPendInput,
  mats,
  handleUpdateSel,
  handleRotateLabel,
  lowerFloorsRamales,
  upperFloorGroup,
  setConfirmState,
  loadingPlanRef,
  drawnElements,
}: PdfViewerRightSidebarProps) {
  return (
    <div className="visor-sidebar-right" style={style}>
      <h2 style={srOnlyStyle}>Panel de edición</h2>
      <div
        data-tour="visor-nivel"
        style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}
      >
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: '#849495',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Nivel
        </div>
        <select
          aria-label="Seleccionar nivel"
          value={selectedNivel ?? ''}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            const idx =
              v !== null ? planos.findIndex((p) => p.nivel === v && p.status === 'confirmed') : -1;
            setSelectedNivel(v);
            if (idx >= 0 && onSelectPlan) onSelectPlan(idx);
          }}
          style={selectStyle}
        >
          <option value="">— Seleccionar piso —</option>
          {pisos
            .toSorted((a, b) => b.n - a.n)
            .map((s) => {
              const tienePlano = planos.some((p) => p.nivel === s.n && p.status === 'confirmed');
              return (
                <option key={s.id} value={s.n}>
                  {tienePlano ? '🟢 ' : ''}
                  {pisoLbl(s.n)} ({s.npt} m)
                </option>
              );
            })}
        </select>
        {planoAsocInfo}
      </div>

      <CopyFromPlanPanel
        engineRef={engineRef}
        currentId={currentId}
        currentIdRef={currentIdRef}
        planosCtx={planosCtx}
        pisos={pisos}
        visibleNets={finalVisibleNets as never}
      />

      {tool !== 'guide' && (
        <div data-tour="visor-edicion" style={rightSidebarOpacity}>
          {!esCotaSel && (
            <TramoEditor
              selElement={selElement as PlanoElement | null}
              activeNet={activeNet}
              rejillasActive={rejillasActive}
              engineRef={engineRef}
              diamSel={diamSel}
              gasMatSel={gasMatSel}
              pendSel={pendSel}
              pendInput={pendInput}
              mats={mats}
              matLongName={matLongName}
              setDiamSel={setDiamSel}
              setGasMatSel={setGasMatSel}
              setPendSel={setPendSel}
              setPendInput={setPendInput}
              setSelElement={setSelElement as never}
              handleUpdateSel={handleUpdateSel}
              handleRotateLabel={handleRotateLabel}
              plans={planosCtx.plans}
              pisos={pisos}
              triggerConfirm={(title, message, onConfirm, confirmLabel) => {
                setConfirmState({
                  isOpen: true,
                  title,
                  message,
                  confirmLabel,
                  onConfirm: () => {
                    onConfirm();
                    setConfirmState((prev) => ({ ...prev, isOpen: false }));
                  },
                });
              }}
            />
          )}

          <BajanteAsociacion
            selElement={selElement}
            setSelElement={setSelElement as never}
            selectedNivel={selectedNivel}
            pisoLbl={pisoLbl}
            lowerFloorsRamales={lowerFloorsRamales}
            upperFloorGroup={upperFloorGroup}
            planosCtx={planosCtx}
            engineRef={engineRef}
            triggerConfirm={(title, message, onConfirm, confirmLabel) => {
              setConfirmState({
                isOpen: true,
                title,
                message,
                confirmLabel,
                onConfirm: () => {
                  onConfirm();
                  setConfirmState((prev) => ({ ...prev, isOpen: false }));
                },
              });
            }}
          />

          {/* MONTANTES SÍ tienen panel de aparatos (orig. usuario): UDs propagadas/asignadas
              como bajantes. Solo áreas y guías lo excluyen — EXCEPCIÓN: área de sector del
              módulo Rejillas de ventilación (rejillas activa + área gas), que cuenta
              gasodomésticos con conteos libres por aparato. */}
          {!(
            (selElement as { id?: string } | null) &&
            (esCotaSel ||
              (selElement as { id?: string } | null)!.id?.startsWith('GL') ||
              ((selElement as { id?: string } | null)!.id?.startsWith('AR') && !esAreaRejillas))
          ) && (
            <AparatosPanel
              activeNet={activeNet}
              selElement={selElement}
              setSelElement={setSelElement as never}
              planId={currentId}
              engineRef={engineRef}
              loadingPlanRef={loadingPlanRef}
              rejillasArea={esAreaRejillas}
            />
          )}

          {!esCotaSel && (
            <PdfViewerDrawnElements
              drawnElements={drawnElements as never}
              activeNet={activeNet}
              selElement={selElement}
              engineRef={engineRef}
            />
          )}

          <div style={{ flex: 1 }} />
        </div>
      )}
    </div>
  );
}
