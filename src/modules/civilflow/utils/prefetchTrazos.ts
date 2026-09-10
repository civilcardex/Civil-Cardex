// Prefetch global de trazos: descarga de la BD los trazos de TODOS los pisos que no tengan
// caché local, migra el layout de asociaciones y re-escribe las claves de sync para que las
// tablas (FixturesPanel, InfTab, diseño) muestren todos los pisos sin necesidad de abrir el
// visor 2D piso por piso (orig. usuario). Idempotente: correrlo varias veces no duplica nada.
import { loadFromStorage, saveToStorage, loadTrazosFromDB } from '../services/storageService';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { migrateAssocLayoutOnLoad, sweepMisplacedLdesvios } from './associateBajanteAcrossFloors';
import { writeSanDrawingSync, writeHydroDrawingSync } from './drawingSync';
import type { SyncPlanInput } from './drawingSync';
import { pisoLbl } from '../constants';
import { devError } from '../../../utils/devError';

/** Nunca rechaza: el prefetch es best-effort — un fallo de red/BD no debe romper al llamador
 *  (los call sites lo disparan con `void` al montar). */
export async function prefetchAllTrazos(
  plans: Array<SyncPlanInput & { nivel: string | number | null }>,
): Promise<void> {
  try {
    // Pasada sincrónica: solo completa pares de asociación con ambos pisos ya en caché local.
    const migrateAll = () => {
      for (const p of plans) {
        if (p.nivel == null) continue;
        try {
          migrateAssocLayoutOnLoad(String(p.id), pisoLbl(p.nivel as number));
        } catch {
          /* migración best-effort */
        }
      }
    };
    migrateAll();
    const missing = plans.filter((p) => loadFromStorage(TRAZOS_PREFIX + p.id, null) == null);
    await Promise.all(
      missing.map(async (p) => {
        const data = await loadTrazosFromDB(String(p.id));
        if (data) saveToStorage(TRAZOS_PREFIX + p.id, data);
      }),
    );
    // Segunda pasada completa: con todos los pisos en caché, cada asociación encuentra ambos
    // extremos y el barrido elimina Ldesvios remanentes en el piso equivocado.
    migrateAll();
    try {
      sweepMisplacedLdesvios();
    } catch {
      /* barrido best-effort */
    }
    // Re-escribir las claves de sync con TODAS las cachés presentes: write* ya dispara los
    // eventos que hacen que TramosContext reconstruya las tablas. El 'storage' extra refresca
    // paneles que escuchan cambios crudos de localStorage.
    writeSanDrawingSync(plans);
    writeHydroDrawingSync(plans);
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {
      /* ignore */
    }
  } catch (e) {
    devError('[PREFETCH] trazos:', e);
  }
}
