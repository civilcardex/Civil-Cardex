import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from './PlanoState';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';
import {
  removeCrossFloorGhostsBySource,
  removeCrossFloorGhost,
  removeCrossFloorLdesvioRamal,
  deleteBajanteFromStorage,
} from '../../utils/associateBajanteAcrossFloors';
import { clearBajanteAssociation } from '../../utils/bajanteAssociation';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { HYDRO_DATA_STORAGE_KEY } from '../../constants/storage-keys';
import { calculateRamalLength } from './ramalMeasure';
import { _midpoint } from './PlanoEngineDrawing';
import { _firstSegmentAngle } from './drawingAngles';

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
        if (t?.tipo === 'montante' || t?.tipo === 'bajante') {
          engine.bajantes = engine.bajantes.filter((b) => b.id !== targetBajanteId);
        } else if (t) t.origenId = null;
      } else {
        deleteBajanteFromStorage(targetPlanId, targetBajanteId);
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
        if (o?.tipo === 'montante' || o?.tipo === 'bajante') {
          engine.bajantes = engine.bajantes.filter((b) => b.id !== originBajanteId);
        } else if (o) o.descargaEnId = null;
      } else {
        deleteBajanteFromStorage(originPlanId, originBajanteId);
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
// limpia tees muertas y reevalúa la geometría del punto. Si queda una esquina en L (dos brazos
// en ángulo) se escribe el codo de plano — aplica a tees manuales desarmadas Y a uniones de
// línea guía que nunca tuvieron tee (el usuario quiere el arco al quedar un solo tributario).
// Si ya no queda esquina (extremo muerto tras borrar el último tributario) se barre cualquier
// codo de plano del punto para que no quede ni arco ni conteo.
function cleanupJunctionsAfterRamalDelete(engine: IPlanoEngineCore, deleted: PlanoRamal): void {
  const ep0 = deleted.pts![0];
  const ep1 = deleted.pts![deleted.pts!.length - 1];
  for (const ep of [ep0, ep1]) {
    const hadTee = junctionHadTeeMarker(engine, ep);
    cleanupTeeMarkersAt(engine, ep);
    const arms = endpointArmsAt(engine, ep);
    const isL = arms.length === 2 && !sameLineDir(arms[0].d, arms[1].d);
    if (hadTee || isL) assignCodoAfterBranchDelete(engine, ep);
    else scrubPlanCodoAt(engine, ep);
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
  if (!engine.ramales.some((r) => r.mergesFrom)) return;
  const TOL = 0.5;
  for (const d of engine.ramales) {
    if (!d.mergesFrom) continue;
    if (d.mergesFrom[0] === deletedId) {
      // Se borró la mitad aguas arriba — la referencia de la sobreviviente queda muerta.
      d.mergesFrom = undefined;
      continue;
    }
    if (d.mergesFrom[1] !== deletedId) continue;
    const a = engine.ramales.find((r) => r.id === d.mergesFrom![0]);
    if (!a || !a.pts || a.pts.length < 2 || !d.pts || d.pts.length < 2) {
      d.mergesFrom = undefined;
      continue;
    }
    const aLast = a.pts[a.pts.length - 1];
    const dFirst = d.pts[0];
    if (Math.hypot(aLast[0] - dFirst[0], aLast[1] - dFirst[1]) > TOL) {
      // Los extremos ya no coinciden (A o D fueron remodelados tras el split) — fusionar
      // geometría incoherente no tiene sentido; se limpia la referencia.
      d.mergesFrom = undefined;
      continue;
    }
    // Re-unir: A continúa con el cuerpo de D (salvo el punto compartido).
    a.pts = [...a.pts, ...d.pts.slice(1)];
    a.totalL = calculateRamalLength(a.pts, engine);
    // El UC del downstream acreditaba existing.uc + incoming.uc — al borrar el incoming se
    // revierte a la suma que ya traía la mitad aguas arriba.
    a.uc = (d.uc || 0) - deletedUc;
    // Mover los datos de extremo lejano de D a A (se ponían en D al dividir).
    if (d.accesorioFin) a.accesorioFin = d.accesorioFin;
    if (d.diametroFin) a.diametroFin = d.diametroFin;
    if (d.aparatoFin) a.aparatoFin = d.aparatoFin;
    if (d.sifonLabelFin) a.sifonLabelFin = d.sifonLabelFin;
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
    a.labelAngle = _firstSegmentAngle(a.pts);
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
}

export function deleteSelected(engine: IPlanoEngineCore, ids?: string[]): void {
  if (ids && ids.length > 0) {
    engine._yeeFlashKey = null;
    const netsToRenumber = new Set<string>();
    const bajNetsToRenumber = new Set<string>();
    let renumberAreas = false;
    const deletedRamalIds = new Set<string>();
    for (const id of ids) {
      const idxR = engine.ramales.findIndex((r) => r.id === id);
      if (idxR >= 0) {
        const deleted = engine.ramales[idxR];
        deletedRamalIds.add(deleted.id);
        engine.ramales = engine.ramales.filter(
          (r) => r.id !== deleted.id && r.padre !== deleted.id,
        );
        // Ítem 9: si este ramal había partido a otro (incoming de una división mergesFrom), se
        // re-une la línea que quedó en dos mitades.
        remergeSplitRamales(engine, deleted.id, deleted.uc || 0);
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
                delete b.desplazamientos[lvlKey];
                if (b.ghostData) delete b.ghostData[lvlKey];
              }
            }
          }
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
    engine.ramales = engine.ramales.filter((r) => r.id !== deletedId && r.padre !== deleted.id);
    // Ítem 9: si este ramal había partido a otro, se re-une la línea en dos mitades.
    remergeSplitRamales(engine, deletedId, deleted.uc || 0);
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
            delete b.desplazamientos[lvlKey];
            if (b.ghostData) delete b.ghostData[lvlKey];
          }
        }
      }
    }
    engine._renumberRamales(deleted.net);
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
        engine._renumberRamales(deleted.net);
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
          engine._renumberRamales(deleted.net);
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
    engine.bajantes.splice(idxB, 1);
    cascadeMontanteAssociation(engine, deleted);
    if (deleted.tipo === 'bajante') {
      engine._renumberBajantes(deleted.net);
    } else if (deleted.tipo === 'montante') {
      // Un montante a mitad de cuerpo siempre escribió un marcador de tee (accMed) en su ramal
      // huésped al crearse — borrarlo sin esto dejaba ese glifo/conteo para siempre.
      cleanupTeeMarkersAt(engine, [deleted.x, deleted.y]);
      engine._renumberMontantes();
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
