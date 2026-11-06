/** Menú contextual del GABINETE GABn rci (ped. usuario): mínimo, SOLO la sección
 *  "Ramales asociados" — la gestión de la asociación desde el gabinete. Sin edición de
 *  código, sin aparatos, sin borrado. Ej: clic derecho sobre GAB1 → Ramales asociados. */
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState.ts';
import { useDrawingElementContextMenu } from './context.ts';
import { RamalesAsociadosGabSection } from './associatedChannels';

/** Cuerpo del menú del gabinete activo: delega en su única sección permitida,
 *  "Ramales asociados" (detalle en la cabecera del módulo). */
export function GabineteMenu() {
  const ctx = useDrawingElementContextMenu();
  const { element } = ctx;
  const gab = element as PlanoBajante;
  return <RamalesAsociadosGabSection ctx={ctx} gabinete={{ id: gab.id, net: gab.net }} />;
}
