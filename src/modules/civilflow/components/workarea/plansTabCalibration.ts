import { devError, devLog } from '../../../../utils/devError.ts';
import { rebasarEscalaTrazos, type PlanoWorkData } from '../../lib/PlanoEngine/PlanoPersistence.ts';
import { pxToM, VERSION_LAMINA_BASE } from '../../lib/PlanoEngine/planoCoords.ts';
/** Subconjunto de PlanItem que la derivación necesita (PlanItem del context lo satisface). */
export interface PlanCalibFuente {
  id: number;
  origen?: { x_px: number; y_px: number } | null;
  scale?: number;
  factorX?: number | null;
  factorY?: number | null;
  calGlobal?: boolean | null;
  definedScale?: number | null;
  status?: string;
}

/** Forma EXACTA de la entrada de calData de PlanosTab (números o null — el configurador
 *  trabaja con strings en sus inputs y normaliza al guardar). */
export interface CalibrationData {
  origen: { x_px: number; y_px: number } | null;
  scaleM: number | null;
  factorX: number | null;
  factorY: number | null;
  calGlobal: boolean | null;
  definedScale?: number | null;
  planId?: number;
}

/** Deriva la entrada de calData de UN plan desde su meta (misma regla para initializer y
 *  siembra tardía — antes estaba duplicada y divergía). */
export function calDataDePlan(p: PlanCalibFuente): CalibrationData {
  const sm = p.scale! / 100;
  return {
    origen: p.origen ?? null,
    scaleM: sm,
    factorX: p.factorX !== undefined && p.factorX !== null ? p.factorX : sm,
    factorY: p.factorY !== undefined && p.factorY !== null ? p.factorY : sm,
    calGlobal: p.calGlobal !== undefined && p.calGlobal !== null ? p.calGlobal : null,
    definedScale: p.definedScale !== undefined && p.definedScale !== null ? p.definedScale : sm,
  };
}

/** Purga huérfanos + siembra calibraciones llegadas con plans (el initializer corre una vez y
 *  en remount plans suele llegar vacío). Las entradas existentes del usuario NO se tocan. */
export function seedCalData(
  prev: Record<number, CalibrationData>,
  plans: PlanCalibFuente[],
): { next: Record<number, CalibrationData>; changed: boolean } {
  const liveIds = new Set(plans.map((p) => p.id));
  const next: Record<number, CalibrationData> = {};
  let changed = false;
  for (const [idStr, cd] of Object.entries(prev)) {
    const id = Number(idStr);
    if (liveIds.has(id)) next[id] = cd;
    else changed = true;
  }
  for (const p of plans) {
    if (!p.origen || !p.scale) continue;
    if (next[p.id]) continue;
    next[p.id] = calDataDePlan(p);
    changed = true;
  }
  return { next, changed };
}

/** Primera calibración con alcance "Todos": aplica a todo piso futuro como alternativa de un
 *  clic a CALIBRAR (debe seguir viva en la lista actual de plans). */
export function computeGlobalCal(
  calData: Record<number, CalibrationData>,
  plans: PlanCalibFuente[],
): CalibrationData | null {
  return (
    Object.values(calData).find(
      (cd) =>
        cd.calGlobal === true && cd.origen && cd.scaleM && plans.some((p) => calData[p.id] === cd),
    ) || null
  );
}

/** Láminas confirmadas que comparten el MISMO origen px con otra (herencia vieja de orígenes
 *  clonados): claves "x|y" repetidas, para el badge que guía a re-marcar el origen. */
export function computeOrigenesCompartidos(plans: PlanCalibFuente[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of plans) {
    if (p.status !== 'confirmed' || !p.origen) continue;
    const k = `${p.origen.x_px}|${p.origen.y_px}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}

/** Calibración lista para estampar en un plano: origen px, scaleM (escala metros por pixel)
 *  promedio y sus factores X/Y. Ej: { planId: 7, origen: {x_px: 300, y_px: 120}, scaleM: 0.02 }. */
export interface ConfigCalibracion {
  planId: number;
  origen: { x_px: number; y_px: number } | null;
  scaleM: number;
  factorX: number;
  factorY: number;
  definedScale: number;
}

/** Estampa la calibración sobre UN doc de trazos (mutación pura, sin IO): origen, factores, escala exacta y — si el doc reclamaba OTRA escala
 * — re-base de su geometría anclado al propio origen del stamp. */
export function stampCalibracion(config: ConfigCalibracion, doc: Record<string, unknown>): void {
  doc.origen = config.origen;
  const escalaPrev = typeof doc.scaleM === 'number' ? doc.scaleM : null;
  devLog(
    `[CF-COTA] stamp calibración ${config.planId} escalaPrev=${escalaPrev} → ${config.scaleM} dims=${JSON.stringify(
      ((doc.dims as Array<Record<string, number>>) || []).map(
        (d) => `${d.id}(${d.x1},${d.y1}→${d.x2},${d.y2})L${d.L}`,
      ),
    )}`,
  );
  if (config.scaleM) {
    if (typeof doc.v === 'number' && doc.v >= VERSION_LAMINA_BASE && escalaPrev !== config.scaleM) {
      // En el formato nuevo el fondo no cambia de tamaño al recalibrar.
      const trabajo = doc as unknown as PlanoWorkData;
      for (const c of (trabajo.dims ?? []) as Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        L: number;
      }>) {
        c.L = pxToM(config.scaleM, Math.hypot(c.x2 - c.x1, c.y2 - c.y1));
      }
      for (const r of (trabajo.ramales ?? []) as Array<{ pts: number[][]; totalL: number }>) {
        let total = 0;
        for (let i = 1; i < r.pts.length; i++) {
          total += pxToM(
            config.scaleM,
            Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]),
          );
        }
        r.totalL = +total.toFixed(3);
      }
      doc.scaleM = config.scaleM;
    } else if (escalaPrev && Math.abs(escalaPrev - config.scaleM) > 1e-9) {
      try {
        // Re-base anclado al origen de la propia lámina (px−origen constante = posición
        // física preservada; ver rebasarEscalaTrazos).
        rebasarEscalaTrazos(doc as unknown as PlanoWorkData, config.scaleM, config.origen);
      } catch (e) {
        devError('rebase en guardado de calibración:', e);
        doc.scaleM = config.scaleM;
      }
    } else {
      doc.scaleM = config.scaleM;
    }
  }
  doc.factorX = config.factorX;
  doc.factorY = config.factorY;
  doc.definedScaleM = config.definedScale;
  doc.ts = Date.now();
}
