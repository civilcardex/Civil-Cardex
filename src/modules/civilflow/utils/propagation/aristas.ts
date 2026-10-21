import {
  cabezaDe,
  colaDe,
  cntVacio,
  distAPadre,
  distSeg,
  type Arista,
  type Cnt,
  type DownTrib,
  type RamalP,
} from './conteo.ts';
import { saveToStorage } from '../../services/almacenamientoServicio.ts';
import { BAJADAS_RECEPTORAS_KEY } from '../../constants/almacenamientoClaves.ts';

/** ¿Existe un camino de CARGA (quién alimenta a quién) de un ramal a otro? BFS que además
 *  evita el doble conteo y los bucles.
 *  @param adj - adyacencia origen→destinos de aristas de carga.
 *  @param origen - clave del ramal inicial.
 *  @param destino - clave del ramal buscado.
 *  @returns true si el destino es alcanzable por vía de carga. */
function alcanzaPorCarga(adj: Map<string, Set<string>>, origen: string, destino: string): boolean {
  if (origen === destino) return true;
  const vistos = new Set<string>([origen]);
  const cola = [origen];
  while (cola.length > 0) {
    const actual = cola.pop() as string;
    for (const sig of adj.get(actual) || []) {
      if (sig === destino) return true;
      if (!vistos.has(sig)) {
        vistos.add(sig);
        cola.push(sig);
      }
    }
  }
  return false;
}

/**
 * Fase 3: aristas por CLÚSTERES de extremos (araña de ramales), siempre dentro del mismo
 * plano. Devuelve las aristas (con su índice por destino) y deja marcado quién es cadena,
 * bajada o transferencia (los mapas se mutan en sitio: los usa la fase de plegado).
 */
export function calcularAristas(
  ramales: RamalP[],
  downTrib: Map<string, DownTrib>,
  ramalesPorPlano: Map<string, Map<string, RamalP>>,
  cadenaTrib: Set<string>,
  transferencias: Map<string, string>,
  bajadasLibro: Record<string, number>,
  disk: Record<string, Cnt>,
  libros: Record<string, Cnt>,
  librosTrib: Record<string, Cnt>,
): { aristas: Arista[]; aristasPorDestino: Map<string, Arista[]> } {
  interface Arista {
    from: string;
    to: string;
    tipo: 'carga' | 'base';
  }
  const idsPorPlano = new Map<string, Set<string>>();
  for (const r of ramales) {
    if (!idsPorPlano.has(r.pid)) idsPorPlano.set(r.pid, new Set());
    idsPorPlano.get(r.pid)!.add(r.id);
  }
  const aristas: Arista[] = [];
  {
    const aristaViva = new Set<string>();
    const addArista = (from: string, to: string, tipo: 'carga' | 'base'): void => {
      if (from === to) return;
      const k = `${tipo}|${from}|${to}`;
      if (aristaViva.has(k)) return;
      aristaViva.add(k);
      aristas.push({ from, to, tipo });
    };
    const ramalPorKey = new Map(ramales.map((r) => [r.key, r]));
    const dirSal = (r: (typeof ramales)[number]): number[] | null => {
      // Dirección de SALIDA en la cola: hacia el segundo vértice en sentido de flujo.
      const pts = r.pts;
      if (!pts || pts.length < 2) return null;
      const a = r._tribReversed ? pts[pts.length - 1] : pts[0];
      const b = r._tribReversed ? pts[pts.length - 2] : pts[1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      return l < 1e-9 ? null : [dx / l, dy / l];
    };
    const dirEnt = (r: (typeof ramales)[number]): number[] | null => {
      // Dirección de LLEGADA en la cabeza: desde el vértice previo en sentido de flujo.
      const pts = r.pts;
      if (!pts || pts.length < 2) return null;
      const a = r._tribReversed ? pts[1] : pts[pts.length - 2];
      const b = r._tribReversed ? pts[0] : pts[pts.length - 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      return l < 1e-9 ? null : [dx / l, dy / l];
    };
    const extremos: Array<{
      key: string;
      pid: string;
      fin: 'cola' | 'cabeza';
      p: number[];
      dir: number[] | null;
      esTrib: boolean;
    }> = [];
    for (const r of ramales) {
      if (r.tipo === 'tributario' && r.padre && idsPorPlano.get(r.pid)?.has(r.padre)) {
        const dn = downTrib.get(r.key);
        if (dn) {
          // Down-trib: extremo de conexión como SALIDA (recibe en la unión del padre) y
          // extremo lejano como ENTRANTE (alimenta la pieza que sigue abajo — cascada).
          const finLejano: 'cola' | 'cabeza' = dn.finConn === 'cola' ? 'cabeza' : 'cola';
          const pLejano = finLejano === 'cola' ? colaDe(r) : cabezaDe(r);
          extremos.push({
            key: r.key,
            pid: r.pid,
            fin: 'cola',
            p: dn.conn,
            dir: null,
            esTrib: true,
          });
          if (pLejano)
            extremos.push({
              key: r.key,
              pid: r.pid,
              fin: finLejano,
              p: pLejano,
              dir: null,
              esTrib: true,
            });
          continue;
        }
        // Lateral con aparato en el extremo de CONEXIÓN (doctrina #14): descarga EN la
        // unión — no clusteriza, su carga sube por plegado al padre.
        const c2 = colaDe(r);
        const h2 = cabezaDe(r);
        if (!c2 || !h2) continue;
        const padre = ramalesPorPlano.get(r.pid)?.get(r.padre || '');
        const dc2 = padre ? distAPadre(c2, padre) : Infinity;
        const dh2 = padre ? distAPadre(h2, padre) : Infinity;
        const aparatoEnConn =
          dc2 <= dh2
            ? r._tribReversed
              ? r.aparatoFin
              : r.aparatoInicio
            : r._tribReversed
              ? r.aparatoInicio
              : r.aparatoFin;
        if ((aparatoEnConn ?? '') !== '') continue;
        // Tributario de CADENA (sin aparato en la conexión): participa con AMBOS extremos —
        // la cascada entre tributarios la resuelve la regla de gravedad del clúster.
        cadenaTrib.add(r.key);
        extremos.push({ key: r.key, pid: r.pid, fin: 'cola', p: c2, dir: dirSal(r), esTrib: true });
        extremos.push({
          key: r.key,
          pid: r.pid,
          fin: 'cabeza',
          p: h2,
          dir: dirEnt(r),
          esTrib: true,
        });
        continue;
      }
      const c = colaDe(r);
      const h = cabezaDe(r);
      if (c)
        extremos.push({ key: r.key, pid: r.pid, fin: 'cola', p: c, dir: dirSal(r), esTrib: false });
      if (h)
        extremos.push({
          key: r.key,
          pid: r.pid,
          fin: 'cabeza',
          p: h,
          dir: dirEnt(r),
          esTrib: false,
        });
    }
    // Contacto trib-sobre-cuerpo-de-trib (orig. usuario T3RAC3 cae en el cuerpo de T2RAC3):
    // extremo virtual del ANFITRIÓN en el punto — el host recibe allí (la gravedad de la
    // cascada decide quién alimenta).
    for (const a of ramales) {
      if (a.tipo !== 'tributario' || !a.pts || a.pts.length < 2) continue;
      if (!idsPorPlano.get(a.pid)?.has(a.padre || '')) continue;
      for (const extremo of [colaDe(a), cabezaDe(a)]) {
        if (!extremo) continue;
        for (const b of ramales) {
          if (b.key === a.key || b.tipo !== 'tributario' || !b.pts || b.pts.length < 2) continue;
          if (b.pid !== a.pid) continue;
          const enBorde =
            Math.hypot(extremo[0] - b.pts[0][0], extremo[1] - b.pts[0][1]) < 0.5 ||
            Math.hypot(
              extremo[0] - b.pts[b.pts.length - 1][0],
              extremo[1] - b.pts[b.pts.length - 1][1],
            ) < 0.5;
          if (enBorde) continue;
          let toca = false;
          for (let i = 0; i < b.pts.length - 1 && !toca; i++) {
            toca = distSeg(extremo, b.pts[i], b.pts[i + 1]) < 0.5;
          }
          if (toca) {
            extremos.push({
              key: b.key,
              pid: b.pid,
              fin: 'cola',
              p: extremo,
              dir: null,
              esTrib: true,
            });
            break;
          }
        }
      }
    }
    // Clústeres por unión-find con tolerancia 0.5 (los splits comparten coordenada
    // exacta), particionados por plano.
    const padreDe = new Map(extremos.map((_, i) => [i, i]));
    const find = (i: number): number => {
      const p = padreDe.get(i);
      if (p === undefined || p === i) return i;
      const raiz = find(p);
      padreDe.set(i, raiz);
      return raiz;
    };
    const uni = (i: number, j: number): void => {
      padreDe.set(find(i), find(j));
    };
    for (let i = 0; i < extremos.length; i++) {
      for (let j = i + 1; j < extremos.length; j++) {
        if (extremos[i].pid !== extremos[j].pid) continue;
        if (
          Math.hypot(extremos[i].p[0] - extremos[j].p[0], extremos[i].p[1] - extremos[j].p[1]) <=
          0.5
        )
          uni(i, j);
      }
    }
    const clusters = new Map<number, number[]>();
    extremos.forEach((_, i) => {
      const raiz = find(i);
      if (!clusters.has(raiz)) clusters.set(raiz, []);
      clusters.get(raiz)!.push(i);
    });
    const cargaAdj = new Map<string, Set<string>>();
    // ¿La salida `s` continúa la línea del entrante `e`? Colinealidad llegada/salida
    // (~25°) o downstream autocreado con mergesFrom al entrante.
    const esContinuacion = (eIdx: number, sIdx: number): boolean => {
      const de = extremos[eIdx].dir;
      const ds = extremos[sIdx].dir;
      if (de && ds && de[0] * ds[0] + de[1] * ds[1] >= 0.9) return true;
      const sRam = ramalPorKey.get(extremos[sIdx].key);
      const eRam = ramalPorKey.get(extremos[eIdx].key);
      if (sRam?.mergesFrom && eRam && sRam.mergesFrom.includes(eRam.id)) return true;
      return false;
    };
    for (const idxs of clusters.values()) {
      if (idxs.length < 2) continue;
      const idxEnt = idxs.filter((i) => extremos[i].fin === 'cabeza');
      const idxSal = idxs.filter((i) => extremos[i].fin === 'cola');
      const entrantes = idxEnt.map((i) => extremos[i].key);
      const salidas = idxSal.map((i) => extremos[i].key);
      const entSet = new Set(entrantes);
      // Cascada trib-trib (orig. usuario T1RAC3→T4RAC3→T2RAC3): en una unión con ≥2 piezas
      // tributarias, TODO el carga va a la pieza cuyo EXTREMO LEJANO queda más ABAJO
      // (gravedad — la cadena desciende); empate: se prefiere la pieza cuya unión es su
      // COLA (dibujada desde aguas arriba). Sin aristas base.
      const tribEnCluster = [
        ...new Set(
          idxEnt
            .concat(idxSal)
            .filter((i) => extremos[i].esTrib)
            .map((i) => extremos[i].key),
        ),
      ];
      if (tribEnCluster.length >= 2) {
        const ptCluster = extremos[idxs[0]].p;
        // Índice key→extremos: el .filter sobre TODOS los extremos por cada pieza del
        // clúster era O(n²) (se llamaba dos veces por comparación del sort).
        const extremosPorKey = new Map<string, typeof extremos>();
        for (const e2 of extremos) {
          const l = extremosPorKey.get(e2.key);
          if (l) l.push(e2);
          else extremosPorKey.set(e2.key, [e2]);
        }
        const farYDe = (k: string): number => {
          const candidatos = extremosPorKey.get(k) || [];
          const fuera = candidatos.filter(
            (e2) => Math.hypot(e2.p[0] - ptCluster[0], e2.p[1] - ptCluster[1]) > 0.5,
          );
          if (fuera.length === 0) return ptCluster[1];
          return Math.max(...fuera.map((e2) => e2.p[1]));
        };
        // Set de las salidas del clúster: el .some por cada pieza era O(n).
        const setSalidas = new Set(idxSal.map((i) => extremos[i].key));
        const colaEnCluster = (k: string): boolean => setSalidas.has(k);
        // Orden por profundidad (extremo lejano más bajo = más abajo en la cadena) y aristas
        // SOLO entre eslabones consecutivos: cada pieza acumula lo de arriba sin dobles.
        const orden = [...tribEnCluster].sort((a, b) => {
          const fa = farYDe(a);
          const fb = farYDe(b);
          if (Math.abs(fa - fb) > 0.5) return fa - fb;
          return colaEnCluster(a) === colaEnCluster(b) ? 0 : colaEnCluster(a) ? 1 : -1;
        });
        if (orden.length >= 2) {
          for (let i = 0; i < orden.length - 1; i++) {
            addArista(orden[i], orden[i + 1], 'carga');
          }
          continue;
        }
      }
      // Doctrina down-trib (2bis): con tributario(s) vertical(es) hacia abajo en el clúster,
      // TODO el carga de los entrantes baja SOLO por ellos — las salidas horizontales no
      // reciben carga ni base (el horizontal es paso, la bajada es la continuación).
      const downs = idxSal.filter((i) => downTrib.has(extremos[i].key));
      // BAJADA GEOMÉTRICA (orig. usuario imagen RAC3): cualquier pieza del nudo cuyo
      // EXTREMO LEJANO queda por debajo del punto de unión (vertical dominante) y sin
      // carga propia (o marcada en corrida previa) es la continuación al piso de abajo —
      // receptora preferente. El FIN (cola/cabeza) es IRRELEVANTE: una bajada dibujada de
      // abajo hacia arriba quedaba clasificada ENTRANTE y la doctrina nunca la veía (orig.
      // usuario: RAC3 seguía habilitada y RAC4 acumulando). Con aparatos propios es lateral
      // de fixture (doctrina vieja).
      const ptJ = extremos[idxs[0]].p;
      const esBajadaGeo = (i: number): boolean => {
        const key = extremos[i].key;
        if (downTrib.has(key)) return false; // su propia rama down-trib ya la maneja
        const piece = ramalPorKey.get(key);
        if (!piece?.pts || piece.pts.length < 2) return false;
        const otro =
          Math.hypot(piece.pts[0][0] - ptJ[0], piece.pts[0][1] - ptJ[1]) > 0.5
            ? piece.pts[0]
            : piece.pts[piece.pts.length - 1];
        const dyGeo = otro[1] - ptJ[1];
        // Vertical ESTRICTA (una diagonal a 45° es lateral, no bajada — clúster mixto).
        if (!(dyGeo > 1 && dyGeo > 2 * Math.abs(otro[0] - ptJ[0]))) return false;
        // Marcada en corrida previa: sigue siendo bajada aunque su disco se haya llenado.
        if (bajadasLibro[key]) return true;
        const cnt = disk[key];
        return !cnt || cntVacio(cnt);
      };
      const bajadasGeo = [
        ...new Set(
          idxSal
            .filter(esBajadaGeo)
            .concat(idxEnt.filter(esBajadaGeo))
            .map((i) => i),
        ),
      ];
      // Set de las bajadas geom\u00e9tricas: el .includes dentro de un filter era O(n) por salida.
      const setBajadasGeo = new Set(bajadasGeo);
      const receptores = [
        ...new Set([
          ...downs,
          ...idxSal.filter((i) => setBajadasGeo.has(i)),
          ...idxEnt.filter((i) => setBajadasGeo.has(i)),
        ]),
      ];
      // Set de las claves de los receptores: el .some por cada entrante era O(n\u00b2) por nudo.
      const clavesReceptores = new Set(receptores.map((r) => extremos[r].key));
      if (receptores.length > 0) {
        for (const e of idxEnt) {
          const ek = extremos[e].key;
          if (clavesReceptores.has(ek)) continue;
          if (!cargaAdj.has(ek)) cargaAdj.set(ek, new Set());
          for (const d of receptores) {
            const dk = extremos[d].key;
            if (dk === ek) continue;
            addArista(ek, dk, 'carga');
            cargaAdj.get(ek)!.add(dk);
          }
        }
        // Las salidas horizontales del nudo se CONSUMEN: su carga propia pasa a la bajada.
        for (const s of idxSal) {
          const sk = extremos[s].key;
          if (entSet.has(sk)) continue;
          if (clavesReceptores.has(sk)) continue;
          const rk = extremos[receptores[0]].key;
          transferencias.set(sk, rk);
        }
        // Marcar las bajadas receptoras (persistente — BAJADAS_RECEPTORAS_KEY, POR CLAVE).
        let marcadas = false;
        for (const ri of receptores) {
          const rkey = extremos[ri].key;
          if (!bajadasLibro[rkey]) {
            bajadasLibro[rkey] = 1;
            marcadas = true;
          }
        }
        if (marcadas) saveToStorage(BAJADAS_RECEPTORAS_KEY, bajadasLibro);
        continue;
      }
      // Unión SOLO DE SALIDAS (orig. usuario RAC6: todas las flechas hacia afuera): la
      // malla clásica duplicaba cada aparato (cada par se alcanzaba por carga Y base).
      // Doctrina: las piezas CON aparato propio alimentan a las VACÍAS — cada aparato
      // baja ×1 y las que tienen no reciben copias (estable entre corridas).
      if (idxEnt.length === 0 && salidas.length >= 2) {
        const manualDePieza = (k: string): Cnt => {
          const cur = disk[k] || {};
          const prev = libros[k] || {};
          const prevTrib = librosTrib[k] || {};
          const out: Cnt = {};
          for (const kk of new Set([
            ...Object.keys(cur),
            ...Object.keys(prev),
            ...Object.keys(prevTrib),
          ])) {
            out[kk] = Math.max(0, (cur[kk] || 0) - (prev[kk] || 0) - (prevTrib[kk] || 0));
          }
          return out;
        };
        const conCarga = salidas.filter((k) => !cntVacio(manualDePieza(k)));
        // Set de las salidas con carga: el .includes por cada salida vacía era O(n²).
        const setConCarga = new Set(conCarga);
        const vacias = salidas.filter((k) => !setConCarga.has(k));
        for (const s of conCarga) {
          if (!cargaAdj.has(s)) cargaAdj.set(s, new Set());
          for (const v of vacias) {
            addArista(s, v, 'base');
            cargaAdj.get(s)!.add(v);
          }
        }
        continue;
      }
      const contGlobal = new Set<string>();
      for (const e of idxEnt) {
        for (const s of idxSal) {
          if (entSet.has(extremos[s].key)) continue;
          if (esContinuacion(e, s)) contGlobal.add(extremos[s].key);
        }
      }
      for (const e of idxEnt) {
        const ek = extremos[e].key;
        if (!cargaAdj.has(ek)) cargaAdj.set(ek, new Set());
        let conts = idxSal
          .filter((s) => !entSet.has(extremos[s].key) && esContinuacion(e, s))
          .map((s) => extremos[s].key);
        // Sin continuación PROPIA: si el clúster tiene continuaciones de OTROS entrantes
        // (contGlobal), la carga sale por la línea principal — una lateral jamás recibe del
        // entrante (doctrina 3a; el reparto clásico a TODAS las salidas solo aplica cuando
        // NADIE tiene continuación, y el filtro de aristas base deja de chocar con la carga).
        if (conts.length === 0) {
          conts = contGlobal.size > 0 ? [...contGlobal] : salidas.filter((s2) => !entSet.has(s2));
        }
        for (const s2 of conts) {
          addArista(ek, s2, 'carga');
          cargaAdj.get(ek)!.add(s2);
        }
      }
      for (const s1 of salidas) {
        for (const s2 of salidas) {
          if (s1 === s2 || entSet.has(s2)) continue;
          // Solo hacia continuaciones (la lateral alimenta la principal; entre laterales
          // o hacia laterales no hay aporte). Sin continuación identificable: clásico.
          if (contGlobal.size > 0 && !contGlobal.has(s2)) continue;
          // Sin doble conteo ni inversión: si ya hay camino de carga entre ambas en
          // cualquier sentido, la base sobra (llega por la vía de carga).
          if (alcanzaPorCarga(cargaAdj, s1, s2) || alcanzaPorCarga(cargaAdj, s2, s1)) continue;
          addArista(s1, s2, 'base');
        }
      }
    }
  }
  // Índice por destino: el DFS ya no escanea todas las aristas por nodo.
  const aristasPorDestino = new Map<string, Arista[]>();
  for (const a of aristas) {
    if (!aristasPorDestino.has(a.to)) aristasPorDestino.set(a.to, []);
    aristasPorDestino.get(a.to)!.push(a);
  }
  return { aristas, aristasPorDestino };
}
