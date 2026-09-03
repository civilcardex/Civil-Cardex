// Resolvedores de asociaciones entre pisos para el bajante/montante seleccionado:
//  - lowerFloorsRamales: lista de bajantes reales en los pisos IGUALES O INFERIORES (selector
//    "Destino" — hacia dónde descarga).
//  - upperFloorGroup: el ÚNICO piso inmediatamente superior (selector "Origen" — de dónde
//    recibe). Una bajante solo recibe del montante directamente encima.
// Cada piso se resuelve síncronamente (motor vivo para el actual, localStorage para el resto)
// y los pisos sin caché local caen a BD asíncronamente, fusionando cada resultado por separado.
import { useState, useEffect } from 'react';
import { loadFromStorage, loadTrazosFromDB } from '../../services/storageService';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante } from '../../lib/PlanoEngine/PlanoState';
import type { Piso } from '../../lib/shared/projectTypes';
import type { PlanItem } from '../../context/PlansContext';
import type { LowerFloorRamales } from './drawingElementContextMenu/context';

interface UseFloorRamalesParams {
  selElement: { tipo?: string; net?: string } | null;
  selectedNivel: number | null;
  pisos: Piso[];
  plans: PlanItem[];
  activeNet: string;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  currentIdRef: React.RefObject<string | number | null | undefined>;
}

// Solo bajantes/montantes reales que atraviesan pisos entran en los selectores —
// contador/calentador/red_publica son aparatos puntuales, no líneas troncales.
const isRiser = (b: PlanoBajante) =>
  b.tipo !== 'contador' && b.tipo !== 'calentador' && b.tipo !== 'red_publica';

/** Asociaciones entre pisos del bajante/montante seleccionado: lista de pisos iguales o
 *  inferiores (selector Destino) y el piso inmediatamente superior (selector Origen), leyendo
 *  del motor vivo, localStorage y BD con fallback por piso. */
export function useFloorRamales({
  selElement,
  selectedNivel,
  pisos,
  plans,
  activeNet,
  engineRef,
  currentIdRef,
}: UseFloorRamalesParams) {
  const [lowerFloorsRamales, setLowerFloorsRamales] = useState<LowerFloorRamales[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!selElement || !(selElement.tipo === 'bajante' || selElement.tipo === 'montante')) {
      setLowerFloorsRamales([]);
      return;
    }
    // Forzar a String, igual que la búsqueda de coincidencia con planos más abajo — selectedNivel
    // y piso.n no siempre coinciden en número-vs-string, y un === estricto fallido aquí dejaba
    // currentFloor en undefined (cayendo a Infinity): inofensivo por sí solo, pero inconsistente
    // con la OTRA búsqueda de esta función que sí resuelve, haciendo que la lista de pisos del
    // dropdown alternara entre correcta y vacía según qué comparación acertara esa vez.
    const currentFloor = pisos.find((p) => String(p.n) === String(selectedNivel));
    // Coerción con Number() — npt está tipado number|string (LevelsCard guarda un string a
    // mitad de edición) y un proyecto antiguo puede tener npt serializado como string; un <=
    // entre dos strings es lexicográfico ("9.00" > "30.00") y descartaba silenciosamente de la
    // lista pisos realmente más bajos.
    const currentNpt = currentFloor ? Number(currentFloor.npt) : Infinity;
    const relevantPlans = plans.filter((plan) => {
      const pF = pisos.find((p) => String(p.n) === String(plan.nivel));
      return pF && Number(pF.npt) <= currentNpt;
    });

    // Resolver cada plan SINCRÓNICAMENTE primero (motor vivo para el piso actual, localStorage
    // para el resto) y mostrarlo de inmediato — el dropdown nunca debe quedarse vacío solo porque
    // una consulta lenta a la BD aún no resolvió. Solo los planes sin nada cacheado en local
    // reciben fallback asíncrono a BD, fusionado conforme cada uno resuelve individualmente (sin
    // esperar un solo Promise.all) para que una re-ejecución posterior del efecto (al seleccionar
    // otro elemento) solo cancele SUS propias peticiones pendientes y no descarte el resultado
    // síncrono ya correcto de cada plan.
    const syncResults = relevantPlans.map((plan) => {
      const pF = pisos.find((p) => String(p.n) === String(plan.nivel))!;
      let bajantes: PlanoBajante[] = [];
      let needsDbFallback = false;
      if (plan.id === currentIdRef.current) {
        bajantes =
          engineRef.current?.bajantes?.filter(
            (b) => b.net === (selElement.net || activeNet) && isRiser(b),
          ) || [];
      } else {
        // Debe pasar por el mismo accessor con prefijo civilflow_ que usa todo lo demás
        // (saveToStorage/loadFromStorage de storageService.ts) — un localStorage.getItem crudo
        // aquí perdía ese prefijo por completo, leía siempre una clave que nadie escribía y caía
        // silenciosamente a la consulta de BD de abajo en cada llamada.
        const data = loadFromStorage<{ bajantes?: PlanoBajante[] } | null>(
          TRAZOS_PREFIX + plan.id,
          null,
        );
        needsDbFallback = !data?.bajantes?.length;
        bajantes = (data?.bajantes || []).filter(
          (b: PlanoBajante) => b.net === (selElement.net || activeNet) && isRiser(b),
        );
      }
      return {
        planId: plan.id,
        planName: plan.name,
        npt: pF.npt,
        bajantes,
        needsDbFallback,
        isCurrent: plan.id === currentIdRef.current,
      };
    });
    syncResults.sort((a, b) => Number(b.npt) - Number(a.npt));
    setLowerFloorsRamales(syncResults.map(({ needsDbFallback: _n, ...rest }) => rest));

    // El almacenamiento local solo tiene lo que este navegador cargó/guardó de este piso — un
    // piso editado en otro dispositivo, o antes de limpiar la caché local, aún no tiene nada
    // aquí aunque sus bajantes sí existan en la nube. Recurrir a la BD igual que loadTrazosForPlan
    // hace con el plan cargado, por cada plan que lo necesite, fusionando cada resultado conforme
    // resuelve en vez de bloquear toda la lista por el más lento.
    for (const plan of relevantPlans) {
      const sync = syncResults.find((r) => r.planId === plan.id);
      if (!sync?.needsDbFallback) continue;
      (async () => {
        try {
          const dbData = await loadTrazosFromDB(String(plan.id));
          if (cancelled || !dbData) return;
          const data =
            typeof dbData === 'string'
              ? JSON.parse(dbData)
              : (dbData as { bajantes?: PlanoBajante[] });
          const bajantes = (data?.bajantes || []).filter(
            (b: PlanoBajante) => b.net === (selElement.net || activeNet) && isRiser(b),
          );
          if (bajantes.length === 0) return;
          setLowerFloorsRamales((prev) =>
            prev.map((r) => (r.planId === plan.id ? { ...r, bajantes } : r)),
          );
        } catch {
          /* ignore */
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [selElement, selectedNivel, pisos, plans, activeNet, engineRef, currentIdRef]);

  // Espejo del efecto lowerFloorsRamales de arriba, pero para el selector "Origen" — solo el
  // ÚNICO piso inmediatamente superior (menor npt estrictamente mayor al actual), no todos los
  // pisos de arriba. Una bajante solo recibe del montante que está directamente encima.
  const [upperFloorGroup, setUpperFloorGroup] = useState<LowerFloorRamales | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!selElement || !(selElement.tipo === 'bajante' || selElement.tipo === 'montante')) {
      setUpperFloorGroup(null);
      return;
    }
    const currentFloor = pisos.find((p) => String(p.n) === String(selectedNivel));
    const currentNpt = currentFloor ? Number(currentFloor.npt) : -Infinity;

    let best: { plan: PlanItem; npt: number } | null = null;
    for (const plan of plans) {
      const pF = pisos.find((p) => String(p.n) === String(plan.nivel));
      if (!pF) continue;
      const npt = Number(pF.npt);
      if (!(npt > currentNpt)) continue;
      if (!best || npt < best.npt) best = { plan, npt };
    }
    if (!best) {
      setUpperFloorGroup(null);
      return;
    }
    const { plan, npt } = best;
    let bajantes: PlanoBajante[] = [];
    let needsDbFallback = false;
    if (plan.id === currentIdRef.current) {
      bajantes =
        engineRef.current?.bajantes?.filter(
          (b) => b.net === (selElement.net || activeNet) && isRiser(b),
        ) || [];
    } else {
      const data = loadFromStorage<{ bajantes?: PlanoBajante[] } | null>(
        TRAZOS_PREFIX + plan.id,
        null,
      );
      needsDbFallback = !data?.bajantes?.length;
      bajantes = (data?.bajantes || []).filter(
        (b: PlanoBajante) => b.net === (selElement.net || activeNet) && isRiser(b),
      );
    }
    setUpperFloorGroup({
      planId: plan.id,
      planName: plan.name,
      npt,
      bajantes,
      isCurrent: plan.id === currentIdRef.current,
    });

    if (needsDbFallback) {
      (async () => {
        try {
          const dbData = await loadTrazosFromDB(String(plan.id));
          if (cancelled || !dbData) return;
          const data =
            typeof dbData === 'string'
              ? JSON.parse(dbData)
              : (dbData as { bajantes?: PlanoBajante[] });
          const bj = (data?.bajantes || []).filter(
            (b: PlanoBajante) => b.net === (selElement.net || activeNet) && isRiser(b),
          );
          if (bj.length === 0) return;
          setUpperFloorGroup((prev) =>
            prev && prev.planId === plan.id ? { ...prev, bajantes: bj } : prev,
          );
        } catch {
          /* ignore */
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [selElement, selectedNivel, pisos, plans, activeNet, engineRef, currentIdRef]);

  return { lowerFloorsRamales, upperFloorGroup };
}
