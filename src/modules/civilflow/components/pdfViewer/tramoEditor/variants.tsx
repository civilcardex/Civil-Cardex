/** Hub de variantes del TramoEditor: contadores/calentadores en vivo y re-exports de las secciones por tipo (canal, cabeceras, bajante/ramal). Ej: index.tsx consume todo desde aquí (contrato previo al split). */
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState.ts';
import { useTramoEditorContext } from './context.ts';
import { ContadorEditor, CalentadorEditor } from './legacyEditors.tsx';

/** Contador seleccionado en el panel: delega en ContadorEditor con el contexto compartido. */
export function ContadorTramoEditor() {
  const { selElement, activeNet, handleUpdateSel } = useTramoEditorContext();
  return (
    <ContadorEditor
      selElement={selElement as PlanoBajante}
      activeNet={activeNet}
      handleUpdateSel={handleUpdateSel}
    />
  );
}

/** Calentador seleccionado en el panel: delega en CalentadorEditor con el contexto compartido. */
export function CalentadorTramoEditor() {
  const { selElement, handleUpdateSel } = useTramoEditorContext();
  return (
    <CalentadorEditor selElement={selElement as PlanoBajante} handleUpdateSel={handleUpdateSel} />
  );
}

// Patrón de texto libre con commit al perder el foco (buffer local de edición) — igual que CanalDimField
// en RainChannelsCheck.tsx y CanalDimInput en DrawingElementContextMenu, porque un input
// controlado por tecla pelea contra el tipeo decimal ('.' final, números parciales).

// Re-exports: index.tsx consume los editores desde este hub (contrato previo al split).
export { CanalTramoEditor } from './channelEditors.tsx';
export {
  BajanteHeaderFields,
  RejillasSectorFields,
  AreaHeaderFields,
  TextHeaderFields,
  RamalHeaderFields,
} from './headerFields.tsx';
export { BajanteEditorSection, RamalEditorSection } from './editorSections.tsx';
