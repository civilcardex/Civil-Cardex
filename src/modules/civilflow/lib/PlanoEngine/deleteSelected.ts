import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from './PlanoState';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';
import {
  removeCrossFloorGhostsBySource,
  removeCrossFloorGhost,
  removeCrossFloorLdesvioRamal,
  isLdesvioRamalId,
} from '../../utils/associateBajanteAcrossFloors';
import { clearBajanteAssociation } from '../../utils/bajanteAssociation';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { HYDRO_DATA_STORAGE_KEY } from '../../constants/storage-keys';
import { calculateRamalLength } from './ramalMeasure';
import { _midpoint } from './PlanoEngineDrawing';
import { _firstSegmentAngle, angleAtHalfLength } from './drawingAngles';

/**
 * Borrado con cascada: elimina selección, limpia ghosts/Ldesvíos entre pisos,
 * recalcula longitudes y renumera. Usado por `PlanoEngine.deleteSelected()`.
 */

interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

// La barra lateral de Aparatos (FixturesPanel.tsx/AccesoriosSection) lleva su propio conteo de
// cada glifo de tee como "accesorio" asignado al ramal huésped (HYDRO_DATA_STORAGE_KEY, llave
// `${net}_${ramalId}_${planId}`) — limpiar el campo del glifo en el objeto del ramal no toca ese
// conteo, así que la barra seguía mostrando la tee como asignada después de que el símbolo
// desapareciera visualmente. Se decrementa a la par.
function decrementAccesorioCount(
  engine: IPlanoEngineCore,
  hostR: { id: string; net: string },
  accType: string,
): void {
  const planId = engine._loadedPlanId;
  if (planId == null) return;
  const storageKey = `${hostR.net}_${hostR.id}_${planId}`;
  const map = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {});
  const entry = map[storageKey];
  if (!entry?.accesorios?.[accType]) return;
  const next = entry.accesorios[accType] - 1;
  const nextAcc = { ...entry.accesorios };
  if (next <= 0) delete nextAcc[accType];
  else nextAcc[accType] = next;
  map[storageKey] = { ...entry, accesorios: nextAcc };
  saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
}

// Un bajante/montante conectado a otro piso por "Origen"/"Destino" es el mismo tubo físico que
// continúa allá — borrar el símbolo de un lado y dejar el otro (apuntando a un id que ya no
// existe) no tiene sentido, así que borrar cualquiera de los dos extremos borra también el otro,
// dondequiera que viva su piso. Aplica tanto a bajante como a montante.
function cascadeMontanteAssociation(engine: IPlanoEngineCore, deleted: PlanoBajante): void {
  if (deleted.tipo !== 'montante' && deleted.tipo !== 'bajante') return;
  const thisPlanId = String(engine._loadedPlanId ?? '');

  if (deleted.descargaEnId) {
    const [targetPlanId, targetBajanteId] = deleted.descargaEnId.includes('|')
      ? deleted.descargaEnId.split('|')
      : [thisPlanId, deleted.descargaEnId];
    if (targetPlanId && targetBajanteId) {
      removeCrossFloorGhost(targetPlanId, thisPlanId, deleted.id);
      removeCrossFloorLdesvioRamal(thisPlanId, deleted.id);
      if (targetPlanId === thisPlanId) {
        const t = engine.bajantes.find((b) => b.id === targetBajanteId);
        if (t) t.origenId = null;
      } else {
        // No borrar el bajante del otro piso, solo limpiar su asociación y fantasma 2/4
        removeCrossFloorGhost(targetPlanId, thisPlanId, deleted.id);
        // limpiar origenId del bajante destino en storage sin borrarlo
        try {
          const key = `trazos_${targetPlanId}`;
          const raw = loadFromStorage<unknown>(key, null) as {
            bajantes?: { id: string; origenId?: string | null }[];
          } | null;
          if (raw?.bajantes) {
            let changed = false;
            for (const b of raw.bajantes) {
              if (b.id === targetBajanteId && b.origenId) {
                b.origenId = null;
                changed = true;
              }
            }
            if (changed) {
              saveToStorage(key, raw);
            }
          }
        } catch {
          /* storage cleanup not critical */
        }
      }
    }
  }

  if (deleted.origenId) {
    const [originPlanId, originBajanteId] = deleted.origenId.includes('|')
      ? deleted.origenId.split('|')
      : [thisPlanId, deleted.origenId];
    if (originPlanId && originBajanteId) {
      removeCrossFloorGhost(thisPlanId, originPlanId, originBajanteId);
      removeCrossFloorLdesvioRamal(originPlanId, originBajanteId);
      if (originPlanId === thisPlanId) {
        const o = engine.bajantes.find((b) => b.id === originBajanteId);
        if (o) o.descargaEnId = null;
      } else {
        // No borrar el bajante del otro piso, solo limpiar su asociación
        removeCrossFloorGhost(originPlanId, thisPlanId, deleted.id);
        try {
          const key = `trazos_${originPlanId}`;
          const raw = loadFromStorage<unknown>(key, null) as {
            bajantes?: {
              id: string;
              descargaEnId?: string | null;
              desplazamientos?: Record<string, unknown>;
              ghostData?: Record<string, unknown>;
            }[];
          } | null;
          if (raw?.bajantes) {
            let changed = false;
            for (const b of raw.bajantes) {
              if (b.id === originBajanteId && b.descargaEnId) {
                b.descargaEnId = null;
                changed = true;
              }
              // limpiar desplazamiento 2/4 del origen si apuntaba a este Ldesvio
              if (b.desplazamientos) {
                for (const lvl of Object.keys(b.desplazamientos)) {
                  if (
                    (b.desplazamientos[lvl] as { Ldesvio?: string })?.Ldesvio ===
                    `LD_${originBajanteId}`
                  ) {
                    delete (b.desplazamientos as Record<string, unknown>)[lvl];
                    if (b.ghostData) delete (b.ghostData as Record<string, unknown>)[lvl];
                    changed = true;
                  }
                }
              }
            }
            if (changed) {
              saveToStorage(key, raw);
            }
          }
        } catch {
          /* storage cleanup not critical */
        }
      }
    }
  }
}

const TEE_TYPES = [
  'teeDirecto',
  'teeSube',
  'teeBaja',
  'te_linea',
  'te_ramal',
  'teeReduccion',
  'teeLado',
];

// Un marcador de tee (accesorioInicio/Fin o accMed) en una unión sobrevive al ramal que formó
// esa unión — borrar la OTRA rama de una T/Y dejaba el glifo/conteo de tee del ramal restante
// colgado, sin nada conectado de verdad. Esto lo limpia, pero solo cuando el punto YA NO es una
// unión tee genuina. Contar solo "otro ramal toca este punto" estaba mal en ambos sentidos: las
// dos mitades de un tronco dividido (la existente + el tramo posterior creado automáticamente,
// ligadas por mergesFrom) siempre se tocan en la unión y habrían bloqueado la limpieza de una
// tee cuya rama se borró, mientras que una continuación simple extremo-con-extremo (o un codo
// formado por dos ramales sobrevivientes) seguiría contando como "conectado" y conservaría un
// glifo que ya no significa nada. Por eso la decisión es geométrica: se agrupan los ramales
// sobrevivientes del punto por dirección de línea, y se conserva la tee solo cuando todavía
// existe una relación de rama real — un ramal que continúa la línea del huésped junto con al
// menos un ramal que sale en ángulo, o un par pasante no colineal (huésped como rama), o un
// bajante/montante en el punto.
function junctionArmsAt(
  engine: IPlanoEngineCore,
  hostR: { id: string; pts: number[][]; mergesFrom?: string[] },
  pt: number[],
): {
  bajanteTouching: boolean;
  hasCollinearWithHost: boolean;
  hasNonCollinear: boolean;
  hasNonCollinearPair: boolean;
} {
  const TOL = 0.5;
  const DOT_TOL = 0.9;
  const norm = (v: number[]) => {
    const l = Math.hypot(v[0], v[1]);
    return l < 1e-6 ? null : ([v[0] / l, v[1] / l] as number[]);
  };
  const dirAt = (pts: number[][], p: number[]): number[] | null => {
    if (!pts || pts.length < 2) return null;
    const li = pts.length - 1;
    if (Math.hypot(pts[0][0] - p[0], pts[0][1] - p[1]) < TOL)
      return norm([pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]);
    if (Math.hypot(pts[li][0] - p[0], pts[li][1] - p[1]) < TOL)
      return norm([pts[li - 1][0] - pts[li][0], pts[li - 1][1] - pts[li][1]]);
    return null;
  };
  const hostLine = dirAt(hostR.pts, pt);
  const groups: number[][] = [];
  const sameLine = (a: number[], b: number[]) => Math.abs(a[0] * b[0] + a[1] * b[1]) >= DOT_TOL;
  let bajanteTouching = false;
  for (const b of engine.bajantes) {
    if (Math.hypot(b.x - pt[0], b.y - pt[1]) < TOL) {
      bajanteTouching = true;
      break;
    }
  }
  for (const other of engine.ramales) {
    if (other.id === hostR.id) continue;
    const d = dirAt(other.pts, pt);
    if (!d) continue;
    let found = -1;
    for (let i = 0; i < groups.length; i++) {
      if (sameLine(groups[i], d)) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      // ya hay un grupo con esa dirección — conservar la primera dirección representativa
    } else {
      groups.push(d);
    }
  }
  let hasCollinearWithHost = false;
  let hasNonCollinear = false;
  let hasNonCollinearPair = false;
  const dirAtMemberCount = (dir: number[]) => {
    let n = 0;
    for (const other of engine.ramales) {
      if (other.id === hostR.id) continue;
      const d = dirAt(other.pts, pt);
      if (d && sameLine(dir, d)) n++;
    }
    return n;
  };
  for (const g of groups) {
    const members = dirAtMemberCount(g);
    const coll = hostLine ? sameLine(g, hostLine) : false;
    if (coll) hasCollinearWithHost = true;
    else {
      hasNonCollinear = true;
      if (members >= 2) hasNonCollinearPair = true;
    }
  }
  return { bajanteTouching, hasCollinearWithHost, hasNonCollinear, hasNonCollinearPair };
}

function cleanupTeeMarkersAt(engine: IPlanoEngineCore, pt: number[]): void {
  const TOL = 0.5;
  for (const hostR of engine.ramales) {
    if (!hostR.pts?.length) continue;
    const arms = junctionArmsAt(engine, hostR, pt);
    // Marcador de EXTREMO (accesorioInicio/Fin): el huésped termina EN el punto, así que una tee
    // exige un paso real — la línea del huésped continuada por un sobreviviente colineal MÁS un
    // ramal que sale en ángulo, o un par de sobrevivientes no colineal (el huésped mismo es la
    // rama), o un bajante/montante en el punto. Un codo suelto (un solo sobreviviente, en
    // ángulo) NO es una tee.
    const keepEndpoint =
      arms.bajanteTouching ||
      (arms.hasCollinearWithHost && arms.hasNonCollinear) ||
      arms.hasNonCollinearPair;
    // Marcador INTERIOR (accMed): el huésped pasa POR el punto, así que cualquier ramal que sale
    // en ángulo (o un bajante/montante) conserva la tee; solo una continuación colineal sola es
    // un paso recto simple.
    const keepInterior = arms.bajanteTouching || arms.hasNonCollinear;

    if (
      hostR.accesorioInicio &&
      TEE_TYPES.includes(hostR.accesorioInicio) &&
      Math.hypot(hostR.pts[0][0] - pt[0], hostR.pts[0][1] - pt[1]) < TOL &&
      !keepEndpoint
    ) {
      decrementAccesorioCount(engine, hostR, hostR.accesorioInicio);
      hostR.accesorioInicio = '';
    }
    const li = hostR.pts.length - 1;
    if (
      hostR.accesorioFin &&
      TEE_TYPES.includes(hostR.accesorioFin) &&
      Math.hypot(hostR.pts[li][0] - pt[0], hostR.pts[li][1] - pt[1]) < TOL &&
      !keepEndpoint
    ) {
      decrementAccesorioCount(engine, hostR, hostR.accesorioFin);
      hostR.accesorioFin = '';
    }
    if (hostR.accMed) {
      for (const key of Object.keys(hostR.accMed)) {
        const m = key.match(/^accMed(\d+)$/);
        if (!m) continue;
        const idx = parseInt(m[1], 10);
        const p = hostR.pts[idx];
        if (
          p &&
          TEE_TYPES.includes(hostR.accMed[key]) &&
          Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL &&
          !keepInterior
        ) {
          decrementAccesorioCount(engine, hostR, hostR.accMed[key]);
          delete hostR.accMed[key];
        }
      }
    }
  }
}

// Ítem 6 (spec): al borrar un ramal, si en el punto quedan EXACTAMENTE dos ramales
// sobrevivientes en ángulo (esquina en L), se escribe el codo horizontal en el extremo de uno de
// ellos — antes la esquina quedaba sin símbolo ni conteo (renderJunctions ignora puntos de 2
// brazos). Aplica igual a tees manuales desarmadas (downgrade tee→codo) y a uniones de línea
// guía que nunca tuvieron tee (el usuario quiere el arco de segmentos al quedar un solo
// tributario). Solo af/ac/gas (accesorios por campo); san/ll/vent son geométricas. El reconteo
// del codo es gratis: _markDirty → calcHydroAccessories lee los campos.

// Brazos de extremo en un punto: ramales af/ac/gas que TERMINAN en pt con su dirección de
// salida (hacia el cuerpo del ramal), agrupados por línea (colineales = mismo brazo).
const sameLineDir = (a: number[], b: number[]) => Math.abs(a[0] * b[0] + a[1] * b[1]) >= 0.9;

function endpointArmsAt(engine: IPlanoEngineCore, pt: number[]): { d: number[]; r: PlanoRamal }[] {
  const TOL = 0.5;
  const norm = (v: number[]) => {
    const l = Math.hypot(v[0], v[1]);
    return l < 1e-6 ? null : ([v[0] / l, v[1] / l] as number[]);
  };
  const arms: { d: number[]; r: PlanoRamal }[] = [];
  for (const r of engine.ramales) {
    if (r.net !== 'af' && r.net !== 'ac' && r.net !== 'gas') continue;
    if (!r.pts || r.pts.length < 2) continue;
    const li = r.pts.length - 1;
    let d: number[] | null = null;
    if (Math.hypot(r.pts[0][0] - pt[0], r.pts[0][1] - pt[1]) < TOL)
      d = norm([r.pts[1][0] - r.pts[0][0], r.pts[1][1] - r.pts[0][1]]);
    else if (Math.hypot(r.pts[li][0] - pt[0], r.pts[li][1] - pt[1]) < TOL)
      d = norm([r.pts[li - 1][0] - r.pts[li][0], r.pts[li - 1][1] - r.pts[li][1]]);
    if (!d) continue;
    if (!arms.some((a) => sameLineDir(a.d, d))) arms.push({ d, r });
  }
  return arms;
}

function assignCodoAfterBranchDelete(engine: IPlanoEngineCore, pt: number[]): void {
  const TOL = 0.5;
  if (engine.bajantes.some((b) => Math.hypot(b.x - pt[0], b.y - pt[1]) < TOL)) return;
  const arms = endpointArmsAt(engine, pt);
  // 2 grupos de dirección distintos y NO colineales entre sí = esquina en L. Un solo grupo es
  // paso recto (o remerge ya unió el tronco) y ≥3 es unión múltiple — ni uno ni otro es codo.
  if (arms.length !== 2 || sameLineDir(arms[0].d, arms[1].d)) return;
  // Escribir el codo en UN solo sobreviviente (evitar doble conteo en calcHydroAccessories):
  // preferir el ramal normal sobre un tributario; sin tocar un campo ya ocupado.
  const host = (arms.find((a) => a.r.tipo !== 'tributario') || arms[0]).r;
  // Ángulo entre los brazos de salida ≈45° → codo 45; si no, 90.
  const is45 = arms[0].d[0] * arms[1].d[0] + arms[0].d[1] * arms[1].d[1] > 0.5;
  const accId = is45
    ? host.net === 'gas'
      ? 'codos_45'
      : 'codo45'
    : host.net === 'gas'
      ? 'codos_90_std'
      : 'codo90rm';
  if (host.pts && Math.hypot(host.pts[0][0] - pt[0], host.pts[0][1] - pt[1]) < TOL) {
    if (!host.accesorioInicio) host.accesorioInicio = accId;
  } else if (!host.accesorioFin) {
    host.accesorioFin = accId;
  }
}

// Codos de PLANO (esquina en L dibujada en planta). Un marcador de estos en un punto que deja
// de ser esquina (muere el tributario de una unión de línea guía) no significa nada y se limpia.
const PLAN_CODO_TYPES = ['codo90rm', 'codos_90_std', 'codo45', 'codos_45'];

// ¿La unión tenía un marcador de tee ANTES del borrado? El downgrade tee→codo
// (assignCodoAfterBranchDelete) solo aplica al flujo manual donde el usuario resolvió la unión
// con una tee vía modal — las uniones creadas desde línea guía nunca tuvieron tee y al
// desarmarlas no debe aparecer ningún símbolo de accesorio.
function junctionHadTeeMarker(engine: IPlanoEngineCore, pt: number[]): boolean {
  const TOL = 0.5;
  for (const r of engine.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    if (
      r.accesorioInicio &&
      TEE_TYPES.includes(r.accesorioInicio) &&
      Math.hypot(r.pts[0][0] - pt[0], r.pts[0][1] - pt[1]) < TOL
    )
      return true;
    const li = r.pts.length - 1;
    if (
      r.accesorioFin &&
      TEE_TYPES.includes(r.accesorioFin) &&
      Math.hypot(r.pts[li][0] - pt[0], r.pts[li][1] - pt[1]) < TOL
    )
      return true;
    if (r.accMed) {
      for (const [k, v] of Object.entries(r.accMed)) {
        const m = k.match(/^accMed(\d+)$/);
        if (!m || !v || !TEE_TYPES.includes(v)) continue;
        const p = r.pts[parseInt(m[1], 10)];
        if (p && Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL) return true;
      }
    }
  }
  return false;
}

// Elimina TODO marcador de tee (accesorioInicio/Fin + accMed) en un punto dado, y decrementa su
// conteo. Usado cuando un punto deja de ser una unión de tee (al borrar un brazo o al fusionar
// dos mitades colineales de un split).
function scrubAccMedTeeAt(engine: IPlanoEngineCore, pt: number[]): void {
  const TOL = 0.5;
  for (const r of engine.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    if (
      r.accesorioInicio &&
      TEE_TYPES.includes(r.accesorioInicio) &&
      Math.hypot(r.pts[0][0] - pt[0], r.pts[0][1] - pt[1]) < TOL
    ) {
      decrementAccesorioCount(engine, r, r.accesorioInicio);
      r.accesorioInicio = '';
    }
    const li = r.pts.length - 1;
    if (
      r.accesorioFin &&
      TEE_TYPES.includes(r.accesorioFin) &&
      Math.hypot(r.pts[li][0] - pt[0], r.pts[li][1] - pt[1]) < TOL
    ) {
      decrementAccesorioCount(engine, r, r.accesorioFin);
      r.accesorioFin = '';
    }
    if (r.accMed) {
      for (const k of Object.keys(r.accMed)) {
        const m = k.match(/^accMed(\d+)$/);
        if (!m) continue;
        const v = r.accMed[k];
        if (!TEE_TYPES.includes(v)) continue;
        const p = r.pts[parseInt(m[1], 10)];
        if (p && Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL) {
          decrementAccesorioCount(engine, r, v);
          delete r.accMed[k];
        }
      }
    }
  }
}

// Legado de uniones de línea guía (código viejo persistió codo90rm en el ramal): al borrar el
// tributario que formaba la esquina, se anula el codo de plano anclado en el punto para que no
// quede ni el arco ni el disco "C90" de respaldo.
function scrubPlanCodoAt(engine: IPlanoEngineCore, pt: number[]): void {
  const TOL = 0.5;
  for (const r of engine.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    if (
      r.accesorioInicio &&
      PLAN_CODO_TYPES.includes(r.accesorioInicio) &&
      Math.hypot(r.pts[0][0] - pt[0], r.pts[0][1] - pt[1]) < TOL
    ) {
      decrementAccesorioCount(engine, r, r.accesorioInicio);
      r.accesorioInicio = '';
    }
    const li = r.pts.length - 1;
    if (
      r.accesorioFin &&
      PLAN_CODO_TYPES.includes(r.accesorioFin) &&
      Math.hypot(r.pts[li][0] - pt[0], r.pts[li][1] - pt[1]) < TOL
    ) {
      decrementAccesorioCount(engine, r, r.accesorioFin);
      r.accesorioFin = '';
    }
  }
}

// Limpieza de uniones tras borrar un ramal, compartida por las dos rutas de deleteSelected:
// - Si había tee (3 brazos) → el accesorio se elimina por completo (ítem 8: no desplazar a la L restante).
// - Si no había tee y queda esquina en L (dos brazos en ángulo) → se escribe codo de plano.
// - Si ya no queda esquina → se barre cualquier codo de plano del punto.
// ¿El ramal BORRADO llevaba un marcador de tee en el extremo `pt`? Tras quitar el ramal del
// array su marcador ya no es visible para junctionHadTeeMarker, así que hay que mirarlo antes:
// si el brazo que se borraba era parte de una tee, el punto debe quedar LIMPIO (sin codo nuevo).
function deletedRamalHadTeeAt(deleted: PlanoRamal, pt: number[]): boolean {
  const TOL = 0.5;
  if (!deleted.pts || deleted.pts.length < 2) return false;
  const near = (v: string | undefined, p: number[]) =>
    !!v && TEE_TYPES.includes(v) && Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL;
  if (near(deleted.accesorioInicio, deleted.pts[0])) return true;
  if (near(deleted.accesorioFin, deleted.pts[deleted.pts.length - 1])) return true;
  if (deleted.accMed) {
    for (const [k, v] of Object.entries(deleted.accMed)) {
      const m = k.match(/^accMed(\d+)$/);
      const idx = m ? parseInt(m[1], 10) : -1;
      if (
        idx >= 0 &&
        TEE_TYPES.includes(v) &&
        deleted.pts[idx] &&
        Math.hypot(deleted.pts[idx][0] - pt[0], deleted.pts[idx][1] - pt[1]) < TOL
      )
        return true;
    }
  }
  return false;
}

function cleanupJunctionsAfterRamalDelete(engine: IPlanoEngineCore, deleted: PlanoRamal): void {
  const ep0 = deleted.pts![0];
  const ep1 = deleted.pts![deleted.pts!.length - 1];
  for (const ep of [ep0, ep1]) {
    const hadTee = junctionHadTeeMarker(engine, ep) || deletedRamalHadTeeAt(deleted, ep);
    cleanupTeeMarkersAt(engine, ep);
    const arms = endpointArmsAt(engine, ep);
    const isL = arms.length === 2 && !sameLineDir(arms[0].d, arms[1].d);
    // Ítem 1/8: borrar un brazo de una tee elimina el símbolo (ya no hay 3 brazos en el punto).
    // Si HABÍA tee (bien en los sobrevivientes o en el propio ramal borrado), el punto queda
    // limpio: NO se asigna un codo que "se desplaza al extremo" del sobreviviente.
    scrubAccMedTeeAt(engine, ep);
    if (hadTee) {
      scrubPlanCodoAt(engine, ep);
    } else if (isL) {
      assignCodoAfterBranchDelete(engine, ep);
    } else {
      scrubPlanCodoAt(engine, ep);
    }
  }
}

// Ítem 9: al borrar un ramal que PARTIÓ a otro (el `incoming` de una división mergesFrom =
// [existing.id, incoming.id]), se re-une la línea: el tramo aguas arriba (A = mergesFrom[0]) y
// el tramo aguas abajo (D = mergesFrom[1]) que quedaron separados vuelven a ser UN ramal, con
// los datos de extremo lejano de D movidos a A, el UC revertido (D.uc − uc del borrado) y la
// etiqueta recalculada. Si en cambio se borra una de las dos mitades (A o D), solo se limpia la
// referencia mergesFrom muerta de la sobreviviente. Las cadenas (D dividido de nuevo después)
// se reescriben para apuntar de D.id → A.id.
function remergeSplitRamales(engine: IPlanoEngineCore, deletedId: string, deletedUc: number): void {
  const TOL = 0.5;
  for (const d of [...engine.ramales]) {
    if (!d.mergesFrom) continue;
    if (d.mergesFrom[0] === deletedId) {
      // Se borró la mitad aguas arriba — la referencia de la sobreviviente queda muerta.
      d.mergesFrom = undefined;
      continue;
    }
    if (d.mergesFrom[1] !== deletedId) continue;
    // ponytail: find the GEOMETRIC upstream — the ramal whose END touches d's START and continues
    // the line. mergesFrom[0] is STALE after a subsequent split of the upstream half (the reported
    // bug: RS1|RS2|RS3 → deleting the first divisor merged RS2 into RS1, overlapping RS3). The
    // partition created by the deleted divisor must re-join its TRUE geometric neighbor.
    let a: PlanoRamal | null = null;
    if (d.pts && d.pts.length >= 2) {
      const dStart = d.pts[0];
      const dDirX = d.pts[1][0] - dStart[0];
      const dDirY = d.pts[1][1] - dStart[1];
      const dLen = Math.hypot(dDirX, dDirY) || 1;
      let bestDot = 1.1;
      for (const r of engine.ramales) {
        if (r.id === d.id || !r.pts || r.pts.length < 2 || r.net !== d.net) continue;
        const last = r.pts[r.pts.length - 1];
        if (Math.hypot(last[0] - dStart[0], last[1] - dStart[1]) > TOL) continue;
        const rDirX = last[0] - r.pts[r.pts.length - 2][0];
        const rDirY = last[1] - r.pts[r.pts.length - 2][1];
        const rLen = Math.hypot(rDirX, rDirY);
        if (rLen < 1e-6) continue;
        // collinear continuation: r's last segment and d's first share the point and run along
        // the SAME line (|dot|≈1). A straight pipe has both vectors pointing the same way (+1).
        const dot = (rDirX * dDirX + rDirY * dDirY) / (rLen * dLen);
        const coll = 1 - Math.abs(dot);
        if (coll < bestDot) {
          bestDot = coll;
          a = r;
        }
      }
    }
    // Fallback: original upstream reference (simple/chain splits where it is still adjacent).
    if (!a) a = engine.ramales.find((r) => r.id === d.mergesFrom![0]) || null;
    if (!a || !a.pts || a.pts.length < 2 || !d.pts || d.pts.length < 2) {
      d.mergesFrom = undefined;
      continue;
    }
    const aLast = a.pts[a.pts.length - 1];
    const dFirst = d.pts[0];
    const gap = Math.hypot(aLast[0] - dFirst[0], aLast[1] - dFirst[1]);
    // ponytail: gap always closed — division must not persist after cause removed, even if dragged
    if (gap > TOL) {
      d.pts[0] = [aLast[0], aLast[1]];
    }
    // Ítem 1: el punto compartido (aLast) es la unión donde se borró el brazo. Tras fusionar ya
    // no es una tee ni una esquina — se elimina cualquier marcador tee/codo ahí para que no se
    // quede el símbolo ni se reubique al extremo del ramal re-unido.
    scrubAccMedTeeAt(engine, aLast);
    scrubPlanCodoAt(engine, aLast);
    // Re-unir: A continúa con el cuerpo de D (salvo el punto compartido).
    a.pts = [...a.pts, ...d.pts.slice(1)];
    a.totalL = calculateRamalLength(a.pts, engine);
    // El UC del downstream acreditaba existing.uc + incoming.uc — al borrar el incoming se
    // revierte a la suma que ya traía la mitad aguas arriba. Con la re-unón geométrica el
    // upstream puede ser OTRO downstream (RS3): nunca reducir su propia UC acumulada.
    a.uc = Math.max(a.uc || 0, (d.uc || 0) - deletedUc);
    // Mover los datos de extremo lejano de D a A (se ponían en D al dividir).
    if (d.accesorioFin) a.accesorioFin = d.accesorioFin;
    if (d.diametroFin) a.diametroFin = d.diametroFin;
    if (d.aparatoFin) a.aparatoFin = d.aparatoFin;
    if (d.sifonLabelFin) a.sifonLabelFin = d.sifonLabelFin;
    // Los aparatos/fixtures del downstream fusionado se suman a A — sin esto, al borrar el
    // divisor de una T/Y los aparatos del tramo aguas abajo se perdían (orig. #8: "al renumerar
    // se resetea los aparatos"). Se suman cantidad por cantidad, no se sobreescriben.
    if (d.fixtures) {
      const merged = { ...(a.fixtures || {}) };
      for (const [k, v] of Object.entries(d.fixtures)) merged[k] = (merged[k] || 0) + (v || 0);
      a.fixtures = merged;
    }
    if (d.hydroAcc) a.hydroAcc = d.hydroAcc;
    if (d.gasAcc) {
      const merged = { ...(a.gasAcc || {}) };
      for (const [k, v] of Object.entries(d.gasAcc)) merged[k] = (merged[k] || 0) + (v || 0);
      a.gasAcc = merged;
    }
    // accMed interiores de D (p. ej. un tee de montante a mitad de cuerpo) se reindexan al
    // nuevo orden de A (el punto compartido queda en el índice base).
    if (d.accMed) {
      if (!a.accMed) a.accMed = {};
      const base = a.pts.length - 1;
      for (const [k, v] of Object.entries(d.accMed)) {
        const m = k.match(/^accMed(\d+)$/);
        if (!m) continue;
        a.accMed[`accMed${base + parseInt(m[1], 10)}`] = v;
      }
    }
    // Etiqueta recalculada sobre el cuerpo re-unido.
    const [mx, my] = _midpoint(a.pts);
    a.labelX = mx;
    a.labelY = my;
    if (a.labelAngle == null) a.labelAngle = angleAtHalfLength(a.pts);
    // Reescritura de cadenas: cualquier ramal que referencie D.id pasa a apuntar a A.id.
    const dId = d.id;
    engine.ramales = engine.ramales.filter((r) => r.id !== dId);
    for (const m of engine.ramales) {
      if (m.mergesFrom) {
        m.mergesFrom = [
          m.mergesFrom[0] === dId ? a.id : m.mergesFrom[0],
          m.mergesFrom[1] === dId ? a.id : m.mergesFrom[1],
        ];
      }
    }
  }
  // Fallback (Ítem 9/v2): cuando se borra una de las MITADES de un ramal partido (no la rama
  // que causó el split), la otra mitad + un ramal colineal adyacente pueden quedar como dos
  // trazos. Si dos ramales comparten extremo, continúan en la misma línea (colineales) y en ese
  // punto NO se ramifican (grado 2), se funden en uno solo — un trazo continuo, un solo borrado.
  mergeCollinearPairs(engine);
}

// Funde ramales colineales que se tocan extremo-a-extremo sin ramificación en el punto.
function mergeCollinearPairs(engine: IPlanoEngineCore): void {
  const TOL = 0.5;
  let merged = true;
  while (merged) {
    merged = false;
    const ramales = [...engine.ramales];
    for (let i = 0; i < ramales.length; i++) {
      const A = ramales[i];
      if (!A?.pts || A.pts.length < 2) continue;
      for (let j = i + 1; j < ramales.length; j++) {
        const B = ramales[j];
        if (!B?.pts || B.pts.length < 2 || B.net !== A.net) continue;
        if (B.id === A.id) continue;
        // ¿Comparten un extremo?
        const a0 = A.pts[0];
        const a1 = A.pts[A.pts.length - 1];
        const b0 = B.pts[0];
        const b1 = B.pts[B.pts.length - 1];
        // encuentra la pareja de extremos que coinciden y en qué orden fusionar
        let shared = -1; // 0: A.end-B.start, 1: A.end-B.end, 2: A.start-B.end, 3: A.start-B.start
        if (Math.hypot(a1[0] - b0[0], a1[1] - b0[1]) < TOL) shared = 0;
        else if (Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) < TOL) shared = 1;
        else if (Math.hypot(a0[0] - b1[0], a0[1] - b1[1]) < TOL) shared = 2;
        else if (Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) < TOL) shared = 3;
        if (shared < 0) continue;
        const sharedPt = shared === 0 || shared === 2 ? a1 : a0;
        // ¿Grado 2? (en el punto tocan exactamente A y B, no otros ramales ni bajantes)
        let touching = 2;
        for (const r of engine.ramales) {
          if (r.id === A.id || r.id === B.id) continue;
          if (!r.pts || r.pts.length < 2) continue;
          const hit =
            Math.hypot(r.pts[0][0] - sharedPt[0], r.pts[0][1] - sharedPt[1]) < TOL ||
            Math.hypot(
              r.pts[r.pts.length - 1][0] - sharedPt[0],
              r.pts[r.pts.length - 1][1] - sharedPt[1],
            ) < TOL;
          if (hit) {
            touching++;
            break;
          }
        }
        for (const baj of engine.bajantes) {
          if (Math.hypot(baj.x - sharedPt[0], baj.y - sharedPt[1]) < TOL) {
            touching++;
            break;
          }
        }
        if (touching !== 2) continue;
        // Al fusionarse ya no hay unión en ese punto — limpiar cualquier marcador de tee residual.
        scrubAccMedTeeAt(engine, sharedPt);
        scrubPlanCodoAt(engine, sharedPt);
        // ¿Colineales (siguen rectos por el punto)?
        const dA = A.pts.length >= 2 ? dirAt(A, sharedPt) : null;
        const dB = B.pts.length >= 2 ? dirAt(B, sharedPt) : null;
        if (!dA || !dB) continue;
        const dot = dA[0] * dB[0] + dA[1] * dB[1];
        // Han de continuar en línea recta a través del punto: direcciones OPUESTAS (dot ≈ -1).
        // Un plegado (ambos hacia el mismo lado, dot ≈ +1) no es un trazo continuo.
        // Tolerancia 0.9 (≈25°) — los dos tramos de un split rara vez quedan PERFECTAMENTE
        // colineales (el divisor cae con pequeño desvío), y con 0.98 estricto no se fusionaban.
        if (dot > -0.9) continue;
        // Fusionar A+B en un solo ramal
        let primary = A,
          secondary = B;
        let mergedPts: number[][];
        if (shared === 0 || shared === 1) {
          mergedPts = [...A.pts, ...(shared === 0 ? B.pts.slice(1) : B.pts.slice(1).reverse())];
        } else {
          // compartimos por el inicio de A → A va después de B
          mergedPts = [...B.pts, ...(shared === 3 ? A.pts.slice(1) : A.pts.slice(1).reverse())];
          primary = B;
          secondary = A;
        }
        primary.pts = mergedPts;
        primary.totalL = calculateRamalLength(primary.pts, engine);
        if (secondary.accesorioFin) primary.accesorioFin = secondary.accesorioFin;
        if (secondary.diametroFin) primary.diametroFin = secondary.diametroFin;
        if (secondary.aparatoFin) primary.aparatoFin = secondary.aparatoFin;
        if (secondary.sifonLabelFin) primary.sifonLabelFin = secondary.sifonLabelFin;
        // Fusionar aparatos/fixtures del ramal fusionado (orig. #8) — igual que remergeSplitRamales.
        if (secondary.fixtures) {
          const merged = { ...(primary.fixtures || {}) };
          for (const [k, v] of Object.entries(secondary.fixtures))
            merged[k] = (merged[k] || 0) + (v || 0);
          primary.fixtures = merged;
        }
        if (secondary.hydroAcc) primary.hydroAcc = secondary.hydroAcc;
        if (secondary.gasAcc) {
          const merged = { ...(primary.gasAcc || {}) };
          for (const [k, v] of Object.entries(secondary.gasAcc))
            merged[k] = (merged[k] || 0) + (v || 0);
          primary.gasAcc = merged;
        }
        const [mx, my] = _midpoint(primary.pts);
        primary.labelX = mx;
        primary.labelY = my;
        if (primary.labelAngle == null) primary.labelAngle = angleAtHalfLength(primary.pts);
        const secondaryId = secondary.id;
        engine.ramales = engine.ramales.filter((r) => r.id !== secondaryId);
        for (const m of engine.ramales) {
          if (m.mergesFrom) {
            m.mergesFrom = [
              m.mergesFrom[0] === secondaryId ? primary.id : m.mergesFrom[0],
              m.mergesFrom[1] === secondaryId ? primary.id : m.mergesFrom[1],
            ];
          }
        }
        merged = true;
        break;
      }
      if (merged) break;
    }
  }
  // Limpiar referencias mergesFrom que apunten a ramales borrados/inexistentes
  for (const m of engine.ramales) {
    if (!m.mergesFrom) continue;
    const [p0, p1] = m.mergesFrom;
    if (!engine.ramales.some((r) => r.id === p0) || !engine.ramales.some((r) => r.id === p1)) {
      m.mergesFrom = undefined;
    }
  }
}

// Dirección (normalizada) hacia el interior desde el extremo compartido sharedPt.
function dirAt(r: { pts: number[][] }, sharedPt: number[]): [number, number] | null {
  const len = r.pts.length;
  let other: number[];
  if (Math.hypot(r.pts[0][0] - sharedPt[0], r.pts[0][1] - sharedPt[1]) < 0.5) other = r.pts[1];
  else other = r.pts[len - 2];
  let dx = other[0] - sharedPt[0];
  let dy = other[1] - sharedPt[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return null;
  dx /= d;
  dy /= d;
  return [dx, dy];
}

// Ítem 9/v2: borrar una MITAD de un ramal dividido (no la rama entrante) debe borrar TODA la
// división — las dos mitades colineales + la rama que la partió. Si solo se borra una mitad,
// quedan restos de la línea dividida y el usuario tiene que borrar dos veces. La rama entrante
// (mergesFrom[1]) NO se expande: borrarla re-une las mitades (comportamiento actual).
// Excepción yee doble: los ramales del brazo principal de una yee doble se borran individualmente
// (el símbolo persiste), no como cluster — ver isYeeDobleInvolved.
// ponytail: transitive closure — chain A-D1-D2 shares same logical ramal, deleting any half deletes whole cluster
function splitMembersFor(engine: IPlanoEngineCore, ramalId: string): string[] {
  if (isYeeDobleInvolved(engine, ramalId)) return [];
  // divisor deletion must not expand (merge path)
  if (engine.ramales.some((r) => r.mergesFrom && r.mergesFrom[1] === ramalId)) return [];
  const d = engine.ramales.find((r) => r.id === ramalId);
  const isHalf =
    !!d?.mergesFrom || engine.ramales.some((r) => r.mergesFrom && r.mergesFrom[0] === ramalId);
  if (!isHalf) return [];
  // BFS over merges edges: collect whole connected component — but skip yeeDoble hosts (deben borrarse solo segmento)
  const S = new Set<string>([ramalId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const r of engine.ramales) {
      if (!r.mergesFrom) continue;
      if (r.yeeDobleAt && r.yeeDobleAt.length === 2) continue;
      if (engine.ramales.some((x) => x.id === r.id && x.yeeDobleAt && x.yeeDobleAt.length === 2))
        continue;
      const [u, i] = r.mergesFrom;
      const did = r.id;
      // no expandir si algún miembro ya es yeeDoble
      if (
        [u, i, did].some((id) =>
          engine.ramales.some((x) => x.id === id && x.yeeDobleAt && x.yeeDobleAt.length === 2),
        )
      )
        continue;
      const touches = S.has(u) || S.has(i) || S.has(did);
      if (!touches) continue;
      for (const nid of [u, i, did]) {
        if (nid && !S.has(nid) && engine.ramales.some((x) => x.id === nid)) {
          // no meter yeeDoble hosts en el set
          const cand = engine.ramales.find((x) => x.id === nid);
          if (cand && cand.yeeDobleAt && cand.yeeDobleAt.length === 2) continue;
          S.add(nid);
          expanded = true;
        }
      }
    }
  }
  S.delete(ramalId);
  return [...S];
}

// Yee doble: eximir del borrado en bloque — los ramales del brazo principal de una yee doble
// deben poder borrarse individualmente (el símbolo persiste), no como cluster colineal.
function isYeeDobleInvolved(engine: IPlanoEngineCore, ramalId: string): boolean {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r) return false;
  if (r.yeeDobleAt && r.yeeDobleAt.length === 2) return true;
  const pts = r.pts || [];
  if (pts.length < 2) return false;
  for (const other of engine.ramales) {
    if (!other.yeeDobleAt || other.yeeDobleAt.length !== 2) continue;
    for (const yp of other.yeeDobleAt) {
      for (const rp of pts) {
        if (Math.hypot(yp[0] - rp[0], yp[1] - rp[1]) < 20) return true;
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i];
        const B = pts[i + 1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) continue;
        const t = ((yp[0] - A[0]) * dx + (yp[1] - A[1]) * dy) / lenSq;
        const ct = Math.max(0, Math.min(1, t));
        const px = A[0] + ct * dx;
        const py = A[1] + ct * dy;
        if (Math.hypot(yp[0] - px, yp[1] - py) < 0.5) return true;
      }
    }
  }
  return false;
}

function preserveYeeDobleAt(engine: IPlanoEngineCore, deleted: PlanoRamal): void {
  if (!deleted.yeeDobleAt || deleted.yeeDobleAt.length !== 2) return;
  const survivors = engine.ramales.filter((x) => x.net === 'san' && x.pts && x.pts.length >= 2);
  if (survivors.length === 0) return;
  let best: PlanoRamal | null = null;
  let bestD = Infinity;
  for (const yp of deleted.yeeDobleAt) {
    for (const cand of survivors) {
      let minD = Infinity;
      for (const p of cand.pts) {
        const d = Math.hypot(p[0] - yp[0], p[1] - yp[1]);
        if (d < minD) minD = d;
      }
      // también distancia a segmento para troncos que pasan por el punto sin vértice exacto
      for (let i = 0; i < cand.pts.length - 1; i++) {
        const A = cand.pts[i];
        const B = cand.pts[i + 1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) continue;
        const t = ((yp[0] - A[0]) * dx + (yp[1] - A[1]) * dy) / lenSq;
        const ct = Math.max(0, Math.min(1, t));
        const px = A[0] + ct * dx;
        const py = A[1] + ct * dy;
        const d = Math.hypot(yp[0] - px, yp[1] - py);
        if (d < minD) minD = d;
      }
      if (minD < bestD && minD < 20) {
        bestD = minD;
        best = cand;
      }
    }
  }
  if (best && !best.yeeDobleAt) {
    best.yeeDobleAt = deleted.yeeDobleAt;
    const planId = engine._loadedPlanId;
    if (planId != null) {
      try {
        const map = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {});
        const kDel = `san_${deleted.id}_${planId}`;
        const kBest = `san_${best.id}_${planId}`;
        const delEntry = map[kDel];
        const yeeVal = delEntry?.accesorios?.['yeeDoble'] ?? 1;
        if (!map[kBest]) map[kBest] = { accesorios: {}, Lh: 0, nSalidas: 0 };
        if (!map[kBest].accesorios) map[kBest].accesorios = {};
        map[kBest].accesorios['yeeDoble'] = yeeVal;
        saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
      } catch {
        /* ignorar */
      }
    }
    // Y doble → tapón: el brazo eliminado deja extremo abierto que se cierra con tapón
    // Asignar 'tapon' al extremo de best más cercano al punto del brazo borrado
    try {
      const delPt = deleted.pts?.[0] || deleted.yeeDobleAt[0];
      const d0 = Math.hypot(best.pts[0][0] - delPt[0], best.pts[0][1] - delPt[1]);
      const d1 = Math.hypot(
        best.pts[best.pts.length - 1][0] - delPt[0],
        best.pts[best.pts.length - 1][1] - delPt[1],
      );
      const atStart = d0 <= d1;
      const accField = atStart ? 'accesorioInicio' : 'accesorioFin';
      const diamField = atStart ? 'diametroInicio' : 'diametroFin';
      if (!best[accField]) {
        (best as unknown as Record<string, unknown>)[accField] = 'tapon';
        if (!best[diamField]) (best as unknown as Record<string, unknown>)[diamField] = '2"';
        // contar en hidroData
        if (planId != null) {
          const map2 = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {});
          const kBest2 = `san_${best.id}_${planId}`;
          if (!map2[kBest2]) map2[kBest2] = { accesorios: {}, Lh: 0, nSalidas: 0 };
          if (!map2[kBest2].accesorios) map2[kBest2].accesorios = {};
          map2[kBest2].accesorios['tapon'] = (map2[kBest2].accesorios['tapon'] || 0) + 1;
          saveToStorage(HYDRO_DATA_STORAGE_KEY, map2);
        }
      }
    } catch {
      /* ignore */
    }
  }
}

function isDeletedYeeDoblePart(engine: IPlanoEngineCore, deleted: PlanoRamal): boolean {
  if (deleted.yeeDobleAt && deleted.yeeDobleAt.length === 2) return true;
  const pts = deleted.pts || [];
  for (const other of engine.ramales) {
    if (!other.yeeDobleAt || other.yeeDobleAt.length !== 2) continue;
    for (const yp of other.yeeDobleAt) {
      for (const rp of pts) {
        if (Math.hypot(yp[0] - rp[0], yp[1] - rp[1]) < 20) return true;
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i];
        const B = pts[i + 1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) continue;
        const t = ((yp[0] - A[0]) * dx + (yp[1] - A[1]) * dy) / lenSq;
        const ct = Math.max(0, Math.min(1, t));
        const px = A[0] + ct * dx;
        const py = A[1] + ct * dy;
        if (Math.hypot(yp[0] - px, yp[1] - py) < 0.5) return true;
      }
    }
  }
  return false;
}

// Orig. usuario #2: al borrar un trazo, sus tributarios se REASIGNAN al ramal del otro lado de
// la unión si existe (p. ej. el otro brazo de una yee doble, o la continuación del paso), en vez
// de borrarse junto con él. El ramal hermano comparte un punto de unión con `deleted` (mismo net,
// no tributario) y sigue existiendo tras el borrado.
// Yee doble: los dos brazos están a ~10 unidades a lo largo del tronco, no comparten vértice
// exacto — se busca primero coincidencia exacta (0.5) y en segunda pasada hasta 20px.
function reassignTributariosToHermano(
  engine: IPlanoEngineCore,
  deleted: PlanoRamal,
  toDelete?: Set<string>,
): void {
  if (!deleted.pts?.length) return;
  const TOL = 0.5;
  const LARGE = 20;
  const isCandidate = (o: PlanoRamal) =>
    o.id !== deleted.id &&
    o.net === deleted.net &&
    o.tipo !== 'tributario' &&
    !toDelete?.has(o.id) &&
    !!o.pts?.length;
  const deletedEps = [deleted.pts[0], deleted.pts[deleted.pts.length - 1]];
  const findByTol = (tol: number): PlanoRamal | undefined => {
    let best: PlanoRamal | undefined;
    let bestD = Infinity;
    for (const o of engine.ramales) {
      if (!isCandidate(o)) continue;
      const oEps = [o.pts[0], o.pts[o.pts.length - 1]];
      for (const de of deletedEps) {
        for (const oe of oEps) {
          const d = Math.hypot(de[0] - oe[0], de[1] - oe[1]);
          if (d < tol && d < bestD) {
            bestD = d;
            best = o;
          }
        }
      }
    }
    return best;
  };
  const hermano = findByTol(TOL) ?? findByTol(LARGE);
  if (!hermano) return;
  for (const t of engine.ramales) {
    if (t.tipo === 'tributario' && t.padre === deleted.id) {
      t.padre = hermano.id;
    }
  }
}

export function deleteSelected(
  engine: IPlanoEngineCore,
  ids?: string[],
  opts?: { noMerge?: boolean },
): void {
  if (ids && ids.length > 0) {
    engine._yeeFlashKey = null;
    const netsToRenumber = new Set<string>();
    const bajNetsToRenumber = new Set<string>();
    let renumberAreas = false;
    const toDelete = new Set<string>(ids);
    // "Borrar trazo" (opts.noMerge) borra SOLO el ramal indicado: no expande mitades de
    // split ni re-úne el tronco — necesario para el borrado parcial de una yee doble
    // (orig. #2), donde borrar un brazo lateral no debe colapsar la yee completa.
    if (!opts?.noMerge) {
      for (const id of [...ids]) {
        for (const extra of splitMembersFor(engine, id)) toDelete.add(extra);
      }
    }
    const deletedRamalIds = new Set<string>();
    for (const id of toDelete) {
      const idxR = engine.ramales.findIndex((r) => r.id === id);
      if (idxR >= 0) {
        const deleted = engine.ramales[idxR];
        deletedRamalIds.add(deleted.id);
        const wasYeeDoblePart = isDeletedYeeDoblePart(engine, deleted);
        const isDivisor = engine.ramales.some(
          (r) => r.mergesFrom && r.mergesFrom[1] === deleted.id,
        );
        // Orig. usuario #2: reasignar tributarios al ramal del otro lado de la unión si existe.
        // Y doble: borrar solo el segmento, no todo el conjunto conectado ni tribs laterales
        if (wasYeeDoblePart) {
          reassignTributariosToHermano(engine, deleted, toDelete);
          engine.ramales = engine.ramales.filter((r) => r.id !== deleted.id);
        } else {
          reassignTributariosToHermano(engine, deleted, toDelete);
          engine.ramales = engine.ramales.filter(
            (r) => r.id !== deleted.id && r.padre !== deleted.id,
          );
        }
        preserveYeeDobleAt(engine, deleted);
        // Y doble lateral → tapón (cuando se borra tributario parte de Y doble, el host queda con extremo abierto)
        if (!deleted.yeeDobleAt && wasYeeDoblePart) {
          try {
            const host = engine.ramales.find(
              (x) => x.yeeDobleAt && x.yeeDobleAt.length === 2 && x.net === 'san',
            );
            if (host && deleted.pts?.length) {
              const delEnd = deleted.pts[deleted.pts.length - 1];
              const d0h = Math.hypot(host.pts[0][0] - delEnd[0], host.pts[0][1] - delEnd[1]);
              const d1h = Math.hypot(
                host.pts[host.pts.length - 1][0] - delEnd[0],
                host.pts[host.pts.length - 1][1] - delEnd[1],
              );
              // si el tributario tocaba cerca del host (dentro 20), asumimos Y doble
              if (Math.min(d0h, d1h) < 25) {
                const planId2 = engine._loadedPlanId;
                const accField2 = d0h <= d1h ? 'accesorioInicio' : 'accesorioFin';
                const diamField2 = d0h <= d1h ? 'diametroInicio' : 'diametroFin';
                if (!host[accField2]) {
                  (host as unknown as Record<string, unknown>)[accField2] = 'tapon';
                  if (!host[diamField2])
                    (host as unknown as Record<string, unknown>)[diamField2] = '2"';
                  if (planId2 != null) {
                    const map3 = loadFromStorage<Record<string, HidroDataEntry>>(
                      HYDRO_DATA_STORAGE_KEY,
                      {},
                    );
                    const kHost = `san_${host.id}_${planId2}`;
                    if (!map3[kHost]) map3[kHost] = { accesorios: {}, Lh: 0, nSalidas: 0 };
                    if (!map3[kHost].accesorios) map3[kHost].accesorios = {};
                    map3[kHost].accesorios['tapon'] = (map3[kHost].accesorios['tapon'] || 0) + 1;
                    saveToStorage(HYDRO_DATA_STORAGE_KEY, map3);
                  }
                }
              }
            }
          } catch {
            /* ignore */
          }
        }
        // Ítem 9: si este ramal había partido a otro (incoming de una división mergesFrom), se
        // re-une la línea que quedó en dos mitades. Para "Borrar trazo" (noMerge) se salta:
        // el tronco de la yee doble debe quedar intacto (solo se borra el brazo lateral).
        // Yee doble: el brazo principal se borra individualmente (sin re-unir); el lateral sí re-une.
        if (!opts?.noMerge && !(wasYeeDoblePart && !isDivisor)) {
          remergeSplitRamales(engine, deleted.id, deleted.uc || 0);
        }
        if (deleted.pts?.length) cleanupJunctionsAfterRamalDelete(engine, deleted);
        netsToRenumber.add(deleted.net);
        // Limpia las referencias al ramal borrado en los bajantes
        for (const b of engine.bajantes) {
          if (b.recibeDeIds) {
            b.recibeDeIds = b.recibeDeIds.filter((rid) => rid !== deleted.id);
          }
          if (b.descargaEnId) {
            const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
            if (parts[parts.length - 1] === deleted.id) b.descargaEnId = null;
          }
          // Si este ramal era el conector Ldesvio de un desplazamiento fantasma, al fantasma ya
          // no le queda tubería hacia el padre — se quita el desplazamiento (y su fantasma).
          if (b.desplazamientos) {
            for (const lvlKey of Object.keys(b.desplazamientos)) {
              if (b.desplazamientos[lvlKey].Ldesvio === deleted.id) {
                const sourceBajanteId = b.id;
                delete b.desplazamientos[lvlKey];
                if (b.ghostData) delete b.ghostData[lvlKey];
                // Borrar también el fantasma punteado del piso inferior
                if (isLdesvioRamalId(deleted.id)) {
                  removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
                }
              }
            }
          }
        }
        // Ldesvio borrado directamente (sin desplazamiento asociado) — limpiar fantasmas huérfanos
        if (isLdesvioRamalId(deleted.id)) {
          const sourceBajanteId = deleted.id.slice(3);
          removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
        }
        continue;
      }
      const idxB = engine.bajantes.findIndex((b) => b.id === id);
      if (idxB >= 0) {
        const deleted: PlanoBajante = engine.bajantes[idxB];
        // Borrar un canal debe desasociar sus bajantes — si no, su canalId seguiría apuntando a
        // un id que ya no existe (o peor, a un canal futuro que llegue a reutilizarlo).
        if (deleted.tipo === 'canal') {
          for (const b of engine.bajantes) {
            if (b.canalId === deleted.id) b.canalId = null;
          }
        } else {
          // Borrar un bajante debe quitar la asociación externa que cualquier canal tenga sobre él.
          for (const c of engine.bajantes) {
            if (c.tipo === 'canal' && c.bajanteExternoId === deleted.id) c.bajanteExternoId = null;
          }
        }
        const lvl = engine.nivelActual?.label ?? '';
        // Si isFantasma=true, se trata como borrado del padre (limpia TODOS los niveles)
        if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
          const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
          if (lDesvioId) {
            engine.ramales = engine.ramales.filter((r) => r.id !== lDesvioId);
            netsToRenumber.add(deleted.net);
          }
          delete deleted.desplazamientos[lvl];
          if (deleted.ghostData) delete deleted.ghostData[lvl];
        } else {
          // Limpia los ramales Ldesvio y los desplazamientos fantasma
          if (deleted.desplazamientos) {
            for (const lvlKey of Object.keys(deleted.desplazamientos)) {
              const d = deleted.desplazamientos[lvlKey];
              if (d.Ldesvio) {
                engine.ramales = engine.ramales.filter((r) => r.id !== d.Ldesvio);
                netsToRenumber.add(deleted.net);
              }
            }
          }
          // Limpia las referencias en otros bajantes
          for (const other of engine.bajantes) {
            if (other.recibeDeIds) {
              other.recibeDeIds = other.recibeDeIds.filter((rid) => rid !== deleted.id);
            }
            if (other.descargaEnId === deleted.id) {
              other.descargaEnId = null;
            } else if (other.descargaEnId?.includes('|')) {
              const parts = other.descargaEnId.split('|');
              if (parts[1] === deleted.id) other.descargaEnId = null;
            }
          }
          engine.bajantes.splice(idxB, 1);
          cascadeMontanteAssociation(engine, deleted);
          // Un montante a mitad de cuerpo siempre escribió un marcador de tee (accMed) en su
          // ramal huésped al crearse — borrar el montante sin esto dejaba ese glifo/conteo para
          // siempre, porque nada más vuelve a revisar accMed una vez escrito.
          if (deleted.tipo === 'montante') cleanupTeeMarkersAt(engine, [deleted.x, deleted.y]);
          if (deleted.tipo === 'bajante') bajNetsToRenumber.add(deleted.net);
          else if (deleted.tipo === 'montante') bajNetsToRenumber.add('montante');
          else if (deleted.tipo === 'red_publica') bajNetsToRenumber.add('red_publica');
          else if (deleted.tipo === 'contador') bajNetsToRenumber.add('contador');
          // Limpia los fantasmas entre pisos de OTROS pisos que referencian este bajante
          if (engine._loadedPlanId != null)
            removeCrossFloorGhostsBySource(engine._loadedPlanId, deleted.id);
        }
        continue;
      }
      const idxGhost = engine.crossFloorGhosts.findIndex((g) => g.id === id);
      if (idxGhost >= 0) {
        const g = engine.crossFloorGhosts[idxGhost];
        // Un fantasma es la mitad visual de un enlace entre pisos — borrarlo debe tumbar el
        // enlace COMPLETO: el puntero inverso origenId del piso destino, el desplazamiento del
        // origen (con su ramal Ldesvio) y el fantasma mismo en storage. El piso destino es el
        // que está cargado (los fantasmas solo se dibujan ahí), así que clearBajanteAssociation
        // también arregla el estado vivo del motor. `plans` no está disponible a nivel de motor:
        // el origenId null del destino aterriza en storage por el flujo normal de guardado
        // sucio, y la caché de dibujo sincronizada se reconstruye en el próximo syncDrawings.
        clearBajanteAssociation(
          engine,
          g.sourcePlanId,
          g.sourceBajanteId,
          g.net,
          `${String(engine._loadedPlanId ?? '')}|${g.targetBajanteId}`,
          [],
        );
        engine.crossFloorGhosts = engine.crossFloorGhosts.filter((x) => x.id !== id);
        engine.selectedGhostId = null;
        engine._isGhostSel = false;
        engine.selId = null;
        engine._emitSelect(null);
        engine._emitDelete([id]);
        engine.render();
        engine._markDirty();
        continue;
      }
      const idxT = engine.textAnnots.findIndex((t) => t.id === id);
      if (idxT >= 0) {
        engine.textAnnots.splice(idxT, 1);
        continue;
      }
      const idxA = engine.areas.findIndex((a) => a.id === id);
      if (idxA >= 0) {
        engine.areas.splice(idxA, 1);
        renumberAreas = true;
        continue;
      }
      const idxD = engine.dims.findIndex((d) => d.id === id);
      if (idxD >= 0) {
        engine.dims.splice(idxD, 1);
        continue;
      }
      const idxG = engine.guideLines.findIndex((g) => g.id === id);
      if (idxG >= 0) {
        engine.guideLines.splice(idxG, 1);
        continue;
      }
    }
    for (const net of netsToRenumber) engine._renumberRamales(net);
    for (const net of bajNetsToRenumber) {
      if (net === 'montante') engine._renumberMontantes();
      else if (net === 'red_publica') {
        const rps = engine.bajantes.filter((b) => b.tipo === 'red_publica');
        rps.forEach((b, i) => {
          b.id = 'RP' + (i + 1);
          b.code = 'RP' + (i + 1);
        });
      } else if (net === 'contador') {
        const cnts = engine.bajantes.filter((b) => b.tipo === 'contador');
        cnts.forEach((b, i) => {
          const pfx = b.net === 'gas' ? 'CTNG' : 'CNTAF';
          b.id = pfx + (i + 1);
          b.code = pfx + (i + 1);
        });
      } else engine._renumberBajantes(net);
    }
    if (renumberAreas) engine._renumberAreas();
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete(ids);
    engine.render();
    engine._markDirty();
    return;
  }
  if (!engine.selId) return;
  engine._yeeFlashKey = null;
  const idxR = engine.ramales.findIndex((r) => r.id === engine.selId);
  if (idxR >= 0) {
    const deleted = engine.ramales[idxR];
    const deletedId = deleted.id;
    // Ítem 9/v2: borrar una mitad de división borra toda la división (misma expansión que el
    // path de ids). Se delega en deleteSelected con el set expandido para un solo camino.
    const members = splitMembersFor(engine, deletedId);
    if (members.length > 0) {
      const expanded = [deletedId, ...members];
      engine.selId = null;
      deleteSelected(engine, expanded);
      return;
    }
    const wasYeeDoblePartSel = isDeletedYeeDoblePart(engine, deleted);
    const isDivisorSel = engine.ramales.some((r) => r.mergesFrom && r.mergesFrom[1] === deletedId);
    // Orig. usuario #2: reasignar tributarios al ramal del otro lado de la unión si existe.
    reassignTributariosToHermano(engine, deleted);
    if (wasYeeDoblePartSel) {
      engine.ramales = engine.ramales.filter((r) => r.id !== deletedId);
    } else {
      engine.ramales = engine.ramales.filter((r) => r.id !== deletedId && r.padre !== deleted.id);
    }
    preserveYeeDobleAt(engine, deleted);
    // Ítem 9: si este ramal había partido a otro, se re-une la línea en dos mitades.
    // Yee doble: el brazo principal se borra individualmente (sin re-unir); el lateral sí re-une.
    if (!(wasYeeDoblePartSel && !isDivisorSel)) {
      remergeSplitRamales(engine, deletedId, deleted.uc || 0);
    }
    if (deleted.pts?.length) cleanupJunctionsAfterRamalDelete(engine, deleted);
    // Limpia las referencias al ramal borrado en los bajantes
    for (const b of engine.bajantes) {
      if (b.recibeDeIds) {
        b.recibeDeIds = b.recibeDeIds.filter((r) => r !== deletedId);
      }
      if (b.descargaEnId) {
        const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
        if (parts[parts.length - 1] === deletedId) b.descargaEnId = null;
      }
      if (b.desplazamientos) {
        for (const lvlKey of Object.keys(b.desplazamientos)) {
          if (b.desplazamientos[lvlKey].Ldesvio === deletedId) {
            const sourceBajanteId = b.id;
            delete b.desplazamientos[lvlKey];
            if (b.ghostData) delete b.ghostData[lvlKey];
            if (isLdesvioRamalId(deletedId)) {
              removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
            }
          }
        }
      }
    }
    if (isLdesvioRamalId(deletedId)) {
      const sourceBajanteId = deletedId.slice(3);
      removeCrossFloorGhostsBySource(engine._loadedPlanId, sourceBajanteId);
    }
    if (deleted.tipo === 'ramal') {
      engine._renumberRamales(deleted.net);
    } else {
      const netId = deleted.net;
      const remaining = engine.ramales.filter((r) => r.net === netId && r.tipo !== 'tributario');
      if (remaining.length === 0) {
        if (engine._netCounts[netId]) engine._netCounts[netId].ramal = 0;
      } else {
        let maxN = 0;
        for (const r of remaining) {
          const m = (r.label || r.id || '').match(/\d+/);
          if (m) maxN = Math.max(maxN, parseInt(m[0], 10));
        }
        if (engine._netCounts[netId]) engine._netCounts[netId].ramal = maxN;
      }
    }
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxB = engine.bajantes.findIndex((b) => b.id === engine.selId);
  if (idxB >= 0) {
    const deleted: PlanoBajante = engine.bajantes[idxB];
    const deletedId = deleted.id;
    const lvl = engine.nivelActual?.label ?? '';
    // Si isFantasma=true, se trata como borrado del padre (limpia TODOS los niveles)
    if (!deleted.isFantasma && engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
      const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
      if (lDesvioId) {
        engine.ramales = engine.ramales.filter((r) => r.id !== lDesvioId);
      }
      delete deleted.desplazamientos[lvl];
      if (deleted.ghostData) delete deleted.ghostData[lvl];
      engine.selId = null;
      engine._isGhostSel = false;
      engine._emitSelect(null);
      engine.render();
      engine._markDirty();
      return;
    }
    // Borrado del bajante padre: también limpia sus ramales Ldesvio y desplazamientos fantasma
    if (deleted.desplazamientos) {
      for (const lvlKey of Object.keys(deleted.desplazamientos)) {
        const d = deleted.desplazamientos[lvlKey];
        if (d.Ldesvio) {
          engine.ramales = engine.ramales.filter((r) => r.id !== d.Ldesvio);
        }
      }
    }
    // Limpia las referencias en recibeDeIds y descargaEnId de otros bajantes
    for (const other of engine.bajantes) {
      if (other.recibeDeIds) {
        other.recibeDeIds = other.recibeDeIds.filter((rid) => rid !== deletedId);
      }
      if (other.descargaEnId === deletedId) {
        other.descargaEnId = null;
      } else if (other.descargaEnId?.includes('|')) {
        const parts = other.descargaEnId.split('|');
        if (parts[1] === deletedId) other.descargaEnId = null;
      }
    }
    // Ítem 4: asociación explícita bajante↔canal por ID — al borrar el bajante se limpia la
    // referencia del canal (bajanteExternoId). Los ramales que atraviesan o ingresan al cuerpo
    // del canal NO se tocan: la asociación es por referencia, no por geometría.
    for (const c of engine.bajantes) {
      if (c.tipo === 'canal' && c.bajanteExternoId === deletedId) c.bajanteExternoId = null;
    }
    engine.bajantes.splice(idxB, 1);
    cascadeMontanteAssociation(engine, deleted);
    if (deleted.tipo === 'bajante') {
      void deleted.net;
    } else if (deleted.tipo === 'montante') {
      // Un montante a mitad de cuerpo siempre escribió un marcador de tee (accMed) en su ramal
      // huésped al crearse — borrarlo sin esto dejaba ese glifo/conteo para siempre.
      cleanupTeeMarkersAt(engine, [deleted.x, deleted.y]);
    } else if (deleted.tipo === 'red_publica') {
      const rps = engine.bajantes.filter((b) => b.tipo === 'red_publica');
      rps.forEach((b, i) => {
        b.id = 'RP' + (i + 1);
        b.code = 'RP' + (i + 1);
      });
    } else if (deleted.tipo === 'contador') {
      const cnts = engine.bajantes.filter((b) => b.tipo === 'contador');
      cnts.forEach((b, i) => {
        const pfx = b.net === 'gas' ? 'CTNG' : 'CNTAF';
        b.id = pfx + (i + 1);
        b.code = pfx + (i + 1);
      });
    }
    // Limpia los fantasmas entre pisos de OTROS pisos que referencian este bajante
    if (engine._loadedPlanId != null)
      removeCrossFloorGhostsBySource(engine._loadedPlanId, deleted.id);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxT = engine.textAnnots.findIndex((t) => t.id === engine.selId);
  if (idxT >= 0) {
    const deletedId = engine.textAnnots[idxT].id;
    engine.textAnnots.splice(idxT, 1);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxA = engine.areas.findIndex((a) => a.id === engine.selId);
  if (idxA >= 0) {
    const deletedId = engine.areas[idxA].id;
    engine.areas.splice(idxA, 1);
    engine._renumberAreas();
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxD = engine.dims.findIndex((d) => d.id === engine.selId);
  if (idxD >= 0) {
    const deletedId = engine.dims[idxD].id;
    engine.dims.splice(idxD, 1);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxG = engine.guideLines.findIndex((g) => g.id === engine.selId);
  if (idxG >= 0) {
    const deletedId = engine.guideLines[idxG].id;
    engine.guideLines.splice(idxG, 1);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
}
