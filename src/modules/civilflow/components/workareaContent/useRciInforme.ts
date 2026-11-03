/** Hook del bloque RCI (Red Contra Incendio) del Informe: re-extrae la geometría GRIS del
 *  dibujo EN FRESCO (extraerGris sobre los trazos rci de cada piso confirmado — los mismos
 *  docs de localStorage que lee RciDesign) y mezcla encima lo AMARILLO digitado guardado en
 *  BD (mezclarOverrides sobre el blob de loadRciDatos). El blob SOLO aporta overrides, jamás
 *  la geometría: si el usuario edita el plano sin abrir la pestaña RCI (que re-extrae y
 *  guarda con debounce 600ms), la memoria sale con el dibujo de HOY y no con el guardado
 *  viejo. Misma regla de "recalcular sin depender de visitar pantallas" de bom/ep, ahora
 *  cierta de verdad. Ej: const rciInf = useRciInforme(hasRci) → rciInf.tabla va a la memoria. */
import { useEffect, useMemo, useState } from 'react';
import { getActiveProyectoId, loadFromStorage } from '../../services/storageService.ts';
import { loadRciDatos } from '../../services/projectDataService.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { pisoLbl } from '../../constants/index.ts';
import { usePlans } from '../../context/PlansContext.tsx';
import { useProject } from '../../context/ProjectContext.tsx';
import { extraerGris, mezclarOverrides } from '../../utils/rci/extract.ts';
import type { PisoRciFuente } from '../../utils/rci/extract.ts';
import { TECHO_DEF } from '../../utils/rci/extractRed.ts';
import { num } from '../../lib/rci/index.ts';
import { sembrarRci } from '../../utils/rci/rowsModel.ts';
import { construirInformeRci, type RciInforme } from '../../utils/rci/rciReport.ts';
import type { RciState } from '../../lib/rci/index.ts';
import type { DrawingData } from '../../utils/drawingSyncTypes.ts';
import type { Piso } from '../../lib/shared/projectTypes.ts';

/** Estado RCI + informe calculado; null = red inactiva, sin datos guardados o no calculable. */
export function useRciInforme(hasRci: boolean): RciInforme | null {
  const { plans } = usePlans();
  const { pisos, proy } = useProject();
  const [estado, setEstado] = useState<RciState | null>(null);

  /** Fuentes por plano confirmado (misma construcción de RciDesign: label/NPT del piso del
   *  proyecto + doc de trazos del storage) — una sola verdad para extraer, sin duplicar. */
  const fuentes = useMemo<PisoRciFuente[]>(() => {
    const pisoPorNivel = new Map<string, Piso>();
    for (const p of pisos) pisoPorNivel.set(String(p.n), p);
    const out: PisoRciFuente[] = [];
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      const piso = pisoPorNivel.get(String(plano.nivel));
      const doc = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
      out.push({
        planId: String(plano.id),
        label: piso ? pisoLbl(piso.n) : plano.name,
        npt: Number(piso?.npt) || 0,
        doc,
      });
    }
    return out;
  }, [plans, pisos]);

  /** Geometría del dibujo de HOY (la parte gris del estado). El techo de la tipología
   *  (clas.htecho) alimenta zRam/bajada — mismo número que RciDesign, para que el desglose
   *  del informe no discrepe de la pantalla con el default 5.30. */
  const techoGris = useMemo(() => num(estado?.clas?.htecho) || TECHO_DEF, [estado]);
  const gris = useMemo(() => extraerGris(fuentes, { techo: techoGris }), [fuentes, techoGris]);

  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadRciDatos(proyectoId).then((prev) => {
      if (cancelled) return;
      // El blob guardado entra SOLO como overrides (lo digitado sobrevive por id estable):
      // la geometría manda la extracción fresca, nunca el blob viejo.
      const est = sembrarRci(mezclarOverrides(gris, prev).estado, proy.nombre);
      setEstado(est);
    });
    return () => {
      cancelled = true;
    };
  }, [gris, proy.nombre]);

  return useMemo(() => (hasRci && estado ? construirInformeRci(estado) : null), [hasRci, estado]);
}
