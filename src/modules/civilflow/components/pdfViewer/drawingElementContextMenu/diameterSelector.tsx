/**
 * BajanteDiameterSelector: fila del menú del bajante con destino/origen entrepisos, diámetro,
 * llenado (R) y área. Fachada que arma las secciones (carpeta diameterSelector/).
 * Ej: elegir Ø100 en BAN1 reescribe el diámetro en el dibujo (writeBajantePropToDrawing) y desplaza la fila de tablas.
 */
import { pisoLbl } from '../../../constants';
import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanoBajante, PlanoElement } from '../../../lib/PlanoEngine/PlanoState.ts';
import type { PlanItem } from '../../../context/PlansContext.tsx';
import { type ContextMenuState, type LowerFloorRamales } from './context.ts';
import { DestinationSection } from './diameterSelector/DestinationSection.tsx';
import { DiameterSelect, GhostDiameterSection } from './diameterSelector/DiameterSection.tsx';
import { OriginSection } from './diameterSelector/OriginSection.tsx';
import { FillAreaSection } from './diameterSelector/FillAreaSection.tsx';

// Opciones de diámetro del elemento (montantes por material de SU red — rci incluido — y
// listas estáticas de bajantes): extraídas a utils/montanteDiameterOptions (techo G1).
// Re-exportadas aquí para que bajanteEditor y el JSX de este menú no cambien.
import { opcionesDiametroElemento } from '../../../utils/montanteDiameterOptions';
export { opcionesDiametroElemento };

/** Selectores del bajante: destino (piso inferior), diámetro con validación contra los ramales
 *  conectados, origen (piso superior), llenado (R) y área servida. */
export function BajanteDiameterSelector({
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
            <DestinationSection
              element={element}
              selectedNivel={selectedNivel}
              engineRef={engineRef}
              selElement={selElement}
              setSelElement={setSelElement}
              setContextMenuState={setContextMenuState}
              lowerFloorsRamales={lowerFloorsRamales}
              planosCtx={planosCtx}
              triggerConfirm={triggerConfirm}
            />
            <DiameterSelect
              element={element}
              selectedNivel={selectedNivel}
              isGhostClick={isGhostClick}
              engineRef={engineRef}
              selElement={selElement}
              setSelElement={setSelElement}
              setContextMenuState={setContextMenuState}
              planosCtx={planosCtx}
              updateGhostField={updateGhostField}
            />
          </div>
          {upperFloorGroup && (
            <OriginSection
              element={element}
              selectedNivel={selectedNivel}
              engineRef={engineRef}
              selElement={selElement}
              setSelElement={setSelElement}
              setContextMenuState={setContextMenuState}
              planosCtx={planosCtx}
              upperFloorGroup={upperFloorGroup}
              triggerConfirm={triggerConfirm}
            />
          )}
          <FillAreaSection
            element={element}
            engineRef={engineRef}
            selElement={selElement}
            setSelElement={setSelElement}
            setContextMenuState={setContextMenuState}
          />
        </>
      ) : (
        <GhostDiameterSection
          element={element}
          selectedNivel={selectedNivel}
          isGhostClick={isGhostClick}
          engineRef={engineRef}
          selElement={selElement}
          setSelElement={setSelElement}
          setContextMenuState={setContextMenuState}
          planosCtx={planosCtx}
          updateGhostField={updateGhostField}
        />
      )}
    </>
  );
}
