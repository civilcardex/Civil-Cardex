import { useEffect, useState } from 'react';
import { usePlans } from '../context/PlansContext';
import { useTramos } from '../context/TramosContext';
import { prefetchAllTrazos } from '../utils/prefetchTrazos';

/** Tope de espera del gate: si algo se cuelga (nube lenta, restore atascado), la entrada
 *  nunca queda bloqueada más de 10 s — mismo tope que el fallback del visor. */
const TOPE_ESPERA_MS = 10000;

/** Gate de carga GLOBAL del proyecto: `listo` cuando (1) los planos están restaurados
 *  (local IndexedDB + nube), (2) `prefetchAllTrazos` terminó — bajó los trazos que faltaban
 *  y re-escribió los blobs de sync — y (3) TramosContext recargó, así las tablas de diseño
 *  nacen con datos en el primer render. Lo consumen WorkAreaCivilFlowPage y ViewerPage. */
export function useProyectoCargado(): { listo: boolean } {
  const { plans, restoreDone, cloudRestoreDone } = usePlans();
  const { recargar } = useTramos();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (listo) return;
    let vivo = true;
    const tope = setTimeout(() => {
      if (vivo) setListo(true);
    }, TOPE_ESPERA_MS);
    if (!restoreDone || !cloudRestoreDone) {
      return () => {
        vivo = false;
        clearTimeout(tope);
      };
    }
    void prefetchAllTrazos(plans)
      .then(() => recargar())
      .then(() => {
        if (vivo) setListo(true);
      })
      .catch(() => {
        if (vivo) setListo(true);
      });
    return () => {
      vivo = false;
      clearTimeout(tope);
    };
  }, [listo, plans, restoreDone, cloudRestoreDone, recargar]);

  return { listo };
}
