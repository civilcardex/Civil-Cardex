// Carga los trazos de un plano resolviendo el conflicto local-vs-BD por timestamp: el más
// reciente gana; si la BD trae datos más nuevos se sincronizan a localStorage y se notifica
// (eventos de sync) para que las tablas montadas recojan los cambios. Devuelve true si el
// motor terminó con contenido cargado.
import { useCallback } from 'react';
import { leerPlansMeta, planCalibrado } from '../../utils/plansMeta.ts';
import {
  corrigeEscalaMeta,
  decideEscalaDelDoc,
  docConTs,
  registraCarga,
  debeAvisarCorreccionEscala,
  EVENTO_ESCALA_CAMBIADA,
} from '../../utils/cargaDiagnostico.ts';
import {
  loadFromStorage,
  saveToStorage,
  saveTrazosToDB,
  loadTrazosFromDB,
  trazosLocalGanaABdVacia,
  saveTrazosLocales,
  localGanaABdPorTs,
} from '../../services/storageService.ts';
import type { PlanTrazos } from '../../services/storageService.ts';
import { devError } from '../../../../utils/devError.ts';
import { validaDocTrazos } from '../../services/storage/validaDocTrazos.ts';
import { marcarPrimerPisoCargado } from './pdfCache.ts';
import { PLANS_META_KEY } from '../../constants/storage-keys.ts';
import {
  migrateAssocLayoutOnLoad,
  sweepMisplacedLdesvios,
} from '../../utils/assocLayoutMigration.ts';
import { restaurarAsociacionesDesdeLocal } from '../../utils/crossFloorStorage.ts';
import { origenDePlan } from '../../utils/crossFloorStorage.ts';
import { rebasarEscalaTrazos, type PlanoWorkData } from '../../lib/PlanoEngine/PlanoPersistence.ts';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { emitSanSync, emitHidroSync, EV_STORAGE } from '../../utils/fixtureEvents.ts';

interface UseTrazosLoaderParams {
  activeNetRef: React.RefObject<string>;
  setActiveNet: React.Dispatch<React.SetStateAction<string>>;
  setScaleM: React.Dispatch<React.SetStateAction<string>>;
  /** Escala única del proyecto (del plan calGlobal) — ref actualizada por el visor. */
  escalaGlobalRef: React.RefObject<number | null>;
}

/** Carga los trazos de un plano resolviendo local-vs-BD por marca de tiempo (gana el más reciente) y notifica los cambios para que las tablas montadas se actualicen. */
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
      // scaleM del DOCUMENTO capturado tras cada loadWork — el engine vivo puede ser pisado
      // por el estado React (syncEngine/default '0.5') durante el await de BD; el re-base
      // debe comparar la escala del doc, no la pisada (bug: elementos corridos al reabrir).
      let docScale = 0;
      // Diagnóstico: la escala y el ts de cada copia (local vs BD). El arbitration gana el
      // mayor ts: si la copia local va sin ts cuenta 0 y la BD manda siempre.
      const escalaTsDe = (doc: unknown): { escala: number | null; ts: number | null } => {
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
        };
      };
      const localInfo = escalaTsDe(localData);
      let bdInfo = { escala: null as number | null, ts: null as number | null };
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
      const pisoVigente = (): boolean => String(eng._loadedPlanId ?? '') === String(resolvedId);
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
          bdInfo = escalaTsDe(dbData);
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
            // Misma validación de forma que la caché local: un doc BD de era vieja con
            // 'ramales' como objeto (o sin 'bajantes') NO debe entrar al motor — metía
            // piezas sin id o dejaba el piso vacío sin aviso.
            if (!validaDocTrazos(merged)) {
              devError('useTrazosCargador: doc BD con forma inválida en', String(resolvedId));
              return initiallyLoaded;
            }
            if (!pisoVigente()) return initiallyLoaded;
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
          } else if (localGanaABdPorTs(localTs, dbTs) && localData) {
            saveTrazosToDB(String(resolvedId), localData);
          }
        } else if (localData) {
          saveTrazosToDB(String(resolvedId), localData);
        }
      } catch (e) {
        devError('[LOAD] Supabase error/sync error:', e);
      }
      // ESCALA DEL PISO (decisión 2026-10-21, orig. usuario: "al reingresar los elementos
      // aparecen desplazados y las cotas leen menos").
      //
      // La escala de un piso es la SUYA: la de su calibración en plans_meta. Antes se
      // comparaba contra la escala GLOBAL del proyecto (el primer plan con calGlobal) y, si
      // no coincidía, se re-escalaba TODA la geometría anclada al origen — eso encogía el
      // dibujo de los pisos calibrados a mano en cuanto el portador global cambiaba, y el
      // cambio quedaba guardado. Ahora:
      //  · piso calibrado a mano  → su escala manda (nadie la re-escala).
      //  · piso que hereda el global (calGlobal) → sigue al global (una sola escala de
      //    proyecto), pero cualquier re-escalado se ANUNCIa y se registra.
      //  · piso sin calibración → su escala de doc manda (nada la toca).
      // El doc manda sobre el valor por defecto del plano: es el que define el espacio de
      // los píxeles del dibujo.
      const escalaGlobal = escalaGlobalRef.current;
      let meta = [] as ReturnType<typeof leerPlansMeta>;
      try {
        meta = leerPlansMeta();
      } catch {
        /* sin meta accesible: el doc manda tal cual */
      }
      const entrada = meta.find((m) => String(m.id) === String(resolvedId));
      const calibrado = planCalibrado(meta, resolvedId);
      // Escala calibrada del piso: la global si el piso la hereda (calGlobal), si no la suya.
      const escalaPropia =
        calibrado && typeof entrada?.scale === 'number' && entrada.scale > 0
          ? entrada.calGlobal === true && escalaGlobal
            ? escalaGlobal
            : entrada.scale / 100
          : null;
      const decision = decideEscalaDelDoc({ escalaDoc: docScale, escalaPlano: escalaPropia });
      const elementosCargados =
        eng.ramales.length + eng.bajantes.length + eng.areas.length + eng.dims.length;
      registraCarga(resolvedId, {
        escalaDoc: docScale || null,
        escalaPlano: escalaPropia,
        escalaGlobal: escalaGlobal ?? null,
        escalaLocal: localInfo.escala,
        escalaBd: bdInfo.escala,
        tsLocal: localInfo.ts,
        tsBd: bdInfo.ts,
        accion: decision.accion,
        factor: decision.accion === 'rebase' ? decision.factor : null,
        elementos: elementosCargados,
      });
      // Aplicar la decisión SOLO con el piso aún vigente (un cambio de piso durante el await
      // deja el motor en otro piso: setScaleM/rebase here serían del piso equivocado).
      if (pisoVigente() && decision.accion === 'autoheal') {
        // Meta legacy REDONDEADO (0.4723 → 47 → 0.47): el doc (exacto) corrige al meta y no
        // se tocan trazos. Divergencias reales (calibraciones manuales) superan el 0.6 %.
        escalaGlobalRef.current = entrada?.calGlobal === true ? decision.escala : escalaGlobal;
        setScaleM(String(decision.escala));
        try {
          const corregido = corrigeEscalaMeta(
            meta,
            resolvedId,
            decision.escala,
            entrada?.calGlobal === true,
          );
          if (corregido.cambio) saveToStorage(PLANS_META_KEY, corregido.meta);
        } catch {
          /* sin meta accesible: solo queda aplicado en la ref de esta sesión */
        }
      } else if (
        pisoVigente() &&
        (decision.accion === 'reparar-etiqueta' || decision.accion === 'rebase')
      ) {
        // La etiqueta del doc quedó pisada (o el doc está en otra escala real): se deja la
        // geometría donde está y se corrige la escala que la interpreta. En el re-base la
        // geometría SÍ se re-escala (px−origen constante = posición física preservada).
        try {
          (eng as unknown as PlanoWorkData).scaleM = docScale;
          if (decision.accion === 'rebase') {
            rebasarEscalaTrazos(
              eng as unknown as PlanoWorkData,
              decision.escala,
              origenDePlan(String(resolvedId)),
            );
          } else {
            (eng as unknown as PlanoWorkData).scaleM = decision.escala;
          }
          eng.setScaleM(decision.escala);
          setScaleM(String(decision.escala));
          const work = eng.saveWork();
          // ts FRESCO: el árbitro local-vs-BD gana el mayor ts. Sin ts, la copia local cuenta
          // como 0 y la BD gana SIEMPRE -> el doc conservaba la escala mala y la corrección se
          // repetía en cada entrada (el aviso salía siempre). Mismo convenio que el autosave
          // (persistTrazosSnapshot): todo doc que se persiste va con ts.
          const workConTs = docConTs(work);
          // Tumba anti-vacío: un loadWork fallido a medias deja el engine sin contenido —
          // persistir el re-base pisaría la caché (y luego BD vía el RPC destructivo) con
          // un doc vacío. Solo persiste con contenido, o si no había nada que proteger.
          const conContenido =
            eng.ramales.length + eng.bajantes.length + eng.areas.length + eng.dims.length > 0;
          if (conContenido || !localData) {
            const guardado = saveTrazosLocales(
              resolvedId,
              workConTs as unknown as Record<string, unknown>,
            );
            void saveTrazosToDB(String(resolvedId), workConTs);
            if (!guardado) {
              // La caché local no se pudo escribir (cuota de localStorage llena): la corrección
              // NO quedó guardada y volvería a salir en la próxima entrada. Sin esto, el
              // usuario ve el mismo aviso cada vez y cree que la app está rota.
              devError('[LOAD] la corrección de escala no se pudo guardar en localStorage');
            }
            if (debeAvisarCorreccionEscala(resolvedId, `${docScale}->${decision.escala}`)) {
              const base =
                decision.accion === 'rebase'
                  ? `El piso ${resolvedId} estaba a ${docScale} m/px y se pasó a ${decision.escala} m/px (se re-escaló el dibujo, anclado al origen de calibración).`
                  : `El piso ${resolvedId} tenía la escala mal puesta (${docScale} m/px) y se restauró la de su calibración (${decision.escala} m/px). El dibujo NO se movió.`;
              eng.triggerAlert(
                'Escala del piso corregida',
                guardado
                  ? base
                  : `${base} OJO: no se pudo guardar (almacenamiento local lleno): puede volver a salir.`,
              );
            }
          }
          window.dispatchEvent(new Event(EV_STORAGE));
          // La lámina de fondo se rasteriza con la escala del doc: si la escala cambia, la
          // lámina tiene que volver a rasterizarse o el fondo y el dibujo quedan en escalas
          // distintas (el dibujo se ve corrido y más corto respecto de la lámina).
          window.dispatchEvent(new CustomEvent(EVENTO_ESCALA_CAMBIADA));
        } catch (e) {
          devError('[LOAD] corrección de escala del piso:', e);
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
      // Piso asentado (raster + arbitración + escala corregida): el overlay de primera
      // entrada puede levantarse — nada más va a mover los elementos a la vista.
      if (pisoVigente()) marcarPrimerPisoCargado();
      return initiallyLoaded;
    },
    [activeNetRef, setActiveNet, setScaleM, escalaGlobalRef],
  );
}
