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
import { restaurarAsociacionesDesdeLocal } from '../../utils/crossFloorStorage';
import { origenDePlan } from '../../utils/crossFloorStorage';
import { rebasarEscalaTrazos, type PlanoWorkData } from '../../lib/PlanoEngine/PlanoPersistence';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';

interface UseTrazosLoaderParams {
  activeNetRef: React.RefObject<string>;
  setActiveNet: React.Dispatch<React.SetStateAction<string>>;
  setScaleM: React.Dispatch<React.SetStateAction<string>>;
  /** Escala única del proyecto (del plan calGlobal) — ref actualizada por el visor. */
  escalaGlobalRef: React.RefObject<number | null>;
}

/** Carga los trazos de un plano resolviendo local-vs-BD por marca de tiempo (gana el más
 *  reciente) y notifica los cambios para que las tablas montadas se actualicen. Devuelve true
 *  si el motor terminó con contenido cargado. */
export function useTrazosLoader({
  activeNetRef,
  setActiveNet,
  setScaleM,
  escalaGlobalRef,
}: UseTrazosLoaderParams) {
  return useCallback(
    async (eng: PlanoEngine, resolvedId: string | number): Promise<boolean> => {
      const tryLoad = (id: string | number): PlanTrazos | string | null => {
        const key = `trazos_${id}`;
        const saved = loadFromStorage<PlanTrazos | string | null>(key, null);
        return saved || null;
      };
      const localData = tryLoad(resolvedId);
      let initiallyLoaded = false;
      // scaleM del DOCUMENTO capturado tras cada loadWork — el engine vivo puede ser pisado
      // por el estado React (syncEngine/default '0.5') durante el await de BD; el re-base
      // debe comparar la escala del doc, no la pisada (bug: elementos corridos al reabrir).
      let docScale = 0;
      if (localData) {
        const workStr = typeof localData === 'string' ? localData : JSON.stringify(localData);
        eng.loadWork(workStr);
        docScale = eng.scaleM;
        // La ruta local-gana jamás sincronizaba el estado React con el doc — syncEngine
        // re-pisaba el engine con el default/derivado y envenenaba cualquier lectura posterior.
        if (docScale) setScaleM(String(docScale));
        initiallyLoaded = true;
        requestAnimationFrame(() => {
          eng.render();
        });
      }
      try {
        const dbData = await loadTrazosFromDB(String(resolvedId));
        // El usuario dibujó durante el await de red: el engine tiene ediciones que aún no
        // llegaron a caché/BD — aplicar dbData (loadWork reemplaza TODO) las destruiría y el
        // autosave siguiente consolidaría el vaciado. La caché local (ya escrita por el
        // autosave) manda; la BD se re-sube desde ella.
        if (eng._dirty) {
          const fresco = tryLoad(resolvedId);
          if (fresco) {
            saveTrazosToDB(String(resolvedId), fresco);
            return initiallyLoaded;
          }
        }
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
            const merged = typeof dbData === 'string' ? (JSON.parse(dbData) as PlanTrazos) : dbData;
            // Asociación entre pisos (orig. usuario): fantasma XFG / Ldesvio / anillo que la
            // caché local sí tiene y el doc BD perdió (guardado RPC fallido, pisa-ts de otra
            // vía) se RESTAURAN desde la local — la desasociación legítima borra en ambos, así
            // que un doc BD sin ellas frente a una local con ellas siempre significa pérdida.
            // GATE anti stale (multi-dispositivo): restaurar solo si el doc BD no tiene
            // NINGÚN artefacto de asociación (indicio de vaciado/RPC fallido) O la divergencia
            // de ts es reciente (<1 h). Una caché VIEJA con fantasmas frente a una BD que los
            // desasoció legítimamente hace horas no debe resucitarlos.
            const dbSinAsocs =
              !(merged as { crossFloorGhosts?: unknown[] }).crossFloorGhosts?.length &&
              !((merged as { ramales?: Array<{ id?: string }> }).ramales || []).some((r) =>
                String(r.id || '').startsWith('LD_'),
              );
            const reciente = !localData || dbTs - localTs < 3600_000;
            const restauradas =
              (dbSinAsocs || reciente) && restaurarAsociacionesDesdeLocal(localData, merged);
            if (restauradas) {
              saveTrazosToDB(String(resolvedId), merged);
              eng.loadWork(JSON.stringify(merged));
            } else {
              eng.loadWork(typeof dbData === 'string' ? dbData : JSON.stringify(dbData));
            }
            docScale = eng.scaleM;
            // La caché refleja EXACTAMENTE lo cargado en el engine: guardar dbData cuando se
            // restauró pisaba el merged y el anti-loss producía la pérdida que curaba.
            saveToStorage(`trazos_${resolvedId}`, restauradas ? merged : dbData);
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
      // ESCALA ÚNICA DEL PROYECTO (causa raíz de cotas distintas entre pisos, incidente
      // 2026-09-21): cada piso guardaba su propio scaleM y las calibraciones manuales
      // divergían 0.5–1.5 % — una cota de 4 m medía distinto en cada piso. Si existe
      // calibración global (calGlobal) y el piso trae otra escala, la geometría se RE-BASA
      // anclada al origen de calibración del piso (px−origen constante = posición física
      // preservada; totalL/L de cotas intactos) y el piso pasa a la escala global +
      // persistencia inmediata. Idempotente: tras el re-base los trazos ya quedan con ella
      // (2ª carga = no-op).
      // Compara el scaleM DEL DOCUMENTO (capturado tras loadWork) — el engine vivo puede
      // venir pisado por el estado React durante el await de BD (bug: elementos corridos).
      const escalaGlobal = escalaGlobalRef.current;
      if (escalaGlobal && docScale && Math.abs(docScale - escalaGlobal) > 1e-9) {
        // Meta legacy REDONDEADO (0.4723 → 47 → 0.47): el re-base movería TODA la geometría
        // ~0.5 % una vez por piso legacy. Self-heal: el doc (exacto) corrige al meta y no se
        // tocan trazos. Divergencias reales (calibraciones manuales) superan el 0.6 %.
        if (Math.abs(docScale - escalaGlobal) / escalaGlobal <= 0.006) {
          escalaGlobalRef.current = docScale;
          setScaleM(String(docScale));
          try {
            const meta = loadFromStorage<
              Array<{ id: number; scale: number; calGlobal?: boolean | null }>
            >('plans_meta', []);
            const holder = meta.find(
              (m) =>
                m.calGlobal === true &&
                typeof m.scale === 'number' &&
                Math.abs(m.scale / 100 - escalaGlobal) < 1e-9,
            );
            if (holder) {
              holder.scale = docScale * 100;
              saveToStorage('plans_meta', meta);
            }
          } catch {
            /* sin meta accesible: solo queda aplicado en la ref de esta sesión */
          }
        } else {
          try {
            (eng as unknown as PlanoWorkData).scaleM = docScale;
            rebasarEscalaTrazos(
              eng as unknown as PlanoWorkData,
              escalaGlobal,
              origenDePlan(String(resolvedId)),
            );
            eng.setScaleM(escalaGlobal);
            setScaleM(String(escalaGlobal));
            const work = eng.saveWork();
            // Tumba anti-vacío: un loadWork fallido a medias deja el engine sin contenido —
            // persistir el re-base pisaría la caché (y luego BD vía el RPC destructivo) con
            // un doc vacío. Solo persiste con contenido, o si no había nada que proteger.
            const conContenido =
              eng.ramales.length + eng.bajantes.length + eng.areas.length + eng.dims.length > 0;
            if (conContenido || !localData) {
              saveToStorage(`trazos_${resolvedId}`, work);
              void saveTrazosToDB(String(resolvedId), work);
            }
            window.dispatchEvent(new Event('storage'));
          } catch (e) {
            devError('[LOAD] re-base escala global:', e);
          }
        }
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
    [activeNetRef, setActiveNet, setScaleM, escalaGlobalRef],
  );
}
