import { useEffect, useRef } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { cargarMallas } from '../../lib/PlanoEngine/nodos';
import { emitPlanLoaded } from '../../utils/fixtureEvents.ts';
import { devError } from '../../../../utils/devError.ts';
import { persistTrazosSnapshot } from './persistStrokes.ts';
import { markPlanContentLoaded } from '../../utils/drawingSync.ts';
import { paginaDeDoc } from '../../utils/planScale.ts';

interface UsePlanoLoadSwitchParams {
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  engineReady: boolean;
  currentId: number | undefined;
  currentIdRef: React.RefObject<string | number | null | undefined>;
  loadTrazosForPlan: (eng: PlanoEngine, resolvedId: string | number) => Promise<boolean>;
  syncDrawings: () => void;
  autoSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  loadingPlanRef: React.MutableRefObject<boolean>;
  /** Cambio de PISO en vuelo (estado React espejo de loadingPlanRef): lo consume el velo
   *  translúcido del canvas — el overlay grande solo corre en la primera entrada. */
  onCambioPiso?: (v: boolean) => void;
  /** ¿Hay raster en vuelo o re-raster encolado (lo expone usePdfViewerEngine)? finCarga lo
   *  espera (techo 3 s): el re-raster de la corrección de escala aterriza DESPUÉS del await
   *  del loader por evento — bajar el velo antes lo dejaba ver. */
  hayRasterEnVuelo?: () => boolean;
  activeNetRef: React.RefObject<string>;
  activeNetworksRef: React.RefObject<Set<string>>;
  setActiveNet: React.Dispatch<React.SetStateAction<string>>;
  setScaleM: React.Dispatch<React.SetStateAction<string>>;
}

/** Guardado y carga al cambiar de plano: persiste el trabajo pendiente del plano anterior y
 *  carga los trazos del entrante, o resetea el motor si el plano no tiene nada guardado. */
export function usePlanoLoadSwitch({
  engineRef,
  engineReady,
  currentId,
  currentIdRef,
  loadTrazosForPlan,
  syncDrawings,
  autoSaveTimerRef,
  loadingPlanRef,
  onCambioPiso,
  hayRasterEnVuelo,
  activeNetRef,
  activeNetworksRef,
  setActiveNet,
  setScaleM,
}: UsePlanoLoadSwitchParams): void {
  // Token secuencial de carga (raíz de la "fotocopia entre pisos", ped. usuario: elementos
  // del piso 2 aparecían solos en la cubierta): el switch reasigna _loadedPlanId ANTES de
  // que llegue el contenido y el efecto no tenía cleanup — una carga a BD lenta del piso
  // VIEJO aterrizaba después, pisaba el motor con su contenido bajo el id del piso NUEVO, y
  // finCarga() bajaba el flag global de carga a mitad de la carga VIGENTE (habilitando a
  // todos los escritores con el motor cruzado). Con el token, una carga obsoleta ya no baja
  // el flag ni toca el motor.
  const cargaTokenRef = useRef(0);
  // Pisos ya cargados en este montaje: re-ejecutar la carga de un piso ya cargado lo único
  // que hace es pisar la cámara del motor con la del doc (el "parpadeo y vuelve al zoom
  // inicial" del visor, orig. usuario) — cualquier re-render que mueva las deps del efecto
  // disparaba la recarga completa. Un piso entra UNA vez; el storage mand después por eventos.
  const pisosCargadosRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!engineRef.current || !engineReady) return;
    const eng = engineRef.current;
    const prevId = eng._loadedPlanId;
    if (prevId && prevId !== currentId) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (eng._dirty) {
        // Guardado COMPARTIDO (caché local + BD): antes solo se escribía la caché local y el
        // autosave pendiente se cancelaba → lo último dibujado en ese piso nunca llegaba a la
        // BD (se perdía al abrir el proyecto en otra pestaña/dispositivo). Además
        // persistTrazosSnapshot conserva la marca de asociación entre pisos y el blindaje
        // anti-borrado de Ldesvio/anillo que `saveToStorage` se comía.
        // SIN guard de loadingPlanRef (orig. usuario: "unos elementos no se guardan"): si el
        // await de BD de la carga entrante seguía vivo, este guard SALTABA el guardado del
        // piso abandonado Y limpiaba el autosave pendiente — los elementos dibujados en esa
        // ventana se perdían. El token de carga + `pisoVigente` garantizan que el contenido
        // del motor en este momento es el del piso que se abandona (prevId).
        persistTrazosSnapshot(eng, prevId);
        eng._dirty = false;
      }
    }
    const resolvedId = currentIdRef.current || currentId || '';
    if (!resolvedId) {
      loadingPlanRef.current = false;
      return;
    }
    // SOLO RECARGA DEL MISMO PISO se salta (el motor ya es ese piso y ya cargó): pisar la
    // cámara era el "parpadeo + vuelve al zoom inicial". OJO: una RE-VISITA (piso distinto
    // al cargado) DEBE pasar — si no, el motor se quedaba con los elementos del piso
    // anterior (orig. usuario: "los elementos no cambian según el piso").
    if (
      String(eng._loadedPlanId ?? '') === String(resolvedId) &&
      pisosCargadosRef.current.has(String(resolvedId))
    )
      return;
    const token = ++cargaTokenRef.current;
    const vigente = (): boolean => token === cargaTokenRef.current;
    /** Baja el velo/flag UNA vez que no queda raster en vuelo (el re-raster de la corrección
     *  de escala aterriza por evento DESPUÉS de este await). Mínimo inmediato, techo 3 s. */
    const finCarga = (): void => {
      if (!vigente()) return;
      const t0 = Date.now();
      const bajar = (): void => {
        if (!vigente()) return;
        if (hayRasterEnVuelo?.() && Date.now() - t0 < 3000) {
          window.setTimeout(bajar, 100);
          return;
        }
        loadingPlanRef.current = false;
        eng._frozen = false;
        try {
          onCambioPiso?.(false);
        } catch {
          /* ignore */
        }
        try {
          emitPlanLoaded();
        } catch {
          /* ignore */
        }
      };
      bajar();
    };
    eng._loadedPlanId = resolvedId;
    eng.mallasDeclaradas = cargarMallas(eng._loadedPlanId);
    loadingPlanRef.current = true;
    try {
      onCambioPiso?.(true);
    } catch {
      /* ignore */
    }
    // Congelar el input mientras la carga vuela (ver _onDownHandler): el canvas sigue
    // mostrando el piso anterior y un trazo dibujado aquí moriría con el loadWork entrante.
    eng._frozen = true;
    (async () => {
      try {
        const loaded = await loadTrazosForPlan(eng, resolvedId);
        // Carga obsoleta (el usuario ya cambió de piso): NO tocar el motor ni el flag —
        // la carga vigente es la única autorizada.
        if (!vigente()) return;
        pisosCargadosRef.current.add(String(resolvedId));
        // Contenido CONFIRMADO en el motor: habilita el vaciado legítimo (borrar todo) en
        // el guard anti-pisado de persistTrazosSnapshot (solo se marca con loaded=true).
        if (loaded) markPlanContentLoaded(resolvedId);
        const currentRefId = currentIdRef.current || 'work';
        if (resolvedId !== currentRefId) {
          finCarga();
          return;
        }
        if (loaded) {
          const fallbackNet =
            activeNetworksRef.current &&
            activeNetworksRef.current.size > 0 &&
            !activeNetworksRef.current.has('af')
              ? Array.from(activeNetworksRef.current)[0]
              : activeNetRef.current || 'af';
          const loadedNet = eng.activeNet || fallbackNet;
          const sm = eng.scaleM;
          // Centrado PRE-paint del piso entrante (misma doctrina que el init, ped. usuario:
          // "siempre centrado" + "sin el salto de acomodarse"): la lámina de ESTE piso
          // (persistida por el render anterior) manda el tamaño de página y el encuadre ⤢
          // corre antes del primer render — la cámara heredada del piso anterior nunca se
          // llega a ver.
          const pg = paginaDeDoc(resolvedId, eng.scaleM);
          if (pg) eng.setPageSize(pg.w, pg.h);
          // MISMA fórmula que el loader y el post-raster (reEncuadrarContenido, bbox del
          // dibujo CON dims): antes fitPage encuadraba la HOJA aquí y pisaba la cámara que
          // el loader acababa de poner — la cámara cambiaba dos veces a la vista (el salto
          // residual del cambio de piso, orig. usuario). Sin dibujo cae a la hoja (fitPage).
          eng.reEncuadrarContenido();
          setActiveNet(loadedNet);
          if (sm != null) setScaleM(String(sm));
          requestAnimationFrame(() => {
            finCarga();
            if (engineRef.current) engineRef.current.render();
          });
        } else if (currentId) {
          eng.ramales = [];
          eng.bajantes = [];
          eng.areas = [];
          eng.dims = [];
          eng.textAnnots = [];
          eng.selId = null;
          eng.activeRamal = null;
          eng.activeArea = null;
          eng.setActiveNet(activeNetRef.current);
          // Piso vacío también centra: sin esto, fitPage corría con el pageW del piso
          // ANTERIOR (setPageSize del raster llega después) y el encuadre llegaba tarde.
          const pg = paginaDeDoc(resolvedId, eng.scaleM);
          if (pg) eng.setPageSize(pg.w, pg.h);
          eng.reEncuadrarContenido();
          eng.render();
          finCarga();
        }
      } catch (e) {
        devError('[LOAD] error', e);
        finCarga();
      }
    })();
    syncDrawings();
  }, [
    currentId,
    engineReady,
    loadTrazosForPlan,
    syncDrawings,
    autoSaveTimerRef,
    engineRef,
    currentIdRef,
    loadingPlanRef,
    onCambioPiso,
    hayRasterEnVuelo,
    activeNetRef,
    activeNetworksRef,
    setActiveNet,
    setScaleM,
  ]);
}
