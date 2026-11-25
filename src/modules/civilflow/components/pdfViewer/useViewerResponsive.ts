/** Modo consulta bajo 744 px (solo teléfono): bajo ese ancho los paneles laterales nacen
 *  colapsados. Las TABLETS (≥744) se comportan como PC — cintas expandidas con TODOS sus
 *  desplegables (antes el umbral 1024 las colapsaba con inert y faltaban los desplegables,
 *  ped. usuario 2025-11-25). Dentro de la franja el usuario puede colapsar a mano. */
import { useEffect, useState } from 'react';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.ts';

/** Estado de sidebars colapsadas + flags isMobile/isNarrow del visor. */
export function useViewerResponsive() {
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 744);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 744);
  const isMobile = useMediaQuery('(width < 744px)');
  const isNarrow = useMediaQuery('(max-width: 743px)');
  useEffect(() => {
    if (isNarrow) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [isNarrow]);
  return { isMobile, isNarrow, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed };
}
