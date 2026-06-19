import { useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { useApparatus } from "../context/ApparatusContext";
import { usePlans } from "../context/PlansContext";
import { calcUDparcial } from "../utils/componentHelpers";
import { pisoCorto, DIAM_OPTIONS, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN, SAN_UC_IDS, APARATOS_DEF } from "../constants";
import { diametroManning, caudalHunterLPS, factorSimultaneidad } from "../utils/calcSanitary";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiameterToDrawing";
import { calcHydraulicCheck } from "../utils/hydraulicCheck";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";

export default function DisenosSanitarios() {
  const { tramosSan, updTramoSan, delTramoSan } = useTramos();
  const { aps } = useApparatus();
  const { plans } = usePlans();

  const handleDiamChange = useCallback((tramoId: string, newPulg: number) => {
    updTramoSan(tramoId, 'diamDisPulg', newPulg);
    const opt = DIAM_OPTIONS.find(o => o.pulg === newPulg);
    if (opt) {
      writeDiametroToDrawing(tramoId, 'san', opt.label, plans);
    }
  }, [updTramoSan, plans]);

  const handleDelete = useCallback((tramoId: string) => {
    delTramoSan(tramoId);
    deleteRamalFromDrawing(tramoId, 'san', plans);
  }, [delTramoSan, plans]);

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

  const [conexiones, conexionesDisplay] = useMemo(() => {
    const calculoMap: Record<string, string[]> = {};

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
          calculoMap[targetKey].push(rKey);
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

    return [calculoMap, displayMap];
  }, [plans, tramosSan]);

  const getDescendantsUD = useCallback((tKey: string): number => {
    const children = conexiones[tKey] || [];
    let sum = 0;
    for (const childKey of children) {
      const childTramo = tramosSan.find(x => x._key === childKey);
      if (childTramo) {
        sum += calcUDparcial(childTramo, mergedBase) + getDescendantsUD(childKey);
      }
    }
    return sum;
  }, [conexiones, tramosSan, mergedBase]);

  const totales = useMemo(() => mergedBase.map(d => ({
    id: d.id, nombre: d.nombre, ud: d.ud,
    cant: tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0)
  })), [mergedBase, tramosSan]);

  const totalUD = useMemo(() =>
    totales.reduce((s, d) => s + (d.cant || 0) * (d.ud || 0), 0),
  [totales]);

  return (
  <>
  <div className="card">
    <div className="card-h">
      <h3 className="card-t"><img src="/iconos_diseno_redes/sanitaria/RS_Diseno.webp" alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Diseño de red sanitaria</h3>
      <span className="card-s">{displayTramos.length} tramos · {totalUD} UD totales</span>
    </div>
    <div className="scroll-top" style={{padding:'16px'}}>
      <div className="scroll-inner">
        <table className="tbl" style={{fontSize:12}}>
          <caption style={{position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>Diseño de red sanitaria</caption>
          <thead>
            <tr>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Tramo<br/>o Ramal</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Nivel</th>
              <th scope="col" className="col-h san" colSpan={3} style={{textAlign:'center',fontSize:10,padding:'2px 4px'}}>UD DE DESCARGA</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>#<br/>Desc.</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>K</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Q<br/><small>LPS</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Manning</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>S %</th>
              <th scope="col" className="col-h ok" colSpan={3} style={{textAlign:'center',fontSize:10,padding:'2px 4px'}}>Diámetro</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Qo<br/><small>LPS</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Vo<br/><small>m/s</small></th>
               <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Q/Qo</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Yc<br/><small>mm</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Froude</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Tipo de<br/>Flujo</th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Ymax<br/><small>0.75D mm</small></th>
              <th scope="col" className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Yn vs Yc</th>
              <th scope="col" className="col-h ven" colSpan={2} style={{textAlign:'center',fontSize:10,padding:'2px 4px'}}>F. Tractiva</th>
            </tr>
            <tr>
              <th scope="col" className="col-h san" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Propias</th>
              <th scope="col" className="col-h san" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Otros<br/>Ramales</th>
              <th scope="col" className="col-h san" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Total</th>
              <th scope="col" className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Calc.<br/>pulg</th>
              <th scope="col" className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Diseño<br/>pulg</th>
              <th scope="col" className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Int.<br/>mm</th>
              <th scope="col" className="col-h ven" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Vr<br/><small>kg/m2</small></th>
              <th scope="col" className="col-h ven" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>&gt;0.15</th>
            </tr>
          </thead>
          <tbody>
            {displayTramos.length === 0 ? (
              <tr>
                <td colSpan={23} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
            ) : (()=>{
              return [...displayTramos].sort((a,b)=>(a.piso||0)-(b.piso||0)).map(t=>{
                const tKey = t._key || `${t.id}-${t.piso}`;
                
                const udPropias=calcUDparcial(t,mergedBase);
                const connectedKeys = conexionesDisplay[tKey] || [];
                const totalExtra = getDescendantsUD(tKey);
                const udAcum=udPropias+totalExtra;
                const nSalidas=t.nSalidas??0;
                const K=nSalidas!=null&&nSalidas>0?Math.round(factorSimultaneidad(nSalidas)*100)/100:null;
                const n=t.nmaning??0;
                const sVal=t.sPercent??0;
                const S=sVal!=null&&sVal>0?sVal/100:null;
                const Q=udAcum>0&&K!=null?Math.round(caudalHunterLPS(udAcum,K)*1000)/1000:null;
                const dSel=DIAM_OPTIONS.find(d=>d.pulg===(t.diamDisPulg||0))||null;
                let DcalcPulg=0,DdisPulg=dSel?dSel.pulg:0,DintMm=dSel?dSel.mm:0;
                let Qo=0,Vo=0,qqo=0;
                let Yc=0,Froude=0,tipoFlujo='—',Ymax=0,chequeoYn='—';
                let fuerzaTractiva=0,chequeoFT='—';
                if(Q!=null&&Q>0&&S!=null&&S>0&&n!=null&&n>0){
                  DcalcPulg=Math.round(diametroManning(Q/1000,n,S)*1000/25.4*100)/100;
                  if(DdisPulg>0){const ok=DcalcPulg<=DdisPulg?'O.K.':'NO CUMPLE'; void ok;}
                }
                if(Q!=null&&Q>0&&S!=null&&S>0&&n!=null&&n>0&&DintMm>0){
                  const hc = calcHydraulicCheck({ Q, S, n, DintMm, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN });
                  Qo = hc.Qo; Vo = hc.Vo; qqo = hc.qqo;
                  Yc = hc.Yc; Froude = hc.Froude; tipoFlujo = hc.tipoFlujo;
                  Ymax = hc.Ymax; chequeoYn = hc.chequeoYn; fuerzaTractiva = hc.fuerzaTractiva; chequeoFT = hc.chequeoFT;
                }
                return (
                <tr key={tKey}>
                  <td className="c" style={{padding:'3px 5px'}}><span className="sigla" style={{fontSize:10}}>{t.id}</span></td>
                  <td className="c" style={{padding:'3px 5px'}}><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{pisoCorto(t.piso)}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{udPropias}</td>
                  <td className="c" style={{padding:'3px 5px',minWidth:60,maxWidth:120}}>
                    {connectedKeys.length === 0 ? (
                      <span style={{fontSize:9,color:'var(--txt3)'}}>—</span>
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
                              style={{fontSize:9,padding:'1px 3px',border:'1px solid var(--san)',borderRadius:3,color:'var(--san)',fontFamily:'var(--mono)',lineHeight:1.3}}>
                              {rId}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:11,padding:'3px 5px'}}>{udAcum}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{nSalidas > 0 ? nSalidas : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'3px 5px'}}>{K!=null?K.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'3px 5px'}}>{Q!=null && Q>0?Q.toFixed(3):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{sVal > 0 ? sVal : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'3px 5px'}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
                  <td className="c" style={{padding:'3px 5px'}}>
                    <select
                      aria-label="Diámetro diseño"
                      value={DdisPulg||''}
                      onChange={e=>handleDiamChange(tKey,parseFloat(e.target.value)||0)}
                      style={{fontFamily:'var(--mono)',fontSize:10,padding:'1px 2px',border:'1px solid var(--line)',borderRadius:2,background:'var(--bg2)',color:'var(--txt)',cursor:'pointer'}}
                    >
                      <option value="">—</option>
                      {DIAM_OPTIONS.map(o=><option key={o.pulg} value={o.pulg}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="c" style={{padding:'3px 5px'}}>{DintMm>0?DintMm:'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{Qo>0?Qo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{Vo>0?Vo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{qqo>0?qqo.toFixed(2):'—'}</td>
                  <td className="c" style={{padding:'3px 5px'}}>{Yc>0?Yc.toFixed(2):'—'}</td>
                  <td className="c" style={{padding:'3px 5px'}}>{Froude>0?Froude.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:10,padding:'3px 5px'}}>{tipoFlujo}</td>
                  <td className="c" style={{padding:'3px 5px'}}>{Ymax>0?Ymax.toFixed(2):'—'}</td>
                  <td className="c" style={{padding:'3px 5px'}}>{chequeoYn}</td>
                  <td className="c" style={{padding:'3px 5px'}}>{fuerzaTractiva>0?fuerzaTractiva.toFixed(2):'—'}</td>
                  <td className="c" style={{padding:'3px 5px'}}>{chequeoFT}</td>
                </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  </>);
}