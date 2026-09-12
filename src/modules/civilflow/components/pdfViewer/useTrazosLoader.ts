// Carga los trazos de un plano resolviendo el conflicto local-vs-BD por timestamp: el más
// reciente gana; si la BD trae datos más nuevos se sincronizan a localStorage y se notifica
// (eventos de sync) para que las tablas montadas recojan los cambios. Devuelve true si el
// motor terminó con contenido cargado.
import { useCallback } from 'react';
import {
  loadFromStorage,
  saveToStorage,
  saveTrazosToDB,
  loadTrazosFromDB,
  trazosLocalGanaABdVacia,
} from '../../services/storageService';
import type { PlanTrazos } from '../../services/storageService';
import { devError } from '../../../../utils/devError';
import { migrateAssocLayoutOnLoad, sweepMisplacedLdesvios } from '../../utils/assocLayoutMigration';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';

interface UseTrazosLoaderParams {
  activeNetRef: React.RefObject<string>;
  setActiveNet: React.Dispatch<React.SetStateAction<string>>;
  setScaleM: React.Dispatch<React.SetStateAction<string>>;
}

/** Carga los trazos de un plano resolviendo local-vs-BD por marca de tiempo (gana el más
 *  reciente) y notifica los cambios para que las tablas montadas se actualicen. Devuelve true
 *  si el motor terminó con contenido cargado. */
export function useTrazosLoader({ activeNetRef, setActiveNet, setScaleM }: UseTrazosLoaderParams) {
  return useCallback(
    async (eng: PlanoEngine, resolvedId: string | number): Promise<boolean> => {
      const tryLoad = (id: string | number): PlanTrazos | string | null => {
        const key = `trazos_${id}`;
        const saved = loadFromStorage<PlanTrazos | string | null>(key, null);
        return saved || null;
      };
      const localData = tryLoad(resolvedId);
      let initiallyLoaded = false;
      if (localData) {
        const workStr = typeof localData === 'string' ? localData : JSON.stringify(localData);
        eng.loadWork(workStr);
        initiallyLoaded = true;
        requestAnimationFrame(() => {
          eng.render();
        });
      }
      try {
        const dbData = await loadTrazosFromDB(String(resolvedId));
        if (dbData) {
          const dbTs = Number(dbData.ts || 0);
          const localTs = Number((typeof localData === 'string' ? null : localData)?.ts || 0);
          // Regla de contenido: un documento BD SIN contenido nunca gana a una caché local CON
          // contenido, aunque su ts sea mayor — el ts fresco de un vaciado accidental no puede
          // borrar el piso (el RPC de guardado es destructivo y el mayor-ts mandaba). La local
          // manda y se re-sube para sanear la fila BD.
          if (trazosLocalGanaABdVacia(localData, dbData)) {
            saveTrazosToDB(String(resolvedId), localData);
          } else if (dbTs > localTs || !localData) {
            const workStr = typeof dbData === 'string' ? dbData : JSON.stringify(dbData);
            eng.loadWork(workStr);
            if (!localData || dbTs > localTs) saveToStorage(`trazos_${resolvedId}`, dbData);
            requestAnimationFrame(() => {
              eng.render();
            });
            initiallyLoaded = true;
            const loadedNet = eng.activeNet || activeNetRef.current || 'af';
            const sm = eng.scaleM;
            setActiveNet(loadedNet);
            if (sm != null) setScaleM(String(sm));
            // La caché de trazos recién sobreescrita (saveToStorage no dispara eventos) puede
            // traer ramales nuevos creados en otro dispositivo — sin notificar, los tramos/UC ya
            // montados se quedan sin ellos hasta una edición manual o recarga completa.
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
            window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed'));
          } else if (localTs > dbTs && localData) {
            saveTrazosToDB(String(resolvedId), localData);
          }
        } else if (localData) {
          saveTrazosToDB(String(resolvedId), localData);
        }
      } catch (e) {
        devError('[LOAD] Supabase error/sync error:', e);
      }
      // Migración del layout de asociación (fantasma+Ldesvio ahora viven en el piso inferior):
      // corre tras la carga con el nivel actual como clave del anillo; idempotente por marca
      // `assocLayout: 2` en el storage de cada piso.
      try {
        migrateAssocLayoutOnLoad(String(resolvedId), eng.nivelActual?.label ?? '');
        sweepMisplacedLdesvios();
      } catch (e) {
        devError('[LOAD] migración asociaciones:', e);
      }
      return initiallyLoaded;
    },
    [activeNetRef, setActiveNet, setScaleM],
  );
}
