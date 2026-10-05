import { useEffect, useRef } from 'react';

/** Mide el alto real de la fila 1 del thead y lo publica como --thead2-top en la tabla:
 *  el sticky de la fila 2 (tables.css, default 27px) queda EXACTO — el offset hardcodeado
 *  abre un hueco banda entre el título del grupo (colSpan) y sus subcolumnas cuando la
 *  fila 1 es más baja (paddings compactos) o más alta (wraps) que 27px. */
export function useStickyThead2Offset() {
  const ref = useRef<HTMLTableElement | null>(null);
  useEffect(() => {
    const table = ref.current;
    const tr1 = table?.querySelector('thead tr:first-child');
    if (!table || !tr1) return;
    const apply = () =>
      table.style.setProperty('--thead2-top', `${tr1.getBoundingClientRect().height}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(tr1);
    return () => ro.disconnect();
  }, []);
  return ref;
}
