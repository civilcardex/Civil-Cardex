/**
 * Menú contextual de un ramal: accesorios (codo, tee…), dirección de flujo, asociación a bajante/montante y canales asociados — el mismo estado que escribe el panel de aparatos (camposAsocManual).
 * Ej: marcar "asociar a BAN1" añade el ramal a recibeDeIds del bajante; desmarcar lo limpia.
 */
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState.ts';
import { useDrawingElementContextMenu } from './context.ts';
import {
  CanalesAsociadosRamalSection,
  GabinetesAsociadosSection,
  MontantesAsociadosSection,
} from './associatedChannels';
import { BajanteConnectionPanel } from './bajanteConnectionPanel.tsx';
import { ElementCodeEditor } from './elementEditor.tsx';
import { RciAutoDrawSection } from './RciAutoDrawSection.tsx';
import {
  AddCalentadorSection,
  CreateMontanteSection,
  RamalAccessorySection,
  RamalDirectionSection,
  TributarioConvertSection,
} from './ramalMenuSections.tsx';
import {
  BajantesAsociadosSection,
  CajasAsociadasSection,
  RamalChannelSection,
} from './ramalMenuAssociatedSections.tsx';
import { RamalLabelSection, RamalLockSection } from './ramalMenuTramoSections.tsx';

/** Cuerpo del menú: arma las secciones del ramal (accesorio en medio, dirección, conversiones
 *  a tributario, asociaciones y canales) sobre el estado vivo del menú contextual. Las
 *  secciones viven en ramalMenuSections/ramalMenuAssociatedSections/ramalMenuTramoSections —
 *  aquí solo queda el estado COMPARTIDO entre secciones (isOccupiedTee) y la composición. */
export function RamalMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element, engineRef } = ctx;
  const ramalEl = element as PlanoRamal;

  // Un midRamalHit que cae exactamente sobre un vértice accMed EXISTENTE (PlanoEngineHitTesting.ts
  // los comprueba antes que los impactos de cuerpo de segmento) reporta segmentIdx = accMedIdx - 1
  // — es decir, accMedIdx = segmentIdx + 1, misma convención que usa handleCreateMontanteMidBody.
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
  // allí. COMPARTIDO por dos secciones (montante + calentador) → vive aquí y viaja por props.
  const isOccupiedTee =
    isExistingTee || existingTeeType === 'teeTapon' || existingTeeType === 'teeLlaveTerminal';

  return (
    <>
      <RamalDirectionSection ctx={ctx} ramal={ramalEl} />
      <TributarioConvertSection ctx={ctx} ramal={ramalEl} />
      <CreateMontanteSection ctx={ctx} ramal={ramalEl} isOccupiedTee={isOccupiedTee} />
      {/* Dibujo automático rci (ped. usuario, sección ARRIBA): vive en RciAutoDrawSection
          (extraído del menú); fuera de rci no pinta nada. */}
      <RciAutoDrawSection
        engineRef={engineRef}
        ramal={ramalEl}
        contextMenuState={contextMenuState}
        setContextMenuState={ctx.setContextMenuState}
      />
      <AddCalentadorSection ctx={ctx} ramal={ramalEl} isOccupiedTee={isOccupiedTee} />
      {/* Segmento libre de la tee RETIRADO (orig. usuario 2026-10-29): sin stub de 300mm ni
          selector +Tapón/+Llave. La llave terminal en cuerpo va por el desplegable de accesorios
          (teeLlaveTerminal, glifo autocontenido en el mismo vértice). */}
      {/* Orig. usuario "primero botones": el panel de conexión (acciones) va con los demás
          botones; los desplegables (canal, aparatos/accesorios, etiqueta) quedan al final. */}
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
      <RamalChannelSection ctx={ctx} ramal={ramalEl} />
      {/* Aparatos/accesorios del trazo — también al clic un EXTREMO (orig. usuario): con
          extremo se sintetiza el hit en esa punta para que la preferencia de extremo del
          selector apunte ahí. */}
      <RamalAccessorySection ctx={ctx} ramal={ramalEl} />
      <ElementCodeEditor
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
      <RamalLockSection ctx={ctx} ramal={ramalEl} />
      <RamalLabelSection ctx={ctx} ramal={ramalEl} />
      <BajantesAsociadosSection ctx={ctx} ramal={ramalEl} />
      <CajasAsociadasSection ctx={ctx} ramal={ramalEl} />
      {ctx.activeNet === 'll' && <CanalesAsociadosRamalSection ctx={ctx} ramal={ramalEl} />}
      {/* gas incluido: la herencia entre pisos de montantes lo trata como presión (af/ac/gas). */}
      {(ctx.activeNet === 'af' || ctx.activeNet === 'ac' || ctx.activeNet === 'gas') && (
        <MontantesAsociadosSection ctx={ctx} ramal={ramalEl} />
      )}
      {/* Gabinetes GABn (ped. usuario): la sección de asociados de la red rci. */}
      {ctx.activeNet === 'rci' && <GabinetesAsociadosSection ctx={ctx} ramal={ramalEl} />}
    </>
  );
}
