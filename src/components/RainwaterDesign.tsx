import { useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { usePlans } from "../context/PlansContext";
import { pisoCorto, DIAM_OPTIONS, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN } from "../constants";
import { diametroManning } from "../utils/calcSanitary";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiameterToDrawing";
import { getTributarioIds } from "../utils/tramoUtils";
import { calcHydraulicCheck } from "../utils/hydraulicCheck";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";

export default function DisenoLluvias() {
  const { tramosLl, updTramoLL, delTramoLL } = useTramos();
  const { plans } = usePlans();

  const [conexiones, conexionesDisplay] = useMemo(() => {
    const calculoMap: Record<string, string[]> = {};

    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { continue; } }

      const ramales = (data.ramales || []).filter((r: any) => r.net === 'll');
      const bajantes = (data.bajantes || []).filter((b: any) => b.net === 'll');

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
    for (const t of tramosLl) {
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
          const tr = tramosLl.find(x => x._key === node);
          const isMainRamal = tr && (tr as any).tipo === 'ramal' && !(tr as any).esBajante;
          if (isMainRamal) {
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
    for (const t of tramosLl) {
      if (t._key && t.tipo === 'ramal' && !t.esBajante) {
        displayMap[t._key] = getConnectedNeighbors(t._key);
      }
    }

    return [calculoMap, displayMap];
  }, [plans, tramosLl]);

  const getDescendantsQ = useCallback((tKey: string): number => {
    const children = conexiones[tKey] || [];
    let sum = 0;
    for (const childKey of children) {
      const childTramo = tramosLl.find(x => x._key === childKey);
      if (childTramo) {
        sum += (childTramo.qLps || 0) + getDescendantsQ(childKey);
      }
    }
    return sum;
  }, [conexiones, tramosLl]);

  const handleDiamChange = useCallback((tramoKey: string, tramoId: string, newPulg: number) => {
    updTramoLL(tramoKey, 'diamDisPulg', newPulg);
    const opt = DIAM_OPTIONS.find(o => o.pulg === newPulg);
    if (opt && tramoId) {
      writeDiametroToDrawing(tramoId, 'll', opt.label, plans);
    }
  }, [updTramoLL, plans]);

  const handleDelete = useCallback((tramoKey: string, tramoId: string) => {
    delTramoLL(tramoKey);
    if (tramoId) deleteRamalFromDrawing(tramoId, 'll', plans);
  }, [delTramoLL, plans]);

  const tribIds = getTributarioIds(tramosLl);
  const displayTramos = tramosLl.filter(t => t._key != null && !tribIds.has(t._key) && !tribIds.has(t.id));

  return (
  <>
    <div className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/aguas_lluvias/RALL_Diseno_red.webp" alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Diseño de red aguas lluvias</h3>
      </div>
      <div className="scroll-top" style={{padding:'12px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
          <table className="tbl" style={{fontSize:11}}>
          <thead>
            <tr>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Tramo</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Nivel</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Inicio</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Fin</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Ramales<br/>asociados</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Q<br/><small>LPS</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>n<br/>Manning</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>S&nbsp;%</th>
              <th className="col-h ok" colSpan={3} style={{textAlign:'center',fontSize:10,padding:'3px 2px'}}>Diámetro</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Qo<br/><small>LPS</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Vo<br/><small>m/s</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Q/Qo</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Yc<br/><small>mm</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Fr</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Flujo</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Ymax<br/><small>mm</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Yn vs Yc</th>
              <th className="col-h ven" colSpan={2} style={{textAlign:'center',fontSize:10,padding:'3px 2px'}}>Fuerza Tractiva</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}></th>
            </tr>
            <tr>
              <th className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 2px'}}>Calc.<br/>pulg</th>
              <th className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 2px'}}>Diseño<br/>pulg</th>
              <th className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 2px'}}>Int.<br/>mm</th>
              <th className="col-h ven" style={{fontSize:9,textAlign:'center',padding:'2px 2px'}}>Vr<br/><small>kg/m2</small></th>
              <th className="col-h ven" style={{fontSize:9,textAlign:'center',padding:'2px 2px'}}>&gt;0.15</th>
            </tr>
          </thead>
          <tbody>
            {displayTramos.length === 0 ? (
              <tr>
                <td colSpan={22} style={{ padding: "16px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
            ) : [...displayTramos].sort((a,b)=>(a.piso||0)-(b.piso||0)).map(t=>{
const n=t.nmaning??0;
const sVal=t.sPercent??0;
const S=sVal!=null&&sVal>0?sVal/100:null;
const ownQ = t.qLps || 0;
const totalExtra = getDescendantsQ(t._key!);
const Q = ownQ + totalExtra;
              const dSel=DIAM_OPTIONS.find(d=>d.pulg===(t.diamDisPulg||0))||null;
      let DcalcPulg=0,DdisPulg=dSel?dSel.pulg:0,DintMm=dSel?dSel.mm:0;
      let Qo=0,Vo=0,qqo=0;
      let Yc=0,Froude=0,tipoFlujo='—',Ymax=0,chequeoYn='—';
      let fuerzaTractiva=0,chequeoFT='—';
if(Q>0&&S!=null&&S>0&&n!=null&&n>0){
DcalcPulg=Math.round(diametroManning(Q/1000,n,S)*1000/25.4*100)/100;
 if(DdisPulg>0){const ok=DcalcPulg<=DdisPulg?'O.K.':'NO CUMPLE'; void ok;}
}
if(Q>0&&S!=null&&S>0&&n!=null&&n>0&&DintMm>0){
const hc = calcHydraulicCheck({ Q, S, n, DintMm, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN });
 Qo = hc.Qo; Vo = hc.Vo; qqo = hc.qqo;
  Yc = hc.Yc; Froude = hc.Froude; tipoFlujo = hc.tipoFlujo;
  Ymax = hc.Ymax; chequeoYn = hc.chequeoYn; fuerzaTractiva = hc.fuerzaTractiva; chequeoFT = hc.chequeoFT;
}
              return(
                <tr key={t._key}>
                  <td className="c" style={{padding:'2px 4px'}}><span className="sigla" style={{fontSize:10}}>{t.id || t._key}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.piso ? pisoCorto(t.piso) : '—'}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.desde || '—'}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.hasta || '—'}</span></td>
                  <td className="c" style={{padding:'2px 4px',minWidth:60,maxWidth:120}}>
                    {(() => {
                      const connectedKeys = conexionesDisplay[t._key!] || [];
                      return connectedKeys.length === 0 ? (
                        <span style={{fontSize:9,color:'var(--txt3)'}}>—</span>
                      ) : (
                        <div style={{display:'flex',flexWrap:'wrap',gap:2,justifyContent:'center',alignItems:'center'}}>
                          {connectedKeys.map(childKey => {
                            const parts = childKey.split('-');
                            const rId = parts[0];
                            const childTramo = tramosLl.find(tr => tr._key === childKey);
                            const childTotalQ = (childTramo ? childTramo.qLps || 0 : 0) + getDescendantsQ(childKey);
                            return (
                              <span key={childKey}
                                title={`${rId} (${childTotalQ.toFixed(2)} LPS)`}
                                style={{fontSize:9,padding:'1px 3px',border:'1px solid var(--ll)',borderRadius:3,color:'var(--ll)',fontFamily:'var(--mono)',lineHeight:1.3}}>
                                {rId}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'2px 4px'}}>{Q>0?Q.toFixed(3):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{sVal > 0 ? sVal : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:9,padding:'2px 4px'}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
                  <td className="c" style={{padding:'2px 2px'}}>
          <select
            value={DdisPulg||''}
            onChange={e=>handleDiamChange(t._key!,t.id,parseFloat(e.target.value)||0)}
            style={{fontFamily:'var(--mono)',fontSize:9,padding:'1px 1px',border:'1px solid var(--line)',borderRadius:2,background:'var(--bg2)',color:'var(--txt)',cursor:'pointer',maxWidth:60}}
          >
            <option value="">—</option>
            {DIAM_OPTIONS.map(o=><option key={o.pulg} value={o.pulg}>{o.label}</option>)}
          </select>
        </td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{DintMm>0?DintMm:'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{Qo>0?Qo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{Vo>0?Vo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{qqo>0?qqo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{Yc>0?Yc.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{Froude>0?Froude.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:9,padding:'2px 4px'}}>{tipoFlujo}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{Ymax>0?Ymax.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{chequeoYn}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{fuerzaTractiva>0?fuerzaTractiva.toFixed(2):'—'}</td>
        <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{chequeoFT}</td>
        <td className="c" style={{padding:'1px 4px'}}>
          <button
            onClick={() => handleDelete(t._key!, t.id)}
            title="Eliminar ramal"
            style={{border:'none',background:'transparent',color:'var(--txt3)',cursor:'pointer',fontSize:11,padding:'0 2px',lineHeight:1}}
          >&#x2715;</button>
        </td>
      </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  </>);
}
