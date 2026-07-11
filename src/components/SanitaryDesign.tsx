import { useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { useApparatus } from "../context/ApparatusContext";
import { usePlans } from "../context/PlansContext";
import { calcUDparcial, renderStatus } from "../utils/componentHelpers";
import { pisoCorto, DIAM_OPTIONS, SAN_UC_IDS, APARATOS_DEF } from "../constants";
import { diametroManning, caudalHunterLPS, factorSimultaneidad } from "../utils/calcSanitaryCore";
import { writeDiametroToDrawing } from "../utils/writeDiameterToDrawing";
import { calcHydraulicCheck } from "../utils/hydraulicCheck";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import { distToPolyline } from "../lib/shared/geometry";
import { parseDescargaEnId } from "../utils/parseDescargaEnId";
const SanitaryDesign_S1: React.CSSProperties = { fontFamily:'var(--mono)',fontSize: 9,padding:'1px 2px',border:'1px solid var(--line)',borderRadius:2,background:'var(--bg2)',color:'var(--txt)',cursor:'pointer' };


const SR_ONLY = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 } as const;
const EMPTY_ROW = { padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 9 } as const;
const TH_HDR = { fontSize: 9, textAlign:'center', padding:'1px 2px' } as const;
const TH_SUB = { fontSize: 9, textAlign:'center', padding:'1px 2px' } as const;

export default function DisenosSanitarios() {
  const { tramosSan, updTramoSan } = useTramos();
  const { aps } = useApparatus();
  const { plans } = usePlans();

  const handleDiamChange = useCallback((tramoId: string, newPulg: number) => {
    updTramoSan(tramoId, 'diamDisPulg', newPulg);
    const opt = DIAM_OPTIONS.find(o => o.pulg === newPulg);
    if (opt) {
      writeDiametroToDrawing(tramoId, 'san', opt.label, plans);
    }
  }, [updTramoSan, plans]);



  const mergedBase = useMemo(() => {
    const defMap = new Map(APARATOS_DEF.map(d => [d.id, d]));
    return SAN_UC_IDS.map(id => {
      const fromAps = aps.find(p => p.id === id);
      const def = defMap.get(id);
      return { id, nombre: def?.nombre || id, ud: fromAps?.ud ?? def?.ud ?? 0 };
    });
  }, [aps]);

  const displayTramos = useMemo(() => {
    return tramosSan.filter(t => t.tipo === 'ramal' && !t.esBajante);
  }, [tramosSan]);

  const [conexiones, conexionesDisplay, componentTotalMap] = useMemo(() => {
    const calculoMap: Record<string, string[]> = {};

    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { continue; } }

      const ramales = data.ramales || [];
      const bajantes = data.bajantes || [];


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
          if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
          if (!calculoMap[targetKey].includes(rKey)) {
            calculoMap[targetKey].push(rKey);
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
          if (!calculoMap[lowerKey]) calculoMap[lowerKey] = [];
          if (!calculoMap[lowerKey].includes(upperKey)) {
            calculoMap[lowerKey].push(upperKey);
          }
        }
      }
    }

    // Add discharge connections (descargaEnId) of bajantes into lower ramales
    for (const t of tramosSan) {
      if (t.esBajante && t.descargaEnId && t._key) {
        const parts = parseDescargaEnId(t.descargaEnId, '');
        const dPlanId = parts[0];
        const targetRamalId = parts[1];
        if (targetRamalId) {
          const targetKey = `${targetRamalId}-${dPlanId}`;
          const targetExists = tramosSan.some(x => x._key === targetKey);
          if (targetExists) {
            if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
            if (!calculoMap[targetKey].includes(t._key)) {
              calculoMap[targetKey].push(t._key);
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

    for (const [parentKey, children] of Object.entries(calculoMap)) {
      if (!adj[parentKey]) adj[parentKey] = [];
      for (const childKey of children) {
        if (!adj[childKey]) adj[childKey] = [];
        if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
        if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
      }
    }

    // Helper to run BFS to get direct neighbors (excluding startKey, stopping traversal at any main ramal node)
    const getConnectedNeighbors = (startKey: string): string[] => {
      const results = new Set<string>();
      const visited = new Set<string>();
      const queue = [startKey];
      visited.add(startKey);

      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node !== startKey) {
          const tr = tramosSan.find(x => x._key === node);
          if (tr && tr.tipo === 'ramal' && !tr.esBajante) {
            results.add(node);
            continue; // Stop traversal at this main ramal
          }
        }
        for (const neighbor of adj[node] || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      return Array.from(results);
    };

    const displayMap: Record<string, string[]> = {};
    for (const t of tramosSan) {
      if (t._key && t.tipo === 'ramal' && !t.esBajante) {
        displayMap[t._key] = getConnectedNeighbors(t._key);
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

    // Compute connected-component totals: each tramo's Total = sum of all tramos in its component
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

    return [orientedConexiones, displayMap, componentTotalMap];
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

  const totales = useMemo(() => mergedBase.map(d => ({
    id: d.id, nombre: d.nombre, ud: d.ud,
    cant: tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0)
  })), [mergedBase, tramosSan]);

  const totalUD = useMemo(() =>
    totales.reduce((s, d) => s + (d.cant || 0) * (d.ud || 0), 0),
  [totales]);

  return (
  <>
  <section className="card">
    <div className="card-h">
      <h3 className="card-t"><img src="/iconos_diseno_redes/sanitaria/RS_Diseno.svg" alt="Diseño red sanitaria"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Diseño de red sanitaria</h3>
      <span className="card-s">{displayTramos.length} tramos · {totalUD} UD totales</span>
    </div>
    <div className="scroll-top" style={{padding:'16px'}}>
      <div className="scroll-inner">
        <table className="tbl" style={{fontSize: 9}}>
          <caption style={SR_ONLY}>Diseño de red sanitaria</caption>
          <thead>
            <tr>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Tramo</th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Nivel</th>
              <th scope="col" className="col-h san" colSpan={3} style={{textAlign:'center',fontSize: 9,padding:'1px 2px'}}>Unidades de descarga</th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}># Descargas</th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>K</th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Caudal<br/><small>(LPS)</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Manning<br/></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Pendiente<br/><small>(%)</small></th>
              <th scope="col" className="col-h ok" colSpan={3} style={{textAlign:'center',fontSize: 9,padding:'1px 2px'}}>Diámetro</th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Q<sub>o</sub><br/><small>(LPS)</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>V<sub>o</sub><br/><small>(m/s)</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Q/Q<sub>o</sub></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Velocidad real<br/><small>(m/s)</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Chequeo  velocidad</th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Y<sub>c</sub><br/><small>(mm)</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Y<sub>n</sub><br/><small>(mm)</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Froude</th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Flujo</th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Y<sub>max</sub><br/><small>(mm)</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>Y<sub>n</sub> vs Y<sub>c</sub></th>
              <th scope="col" className="col-h ven" colSpan={2} style={{textAlign:'center',fontSize: 9,padding:'1px 2px'}}>Fuerza Tractiva</th>
            </tr>
            <tr>
              <th scope="col" className="col-h san" style={TH_SUB}>Propia</th>
              <th scope="col" className="col-h san" style={TH_SUB}>Otros</th>
              <th scope="col" className="col-h san" style={TH_SUB}>Total</th>
              <th scope="col" className="col-h ok" style={TH_SUB}>Calculado<br/><small>(")</small></th>
              <th scope="col" className="col-h ok" style={TH_SUB}>Diseño<br/><small>(")</small></th>
              <th scope="col" className="col-h ok" style={TH_SUB}>Interior<br/><small>(mm)</small></th>
              <th scope="col" className="col-h ven" style={TH_SUB}>Real<br/><small>(kg/m²)</small></th>
              <th scope="col" className="col-h ven" style={TH_SUB}>&gt;0.15</th>
            </tr>
          </thead>
          <tbody>
            {displayTramos.length === 0 ? (
              <tr>
                <td colSpan={26} style={EMPTY_ROW}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
            ) : (()=>{
              return displayTramos.toSorted((a,b)=>(a.piso||0)-(b.piso||0)).map(t=>{
                const tKey = t._key || `${t.id}-${t.piso}`;
                
                const udPropias=calcUDparcial(t,mergedBase);
                const connectedKeys = conexionesDisplay[tKey] || [];
                const udAcum = (componentTotalMap[tKey] || 0);

                const nSalidas=t.nSalidas??0;
                const K=nSalidas!=null&&nSalidas>0?Math.round(factorSimultaneidad(nSalidas)*100)/100:null;
                const n=t.nmaning || 0.009;
                const sVal=t.sPercent??0;
                const S=sVal!=null&&sVal>0?sVal/100:null;
                const Q=udAcum>0&&K!=null?Math.round(caudalHunterLPS(udAcum,K)*1000)/1000:null;
                const dSel=DIAM_OPTIONS.find(d=>d.pulg===(t.diamDisPulg||0))||null;
                let DcalcPulg = 0;
                const DdisPulg = dSel ? dSel.pulg : 0;
                const DintMm = dSel ? dSel.mm : 0;
                let Qo=0,Vo=0,qqo=0;
                let Vreal=0,chequeoV='—';
                let Yc=0,Yn=0,Froude=0,tipoFlujo='—',Ymax=0,chequeoYn='—';
                let fuerzaTractiva=0,chequeoFT='—';
                if(Q!=null&&Q>0&&S!=null&&S>0&&n!=null&&n>0){
                  DcalcPulg=Math.round(diametroManning(Q/1000,n,S)*1000/25.4*100)/100;
                }
                if(Q!=null&&Q>0&&S!=null&&S>0&&n!=null&&n>0&&DintMm>0){
                  const hc = calcHydraulicCheck({ Q, S, n, DintMm });
                  Qo = hc.Qo; Vo = hc.Vo; qqo = hc.qqo;
                  Vreal = hc.Vreal; chequeoV = hc.chequeoV;
                  Yc = hc.Yc; Yn = hc.Yn; Froude = hc.Froude; tipoFlujo = hc.tipoFlujo;
                  Ymax = hc.Ymax; chequeoYn = hc.chequeoYn; fuerzaTractiva = hc.fuerzaTractiva; chequeoFT = hc.chequeoFT;
                }
                return (
                <tr key={tKey}>
                  <td className="c" style={{padding:'1px 2px'}}><span className="sigla" style={{fontSize: 9}}>{t.id}</span></td>
                  <td className="c" style={{padding:'1px 2px'}}><span style={{fontSize: 9,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{pisoCorto(t.piso)}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{udPropias}</td>
                  <td className="c" style={{padding:'1px 2px',minWidth:60,maxWidth:120}}>
                    {connectedKeys.length === 0 ? (
                      <span style={{fontSize: 9,color:'var(--txt3)'}}>—</span>
                    ) : (
                      <div style={{display:'flex',flexWrap:'wrap',gap:2,justifyContent:'center',alignItems:'center'}}>
                        {connectedKeys.map(childKey => {
                          const parts = childKey.split('-');
                          const rId = parts[0];
                          const childTramo = tramosSan.find(tr => tr._key === childKey);
                          const childOwnUd = childTramo ? calcUDparcial(childTramo, mergedBase) : 0;
                          const childTotalUd = childOwnUd + getDescendantsUD(childKey);
                          return (
                            <span key={childKey}
                              title={`${rId} (${childTotalUd} UD)`}
                              style={{fontSize: 9,padding:'1px 2px',border:'1px solid var(--san)',borderRadius:3,color:'var(--san)',fontFamily:'var(--mono)',lineHeight:1.3}}>
                              {rId}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize: 9,padding:'1px 2px'}}>{udAcum}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{nSalidas > 0 ? nSalidas : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'1px 2px'}}>{K!=null?K.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'1px 2px'}}>{Q!=null && Q>0?Q.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{sVal > 0 ? sVal : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 9,padding:'1px 2px'}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
                  <td className="c" style={{padding:'1px 2px'}}>
                    <select
                      aria-label="Diámetro diseño"
                      value={DdisPulg||''}
                      onChange={e=>handleDiamChange(tKey,parseFloat(e.target.value)||0)}
                      style={SanitaryDesign_S1}
                    >
                      <option value="">—</option>
                      {DIAM_OPTIONS.map(o=><option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="c" style={{padding:'1px 2px'}}>{DintMm>0?DintMm:'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{Qo>0?Qo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{Vo>0?Vo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{qqo>0?qqo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{Vreal>0?Vreal.toFixed(2):'—'}</td>
                  <td className="c" style={{padding:'1px 2px'}}>{renderStatus(chequeoV)}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{Yc>0?Yc.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{Yn>0?Yn.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{Froude>0?Froude.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize: 9,padding:'1px 2px'}}>{tipoFlujo}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{Ymax>0?Ymax.toFixed(2):'—'}</td>
                  <td className="c" style={{padding:'1px 2px'}}>{renderStatus(chequeoYn)}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'1px 2px'}}>{fuerzaTractiva>0?fuerzaTractiva.toFixed(2):'—'}</td>
                  <td className="c" style={{padding:'1px 2px'}}>{renderStatus(chequeoFT)}</td>
                </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  </section>
  </>);
}