import { distToPolyline } from '../../lib/shared/geometry';
import { resolveJunctionEntrant } from '../../utils/flowDirection';

/** Un ramal del plano (lo mínimo que usa el cálculo de las claves combinadas). */
export interface RamalMerge {
  id: string;
  net?: string;
  tipo?: string;
  label?: string;
  fin?: string;
  ini?: string;
  pts?: number[][];
  _tribReversed?: boolean;
  mergesFrom?: string[];
}

/** Un bajante/montante del piso (para saber a quién desemboca un extremo). */
export interface BajanteMerge {
  id: string;
  code?: string;
  x: number;
  y: number;
}

/**
 * Claves de conteo que el ramal elegido debe MOSTRAR (el combinado de su empalme + el subárbol
 * aguas arriba).
 *
 * Unir AMBAS fuentes de verdad de flujo: mergesFrom (auto-split) + geometría (extremo-a-extremo).
 * RS3 suele ser extremo-a-extremo (sin mergesFrom) pero RS5 es auto-split (con mergesFrom); el
 * subárbol completo de RS3 debe incluir ambos.
 *
 * Antes solo se usaba mergesFrom y RS3 dibujado a mano quedaba en 0 ("muestra de menos").
 */
export function calcularMergeKeys(args: {
  target: RamalMerge;
  netId: string;
  planId?: string | number;
  allRamalesForPlan: RamalMerge[];
  bajantes: BajanteMerge[];
}): string[] | null {
  const { target, netId, planId, allRamalesForPlan, bajantes } = args;
  // Índices: los lookups por id/código eran un `find` POR RAMAL dentro del walk -> O(n²).
  const porId = new Map(allRamalesForPlan.map((r) => [r.id, r]));
  const codigosDeBajante = new Set(bajantes.map((b) => b.code).filter(Boolean) as string[]);
  const idsDeBajante = new Set(bajantes.map((b) => b.id));
  if (!target?.id || !netId) return null;
  const keyFor = (id: string) => (planId ? `${netId}_${id}_${planId}` : `${netId}_${id}`);
  // Unir AMBAS fuentes de verdad de flujo: mergesFrom (auto-split) + geometría
  // (extremo-a-extremo). RS3 suele ser extremo-a-extremo (sin mergesFrom) pero RS5 es
  // auto-split (con mergesFrom); el subárbol completo de RS3 debe incluir ambos.
  // Antes solo se usaba mergesFrom y RS3 dibujado a mano quedaba en 0 ("muestra de menos").
  const mergeSiblingPairs = new Set<string>();
  for (const r of allRamalesForPlan) {
    if (r.mergesFrom) mergeSiblingPairs.add(r.mergesFrom.toSorted().join('|'));
  }
  const geomKeysForSan = (): string[] => {
    if (netId !== 'san' || !target?.id) return [];
    const visited = new Set<string>([target.id]);
    const keys: string[] = [];
    const collect = (id: string) => {
      const t = porId.get(id);
      if (!t || !t.pts || t.pts.length < 2) return;
      const tDownstream = t._tribReversed ? t.pts[0] : t.pts[t.pts.length - 1];
      for (const f of allRamalesForPlan) {
        if (f.id === id || f.net !== netId || visited.has(f.id)) continue;
        if (!f.pts || f.pts.length < 2) continue;
        if (f.tipo === 'bajante' || f.tipo === 'montante') continue;
        if (mergeSiblingPairs.has([f.id, t.id].sort().join('|'))) continue;
        // Dos ramales que desembocan en el mismo bajante no se consideran que drenan entre sí
        const fFinCheck = (f as unknown as { fin?: string }).fin || '';
        const tFinCheck = (t as unknown as { fin?: string }).fin || '';
        if (tFinCheck && fFinCheck && tFinCheck === fFinCheck) {
          const isBajanteFin = (fid: string) => {
            if (
              /^B[A-Z]+/.test(fid) ||
              fid.startsWith('BAN') ||
              fid.startsWith('BALL') ||
              fid.startsWith('BREV')
            )
              return true;
            // fallback: buscar en bajantes reales
            if (codigosDeBajante.has(fid) || idsDeBajante.has(fid)) return true;
            return false;
          };
          if (isBajanteFin(tFinCheck)) continue;
        }
        const fEnd = f._tribReversed ? f.pts[0] : f.pts[f.pts.length - 1];
        if (distToPolyline(fEnd, t.pts) >= 2.0) continue;
        // Si ambos terminan en el mismo bajante geométricamente, no agregar
        if (bajantes) {
          const bajAtTDown = bajantes.find(
            (b) => Math.hypot(b.x - tDownstream[0], b.y - tDownstream[1]) < 2.0,
          );
          const bajAtFEnd = bajantes.find((b) => Math.hypot(b.x - fEnd[0], b.y - fEnd[1]) < 2.0);
          if (bajAtTDown && bajAtFEnd && bajAtTDown.id === bajAtFEnd.id) continue;
        }
        const touchesTDownstream =
          Math.hypot(fEnd[0] - tDownstream[0], fEnd[1] - tDownstream[1]) < 2.0;
        if (touchesTDownstream) {
          const tFin = (t as unknown as { fin?: string }).fin || '';
          if (!tFin) continue;
          const finIsRamalAtPt = allRamalesForPlan.some(
            (o) =>
              (o.id === tFin || (o as unknown as { label?: string }).label === tFin) &&
              o.pts &&
              o.pts.length >= 2 &&
              distToPolyline(fEnd, o.pts) < 2.0,
          );
          if (finIsRamalAtPt) continue;
        }
        visited.add(f.id);
        keys.push(keyFor(f.id));
        collect(f.id);
      }
    };
    collect(target.id);
    return keys;
  };
  // Si target es el ramal auto-creado, su propio mergesFrom es el par de fuentes; si no,
  // hallar el ramal auto-creado que lista a target como una de sus dos fuentes.
  const isAutoCreated = !!target.mergesFrom;
  const hostR = isAutoCreated
    ? target
    : allRamalesForPlan.find((r) => r.net === netId && r.mergesFrom?.includes(target.id!));
  if (!hostR?.mergesFrom) {
    const g = geomKeysForSan();
    return g.length > 0 ? g : null;
  }
  const [aId, bId] = hostR.mergesFrom;
  if (!aId || !bId) return null;
  // `hostR.mergesFrom` es siempre [existing.id, incoming.id] por construcción
  // (PlanoEngineDrawing.ts, autoSplitJunctionAndSumFlow). Cuál de los tres ramales de este
  // empalme (existing, hostR=downstream, incoming) MUESTRA el total combinado se decide solo por
  // la dirección actual del flujo — no está fijo a "existing" ni al "auto-creado":
  // junctionHasOutgoingFlow ya garantiza al menos uno de los tres flujos FUERA del empalme, así
  // que con tres ramales la división es siempre 2-vs-1, y el único disidente (el que discrepa de
  // los otros dos) es el entrante. Coincide con waterNetworkRows.ts / WaterNetworkDesign.tsx.
  if (!hostR.id || !hostR.pts || hostR.pts.length === 0) return null;
  // Para la sidebar de aparatos mostrar el combinado en CUALQUIERA de los participantes
  // (auto o fuente), no solo en el entrante — el usuario espera ver en RS3 (auto) el total
  // RS5+RS2 (+ RS1,RS4 transitivos), igual que la tabla TOTAL. Antes solo el entrante
  // (tributario) veía el combinado y RS3 quedaba en 0 ("muestra de menos").
  const targetIsInMerge = hostR.mergesFrom.includes(target.id!);
  if (!targetIsInMerge && hostR.id !== target.id) return null;
  const jc = hostR.pts[0];
  const existingObj = porId.get(aId);
  const incomingObj = porId.get(bId);
  // `resolveJunctionEntrant` = la pata MINORITARIA por rol de flujo del empalme: 2 salidas +
  // 1 entrada → la ENTRADA; 2 entradas + 1 salida → la SALIDA (orig. usuario AF/AC/gas).
  const entrantId = existingObj
    ? resolveJunctionEntrant(
        jc,
        existingObj,
        { id: hostR.id, pts: hostR.pts, _tribReversed: Boolean(hostR._tribReversed) },
        incomingObj,
      )
    : aId;
  // AF/AC/gas (orig. usuario): SOLO la pata única muestra el combinado y es de solo lectura;
  // las otras dos patas muestran sus UDs propias y quedan asignables manualmente. San/ll
  // conserva el comportamiento anterior (combinado en cualquiera de los participantes).
  const esRedAgua = netId === 'af' || netId === 'ac' || netId === 'gas';
  if (esRedAgua ? entrantId !== target.id : hostR.id !== target.id && entrantId !== target.id)
    return null;
  // TRANSITIVIDAD: un ramal auto-creado puede ser a su vez fuente de un empalme aguas arriba
  // (cadena RS1+T1RS1→RS2, RS2+T2RS2→RS3). Las fuentes directas de RS3 incluyen a RS2, que
  // es también un merge point sin aparatos propios — sus conteos viven en RS1/T1RS1. Sumar
  // solo un nivel dejaba el panel de RS3 con los aparatos del tributario directo pero sin la
  // cadena acumulada (la tabla de diseño sí muestra el total transitivo). Recolectar todo el
  // subárbol aguas arriba (cada ramal aparece una sola vez).
  const seen = new Set<string>();
  const allKeys: string[] = [];
  const collect = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (id !== target.id) allKeys.push(keyFor(id));
    const r = porId.get(id);
    if (r?.mergesFrom) for (const src of r.mergesFrom) collect(src);
  };
  collect(hostR.id);
  // Unión con geom para robustez (cubre extremo-a-extremo donde mergesFrom no registra un
  // alimentador pero geométricamente sí existe).
  const geomExtra = geomKeysForSan().filter((k) => !allKeys.includes(k));
  return geomExtra.length > 0 ? [...allKeys, ...geomExtra] : allKeys;
}
