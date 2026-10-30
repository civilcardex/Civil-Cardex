/** Sección del menú contextual para bajantes/montantes: dirección, diámetro+destino, conexiones san/ll, bomba en cajas y ramales asociados del montante. Ej: clic derecho en BAN2 → "Sube/Baja" + diámetro 4". */
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState.ts';
import { useDrawingElementContextMenu } from './context.ts';
import { BajanteConnectionPanel } from './bajanteConnectionPanel.tsx';
import { BajanteDirectionSelector } from './directionSelector.tsx';
import { BajanteDiameterSelector } from './diameterSelector.tsx';
import {
  BotonCrearBomba,
  CajaBombaSection,
  AsociarBombaSection,
  cajaSinBomba,
} from './pumpSections.tsx';
import {
  CanalesAsociadosBajSection,
  MaterialCubiertaBajSection,
  RamalesAsociadosMontSection,
} from './associatedChannels';

/** Menú contextual del bajante/montante elegido: arma el selector de dirección, el de diámetro
 *  y destino, y el panel de conexiones para redes sanitarias y de lluvias (en cajas agrega
 *  las secciones de bomba). */
export function BajanteMenu() {
  const ctx = useDrawingElementContextMenu();
  const { contextMenuState, element } = ctx;
  const bajEl = element as PlanoBajante;
  const isGhostClick = contextMenuState.isGhostClick || false;
  const isSanOrLl = !isGhostClick && ['san', 'll'].includes(ctx.activeNet);
  const esCajaMenu = bajEl.tipo === 'caja_san' || bajEl.tipo === 'caja_ll';
  const planNivelLl = ctx.planosCtx?.plans.find(
    (p) => String(p.id) === String(ctx.engineRef.current?._loadedPlanId ?? ''),
  )?.nivel;

  return (
    <>
      {/* Botones de acción primero (orig. usuario): crear bomba al tope del menú de caja. */}
      {esCajaMenu && !isGhostClick && cajaSinBomba(ctx, bajEl) && (
        <div style={{ padding: '4px 8px' }}>
          <BotonCrearBomba ctx={ctx} caja={bajEl} />
        </div>
      )}
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
      {bajEl.tipo === 'bajante' && ctx.activeNet === 'll' && (
        <>
          <MaterialCubiertaBajSection ctx={ctx} bajEl={bajEl} planNivel={planNivelLl} />
          <CanalesAsociadosBajSection ctx={ctx} bajEl={bajEl} />
        </>
      )}
      {/* Montante af/ac/gas: la inversa — gestiona sus ramales asociados desde el montante.
          gas incluido: el motor (apply/espejos/herencia) lo trata como red de presión igual que
          af (Agua Fria)/ac (Agua Caliente); el menú quedó atrás. */}
      {bajEl.tipo === 'montante' &&
        (ctx.activeNet === 'af' || ctx.activeNet === 'ac' || ctx.activeNet === 'gas') && (
          <RamalesAsociadosMontSection ctx={ctx} montante={bajEl} />
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
