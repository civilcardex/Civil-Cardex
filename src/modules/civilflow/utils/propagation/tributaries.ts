import { cabezaDe, colaDe, distAPadre, type DownTrib, type RamalP } from './conteo.ts';
/**
 * Detecta los tributarios verticales ABAJO (continuación receptora de su unión) y arma el
 * índice por plano (para buscar el padre de cada tributario en un paso).
 */
export function detectarDownTrib(ramales: RamalP[]): {
  downTrib: Map<string, DownTrib>;
  padresDeDown: Set<string>;
  ramalesPorPlano: Map<string, Map<string, RamalP>>;
} {
  const downTrib = new Map<
    string,
    { padreKey: string; conn: number[]; finConn: 'cola' | 'cabeza' }
  >();
  const padresDeDown = new Set<string>();
  /** Down-tribs receptores: su BASE en el DFS es SOLO su manual (el fold invertido ya vive
   *  dentro del manual — contarlo también duplicaría cada corrida). */

  /**
   * Indiza los ramales por piso e id para buscarlos en 1 paso (antes buscar al padre de cada
   * tributario recorría toda la lista: en planos grandes era lentísimo).
   * @param lista - piezas recolectadas de todos los planos.
   * @returns mapa pid → (id → pieza).
   */
  const indicePorPlano = (
    lista: (typeof ramales)[number][],
  ): Map<string, Map<string, (typeof ramales)[number]>> => {
    const idx = new Map<string, Map<string, (typeof ramales)[number]>>();
    for (const r of lista) {
      let porPid = idx.get(r.pid);
      if (!porPid) {
        porPid = new Map();
        idx.set(r.pid, porPid);
      }
      porPid.set(r.id, r);
    }
    return idx;
  };
  const ramalesPorPlano = indicePorPlano(ramales);
  {
    for (const t of ramales) {
      if (t.tipo !== 'tributario' || !t.padre || !t.pts || t.pts.length < 2) continue;
      const padre = ramalesPorPlano.get(t.pid)?.get(t.padre);
      if (!padre) continue;
      const c = colaDe(t);
      const h = cabezaDe(t);
      if (!c || !h) continue;
      const dc = distAPadre(c, padre);
      const dh = distAPadre(h, padre);
      const conn = dc <= dh ? c : h;
      const far = dc <= dh ? h : c;
      const dy = far[1] - conn[1];
      // Doctrina UNIVERSAL down-trib (2026-10-14, orig. usuario): un tributario vertical
      // hacia abajo es la continuación receptora de su unión — sustituye el plegado hacia
      // arriba del caso "cabeza del trib en la unión" (auditoría #14) para esta geometría.
      if (dy > 1 && dy > 2 * Math.abs(far[0] - conn[0])) {
        downTrib.set(t.key, {
          padreKey: padre.key,
          conn,
          finConn: dc <= dh ? 'cola' : 'cabeza',
        });
        padresDeDown.add(padre.key);
      }
    }
  }
  return { downTrib, padresDeDown, ramalesPorPlano };
}
