import { useContext, useMemo } from 'react';
import { PLANS_META_KEY, TRAZOS_PREFIX } from '../../../constants/storage-keys';
import { loadFromStorage } from '../../../services/storageService';
import { RainwaterContext } from '../../../context/RainwaterContext';
import { buildLlBajanteAssociations } from '../../../utils/rainwaterRows';
import { chequeoBajanteLluvia } from '../../../utils/calcRainwater';
import type { DrawingData } from '../../../utils/drawingSync';

/** Forma mínima de un override manual de bajante ll (BajanteLL de RainwaterContext). */
interface BajanteLLManual {
  id: string;
  bajante: string;
  areaParcial: number;
  areaOtras: number;
  areaAcumulada: number;
  intensidad: number;
  coeficienteC: number;
}

/** Caudal (LPS) del ramal/bajante de aguas lluvias seleccionado en el panel del visor.
 *  Réplica del cálculo de la tabla Diseño de red lluvias: aporte de bajantes de TODOS los pisos
 *  (misma BFS de asociación, planes desde el meta), caudal manual del dibujo como precedencia y
 *  overrides manuales (Área Otras/intensidad/coef) del RainwaterContext cuando hay provider
 *  (el visor lo monta en ViewerPage; sin provider — tests — cae al cálculo del dibujo). */
export function useCaudalLl(
  selElement: { id?: string; tipo?: string } | null,
  activeNet: string,
  loadedPlanId?: string | number | null,
): number | null {
  // Hooks SIEMPRE antes de cualquier early return (reglas de hooks).
  const ctx = useContext(RainwaterContext);
  // I/O síncrona multi-piso memoizada: el cuerpo corre por render del editor (cada
  // keystroke del panel re-renderiza) — sin esto, parseaba los docs en cada una.
  return useMemo(
    () => caudalLlDe(selElement, activeNet, loadedPlanId, ctx?.bajantesLl ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inputs primitivos + identidad del array de overrides
    [selElement?.id, selElement?.tipo, activeNet, loadedPlanId, ctx?.bajantesLl],
  );
}

/** Cálculo puro (sin React), inyectable para tests. */
function caudalLlDe(
  selElement: { id?: string; tipo?: string } | null,
  activeNet: string,
  loadedPlanId?: string | number | null,
  overrides: BajanteLLManual[] = [],
): number | null {
  if (activeNet !== 'll' || !selElement?.id) return null;
  const planId = String(loadedPlanId ?? '');
  if (!planId) return null;

  const parseDoc = (raw: unknown): DrawingData | null => {
    if (!raw) return null;
    if (typeof raw !== 'string') return raw as DrawingData;
    try {
      return JSON.parse(raw) as DrawingData;
    } catch {
      return null;
    }
  };

  // Pisos conocidos (meta de plans); el propio piso cargado SIEMPRE participa aunque el
  // meta aún no lo refleje.
  const meta = loadFromStorage<Array<{ id: number; nivel: number | null }>>(PLANS_META_KEY, []);
  const planIds = Array.from(new Set([...meta.map((m) => String(m.id)), planId]));

  // Bajantes ll de TODOS los pisos (el drenaje es multi-piso: un bajante de otro piso puede
  // drenar al ramal seleccionado — antes solo se veía el doc cargado).
  const bajLl: Array<{
    b: DrawingData['bajantes'] extends (infer T)[] | undefined
      ? T & { area_m2?: number; caudal?: number }
      : never;
    planId: string;
  }> = [];
  const docs = new Map<string, DrawingData>();
  for (const pid of planIds) {
    const data = parseDoc(loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + pid, null));
    if (!data) continue;
    docs.set(pid, data);
    for (const b of data.bajantes || []) {
      if (b.net === 'll' && b.tipo === 'bajante')
        bajLl.push({
          b: b as never,
          planId: pid,
        });
    }
  }

  // Overrides manuales: clave = code del bajante.
  const manualByCode = new Map<string, BajanteLLManual>();
  for (const m of overrides) manualByCode.set(m.bajante || m.id, m);

  const qDe = (b: { id?: string; code?: string; area_m2?: number; caudal?: number }): number => {
    if (b.caudal != null && b.caudal > 0) return b.caudal;
    // Overrides manuales de la tabla (Área Otras / intensidad) vía RainwaterContext — el
    // visor lo monta (ViewerPage); sin provider (tests), cae al cálculo del dibujo.
    const manual = manualByCode.get(b.code || b.id || '');
    if (manual && ((manual.areaAcumulada ?? 0) > 0 || (manual.areaParcial ?? 0) > 0)) {
      return chequeoBajanteLluvia({
        areaAcumulada: manual.areaAcumulada || manual.areaParcial || 0,
        intensidad: manual.intensidad ?? 100,
        coeficienteC: manual.coeficienteC || 0.0278,
      }).Q;
    }
    return chequeoBajanteLluvia({
      areaAcumulada: b.area_m2 || 0,
      intensidad: 100,
      coeficienteC: 0.0278,
    }).Q;
  };

  // Caudal HEREDADO por asociación entre pisos: el puntero `origenId` del bajante inferior
  // apunta al superior que descarga en él ("planId|id") — recursivo con visited para
  // cadenas de 3+ pisos. El LD_<idSuperior> y el fantasma/anillo transportan este aporte.
  const heredadoDe = (pid: string, bajId: string, seen: Set<string>): number => {
    const b = (docs.get(pid)?.bajantes || []).find((x) => x.id === bajId) as
      | { origenId?: string }
      | undefined;
    const o = b?.origenId || '';
    if (!o.includes('|')) return 0;
    const [op, oid] = o.split('|');
    const k = `${op}|${oid}`;
    if (seen.has(k)) return 0;
    seen.add(k);
    const sup = bajLl.find((x) => x.planId === op && (x.b as { id?: string }).id === oid);
    if (!sup) return 0;
    return qDe(sup.b) + heredadoDe(op, oid, seen);
  };

  // FANTASMA (XFG_<idInferior>_<planAnfitrion>): NO vive en bajantes — resolver el bajante
  // FUENTE (targetBajanteId del ghost) y calcular sobre él. Sin esto el panel de fantasma
  // mostraba '—' el 100% de las veces.
  if (selElement.id.startsWith('XFG_')) {
    let ghost: { targetBajanteId?: string; sourcePlanId?: string } | undefined;
    for (const pid of planIds) {
      const ghosts = (docs.get(pid)?.crossFloorGhosts ?? []) as Array<{
        id?: string;
        targetBajanteId?: string;
        sourcePlanId?: string;
      }>;
      const g = ghosts.find((x) => x.id === selElement.id) as
        | { targetBajanteId?: string; sourcePlanId?: string }
        | undefined;
      if (g) {
        ghost = g;
        break;
      }
    }
    if (ghost?.targetBajanteId) {
      const supId = ghost.targetBajanteId;
      // El bajante fuente puede vivir en cualquier piso (el ghost espeja a través de pisos).
      const sup = bajLl.find((x) => (x.b as { id?: string }).id === supId);
      if (sup) {
        const spid = sup.planId;
        const seen = new Set([`${spid}|${supId}`]);
        const q = qDe(sup.b) + heredadoDe(spid, supId, seen);
        return q > 0 ? q : null;
      }
    }
    return null;
  }

  if (selElement.tipo === 'bajante') {
    const b = bajLl.find(
      (x) => x.planId === planId && (x.b as { id?: string }).id === selElement.id,
    );
    if (!b) return null;
    // Bajante inferior asociado: caudal PROPIO + lo que baja por la columna del superior.
    const seen = new Set([`${planId}|${selElement.id}`]);
    const q = qDe(b.b) + heredadoDe(planId, selElement.id, seen);
    return q > 0 ? q : null;
  }

  // Ldesvio (LD_<idSuperior>): transporta el caudal del bajante superior (más su propia
  // herencia si hay cadena) — sin sumar el aporte propio del inferior.
  if (selElement.id.startsWith('LD_')) {
    const supId = selElement.id.slice(3);
    // El LD vive en el piso INFERIOR y nombra al bajante del SUPERIOR: buscarlo en TODOS los
    // pisos (limitado al plan cargado nunca lo encontraba — panel en '—' siempre).
    const sup = bajLl.find((x) => (x.b as { id?: string }).id === supId);
    if (sup) {
      const spid = sup.planId;
      const seen = new Set([`${spid}|${supId}`]);
      const q = qDe(sup.b) + heredadoDe(spid, supId, seen);
      return q > 0 ? q : null;
    }
    return null;
  }

  // Ramal: asociaciones ramal→bajantes de TODOS los pisos (BFS compartida con la tabla).
  const miniTramos = bajLl.map(({ b, planId: pid }) => {
    const bb = b as { id?: string; code?: string };
    return { id: bb.id, code: bb.code || bb.id, _key: `${bb.id}-${pid}`, esBajante: true };
  });
  const assoc = buildLlBajanteAssociations(
    miniTramos as never,
    planIds.map((id) => ({ id: Number(id), nivel: 0 })) as never,
  );
  const codes = assoc[`${selElement.id}-${planId}`] || [];
  // Caudal manual del ramal en el dibujo manda (misma precedencia que la tabla).
  const ramal = (docs.get(planId)?.ramales || []).find(
    (r: { id?: string }) => r.id === selElement.id,
  ) as { caudal?: number } | undefined;
  if (ramal?.caudal != null && ramal.caudal > 0) return ramal.caudal;
  let q = 0;
  for (const code of codes) {
    const hit = bajLl.find(
      ({ b }) => ((b as { code?: string }).code || (b as { id?: string }).id) === code,
    );
    if (hit) q += qDe(hit.b);
  }
  return q > 0 ? q : null;
}
