import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { _midpoint } from './PlanoEngineDrawing';
import { _firstSegmentAngle } from './drawingAngles';
import { decrementAccesorioCount } from './deleteCascade';

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

/** Limpia el marcador de tee del ramal en el punto cuando, tras un borrado, la unión ya no es una tee real. */
export function cleanupTeeMarkersAt(engine: IPlanoEngineCore, pt: number[]): void {
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
/** Quita los marcadores de tee a mitad de ramal (accMed) en el punto dado. */
export function scrubAccMedTeeAt(engine: IPlanoEngineCore, pt: number[]): void {
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
/** Quita los codos de plano (90°/45°) que quedaron colgando en el punto tras borrar el tributario que los formó. */
export function scrubPlanCodoAt(engine: IPlanoEngineCore, pt: number[]): void {
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

/** Tras borrar un ramal, decide qué hacer con la unión que dejó: asignar un codo si queda
 *  una esquina viva, o limpiar los marcadores residuales si el punto quedó muerto o recto. */
export function cleanupJunctionsAfterRamalDelete(
  engine: IPlanoEngineCore,
  deleted: PlanoRamal,
): void {
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
