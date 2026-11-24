// Carga los trazos de un plano resolviendo el conflicto local-vs-BD por timestamp: el más
// reciente gana; si la BD trae datos más nuevos se sincronizan a localStorage y se notifica
// (eventos de sync) para que las tablas montadas recojan los cambios. Devuelve true si el
// motor terminó con contenido cargado.
import { useCallback } from 'react';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { registraCarga, EVENTO_ESCALA_CAMBIADA } from '../../utils/loadDiagnostics.ts';
import {
  loadFromStorage,
  saveTrazosToDB,
  loadTrazosFromDB,
  arbitrarCarga,
  saveTrazosLocales,
  trazosDocHasContent,
  getActiveProyectoId,
} from '../../services/storageService.ts';
import type { PlanTrazos } from '../../services/storageService.ts';
import { devError } from '../../../../utils/devError.ts';
import { validaDocTrazos } from '../../services/storage/validateDocStrokes.ts';
import {
  migrateAssocLayoutOnLoad,
  sweepMisplacedLdesvios,
} from '../../utils/assocLayoutMigration.ts';
import { restaurarAsociacionesDesdeLocal } from '../../utils/crossFloorStorage.ts';
import { VERSION_LAMINA_BASE } from '../../lib/PlanoEngine/planoCoords.ts';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { emitSanSync, emitHidroSync, EV_STORAGE } from '../../utils/fixtureEvents.ts';
import { journalTrazos, resumenTrazos } from '../../services/storage/strokesJournal.ts';

interface UseTrazosLoaderParams {
  plansRef: React.RefObject<PlanItem[]>;
  activeNetRef: React.RefObject<string>;
  setActiveNet: React.Dispatch<React.SetStateAction<string>>;
  setScaleM: React.Dispatch<React.SetStateAction<string>>;
}

/** Carga los trazos de un plano resolviendo local-vs-BD por marca de tiempo (gana el más reciente) y notifica los cambios para que las tablas montadas se actualicen. */
export function useTrazosLoader({
  plansRef,
  activeNetRef,
  setActiveNet,
  setScaleM,
}: UseTrazosLoaderParams) {
  return useCallback(
    async (eng: PlanoEngine, resolvedId: string | number): Promise<boolean> => {
      const proyectoId = getActiveProyectoId();
      const tryLoad = (id: string | number): PlanTrazos | string | null => {
        const key = `trazos_${id}`;
        const saved = loadFromStorage<PlanTrazos | string | null>(key, null);
        if (!saved) return null;
        // Se valida la FORMA antes de cargarlo: un doc de era vieja (o truncado) con
        // 'ramales' como objeto, o sin 'bajantes', metía basura en el motor o dejaba el
        // piso vacío sin aviso (el usuario creía que había guardado).
        if (!validaDocTrazos(saved)) {
          devError('useTrazosCargador: doc con forma inválida en', key);
          return null;
        }
        return saved;
      };
      const localData = tryLoad(resolvedId);
      let initiallyLoaded = false;
      // Sin caché local: el motor aún muestra el piso ANTERIOR. Vaciarlo ANTES del await —
      // con `_frozen` el usuario no puede dibujar encima, y no hay contenido viejo que el
      // loadWork de BD vaya a pisar (ni nada que revivir por undo). Mismo vaciado que la
      // rama post-await "sin datos" — sincronizado con esa para no divergir.
      if (!localData) {
        eng.ramales = [];
        eng.bajantes = [];
        eng.areas = [];
        eng.dims = [];
        eng.textAnnots = [];
        eng.guideLines = [];
        eng.crossFloorGhosts = [];
        eng.selId = null;
        eng.activeRamal = null;
        eng.activeArea = null;
        eng.render();
      }
      // Diagnóstico: capturar la escala del documento que realmente entró al motor.
      let docScale = 0;
      // Diagnóstico: la escala y el ts de cada copia (local vs BD). El arbitration gana el
      // mayor ts: si la copia local va sin ts cuenta 0 y la BD manda siempre.
      const escalaTsDe = (doc: unknown) => {
        const d = (
          typeof doc === 'string'
            ? (() => {
                try {
                  return JSON.parse(doc) as { scaleM?: number; ts?: number };
                } catch {
                  return null;
                }
              })()
            : doc
        ) as { scaleM?: number; ts?: number } | null;
        return {
          escala: typeof d?.scaleM === 'number' ? d.scaleM : null,
          ts: typeof d?.ts === 'number' ? d.ts : null,
          tieneContenido: trazosDocHasContent(d),
        };
      };
      const localInfo = escalaTsDe(localData);
      let docDibujado = !!(localInfo.ts || localInfo.tieneContenido);
      let bdInfo = escalaTsDe(null);
      // El usuario pudo cambiar de piso durante el await de red: el motor ya es del piso
      // NUEVO y _loadedPlanId apunta a él — un loadWork con el doc del piso VIEJO bajo el
      // id nuevo era la FOTOCOPIA entre pisos (elementos del piso 2 apareciendo en la
      // cubierta, orig. usuario). Todo lo que sigue al await toca el motor solo si el piso
      // sigue siendo el cargado (segunda llave, además del token del switch).
      // El contenido cambió (loadWork): el bbox y el encuadre se recalculan — la arbitración
      // local-vs-BD que aterriza tras el raster no puede mover los elementos a la vista
      // (orig. usuario: «salto residual mientras se acomodan»).
      const reEncuadrar = (): void => {
        eng.reEncuadrarContenido();
        requestAnimationFrame(() => {
          eng.render();
        });
      };
      const pisoVigente = (): boolean =>
        getActiveProyectoId() === proyectoId &&
        String(eng._loadedPlanId ?? '') === String(resolvedId);
      if (localData) {
        const workStr = typeof localData === 'string' ? localData : JSON.stringify(localData);
        eng.loadWork(workStr);
        docScale = eng.scaleM;
        // La ruta local-gana jamás sincronizaba el estado React con el doc — syncEngine
        // re-pisaba el engine con el default/derivado y envenenaba cualquier lectura posterior.
        if (docScale) setScaleM(String(docScale));
        initiallyLoaded = true;
        reEncuadrar();
      }
      try {
        const dbData = await loadTrazosFromDB(String(resolvedId));
        if (!pisoVigente()) return initiallyLoaded;
        // El usuario dibujó durante el await de red: el engine tiene ediciones que aún no
        // llegaron a caché/BD — aplicar dbData (loadWork reemplaza TODO) las destruiría y el
        // autosave siguiente consolidaría el vaciado. La caché local (ya escrita por el
        // autosave) manda; la BD se re-sube desde ella.
        if (eng._dirty) {
          const fresco = tryLoad(resolvedId);
          if (fresco) {
            journalTrazos(
              'load',
              resolvedId,
              fresco,
              `engine-dirty: se conserva la caché (${resumenTrazos(fresco)}) y se re-sube`,
            );
            saveTrazosToDB(String(resolvedId), fresco);
            return initiallyLoaded;
          }
        }
        if (dbData) {
          bdInfo = escalaTsDe(dbData);
          const dbTs = Number(dbData.ts || 0);
          const localTs = localInfo.ts ?? 0;
          /* Árbitro por contenido+ts (LWW en el guardado): al abrir gana el doc MÁS NUEVO,
           *  con las reglas anti-vacío por delante. Sin reloj de versión (ped. 2026-11-24). */
          const decision = arbitrarCarga(localData, dbData, localTs, dbTs);
          // Caja negra (DEV): la decisión del árbitro con los conteos de AMBOS lados. Es la
          // firma que nombra al culpable cuando un piso aparece vacío al reabrir: si aquí se
          // ve `local=vacio bd=vacio`, el borrado ocurrió ANTES (buscar el push vacío en el
          // diario); si se ve `gana=local-contenido` con local vacío, el árbitro no protegió.
          journalTrazos(
            'load',
            resolvedId,
            decision === 'bd' ? dbData : (localData ?? undefined),
            `local=${resumenTrazos(localData)} bd=${resumenTrazos(dbData)} gana=${
              decision === 'bd' ? 'BD' : decision
            }`,
          );
          if (decision === 'local-contenido') {
            saveTrazosToDB(String(resolvedId), localData);
          } else if (decision === 'bd') {
            const merged = typeof dbData === 'string' ? (JSON.parse(dbData) as PlanTrazos) : dbData;
            // Misma validación de forma que la caché local: un doc BD de era vieja con
            // 'ramales' como objeto (o sin 'bajantes') NO debe entrar al motor — metía
            // piezas sin id o dejaba el piso vacío sin aviso.
            if (!validaDocTrazos(merged)) {
              devError('useTrazosCargador: doc BD con forma inválida en', String(resolvedId));
              return initiallyLoaded;
            }
            // Asociación entre pisos (orig. usuario): unión SIEMPRE cuando BD gana — fantasma
            // XFG / Ldesvio / anillo presentes en la caché local y ausentes en el doc BD se
            // restauran. Sin gates: el gate dbSinAsocs/reciente era CIEGO para layout-2 (en el
            // piso inferior dbSinAsocs era false si la BD tenía CUALQUIER otro LD_ ajeno, y con
            // gap ≥1 h la restauración se saltaba → loadWork pisaba engine+caché buenas con el
            // doc BD sin anillo/LD_ — causa raíz del borrado persistente). Seguro porque la
            // desasociación legítima borra en AMBOS lados: la caché local sin piezas no aporta
            // nada a la unión.
            const restauradas = restaurarAsociacionesDesdeLocal(localData, merged);
            if (restauradas) {
              saveTrazosToDB(String(resolvedId), merged);
              eng.loadWork(JSON.stringify(merged));
            } else {
              eng.loadWork(typeof dbData === 'string' ? dbData : JSON.stringify(dbData));
            }
            docScale = eng.scaleM;
            docDibujado = !!(dbTs || trazosDocHasContent(merged));
            // La caché refleja EXACTAMENTE lo cargado en el engine: guardar dbData cuando se
            // restauró pisaba el merged y el anti-loss producía la pérdida que curaba.
            saveTrazosLocales(
              resolvedId,
              (restauradas ? merged : dbData) as Record<string, unknown>,
            );
            reEncuadrar();
            initiallyLoaded = true;
            const loadedNet = eng.activeNet || activeNetRef.current || 'af';
            const sm = eng.scaleM;
            setActiveNet(loadedNet);
            if (sm != null) setScaleM(String(sm));
            // La caché de trazos recién sobreescrita (saveToStorage no dispara eventos) puede
            // traer ramales nuevos creados en otro dispositivo — sin notificar, los tramos/UC ya
            // montados se quedan sin ellos hasta una edición manual o recarga completa.
            window.dispatchEvent(new Event(EV_STORAGE));
            emitSanSync();
            emitHidroSync();
          } else if (decision === 'local-ts' && localTs > dbTs) {
            saveTrazosToDB(String(resolvedId), localData);
          }
        } else if (localData) {
          journalTrazos(
            'load',
            resolvedId,
            localData,
            `local=${resumenTrazos(localData)} bd=sin-fila gana=local`,
          );
          saveTrazosToDB(String(resolvedId), localData);
        } else {
          // Ni caché ni fila BD: el piso entra vacío. Queda en el diario para no confundirlo
          // con un borrado (aquí NO hay nada que perder).
          journalTrazos('load', resolvedId, undefined, 'local=vacio bd=sin-fila gana=nada');
        }
      } catch (e) {
        devError('[LOAD] Supabase error/sync error:', e);
      }
      if (!pisoVigente()) return initiallyLoaded;
      const meta = plansRef.current.find((m) => String(m.id) === String(resolvedId));
      const escalaPlano = Number(meta?.scale) / 100;
      // Un registro de solo metadatos no fija las coordenadas del dibujo. En un piso nuevo
      // se mide con su calibración y se dibuja sobre el PDF base, incluso sin doc en caché.
      if (!docDibujado) {
        eng.workVersion = VERSION_LAMINA_BASE;
        const escala = Number.isFinite(escalaPlano) && escalaPlano > 0 ? escalaPlano : 0.5;
        eng.setScaleM(escala);
        setScaleM(String(escala));
      }
      const definida = meta?.definedScale;
      if (
        (!docDibujado || eng.definedScaleM <= 0) &&
        typeof definida === 'number' &&
        Number.isFinite(definida) &&
        definida > 0
      ) {
        eng.setDefinedScaleM(definida);
      } else if (!docDibujado) {
        eng.setDefinedScaleM(0);
      }
      // Abrir nunca reescala ni modifica la calibración guardada. Si al llegar la nube
      // cambió el formato de coordenadas, actualizar solamente el fondo.
      window.dispatchEvent(new CustomEvent(EVENTO_ESCALA_CAMBIADA, { detail: String(resolvedId) }));
      registraCarga(resolvedId, {
        escalaDoc: docDibujado ? docScale : null,
        escalaPlano: escalaPlano > 0 ? escalaPlano : null,
        escalaGlobal: null,
        escalaLocal: localInfo.escala,
        escalaBd: bdInfo.escala,
        tsLocal: localInfo.ts,
        tsBd: bdInfo.ts,
        accion: 'nada',
        factor: null,
        elementos: eng.ramales.length + eng.bajantes.length + eng.areas.length + eng.dims.length,
      });
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
    [activeNetRef, plansRef, setActiveNet, setScaleM],
  );
}
