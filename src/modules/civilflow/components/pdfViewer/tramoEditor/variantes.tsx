import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoEstado.ts';
import { useTramoEditorContext } from './contexto.ts';
import { ContadorEditor, CalentadorEditor } from './antiguoEditores.tsx';

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

export function CalentadorTramoEditor() {
  const { selElement, handleUpdateSel } = useTramoEditorContext();
  return (
    <CalentadorEditor selElement={selElement as PlanoBajante} handleUpdateSel={handleUpdateSel} />
  );
}

// Patrón de texto libre con commit al perder el foco (buffer local de edición) — igual que CanalDimField
// en LluviaCanalesVerifica.tsx y CanalDimInput en DrawingElementContextMenu, porque un input
// controlado por tecla pelea contra el tipeo decimal ('.' final, números parciales).

// Re-exports: index.tsx consume los editores desde este hub (contrato previo al split).
export { CanalTramoEditor } from './canalEditores.tsx';
export {
  BajanteHeaderFields,
  RejillasSectorFields,
  AreaHeaderFields,
  TextHeaderFields,
  RamalHeaderFields,
} from './encabezadoCampos.tsx';
export { BajanteEditorSection, RamalEditorSection } from './editorSecciones.tsx';
