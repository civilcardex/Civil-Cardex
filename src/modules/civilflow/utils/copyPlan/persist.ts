/**
 * Escritura al piso destino: guarda el work del motor con timestamp (saveTrazosLocales), marca el
 * dirty para el autosave y refresca el render y los eventos de sincronía (hidro/san/aparatos).
 * Ej: tras copiar, el panel de aparatos del piso destino se re-sincroniza sin recargar.
 */
import { saveTrazosLocales } from '../../services/storageService.ts';
import { emitAparatosClear, emitSanSync, emitHidroSync } from '../fixtureEvents.ts';
import type { ExtendedEngine } from './types.ts';

/** Persiste el doc del piso destino y refresca UI/eventos (errores de guardado ignorados a propósito). */
export function guardarYRefrescar(engine: ExtendedEngine, targetPlanId: string): void {
  try {
    const work = engine.saveWork();
    if (work && typeof work === 'object') {
      (work as { ts?: number }).ts = Date.now();
      saveTrazosLocales(targetPlanId, work as Record<string, unknown>);
    }
  } catch {
    // Ignorar errores de guardado
  }

  engine._dirty = true;
  engine._markDirty();
  engine.render();

  try {
    emitHidroSync();
    emitSanSync();
    emitAparatosClear();
  } catch {
    // Ignorar errores de evento
  }
}
