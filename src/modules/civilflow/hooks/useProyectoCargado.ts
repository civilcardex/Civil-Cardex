import { useEffect, useState } from 'react';
import { usePlans } from '../context/PlansContext.tsx';
import { useTramos } from '../context/TramosContext.tsx';
import { prefetchAllTrazos } from '../utils/prefetchTrazos.ts';

/** Tope de espera del gate: si algo se cuelga (nube lenta, restore atascado), la entrada
 *  nunca queda bloqueada más de 10 s — mismo tope que el fallback del visor. */
const TOPE_ESPERA_MS = 10000;

/** Espera a que el proyecto esté listo antes de mostrar tablas (planos + trazos + tramos). Si la nube se cuelga, entra igual a los 10 s. Ej: WorkArea y Visor lo usan. */
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
