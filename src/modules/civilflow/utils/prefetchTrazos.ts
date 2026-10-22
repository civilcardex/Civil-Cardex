// Prefetch global de trazos: descarga de la BD los trazos de TODOS los pisos que no tengan
// caché local, migra el layout de asociaciones y re-escribe las claves de sync para que las
// tablas (FixturesPanel, InfTab, diseño) muestren todos los pisos sin necesidad de abrir el
// visor 2D piso por piso (orig. usuario). Idempotente: correrlo varias veces no duplica nada.
import { saveToStorage, loadTrazosFromDB } from '../services/storageService.ts';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';
import { leerDocDePlan } from './readPlanDrawing';
import { migrateAssocLayoutOnLoad, sweepMisplacedLdesvios } from './assocLayoutMigration.ts';
import { healHerenciaInvertida } from './bajanteAssociation';
import { writeSanDrawingSync, writeHydroDrawingSync, markPlanTrazosFresh } from './drawingSync.ts';
import type { SyncPlanInput } from './drawingSync.ts';
import { pisoLbl } from '../constants';
import { devError } from '../../../utils/devError.ts';
import { emitAparatosClear, EV_STORAGE } from './fixtureEvents.ts';

// Single-flight: WorkArea, ViewerPage e Isometria disparan el prefetch al montar sobre el
// mismo estado. Sin esto, dos ejecuciones concurrentes intercalan read-modify-write de
// documentos completos (migración) y pueden persistir estado medio aplicado.
let inflight: Promise<void> | null = null;

/** Prefetch best-effort single-flight (nunca rechaza; concurrentes comparten la promesa en vuelo). */
export function prefetchAllTrazos(
  plans: Array<SyncPlanInput & { nivel: string | number | null }>,
): Promise<void> {
  inflight ??= runPrefetch(plans).finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Cuerpo del prefetch: caché local ← BD, migración de asociaciones, sweep y re-escritura de sync. */
async function runPrefetch(
  plans: Array<SyncPlanInput & { nivel: string | number | null }>,
): Promise<void> {
  try {
    // Migración DESPUÉS del fetch (nunca antes): sobre un piso sin caché local, migrateAssoc
    // fabricaba `{assocLayout:2, ts}` y el RPC destructivo lo pisaba en BD ANTES de que el
    // fetch de abajo pudiera restaurarlo — borrado total del piso. Con cachés ya descargadas,
    // esta pasada única encuentra ambos extremos de cada asociación.
    // Plano-fantasma con id uuid (estado contaminado de sesión): cf_planos.id es bigint —
    // filtrar del prefetch/migración (orig. usuario: 42883/22P02 en cada arranque).
    const planes = plans.filter((p) => /^\d+$/.test(String(p.id)));
    const migrateAll = () => {
      for (const p of planes) {
        if (p.nivel == null) continue;
        try {
          migrateAssocLayoutOnLoad(String(p.id), pisoLbl(p.nivel as number));
        } catch {
          /* migración best-effort */
        }
      }
    };
    const missing = planes.filter((p) => leerDocDePlan(p.id) == null);
    await Promise.all(
      missing.map(async (p) => {
        const data = await loadTrazosFromDB(String(p.id));
        if (data) {
          saveToStorage(TRAZOS_PREFIX + p.id, data);
          markPlanTrazosFresh(p.id);
        }
      }),
    );
    // Única pasada de migración: con todos los pisos ya en caché, cada asociación encuentra
    // ambos extremos y el barrido elimina Ldesvios remanentes en el piso equivocado.
    migrateAll();
    try {
      sweepMisplacedLdesvios();
    } catch {
      /* barrido best-effort */
    }
    // Sanador del trinquete de herencia invertida (12→16 al reentrar): revierte los libros
    // falsos que el guard de dirección muerto dejó en el piso superior. Best-effort.
    try {
      if (healHerenciaInvertida(plans)) {
        try {
          emitAparatosClear();
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* sanador best-effort */
    }
    // Re-escribir las claves de sync con TODAS las cachés presentes: write* ya dispara los
    // eventos que hacen que TramosContext reconstruya las tablas. El EV_STORAGE extra refresca
    // paneles que escuchan cambios crudos de localStorage.
    writeSanDrawingSync(plans);
    writeHydroDrawingSync(plans);
    try {
      window.dispatchEvent(new Event(EV_STORAGE));
    } catch {
      /* ignore */
    }
  } catch (e) {
    devError('[PREFETCH] trazos:', e);
  }
}
