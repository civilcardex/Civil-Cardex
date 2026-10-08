import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import { useDrawingElementContextMenu } from './context';
import { BajanteConnectionPanel } from './bajanteConnectionPanel';
import { BajanteDirectionSelector } from './directionSelector';
import { BajanteDiameterSelector } from './diameterSelector';
import { CajaBombaSection, AsociarBombaSection } from './bombaSections';

/** Menú contextual de bajante/montante: ensambla dirección, diámetro y secciones de caja/bomba. */
/** Menú contextual de un bajante/montante: compone el selector de dirección, el de diámetro y
 *  destino, y el panel de conexiones para redes sanitarias y de lluvias. */
export function BajanteMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element } = ctx;
  const bajEl = element as PlanoBajante;
  const isGhostClick = contextMenuState.isGhostClick || false;
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(ctx.activeNet);
  const esCajaMenu = bajEl.tipo === 'caja_san' || bajEl.tipo === 'caja_ll';

  return (
    <>
      {esCajaMenu && !isGhostClick && <CajaBombaSection ctx={ctx} caja={bajEl} />}
      {/* CAJA (orig. usuario): menú mínimo — solo bomba (crear/checkbox/info) y ramales
          asociados. Sin dirección ni diámetro (la caja no tiene propiedades hidráulicas). */}
      {!esCajaMenu && (
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
      )}
      {!esCajaMenu && (
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
      )}
      {bajEl.tipo === 'bajante' && ctx.activeNet === 'san' && (
        <AsociarBombaSection ctx={ctx} bajEl={bajEl} />
      )}
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
