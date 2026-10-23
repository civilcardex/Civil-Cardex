import { leerDocDePlan } from './readPlanDrawing';
import type { Tramo } from '../context/tramosReducer';
import type { BajanteRaw } from './drawingSyncTypes.ts';
import { cmToPlanePx } from '../lib/PlanoEngine/planoCoords.ts';
import { canalOBBDe, puntoEnCanalOBB } from '../lib/PlanoEngine/channelAssociation';
import type { PlanItem } from '../context/PlansContext.tsx';
import { diametroManning } from './calcSanitaryCore.ts';
import { chequeoBajanteLluvia } from './calcRainwater.ts';
import { cDeCubierta } from '../constants/engineeringDataMaterials.ts';
import { calcHydraulicCheck } from './hydraulicCheck.ts';
import { compareTramosPisoDesc } from './componentHelpers.tsx';
import { DIAM_OPTIONS } from '../constants';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';
import { loadFromStorage } from '../services/storageService.ts';
import { distToPolyline } from '../lib/shared/geometry';
import type { DrawingData, RawElement } from './drawingSync.ts';

interface AreaRaw {
  areaM2?: number;
}
/** Override manual (tabla Diseño de lluvias) de un bajante de aguas lluvias: áreas, intensidad
 *  (mm/h), material de cubierta — lo escrito a mano manda sobre lo del dibujo. */
export interface BajanteLl {
  bajante?: string;
  id?: string;
  areaAcumulada?: number;
  /** Área de "Otras" superficies (m²) que también le llueven encima al bajante, editable a mano; arranca en 0. */
  areaOtras?: number;
  areaParcial?: number;
  intensidad?: number;
  coeficienteC?: number;
  /** Material de cubierta (nombre completo) — C efectivo derivado del catálogo. */
  materialCubierta?: string;
}

/**
 * Ramales DE los canales (orig. usuario): los marcados `esCanalId` y los que DESCARGAN en un
 * canal (extremo dentro del OBB — misma regla que el motor) — fuera de la tabla de diseño.
 * @returns claves `${id}-${planId}` (formato _key de tramos).
 */
export function computeCanalBajanteRamalKeys(plans: PlanItem[]): Set<string> {
  const keys = new Set<string>();
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const data = leerDocDePlan<DrawingData>(plan.id);
    if (!data) continue;
    const canales = (data.bajantes || []).filter(
      (b): b is BajanteRaw & { base?: number; longitud?: number; angulo?: number } =>
        b.net === 'll' && b.tipo === 'canal',
    );
    if (canales.length === 0) continue;
    // px de plano por cm, según la escala del propio documento.
    const pxPerCm = cmToPlanePx(Number(data.scaleM ?? 0.5), 1); // px de plano por cm — MISMA conversión que el engine (antes: invertida, rect 25-100x el canal)

    const enRectCanal = (p: number[]) =>
      canales.some((c) => {
        if (c.x == null || c.y == null) return false;
        // OBB (válido en diagonal): misma regla efectiva que el motor (canalMarco).
        return puntoEnCanalOBB(canalOBBDe(pxPerCm, c), p[0], p[1], 4);
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

/** Mayor diámetro (en pulgadas) entre los ramales conectados al bajante (los de recibeDeIds/alimentaIds (ramales que llegan/salen del bajante)) en aguas lluvias (ll (Lluvias)). */
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

/**
 * Qué códigos de bajante alimentan cada ramal — la misma BFS de proximidad geométrica de la
 * tabla DisenoLluvias, compartida con la memoria para que ambas reporten lo mismo.
 * @returns mapa clave-de-ramal → códigos de bajante ('BAN2-P2').
 */
export function buildLlBajanteAssociations(
  tramosLl: Tramo[],
  plans: PlanItem[],
): Record<string, string[]> {
  // Set por clave: la pertenencia (¿ya enlazado?) era un .includes sobre un array que crece.
  const calculoMap = new Map<string, Set<string>>();
  const enlazar = (padre: string, hijo: string): void => {
    let set = calculoMap.get(padre);
    if (!set) {
      set = new Set<string>();
      calculoMap.set(padre, set);
    }
    set.add(hijo);
  };

  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const data = leerDocDePlan<DrawingData>(plan.id);
    if (!data) continue;

    const ramales = (data.ramales || []).filter((r) => r.net === 'll');
    // Canales fuera: no son bajantes (glifo recolector) y un recibeDeIds legacy del canal no
    // debe contar como asociación de descarga.
    // Cajas CALL fuera: no son bajantes (glifo de captura) — ni endpoint de asociación ni chip.
    // Tolerante a bajantes viejos SIN campo tipo: excluir por tipo explícito, no exigir 'bajante'.
    const bajantes = (data.bajantes || []).filter(
      (b): b is BajanteRaw =>
        b.net === 'll' && b.tipo !== 'canal' && b.tipo !== 'caja_ll' && b.x != null && b.y != null,
    );

    // Set de los ramales que cada bajante recibe (el .includes dentro del bucle era O(n)).
    const recibePorBajante = new Map<string, Set<string>>();
    for (const b of bajantes) {
      if (b.id) recibePorBajante.set(b.id, new Set(b.recibeDeIds || []));
    }
    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const rKey = `${r.id}-${plan.id}`;

      const checkEndpoint = (pt: number[]) => {
        for (const b of bajantes) {
          const recibe = b.id ? recibePorBajante.get(b.id) : undefined;
          const isExplicit = !!recibe && (recibe.has(r.id) || (!!r.label && recibe.has(r.label)));
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
        enlazar(targetKey, rKey);
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
      const children = calculoMap.get(node) ?? new Set<string>();
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

/** Caudal (Q (Caudal), L/s) de un bajante de lluvias (ll (Lluvias)): manda el valor escrito a mano; si no, el cálculo con el área; sin material de cubierta elegido da 0 (no se inventa). */
export function qBajanteLl(
  bajante: { id?: string; code?: string; area_m2?: number; caudal?: number },
  manual?: BajanteLl | null,
  areaPisoFallback = 0,
): number {
  // Requisito ABSOLUTO del material de cubierta (decisión del usuario): sin material elegido
  // no hay Q — ni con caudal manual del dibujo ni con override de áreas (antes C=1 implícito).
  const C = cDeCubierta(manual?.materialCubierta ?? '');
  if (!C) return 0;
  if (bajante.caudal != null && bajante.caudal > 0) return bajante.caudal;
  if (manual) {
    const areaParcial = manual.areaParcial ?? bajante.area_m2 ?? 0;
    const areaTotal = areaParcial + (manual.areaOtras ?? 0);
    if (areaTotal > 0) {
      return chequeoBajanteLluvia({
        areaAcumulada: areaTotal,
        intensidad: manual.intensidad ?? 100,
        coeficienteC: C,
      }).Q;
    }
  }
  const area = bajante.area_m2 || areaPisoFallback || 0;
  if (area <= 0) return 0;
  return chequeoBajanteLluvia({ areaAcumulada: area, intensidad: 100, coeficienteC: C }).Q;
}

/** Área que aporta un bajante de lluvias (ll (Lluvias)) (m²): la del dibujo; si no, la del glifo; si no, la escrita a mano. */
export function areaParcialBajanteLl(
  areaDibujo: number | undefined,
  areaGlifo: number | undefined,
  manual?: { areaParcial?: number } | null,
): number {
  return areaDibujo || areaGlifo || manual?.areaParcial || 0;
}

/** Material de cubierta que comparten TODOS los bajantes que alimentan a un canal: si mezclan materiales (o ninguno lo tiene) devuelve '' — sin material no hay coeficiente de escorrentía y el cálculo no arranca. */
export function materialComun(materiales: Array<string | undefined>): string {
  const primero = materiales[0];
  if (!primero) return '';
  return materiales.every((m) => m === primero) ? primero : '';
}

/** Suma del área "Otras" (m²) de los bajantes que alimentan a un canal (los que no tengan nada cuentan 0). */
export function sumaOtrasAsociados(overrides: Array<{ areaOtras?: number } | undefined>): number {
  return overrides.reduce((s, o) => s + (o?.areaOtras ?? 0), 0);
}

/** Reparte el "Área Otras" del canal entre los N bajantes que lo alimentan (en centavos de m² para que la suma sea exacta; se puede repetir sin duplicar). */
export function repartirOtrasCanal(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((total * 100) / n) / 100; // centavos de m² para evitar flotantes
  const vals = Array.from({ length: n }, () => base);
  const residuo = Math.round((total - base * n) * 100) / 100;
  vals[0] = Math.round((vals[0] + residuo) * 100) / 100;
  return vals;
}

// Caudal (LPS) que llega a cada tramo — escorrentía propia para un bajante, escorrentía del área
// acumulada para un ramal colector vía sus bajantes asociados. Compartido con la exportación de
// memoria.
/**
 * Q (Caudal, L/s) por clave de tramo de aguas lluvias: baja la lluvia acumulada (áreas de
 * áreas-dibujo + overrides manuales repartidos) por la cadena bajante→canal→ramal.
 * @returns mapa _key de tramo → Q en L/s (0 donde no llueve nada acumulado).
 */
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
    // Mismo cálculo que el panel (qBajanteLl): una sola precedencia. El caudal manual del
    // dibujo (t.qLps) también queda gated por el material del override (requisito absoluto).
    const manual = bajantesLl.find(
      (b) => b.bajante === t.id || b.bajante === t.code || b.id === t.id || b.id === t.code,
    );
    const conMaterial = !!cDeCubierta(manual?.materialCubierta ?? '');
    const ownQ = qBajanteLl(t, manual) || (conMaterial ? t.qLps || 0 : 0);
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

        // Área TOTAL (orig. usuario) = Parcial + Otras. Parcial con la MISMA fórmula
        // compartida del chequeo de bajantes y del canal (areaParcialBajanteLl: área
        // dibujada del tramo bajante > override manual) — antes: manual primero, y el Q
        // del mismo bajante divergía entre "Diseño de red" y "Chequeo bajantes". El total
        // del piso queda como ÚLTIMO fallback (sin dibujo ni override).
        const areaParcial =
          areaParcialBajanteLl(trBaj?.area_m2, undefined, bajante) ||
          areaAcumMap[String(trBaj?.piso)] ||
          0;
        const areaTotal = areaParcial + (bajante?.areaOtras ?? 0);

        if (bajante) {
          // C SOLO del material de cubierta (requisito absoluto): sin material → C=0 → sin Q.
          const Q = chequeoBajanteLluvia({
            areaAcumulada: areaTotal,
            intensidad: bajante.intensidad ?? 100,
            coeficienteC: cDeCubierta(bajante.materialCubierta ?? '') ?? 0,
          }).Q;
          total += Q;
        }
        // (fallback trBaj con C=1 retirado — requisito absoluto del material: sin fila de
        // override no hay material conocido y el bajante no aporta Q.)
      }
      // Caudal manual del ramal (dibujo) también gated: sin material en NINGÚN bajante
      // asociado no hay Q (decisión del usuario).
      const algunMaterial = associatedCodes.some((code) => {
        const b = bajantesLl.find((x) => x.bajante === code || x.id === code);
        return !!cDeCubierta(b?.materialCubierta ?? '');
      });
      if (total === 0 && t.qLps && algunMaterial) {
        total = t.qLps;
      }
    } else {
      total = ownQMap[t._key] || 0;
    }
    totalQMap[t._key] = total;
  }
  return totalQMap;
}

/**
 * Ids de tributarios (de dónde BEBEN los tramos): los recibeDe + los id listados en la
 * descripción 'A+B'. @returns el Set para filtrar ramal vs tributario.
 */
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

/** Fila de la tabla de diseño de aguas lluvias: Q, diámetros (calculado/disponible/interno
 *  mm), velocidad y tirantes (crítico/normal, Froude (numero adimensional de regimen)) + chequeos. */
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

/**
 * Fila de diseño hidráulico por tramo para aguas lluvias — mismas fórmulas que DisenoLluvias
 * (Manning (formula de flujo en tuberia) + Froude (numero adimensional de regimen) + fuerza tractiva),
 * ordenadas piso descendente.
 */
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
      // Chequeo de diámetro (como red sanitaria): D diseño >= D calculado; REQ: incompleto
      // (sin D diseño o sin D calculado) = 'No cumple' — fuera el '—'.
      chequeoD:
        DdisPulg > 0 && DcalcPulg > 0 ? (DdisPulg >= DcalcPulg ? 'Ok' : 'No cumple') : 'No cumple',
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
