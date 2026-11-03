/** Hook del bloque RCI (Red Contra Incendio) del Informe: carga el estado guardado en la BD
 *  (fuente de verdad del módulo — aquí no hay estado de diseño en vivo) UNA vez al montar y
 *  corre el motor en fresco, misma regla de "recalcular sin depender de visitar pantallas" de
 *  bom/ep. Ej: const rciInf = useRciInforme(hasRci) → rciInf.tabla va a la memoria de cálculo. */
import { useEffect, useMemo, useState } from 'react';
import { getActiveProyectoId } from '../../services/storageService.ts';
import { loadRciDatos } from '../../services/projectDataService.ts';
import { construirInformeRci, type RciInforme } from '../../utils/rci/rciReport.ts';
import type { RciState } from '../../lib/rci/index.ts';

/** Estado RCI + informe calculado; null = red inactiva, sin datos guardados o no calculable. */
export function useRciInforme(hasRci: boolean): RciInforme | null {
  const [estado, setEstado] = useState<RciState | null>(null);
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadRciDatos(proyectoId).then((d) => {
      if (!cancelled) setEstado(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(() => (hasRci && estado ? construirInformeRci(estado) : null), [hasRci, estado]);
}
