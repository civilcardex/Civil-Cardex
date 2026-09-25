import type { Tramo } from '../context/tramosReducer';
import { cmToPlanePx } from '../lib/PlanoEngine/planoCoords';
import type { PlanItem } from '../context/PlansContext';
import { diametroManning } from './calcSanitaryCore';
import { chequeoBajanteLluvia } from './calcRainwater';
import { calcHydraulicCheck } from './hydraulicCheck';
import { compareTramosPisoDesc } from './componentHelpers';
import { DIAM_OPTIONS } from '../constants';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { distToPolyline } from '../lib/shared/geometry';
import type { DrawingData, RawElement } from './drawingSync';

interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
}
interface AreaRaw {
  areaM2?: number;
}
export interface BajanteLl {
  bajante?: string;
  id?: string;
  areaAcumulada?: number;
  /** Área Otras (orig. usuario): editable, default 0 — Total = Parcial + Otras. */
  areaOtras?: number;
  areaParcial?: number;
  intensidad?: number;
  coeficienteC?: number;
}

// Ramales DE los canales (orig. usuario): los marcados `esCanalId` por finishRamal (geometría
// del canal) y los que DESCARGAN en un canal (último punto dentro del rectángulo del canal,
// que crece desde (x,y) según longitud/base en cm a la escala del doc) — fuera de la tabla
// Diseño de red aguas lluvias. Claves `${id}-${planId}` (mismo formato _key de los tramos).
export function computeCanalBajanteRamalKeys(plans: PlanItem[]): Set<string> {
  const keys = new Set<string>();
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    const canales = (data.bajantes || []).filter(
      (b): b is BajanteRaw & { base?: number; longitud?: number } =>
        b.net === 'll' && b.tipo === 'canal',
    );
    if (canales.length === 0) continue;
    // px de plano por cm, según la escala del propio documento.
    const pxPerCm = cmToPlanePx(Number(data.scaleM ?? 0.5), 1); // px de plano por cm — MISMA conversión que el engine (antes: invertida, rect 25-100x el canal)

    const enRectCanal = (p: number[]) =>
      canales.some((c) => {
        if (c.x == null || c.y == null) return false;
        const w = (c.longitud ?? 0) * pxPerCm;
        const h = (c.base ?? 0) * pxPerCm;
        const pad = 4;
        return (
          p[0] >= c.x - pad && p[0] <= c.x + w + pad && p[1] >= c.y - pad && p[1] <= c.y + h + pad
        );
      });

    for (const r of (data.ramales || []) as Array<RawElement & { esCanalId?: string | null }>) {
      if (r.net !== 'll' || !r.pts || r.pts.length < 2) continue;
      if (r.esCanalId) {
        keys.add(`${r.id}-${plan.id}`);
        continue;
      }
      // Cualquier extremo tocando el canal (llega, sale o conecta canal↔bajante): fuera de
      // Diseño de red y de "Ramales asociados" del chequeo.
      if (enRectCanal(r.pts[0]) || enRectCanal(r.pts[r.pts.length - 1])) {
        keys.add(`${r.id}-${plan.id}`);
      }
    }
  }
  return keys;
}

/** Regla ll: diámetro del bajante >= diámetro de sus ramales conectados directos (recibeDeIds).
 *  Devuelve el máximo pulg de esos ramales (0 si no hay ninguno con diámetro). */
export function maxRamalPulgDeBajante(
  bajanteId: string,
  planId: string,
  tramosLl: Tramo[],
): number {
  const b = tramosLl.find(
    (t) => t.esBajante && t.id === bajanteId && String(t.planId ?? '') === String(planId),
  );
  let max = 0;
  for (const rid of b?.recibeDeIds || []) {
    const r = tramosLl.find(
      (t) => !t.esBajante && t.id === rid && String(t.planId ?? '') === String(planId),
    );
    if (r && (r.diamDisPulg || 0) > max) max = r.diamDisPulg || 0;
  }
  return max;
}

/** Regla ll (sentido inverso): pulg del bajante en el que descarga el ramal (campo `hasta`),
 *  0 si no hay bajante destino con diámetro. */
export function minBajantePulgDeRamal(ramalId: string, planId: string, tramosLl: Tramo[]): number {
  const r = tramosLl.find(
    (t) => !t.esBajante && t.id === ramalId && String(t.planId ?? '') === String(planId),
  );
  if (!r?.hasta) return 0;
  const b = tramosLl.find(
    (t) => t.esBajante && t.id === r.hasta && String(t.planId ?? '') === String(planId),
  );
  return b?.diamDisPulg || 0;
}

// Qué códigos de bajante alimentan cada ramal — la misma BFS de proximidad geométrica usada por
// la tabla DisenoLluvias, compartida con la exportación de memoria para que ambas reporten las
// mismas asociaciones.
export function buildLlBajanteAssociations(
  tramosLl: Tramo[],
  plans: PlanItem[],
): Record<string, string[]> {
  const calculoMap: Record<string, string[]> = {};

  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data: DrawingData = raw as DrawingData;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
    }

    const ramales = (data.ramales || []).filter((r) => r.net === 'll');
    // Canales fuera: no son bajantes (glifo recolector) y un recibeDeIds legacy del canal no
    // debe contar como asociación de descarga.
    // Cajas CALL fuera: no son bajantes (glifo de captura) — ni endpoint de asociación ni chip.
    // Tolerante a bajantes viejos SIN campo tipo: excluir por tipo explícito, no exigir 'bajante'.
    const bajantes = (data.bajantes || []).filter(
      (b): b is BajanteRaw =>
        b.net === 'll' && b.tipo !== 'canal' && b.tipo !== 'caja_ll' && b.x != null && b.y != null,
    );

    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const rKey = `${r.id}-${plan.id}`;

      const checkEndpoint = (pt: number[]) => {
        for (const b of bajantes) {
          const isExplicit =
            b.recibeDeIds &&
            (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
          const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
          if (isExplicit) {
            const otherPt = pt === pEnd ? pStart : pEnd;
            const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
            if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
            continue;
          }
          if (dist < 2.0) {
            return { type: 'bajante' as const, id: b.id };
          }
        }
        let bestRx: RawElement | null = null;
        let minDist = Infinity;
        for (const rx of ramales) {
          if (rx.id === r.id) continue;
          if (!rx.pts || rx.pts.length < 2) continue;
          const dist = distToPolyline(pt, rx.pts);
          if (dist < 2.0 && dist < minDist) {
            minDist = dist;
            bestRx = rx;
          }
        }
        if (bestRx) {
          return { type: 'ramal' as const, id: bestRx.id };
        }
        return null;
      };

      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null,
      );

      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
        if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
      }
    }
  }

  const ramalToBajantes: Record<string, string[]> = {};
  // Las cajas (CALL) tienen tramo esBajante pero no son bajantes: fuera de las semillas
  // del BFS para que nunca salgan como chips "Bajantes asociados".
  const isCajaCode = (s: string) => s.startsWith('CALL');
  const bajanteKeys = tramosLl
    .filter(
      (t) =>
        t.esBajante &&
        t._key &&
        !isCajaCode(String(t.code ?? '')) &&
        !isCajaCode(String(t.id ?? '')),
    )
    .map((t) => ({ key: t._key!, code: t.code || t.id }));

  for (const b of bajanteKeys) {
    const queue = [b.key];
    const visited = new Set<string>();
    visited.add(b.key);

    while (queue.length > 0) {
      const node = queue.shift()!;
      const children = calculoMap[node] || [];
      for (const child of children) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
          if (!ramalToBajantes[child]) ramalToBajantes[child] = [];
          if (!ramalToBajantes[child].includes(b.code)) {
            ramalToBajantes[child].push(b.code);
          }
        }
      }
    }
  }

  return ramalToBajantes;
}

/** Q (LPS) de UN bajante de aguas lluvias — ÚNICA precedencia para panel y tablas:
 *  caudal manual del dibujo > override manual con Área TOTAL (Parcial + Otras)/I/C > área
 *  del dibujo > fallback del área del piso. Antes: 4 fórmulas distintas (panel, computeLlQMap,
 *  chequeo bajantes, export) discrepaban para el mismo elemento. */
export function qBajanteLl(
  bajante: { id?: string; code?: string; area_m2?: number; caudal?: number },
  manual?: BajanteLl | null,
  areaPisoFallback = 0,
): number {
  if (bajante.caudal != null && bajante.caudal > 0) return bajante.caudal;
  if (manual) {
    const areaParcial = manual.areaParcial ?? bajante.area_m2 ?? 0;
    const areaTotal = areaParcial + (manual.areaOtras ?? 0);
    if (areaTotal > 0) {
      return chequeoBajanteLluvia({
        areaAcumulada: areaTotal,
        intensidad: manual.intensidad ?? 100,
        coeficienteC: manual.coeficienteC ?? 0.0278,
      }).Q;
    }
  }
  const area = bajante.area_m2 || areaPisoFallback || 0;
  if (area <= 0) return 0;
  return chequeoBajanteLluvia({ areaAcumulada: area, intensidad: 100, coeficienteC: 0.0278 }).Q;
}

// Caudal (LPS) que llega a cada tramo — escorrentía propia para un bajante, escorrentía del área
// acumulada para un ramal colector vía sus bajantes asociados. Compartido con la exportación de
// memoria.
export function computeLlQMap(
  tramosLl: Tramo[],
  plans: PlanItem[],
  bajantesLl: BajanteLl[],
  associations: Record<string, string[]>,
): Record<string, number> {
  const areaAcumMap: Record<string, number> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<(DrawingData & { areas?: AreaRaw[] }) | string | null>(
      TRAZOS_PREFIX + plan.id,
      null,
    );
    if (!raw) continue;
    let data: DrawingData & { areas?: AreaRaw[] } = raw as DrawingData & { areas?: AreaRaw[] };
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    const totalArea = (data.areas || []).reduce((s, a) => s + (a.areaM2 || 0), 0);
    areaAcumMap[String(plan.nivel)] = totalArea;
  }

  const ownQMap: Record<string, number> = {};
  for (const t of tramosLl) {
    if (!t._key) continue;
    // Mismo cálculo que el panel (qBajanteLl): una sola precedencia.
    const manual = bajantesLl.find(
      (b) => b.bajante === t.id || b.bajante === t.code || b.id === t.id || b.id === t.code,
    );
    const ownQ = qBajanteLl(t, manual) || t.qLps || 0;
    ownQMap[t._key] = ownQ;
  }

  const totalQMap: Record<string, number> = {};
  for (const t of tramosLl) {
    if (!t._key) continue;

    let total = 0;
    if (t.tipo === 'ramal' && !t.esBajante) {
      const associatedCodes = associations[t._key] || [];
      for (const code of associatedCodes) {
        const bajante = bajantesLl.find((b) => b.bajante === code || b.id === code);
        const trBaj = tramosLl.find((tb) => tb.code === code || tb.id === code);

        // Área TOTAL (orig. usuario) = Parcial + Otras: la parcial del dibujo (override manual
        // del bajante primero, total del piso como fallback) más las Otras editables.
        const areaTotal =
          (bajante?.areaParcial || areaAcumMap[String(trBaj?.piso)] || 0) +
          (bajante?.areaOtras ?? 0);

        if (bajante) {
          const Q = chequeoBajanteLluvia({
            areaAcumulada: areaTotal,
            intensidad: bajante.intensidad ?? 100,
            coeficienteC: bajante.coeficienteC ?? 0.0278,
          }).Q;
          total += Q;
        } else if (trBaj) {
          const Q = chequeoBajanteLluvia({
            areaAcumulada: areaTotal,
            intensidad: 100,
            coeficienteC: 0.0278,
          }).Q;
          total += Q;
        }
      }
      if (total === 0 && t.qLps) {
        total = t.qLps;
      }
    } else {
      total = ownQMap[t._key] || 0;
    }
    totalQMap[t._key] = total;
  }
  return totalQMap;
}

export function getTributarioIds(
  tramos: Array<{ recibeDe?: string[]; descripcion?: string; id: string }>,
): Set<string> {
  const tribSet = new Set<string>();
  for (const t of tramos) {
    if (t.recibeDe) {
      for (const id of t.recibeDe) tribSet.add(id);
    }
    if (t.descripcion) {
      const ids = t.descripcion
        .split('+')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const id of ids) tribSet.add(id);
    }
  }
  return tribSet;
}

export interface LlRow {
  tKey: string;
  id: string;
  piso: number;
  desde?: string;
  hasta?: string;
  bajantesAsociadas: string[];
  Q: number;
  n: number;
  sVal: number;
  DcalcPulg: number;
  DdisPulg: number;
  chequeoD: string;
  DintMm: number;
  Qo: number;
  Vo: number;
  qqo: number;
  Vreal: number;
  chequeoV: string;
  Yc: number;
  Yn: number;
  Froude: number;
  tipoFlujo: string;
  Ymax: number;
  chequeoYn: string;
  fuerzaTractiva: number;
  chequeoFT: string;
}

// Fila de diseño hidráulico por-tramo para aguas lluvias — mismas fórmulas que la tabla de
// DisenoLluvias.
export function computeLlRows(
  displayTramos: Tramo[],
  qMap: Record<string, number>,
  associations: Record<string, string[]>,
): LlRow[] {
  return displayTramos.toSorted(compareTramosPisoDesc).map((t) => {
    const tKey = t._key ?? '';
    const n = t.nmaning ?? 0;
    const sVal = t.sPercent ?? 0;
    const S = sVal != null && sVal > 0 ? sVal / 100 : null;
    const Q = qMap[tKey] || 0;
    const dSel = DIAM_OPTIONS.find((d) => d.pulg === (t.diamDisPulg || 0)) || null;
    let DcalcPulg = 0;
    const DdisPulg = dSel ? dSel.pulg : 0;
    const DintMm = dSel ? dSel.mm : 0;
    let Qo = 0,
      Vo = 0,
      qqo = 0;
    let Vreal = 0,
      chequeoV = '—';
    let Yc = 0,
      Yn = 0,
      Froude = 0,
      tipoFlujo = '—',
      Ymax = 0,
      chequeoYn = '—';
    let fuerzaTractiva = 0,
      chequeoFT = '—';
    if (Q > 0 && S != null && S > 0 && n != null && n > 0) {
      DcalcPulg = Math.round(((diametroManning(Q / 1000, n, S) * 1000) / 25.4) * 100) / 100;
    }
    if (Q > 0 && S != null && S > 0 && n != null && n > 0 && DintMm > 0) {
      const hc = calcHydraulicCheck({ Q, S, n, DintMm });
      Qo = hc.Qo;
      Vo = hc.Vo;
      qqo = hc.qqo;
      Vreal = hc.Vreal;
      chequeoV = hc.chequeoV;
      Yc = hc.Yc;
      Yn = hc.Yn;
      Froude = hc.Froude;
      tipoFlujo = hc.tipoFlujo;
      Ymax = hc.Ymax;
      chequeoYn = hc.chequeoYn;
      fuerzaTractiva = hc.fuerzaTractiva;
      chequeoFT = hc.chequeoFT;
    }
    return {
      tKey,
      id: t.id || tKey,
      piso: t.piso,
      desde: t.desde,
      hasta: t.hasta,
      bajantesAsociadas: associations[tKey] || [],
      Q,
      n,
      sVal,
      DcalcPulg,
      DdisPulg,
      // Chequeo de diámetro (como red sanitaria): D diseño >= D calculado.
      chequeoD: DdisPulg > 0 && DcalcPulg > 0 ? (DdisPulg >= DcalcPulg ? 'Ok' : 'No cumple') : '—',
      DintMm,
      Qo,
      Vo,
      qqo,
      Vreal,
      chequeoV,
      Yc,
      Yn,
      Froude,
      tipoFlujo,
      Ymax,
      chequeoYn,
      fuerzaTractiva,
      chequeoFT,
    };
  });
}
