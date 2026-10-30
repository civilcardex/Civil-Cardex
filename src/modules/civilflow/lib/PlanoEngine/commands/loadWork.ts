import type { EngineFull } from '../engineFull.ts';
import type { PlanoNetCounts } from '../PlanoState.ts';
import { devError } from '../../../../../utils/devError.ts';
import { applyWorkData } from '../PlanoPersistence.ts';
import {
  autoDetectRamalConnections,
  podarReferenciasStaleDeBajantes,
  ensureRpCntRamal,
} from '../PlanoEngineNetwork.ts';
import { sellarAsociacionesCanalBajante } from '../channelAssociation.ts';

/** Aplica un trabajo guardado (JSON u objeto PlanoWorkData) al motor: reemplaza elementos y estado (npt (nivel de piso topografico), scaleM (escala metros por pixel)) y re-deriva conexiones. El historial se resetea ANTES de la foto para no revivir snapshots del piso anterior. */
export function loadWorkCommand(engine: EngineFull, json: string | object): void {
  try {
    const d = (typeof json === 'string'
      ? JSON.parse(json)
      : json) as unknown as import('../PlanoPersistence.ts').PlanoWorkData;
    applyWorkData(
      engine as unknown as {
        scaleM: number;
        definedScaleM: number;
        activeNet: string;
        lineWidthScale?: number;
        ramales: unknown[];
        dims: unknown[];
        textAnnots: unknown[];
        bajantes: unknown[];
        areas: unknown[];
        nptLevels: unknown[];
        crossFloorGhosts: unknown[];
        guideLines: unknown[];
        selId: string | null;
        activeRamal: unknown;
        activeArea: unknown;
        _netCounts: Record<string, PlanoNetCounts>;
        _dirty: boolean;
        render: () => void;
        [key: string]: unknown;
      },
      d,
    );
    autoDetectRamalConnections(engine);
    podarReferenciasStaleDeBajantes(engine);
    sellarAsociacionesCanalBajante(engine);
    ensureRpCntRamal(engine);
    if (engine._history) {
      // Reset ANTES de la foto: el stack puede traer snapshots del piso ANTERIOR — un
      // Ctrl+Z los restauraba en el motor ya bajo el id del piso nuevo (fotocopia
      // cross-piso persistida por el autosave). La foto de abajo queda como base.
      engine._history.reset();
      engine._history.saveSnapshot();
    }
  } catch (e) {
    devError('Error loading work:', e);
  }
}
