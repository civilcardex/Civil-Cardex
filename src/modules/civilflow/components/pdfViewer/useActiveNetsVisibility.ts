// Redes visibles en el visor: resuelve qué pestañas de red se muestran combinando la prop
// `activeNetworks` (redes del proyecto) con el cache vivo de localStorage (ACTIVE_NETS_KEY,
// refrescado por eventos de cambio). Excluye equipos (ep/bom) de las pestañas; 'recolectora'
// se reporta aparte porque sus glifos se dibujan bajo la pestaña 'll'.
import { useState, useEffect, useMemo } from 'react';
import { NETS, type PlanoNet } from '../../lib/PlanoEngine/PlanoState';
import { ACTIVE_NETS_KEY, NETS_CHANGED_EVENT } from '../../constants/storage-keys';
import { loadFromStorage } from '../../services/storageService';

/** Redes visibles en el visor: combina la prop de redes activas con el caché de localStorage
 *  (refrescado por eventos) y expone las pestañas finales y si la red recolectora está activa. */
export function useActiveNetsVisibility(activeNetworks: Set<string>) {
  const [liveActiveNets, setLiveActiveNets] = useState<Set<string> | null>(() => {
    try {
      const saved = loadFromStorage(ACTIVE_NETS_KEY, null);
      if (saved && Array.isArray(saved)) return new Set(saved);
    } catch {
      /* ignore */
    }
    return null;
  });

  useEffect(() => {
    const refresh = () => {
      try {
        const saved = loadFromStorage(ACTIVE_NETS_KEY, null);
        setLiveActiveNets(saved && Array.isArray(saved) ? new Set(saved) : null);
      } catch {
        setLiveActiveNets(null);
      }
    };
    window.addEventListener(NETS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(NETS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const finalVisibleNets = useMemo(() => {
    const excludeEquipment = (nets: PlanoNet[]) =>
      nets.filter((n) => n.id !== 'ep' && n.id !== 'bom' && n.id !== 'recolectora');
    const getNets = () => {
      if (activeNetworks && activeNetworks.size > 0)
        return excludeEquipment(NETS.filter((n) => activeNetworks.has(n.id)));
      if (liveActiveNets) return excludeEquipment(NETS.filter((n) => liveActiveNets.has(n.id)));
      return excludeEquipment(NETS);
    };
    return getNets();
  }, [activeNetworks, liveActiveNets]);

  // Misma precedencia que finalVisibleNets arriba, pero para 'recolectora' específicamente — esa
  // red está excluida de la lista de pestañas visibles (los glifos de canal se dibujan bajo la
  // pestaña 'll', no en su propia pestaña), así que no se puede derivar de finalVisibleNets y
  // necesita su propia verificación.
  const recolectoraActive = useMemo(() => {
    if (activeNetworks && activeNetworks.size > 0) return activeNetworks.has('recolectora');
    if (liveActiveNets) return liveActiveNets.has('recolectora');
    return true;
  }, [activeNetworks, liveActiveNets]);

  return { liveActiveNets, finalVisibleNets, recolectoraActive };
}
