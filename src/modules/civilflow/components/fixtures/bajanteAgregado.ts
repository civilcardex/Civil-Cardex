import { countKey } from '../../utils/claves.ts';
import { leerLibrosPresion, udPropiaDe } from '../../utils/propagation';
import { idsServidosPorBajante, type InheritPoolRamal } from '../../utils/bajanteAsocCompartido.ts';
import type { CountsMap } from '../aparatosAlmacenamiento.ts';

/** Un tramo del panel (lo mínimo que usa el agregado). */
export interface TramoPanel {
  _key?: string;
  id?: string;
  esBajante?: boolean;
  tipo?: string;
  ini?: string;
  fixtures?: Record<string, number>;
  [k: string]: unknown;
}

/** Conectividad sanitaria (el árbol de bajantes del piso). */
export interface ConectividadSan {
  fullChildrenMap: Record<string, string[]>;
}

/** Lo mínimo del motor que usa el agregado. */
export interface MotorAgregado {
  bajantes?: Array<{
    id: string;
    code?: string;
    tipo?: string;
    net?: string;
    x?: number;
    y?: number;
    recibeDeIds?: string[];
    alimentaIds?: string[];
    asocManual?: string[];
  }>;
  ramales?: unknown[];
}

/**
 * Suma las UD (Unidades de Descarga) que transporta un bajante o montante: su clave propia más los ramales que alimenta.
 * Ej: montante con 2 ramales y 4.5 UD -> el panel muestra 4.5, no 0.
 */
export function agregarCargaDeBajante(args: {
  bajId: string;
  counts: CountsMap;
  netId: string;
  planId?: string | number;
  sanConnectivity: ConectividadSan | null;
  tramosPiso: TramoPanel[];
  exits: Set<string>;
  engineRef: { current: MotorAgregado | null };
}): Record<string, number> {
  const { bajId, counts, netId, planId, sanConnectivity, tramosPiso, exits, engineRef } = args;
  const agg: Record<string, number> = {};
  const ownKey = planId ? countKey(netId, bajId, planId) : `${netId}_${bajId}`;
  for (const [k, v] of Object.entries(counts[ownKey] || {})) agg[k] = (agg[k] || 0) + (v as number);
  // Suma el storageKey de un tramo; sin counts propios usa sus fixtures directos.
  const sumCounts = (ck: string, fixtures?: Record<string, number>) => {
    const m = counts[ck] || {};
    if (Object.keys(m).length > 0) {
      for (const [k, v] of Object.entries(m)) agg[k] = (agg[k] || 0) + (v as number);
    } else if (fixtures) {
      for (const [k, v] of Object.entries(fixtures)) agg[k] = (agg[k] || 0) + (v as number);
    }
  };
  const visited = new Set<string>();
  const walkKey = (tKey: string) => {
    if (visited.has(tKey)) return;
    visited.add(tKey);
    const ct = tramosPiso.find((x) => x._key === tKey);
    if (!ct) return;
    if (!ct.esBajante) {
      // Espejo (salida): no suma NI recorre su subárbol. Doble guard: referencia
      // explícita (alimentaIds / ini = código) ADEMÁS del set geométrico - una salida
      // que la geometría no detecta (ramal corto junto a una caja) no puede volver al
      // walk, o su clave (que ya contiene el agregado) crecería en cada pasada.
      const bajRef = engineRef.current?.bajantes?.find((b) => b.id === bajId);
      // Un MONTANTE no tiene espejos: sus ramales alimentados son los que llevan los
      // aparatos de ese piso (se suman); solo un bajante normal espeja sus salidas.
      const esMontanteRef = bajRef?.tipo === 'montante';
      if (
        !esMontanteRef &&
        (exits.has(ct.id as string) ||
          (bajRef &&
            ((bajRef.alimentaIds || []).includes(ct.id as string) ||
              ct.ini === (bajRef.code || bajRef.id))))
      )
        return;
      // Cada tramo aporta con SU propia clave (su planId): los hijos pueden ser de otro
      // piso (enlace de asociación entre pisos) y sus UDs viven bajo el plan de origen.
      if (ct.tipo === 'ramal' || ct.tipo === 'tributario')
        sumCounts(
          planId ? `${netId}_${ct.id}_${planId}` : `${netId}_${ct.id}`,
          ct.fixtures as Record<string, number> | undefined,
        );
    }
    for (const child of sanConnectivity?.fullChildrenMap[tKey] || []) walkKey(child);
  };
  const bajT = tramosPiso.find((t) => t.esBajante && t.id === bajId);
  // El árbol sanitario solo existe en san/ll - para montantes/suministro (af/ac/gas) o sin
  // conectividad, el agregado va por el FALLBACK (recibeDeIds + tributarios por padre): es
  // donde viven los ramales que el montante alimenta. Con `bajT` pero conectividad null el
  // walk sumaba CERO (orig. usuario: "no aparecen las uds del ramal conectado").
  if (sanConnectivity && bajT?._key) {
    for (const child of sanConnectivity?.fullChildrenMap[bajT._key] || []) walkKey(child);
  } else {
    // Fallback sin árbol sanitario: ramales asociados (recibeDeIds) + cadenas de
    // tributarios colgantes. `seen` incluye las salidas EXPLÍCITAS (alimentaIds), no solo
    // las geométricas: sin engine (o con geometría ambigua) una salida con la clave ya
    // espejada volvería al walk y re-fusionaría el agregado en su propia clave en cada
    // pasada (misma familia que el dup de caja AN / suma infinita de bomba).
    // MONTANTES (orig. usuario): sus ramales nacen EN él (la dirección de flujo los hace
    // parecer "salidas") pero son sus ALIMENTADOS - se suman, nunca se excluyen.
    const eng = engineRef.current;
    const baj = eng?.bajantes?.find((b) => b.id === bajId);
    const esMontante = baj?.tipo === 'montante';
    const esPresion = netId === 'af' || netId === 'ac' || netId === 'gas';
    const seen = new Set<string>([
      bajId,
      ...(esMontante ? [] : exits),
      // Los alimentados de un MONTANTE son sus ALIMENTADOS (llevan los aparatos de ese
      // piso): se suman, no se excluyen. Para un bajante normal sí son espejos (su clave
      // ya trae el agregado) y excluirlos evita el re-fusionado en cada pasada.
      ...(esMontante ? [] : baj?.alimentaIds || []),
    ]);
    // MONTANTE de presión: los ramales que el montante ALIMENTA ya llevan su carga en el
    // disco (upMonte) - de ellos se cuenta solo lo PROPIO (misma regla que la herencia).
    const servidos =
      esMontante && esPresion && eng && baj
        ? idsServidosPorBajante({
            bajCode: baj.code || baj.id,
            asocManual: baj.asocManual,
            alimentasIds: baj.alimentaIds,
            pool: eng.ramales as unknown as InheritPoolRamal[],
            x: baj.x,
            y: baj.y,
          })
        : new Set<string>();
    let libros: ReturnType<typeof leerLibrosPresion> | null = null;
    const sum = (rid: string) => {
      if (seen.has(rid)) return;
      seen.add(rid);
      const ck = planId ? `${netId}_${rid}_${planId}` : `${netId}_${rid}`;
      if (servidos.has(rid) && counts[ck]) {
        libros ||= leerLibrosPresion();
        const propia = udPropiaDe(counts[ck], libros.her[ck] || {}, libros.fold[ck] || {});
        for (const [k, v] of Object.entries(propia)) agg[k] = (agg[k] || 0) + v;
        return;
      }
      sumCounts(ck);
    };
    for (const rid of baj?.recibeDeIds || []) sum(rid);
    // MONTANTE (orig. usuario: "no aparecen los aparatos del montante"): sus ramales
    // ALIMENTADOS (nacen en él) son los que llevan los aparatos de ese piso - sin sumarlos
    // el agregado del montante salía en cero y el panel lo teachía vacío hasta seleccionar
    // el elemento (el memo solo se rehace al cambiar la selección).
    if (esMontante) for (const rid of baj?.alimentaIds || []) sum(rid);
  }
  return agg;
}
