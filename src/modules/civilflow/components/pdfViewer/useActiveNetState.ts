/**
 * Red activa del visor: init lazy (redes activas del proyecto → storage → 'af' default) y
 * sincronía cuando el proyecto cambia las redes visibles. Extraído verbatim de PdfViewer.
 * Ej: proyecto solo con san/vent arranca con 'san', no con la default 'af'.
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { loadFromStorage } from '../../services/storageService.ts';
import { ACTIVE_NETS_KEY } from '../../constants/storage-keys.ts';

export function useActiveNetState(
  activeNetworks: Set<string>,
): [string, Dispatch<SetStateAction<string>>] {
  const [activeNet, setActiveNet] = useState(() => {
    if (activeNetworks && activeNetworks.size > 0) {
      if (activeNetworks.has('af')) return 'af';
      return Array.from(activeNetworks)[0];
    }
    try {
      const parsed = loadFromStorage<string[] | null>(ACTIVE_NETS_KEY, null);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((id) => id !== 'ep' && id !== 'bom');
        if (valid.length > 0) {
          if (parsed.includes('af')) return 'af';
          return valid[0];
        }
      }
    } catch {
      /* sin storage legible: default */
    }
    return 'af';
  });

  useEffect(() => {
    if (activeNetworks && activeNetworks.size > 0 && !activeNetworks.has(activeNet)) {
      setActiveNet(Array.from(activeNetworks)[0]);
    }
  }, [activeNetworks, activeNet]);

  return [activeNet, setActiveNet];
}
