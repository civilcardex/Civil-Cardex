import { useCallback, useEffect, useRef } from 'react';
import { usePersistedState } from '../../../../hooks/usePersistedState';
import type { EPData } from './EPShared';
import { EP_DEFAULTS } from './EPShared';
import { getActiveProyectoId } from '../../services/storageService';
import { loadEpDatos, saveEpDatos } from '../../services/epService';

/** Estado EP sincronizado con la BD (ep_datos_proyecto, 1:1 con el proyecto) — compartido por
 *  el diseño EP en Redes y el esquema solo-lectura en la sub-pestaña de Isometría, para que
 *  ambos vean/editen el MISMO dato. Hidratación al montar (gana sobre caché localStorage) y
 *  persistencia debounced (1200 ms) que no corre hasta terminar la hidratación. */
export function useEpSincronizado(): {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
} {
  const [ep, setEP] = usePersistedState<EPData>('ep', EP_DEFAULTS, (saved) => ({
    ...EP_DEFAULTS,
    ...(saved as Partial<EPData>),
  }));

  const hydratedRef = useRef(false);
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadEpDatos(proyectoId).then((d) => {
      if (cancelled) return;
      if (d) setEP({ ...EP_DEFAULTS, ...d });
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [setEP]);

  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydratedRef.current) return;
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveEpDatos(proyectoId, ep);
    }, 1200);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [ep]);

  const updEP = useCallback(
    (field: keyof EPData, val: EPData[keyof EPData]) => {
      setEP((prev) => ({ ...prev, [field]: val }));
    },
    [setEP],
  );

  return { ep, updEP };
}
