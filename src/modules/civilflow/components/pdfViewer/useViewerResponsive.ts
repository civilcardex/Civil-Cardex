import { useEffect, useState } from 'react';
import { useIsMobile, useMediaQuery } from '../../../../hooks/useMediaQuery';

// Estado responsive del visor en UN solo lugar: móvil <768 (modo consulta: sin toolbar de
// dibujo), angosto <1024 (colapsar sidebars SOLO al cruzar el breakpoint — un listener crudo
// de resize re-cerraba los paneles en cada resize, p. ej. el teclado del SO en tablet pisaba
// la re-expansión manual). Dentro de la franja el usuario puede re-abrir.

/** Estado de sidebars colapsadas + flags isMobile/isNarrow del visor. */
export function useViewerResponsive() {
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 1024);
  const [rightCollapsed, setRightCollapsed] = useState(() => window.innerWidth < 1024);
  const isMobile = useIsMobile();
  const isNarrow = useMediaQuery('(max-width: 1023px)');
  useEffect(() => {
    if (isNarrow) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [isNarrow]);
  return { isMobile, isNarrow, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed };
}
