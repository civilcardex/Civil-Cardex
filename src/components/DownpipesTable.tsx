import { useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { useProject } from "../context/ProjectContext";
import { usePlans } from "../context/PlansContext";
import { useApparatus } from "../context/ApparatusContext";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import { pisoCorto } from "../constants";
import { calcUDparcial } from "../utils/componentHelpers";
import { calculateVentStack } from "../utils/calcSanitary";

function fmtPiso(val: string, pisos: any[]): string {
  if (!val) return '—';
  const num = parseInt(val);
  if (!isNaN(num) && pisos.some(p => p.n === num)) return pisoCorto(num);
  for (const p of pisos) {
    const lbl = `Piso ${p.n}`;
    if (val === lbl || val === `Sótano ${Math.abs(p.n)}` || val === 'Cubierta' && p.n === 99) return pisoCorto(p.n);
  }
  return val;
}

export default function BajantesTable() {
  const { tramosSan } = useTramos();
  const { udBase } = useApparatus();
  const { pisos } = useProject();
  const { plans } = usePlans();

  const [conexiones, componentTotalMap] = useMemo(() => {
    const map: Record<string, string[]> = {};

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

    for (const [bId, sections] of Object.entries(bajantesGroups)) {
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
      return (piso * 100000) + (isBajante ? 10000 : 0) + num;
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
      if (key) parcialMap[key] = calcUDparcial(t, udBase);
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
  }, [plans, tramosSan, udBase]);

  const getDescendantsUD = useCallback((tKey: string, visited = new Set<string>()): number => {
    if (visited.has(tKey)) return 0;
    visited.add(tKey);
    const children = conexiones[tKey] || [];
    let sum = 0;
    for (const childKey of children) {
      const childTramo = tramosSan.find(x => x._key === childKey);
      if (childTramo) {
        sum += calcUDparcial(childTramo, udBase) + getDescendantsUD(childKey, visited);
      }
    }
    return sum;
  }, [conexiones, tramosSan, udBase]);

  return (
    <div className="card">
      <div className="card-h">
          <h3 className="card-t"><img src="/iconos_diseno_redes/sanitaria/RS_Bajantes.webp" alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Bajantes de aguas negras y ventilación</h3>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize:11}}>
          <caption className="visually-hidden">Bajantes de aguas negras y ventilación</caption>
          <thead>
            <tr>
              <th scope="col" className="col-h san" colSpan={8} style={{textAlign:'center',padding:'2px 4px',fontSize:10}}>INFORMACIÓN COMÚN</th>
              <th scope="col" className="col-h ok" colSpan={7} style={{textAlign:'center',padding:'2px 4px',fontSize:10}}>BAJANTES AGUAS NEGRAS</th>
              <th scope="col" className="col-h ven" colSpan={6} style={{textAlign:'center',padding:'2px 4px',fontSize:10}}>TUBERÍA DE VENTILACIÓN</th>
            </tr>
            <tr>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>No.</th>
              <th scope="col" className="col-h san" colSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Nivel</th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Ramales<br/>asociados</th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>UD</th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>r</th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Q<br/><small>lps</small></th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>n</th>
              <th scope="col" className="col-h ok" colSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Diám</th>
              <th scope="col" className="col-h ok" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Cheq</th>
              <th scope="col" className="col-h ok" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Q máx<br/><small>Baj</small></th>
              <th scope="col" className="col-h ok" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Vt<br/><small>m/s</small></th>
              <th scope="col" className="col-h ok" colSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>L term</th>
              <th scope="col" className="col-h ven" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Va<br/><small>m/s</small></th>
              <th scope="col" className="col-h ven" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>ƒ</th>
              <th scope="col" className="col-h ven" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Qa<br/><small>LPS</small></th>
              <th scope="col" className="col-h ven" rowSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Lb<br/><small>m</small></th>
              <th scope="col" className="col-h ven" colSpan={2} style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Diám V</th>
            </tr>
            <tr>
              <th scope="col" className="col-h san" style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Origen</th>
              <th scope="col" className="col-h san" style={{textAlign:'center',padding:'1px 3px',fontSize:9}}>Destino</th>
              <th scope="col" className="col-h ok" style={{textAlign:'center',padding:'1px 3px',fontSize:8}}>Calc<br/>Pulg</th>
              <th scope="col" className="col-h ok" style={{textAlign:'center',padding:'1px 3px',fontSize:8}}>Prop<br/>Pulg</th>
              <th scope="col" className="col-h ok" style={{textAlign:'center',padding:'1px 3px',fontSize:8}}>calc</th>
              <th scope="col" className="col-h ok" style={{textAlign:'center',padding:'1px 3px',fontSize:8}}>min</th>
              <th scope="col" className="col-h ven" style={{textAlign:'center',padding:'1px 3px',fontSize:8}}>Calc<br/>Pulg</th>
              <th scope="col" className="col-h ven" style={{textAlign:'center',padding:'1px 3px',fontSize:8}}>Prop<br/>Pulg</th>
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const banTramos = tramosSan.filter(t => t.esBajante);
              if (banTramos.length === 0) return <tr><td colSpan={21} style={{textAlign:'center',color:'var(--txt3)',padding:'24px 0',fontSize:11}}>No hay bajantes definidos. Marque un tramo como bajante en la tabla de Cálculo UD.</td></tr>;

              return banTramos.map(t => {
                const rVal = t.bajR;
                const rStr = rVal != null ? (Math.abs(rVal - 7/24) < 0.001 ? '7/24' : '1/4') : null;
                
                const propiasUD = calcUDparcial(t, udBase);
                const planIdStr = t.planId || (t._key ? t._key.split('-')[1] : '');
                
                let targetPiso = '';
                let destinoVal = '—';
                if (t.descargaEnId) {
                  const parts = t.descargaEnId.includes('|') ? t.descargaEnId.split('|') : ['', t.descargaEnId];
                  const dPlanId = parts[0];
                  const targetRamal = parts[1] || '';
                  const targetPlan = plans?.find((p: any) => String(p.id) === String(dPlanId));
                  if (targetPlan && targetPlan.nivel != null) {
                    targetPiso = targetPlan.nivel.toString();
                    const targetPisoVal = fmtPiso(targetPiso, pisos);
                    destinoVal = targetRamal ? `${targetPisoVal}-${targetRamal}` : targetPisoVal;
                  } else {
                    destinoVal = targetRamal || '—';
                  }
                }

                const ramalesIds = (t.recibeDeIds || []) as string[];
                const ramalesAsocVal = ramalesIds.length > 0 ? ramalesIds.join(', ') : '—';
                const totalUD = propiasUD + getDescendantsUD(t._key || `${t.id}-${planIdStr}`);
                const ramalesUD = totalUD - propiasUD;

                const n = t.nmaning ?? 0;
                const origenVal = fmtPiso(t.piso?.toString() || '', pisos);
                const pisosRange = targetPiso ? `${t.piso}-${targetPiso}` : `${t.piso}-${t.piso}`;

                const res = calculateVentStack({
                  bajante: t.id,
                  pisos: pisosRange,
                  UD_propias: propiasUD,
                  UD_otros: ramalesUD,
                  UD_acum: totalUD,
                  r: t.bajR,
                  n: t.nmaning || 0.009,
                  bajDprop: t.bajDprop || 0,
                  bajLong: t.bajLong || 3,
                  bajFDarcy: t.bajFDarcy || 0.025,
                  ventDprop: t.ventDprop || 0,
                });

                const Q = res.Q_Ls;
                const DcalcPulg = res.Dcalc_pulg;
                const chequeo = res.chequeoDiam;
                const QmaxB = res.QmaxBajante;
                const Vt = res.Vt;
                const Ltcalc = res.Lt_calc;
                const Ltmin = res.Lt_min;
                const fDarcy = t.bajFDarcy ?? 0;
                const Vair = res.V_aire;
                const Qair = res.Q_aire_Ls;
                const Lbaj = res.longBajante_m;
                const DventCalcPulg = res.D_vent_calc_pulg;
                const DventPropPulg = res.D_vent_prop_pulg;
                
                return (
                  <tr key={t._key || `${t.id}-${t.piso}`}>
                    <td className="c"><span className="sigla" style={{fontSize:9}}>{t.code || t.id}</span></td>
                    <td className="c" style={{padding:'1px 3px',fontSize:10,fontFamily:'var(--mono)',color:'var(--txt)'}}>{origenVal}</td>
                    <td className="c" style={{padding:'1px 3px',fontSize:10,fontFamily:'var(--mono)',color:'var(--txt)'}}>{destinoVal}</td>
                    <td className="c" style={{fontSize:10,color:'var(--txt2)',fontFamily:'var(--mono)',padding:'1px 3px'}}>
                      {ramalesAsocVal}
                    </td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:10,padding:'1px 3px'}}>{totalUD > 0 ? totalUD : (propiasUD > 0 ? propiasUD : '—')}</td>
                    <td className="c" style={{padding:'1px 3px'}}>
                      <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{rStr || '—'}</span>
                    </td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:10,padding:'1px 3px'}}>{Q > 0 ? Q.toFixed(3) : '—'}</td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'1px 3px'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontSize:9,padding:'1px 3px'}}>{DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '—'}</td>
                    <td className="c" style={{padding:'1px 3px'}}><span style={{fontFamily:'var(--mono)',fontSize:10}}>{t.bajDprop ? t.bajDprop + '"' : '—'}</span></td>
                    <td className="c" style={{fontSize:10,padding:'1px 3px'}}>{chequeo}</td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'1px 3px'}}>{QmaxB > 0 ? QmaxB.toFixed(2) : '—'}</td>
                    <td className="c" style={{fontSize:10,padding:'1px 3px'}}>{Vt > 0 ? Vt.toFixed(2) : '—'}</td>
                    <td className="c" style={{fontSize:10,padding:'1px 3px'}}>{Ltcalc > 0 ? Ltcalc.toFixed(2) : '—'}</td>
                    <td className="c" style={{fontSize:10,padding:'1px 3px'}}>{Ltmin > 0 ? Ltmin.toFixed(2) : '—'}</td>
                    <td className="c" style={{fontSize:10,padding:'1px 3px'}}>{Vair > 0 ? Vair.toFixed(2) : '—'}</td>
                    <td className="c" style={{padding:'1px 3px'}}><span style={{fontFamily:'var(--mono)',fontSize:10}}>{fDarcy > 0 ? fDarcy.toFixed(3) : '—'}</span></td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'1px 3px'}}>{Qair > 0 ? Qair.toFixed(2) : '—'}</td>
                    <td className="c" style={{padding:'1px 3px'}}><span style={{fontFamily:'var(--mono)',fontSize:10}}>{Lbaj > 0 ? Lbaj : '—'}</span></td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontSize:9,padding:'1px 3px'}}>{DventCalcPulg > 0 ? DventCalcPulg.toFixed(2) + '"' : '—'}</td>
                    <td className="c" style={{padding:'1px 3px'}}><span style={{fontFamily:'var(--mono)',fontSize:10}}>{t.ventDprop ? t.ventDprop + '"' : '—'}</span></td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}