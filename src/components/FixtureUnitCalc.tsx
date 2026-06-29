import React, { useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { useApparatus } from "../context/ApparatusContext";
import { usePlans } from "../context/PlansContext";
import { calcUDparcial } from "../utils/componentHelpers";
import { pisoCorto, APARATOS_DEF, SAN_UC_IDS } from "../constants";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";

function CalculoUD() {
  const { tramosSan } = useTramos();
  const { aps } = useApparatus();
  const { plans } = usePlans();

  const mergedBase = useMemo(() => {
    return SAN_UC_IDS.map(id => {
      const fromAps = aps.find(p => p.id === id);
      const def = APARATOS_DEF.find(x => x.id === id);
      return { id, nombre: def?.nombre || id, ud: fromAps?.ud || def?.ud || 0, _disabled: (def?.ud || 0) === 0 };
    });
  }, [aps]);

  const [conexiones, componentTotalMap] = useMemo(() => {
    const map: Record<string, string[]> = {}; // parentKey -> childKeys[]

    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { continue; } }

      const ramales = data.ramales || [];
      const bajantes = data.bajantes || [];

      const distToSegment = (p: number[], a: number[], b: number[]) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
        let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
      };

      const distToPolyline = (p: number[], pts: number[][]) => {
        let minDist = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
          const d = distToSegment(p, pts[i], pts[i + 1]);
          if (d < minDist) minDist = d;
        }
        return minDist;
      };

      for (const r of ramales) {
        if (!r.pts || r.pts.length < 2) continue;
        const pStart = r.pts[0];
        const pEnd = r.pts[r.pts.length - 1];
        const rKey = `${r.id}-${plan.id}`;

        let connection: { type: 'bajante' | 'ramal'; id: string } | null = null;

        const checkEndpoint = (pt: number[]) => {
          for (const b of bajantes) {
            const isDischargingIntoR = b.descargaEnId && (
              b.descargaEnId === `${plan.id}|${r.id}` ||
              b.descargaEnId === r.id ||
              (r.label && (b.descargaEnId === `${plan.id}|${r.label}` || b.descargaEnId === r.label))
            );
            if (isDischargingIntoR) continue;

            const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
            const dist = Math.hypot(pt[0] - b.x, pt[1] - b.y);
            if (isExplicit || dist < 2.0) {
              return { type: 'bajante' as const, id: b.id };
            }
          }
          let bestRx: any = null;
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

        connection = checkEndpoint(pEnd) || checkEndpoint(pStart);

        if (connection) {
          const targetKey = `${connection.id}-${plan.id}`;
          if (!map[targetKey]) map[targetKey] = [];
          if (!map[targetKey].includes(rKey)) {
            map[targetKey].push(rKey);
          }
        }
      }
    }

    // Add vertical connections for bajantes (from upper to lower sections)
    const bajantesGroups: Record<string, typeof tramosSan> = {};
    for (const t of tramosSan) {
      if (t.esBajante && t.id) {
        if (!bajantesGroups[t.id]) bajantesGroups[t.id] = [];
        bajantesGroups[t.id].push(t);
      }
    }

    for (const sections of Object.values(bajantesGroups)) {
      sections.sort((a, b) => (a.piso || 0) - (b.piso || 0));
      for (let i = 0; i < sections.length - 1; i++) {
        const lowerKey = sections[i]._key;
        const upperKey = sections[i + 1]._key;
        if (lowerKey && upperKey) {
          if (!map[lowerKey]) map[lowerKey] = [];
          if (!map[lowerKey].includes(upperKey)) {
            map[lowerKey].push(upperKey);
          }
        }
      }
    }

    // Add discharge connections (descargaEnId) of bajantes into lower ramales
    for (const t of tramosSan) {
      if (t.esBajante && t.descargaEnId && t._key) {
        const parts = t.descargaEnId.includes('|') ? t.descargaEnId.split('|') : ['', t.descargaEnId];
        const dPlanId = parts[0];
        const targetRamalId = parts[1];
        if (targetRamalId) {
          const targetKey = `${targetRamalId}-${dPlanId}`;
          const targetExists = tramosSan.some(x => x._key === targetKey);
          if (targetExists) {
            if (!map[targetKey]) map[targetKey] = [];
            if (!map[targetKey].includes(t._key)) {
              map[targetKey].push(t._key);
            }
          }
        }
      }
    }

    // Build undirected adjacency list for all tramos
    const adj: Record<string, string[]> = {};
    for (const t of tramosSan) {
      if (t._key) {
        adj[t._key] = [];
      }
    }

    for (const [parentKey, children] of Object.entries(map)) {
      if (!adj[parentKey]) adj[parentKey] = [];
      for (const childKey of children) {
        if (!adj[childKey]) adj[childKey] = [];
        if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
        if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
      }
    }

    // Find connected components in the full graph `adj`
    const compVisited = new Set<string>();
    const components: string[][] = [];

    for (const node of Object.keys(adj)) {
      if (!compVisited.has(node)) {
        const comp: string[] = [];
        const q = [node];
        compVisited.add(node);
        while (q.length > 0) {
          const curr = q.shift()!;
          comp.push(curr);
          for (const neigh of adj[curr] || []) {
            if (!compVisited.has(neigh)) {
              compVisited.add(neigh);
              q.push(neigh);
            }
          }
        }
        components.push(comp);
      }
    }

    const getRootScore = (key: string): number => {
      const tr = tramosSan.find(x => x._key === key);
      if (!tr) return 99999999;
      const piso = tr.piso || 0;
      const isBajante = tr.esBajante;
      const id = tr.id || '';
      const match = id.match(/^([a-zA-Z]+)(\d+)?$/);
      const num = match && match[2] ? parseInt(match[2]) : 999;
      return (piso * 100000) + (isBajante ? 0 : 10000) + num;
    };

    const orientedConexiones: Record<string, string[]> = {};
    const orientedVisited = new Set<string>();

    for (const comp of components) {
      let root = comp[0];
      let minScore = getRootScore(root);
      for (const node of comp) {
        const score = getRootScore(node);
        if (score < minScore) {
          minScore = score;
          root = node;
        }
      }

      const q = [root];
      orientedVisited.add(root);
      while (q.length > 0) {
        const parent = q.shift()!;
        if (!orientedConexiones[parent]) orientedConexiones[parent] = [];
        for (const child of adj[parent] || []) {
          if (!orientedVisited.has(child)) {
            orientedVisited.add(child);
            orientedConexiones[parent].push(child);
            q.push(child);
          }
        }
      }
    }

    // Compute connected-component totals
    const tramoById: Record<string, any> = {};
    for (const t of tramosSan) {
      const key = t._key || t.id;
      if (key) tramoById[key] = t;
    }
    const parcialMap: Record<string, number> = {};
    for (const t of tramosSan) {
      const key = t._key || t.id;
      if (key) parcialMap[key] = calcUDparcial(t, mergedBase);
    }
    const componentTotalMap: Record<string, number> = {};
    const compVisited2 = new Set<string>();
    for (const t of tramosSan) {
      const startKey = t._key || t.id;
      if (!startKey || compVisited2.has(startKey)) continue;
      
      const comp: string[] = [];
      const q = [startKey];
      compVisited2.add(startKey);
      while (q.length > 0) {
        const cur = q.shift()!;
        comp.push(cur);
        for (const nb of adj[cur] || []) {
          if (!compVisited2.has(nb) && tramoById[nb]) {
            compVisited2.add(nb);
            q.push(nb);
          }
        }
      }
      const compTotal = comp.reduce((s, k) => s + (parcialMap[k] || 0), 0);
      for (const k of comp) componentTotalMap[k] = compTotal;
    }

    return [orientedConexiones, componentTotalMap];
  }, [plans, tramosSan, mergedBase]);

  function getDescendantsUD(tKey: string, visited = new Set<string>()): number {
    if (visited.has(tKey)) return 0;
    visited.add(tKey);
    const children = conexiones[tKey] || [];
    let sum = 0;
    for (const childKey of children) {
      const childTramo = tramosSan.find(x => x._key === childKey);
      if (childTramo) {
        sum += calcUDparcial(childTramo, mergedBase) + getDescendantsUD(childKey, visited);
      }
    }
    return sum;
  }

  function getDescendantKeys(tKey: string, visited = new Set<string>()): string[] {
    if (visited.has(tKey)) return [];
    visited.add(tKey);
    const children = conexiones[tKey] || [];
    let list: string[] = [];
    for (const childKey of children) {
      list.push(childKey);
      list = list.concat(getDescendantKeys(childKey, visited));
    }
    return list;
  }

  const displayTramos = useMemo(() => {
    return tramosSan.filter(t => t.tipo === 'ramal' && !t.esBajante)
      .sort((a, b) => (a.piso || 0) - (b.piso || 0));
  }, [tramosSan]);

  const totales = useMemo(() => {
    return mergedBase.map(d => ({
      id: d.id, nombre: d.nombre, ud: d.ud,
      cant: tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0)
    }));
  }, [mergedBase, tramosSan]);

  const totalUD = useMemo(() => {
    return totales.reduce((s, d) => s + (d.cant || 0) * (d.ud || 0), 0);
  }, [totales]);

  return (
  <>
    <div className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/sanitaria/RS_Calculo_UC.svg" alt="Cálculo unidades de descarga"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Cálculo de unidades de descarga</h3>
        <span className="card-s">{displayTramos.length} tramos</span>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
          <table className="tbl" style={{minWidth:900}}>
            <caption style={{position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>Cálculo de unidades de descarga</caption>
            <thead>
              <tr>
                <th scope="col" className="col-h" rowSpan={2} style={{minWidth:70,textAlign:'center'}}>Tramo</th>
                <th scope="col" className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Nivel</th>
                <th scope="col" className="col-h" rowSpan={2} style={{minWidth:60,textAlign:'center'}}>Inicio</th>
                <th scope="col" className="col-h" rowSpan={2} style={{minWidth:60,textAlign:'center'}}>Fin</th>
                <th scope="col" className="col-h san" colSpan={mergedBase.length} style={{textAlign:'center'}}>Aparatos</th>
                <th scope="col" className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Unidades de descarga</th>
                <th scope="col" className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center',display:'none'}}>Bajante</th>
              </tr>
              <tr>
                {mergedBase.map(d=>(
                  <th key={d.id} className="col-h san" style={{minWidth:52,fontSize:9,textAlign:'center'}}>{d.nombre}<br/><span style={{fontSize:8,fontWeight:400}}>{d.ud} UD</span></th>
                ))}
                <th scope="col" className="col-h ok" style={{textAlign:'center'}}>Parcial</th>
                <th scope="col" className="col-h ok" style={{textAlign:'center'}}>Total</th>
              </tr>
            </thead>
            <tbody>
  {displayTramos.length === 0 ? (
                <tr>
                    <td colSpan={4 + mergedBase.length + 2} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                    No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                  </td>
                </tr>
  ) : displayTramos.map((t) => {
    const tKey = t._key || `${t.id}-${t.piso}`;
    const parcial = calcUDparcial(t, mergedBase);
    const acum = (componentTotalMap[tKey] || 0);
    return (
      <tr key={tKey}>
        <td className="c"><span className="sigla" style={{fontSize:11,fontWeight:600}}>{t.id}</span></td>
        <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{pisoCorto(t.piso)}</span></td>
        <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt)'}}>{t.ini && typeof t.ini === 'object' ? `${t.ini.x},${t.ini.y}` : t.ini || '—'}</span></td>
        <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt)'}}>{t.fin && typeof t.fin === 'object' ? `${t.fin.x},${t.fin.y}` : t.fin || '—'}</span></td>
        {mergedBase.map(d=>(
          <td key={d.id} className="c" style={{padding:'2px 3px'}}>
            <span style={{fontSize:12,fontFamily:'var(--mono)',color:d._disabled?'var(--txt3)':'var(--txt)'}}>{t.fixtures[d.id]??0}</span>
          </td>
        ))}
        <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--txt)',fontSize:13}}>{parcial}</td>
        <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--txt)',fontSize:14}}>{acum}</td>
        <td style={{display:'none'}}>
        </td>
      </tr>
    );
  })}
            </tbody>
            <tfoot>
              <tr>
                <td className="c" style={{fontWeight:600,fontSize:13,color:'var(--txt3)',textAlign:'center',borderTop:'2px solid var(--line)'}}>∑</td>
                <td style={{borderTop:'2px solid var(--line)'}}></td>
                <td style={{borderTop:'2px solid var(--line)'}}></td>
                <td style={{borderTop:'2px solid var(--line)'}}></td>
                {totales.map(d => {
                  const subtotal = (d.cant || 0) * (d.ud || 0);
                  return (
                    <td key={d.id} className="c" style={{padding:'4px 3px',borderTop:'2px solid var(--line)'}}>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,fontSize:10,fontFamily:'var(--mono)'}}>
                        <span style={{fontWeight:600,color:'var(--txt)',fontSize:12}}>{d.cant}</span>
                        <span style={{color:'var(--txt3)',fontSize:8}}>× {d.ud} UD</span>
                        <span style={{fontWeight:700,color:'var(--san)',fontSize:11}}>{subtotal}</span>
                      </div>
                    </td>
                  );
                })}
                <td style={{borderTop:'2px solid var(--line)'}}></td>
                <td className="c" style={{fontWeight:700,fontSize:14,color:'var(--txt)',fontFamily:'var(--mono)',textAlign:'center',borderTop:'2px solid var(--line)'}}>
                  {totalUD} UD
                </td>
                <td style={{borderTop:'2px solid var(--line)',display:'none'}}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  </>
  );
}

export default React.memo(CalculoUD);