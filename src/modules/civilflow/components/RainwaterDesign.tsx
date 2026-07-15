import React, { useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { usePlans } from "../context/PlansContext";
import { renderStatus } from "../utils/componentHelpers";
import { pisoCorto, DIAM_OPTIONS } from "../constants";
import { diametroManning } from "../utils/calcSanitaryCore";
import { chequeoBajanteLluvia } from "../utils/calcRainwater";
import { writeDiametroToDrawing } from "../utils/writeDiameterToDrawing";
import { calcHydraulicCheck } from "../utils/hydraulicCheck";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import { useRainwater } from "../context/RainwaterContext";
import { distToPolyline } from "../lib/shared/geometry";
const RainwaterDesign_S2: React.CSSProperties = { fontFamily:'var(--mono)',fontSize: 10,padding:'1px 1px',border:'1px solid var(--line)',borderRadius:2,background:'var(--bg2)',color:'var(--txt)',cursor:'pointer',maxWidth:60 };
const TH_HDR = { fontSize: 9, textAlign:'center', padding:'1px 2px' } as const;


function getTributarioIds(tramos: Array<{ recibeDe?: string[]; descripcion?: string }>): Set<string> {
  const tribSet = new Set<string>();
  for (const t of tramos) {
    if (t.recibeDe) {
      for (const id of t.recibeDe) tribSet.add(id);
    }
    if (t.descripcion) {
      const ids = t.descripcion.split('+').map(s => s.trim()).filter(Boolean);
      for (const id of ids) tribSet.add(id);
    }
  }
  return tribSet;
}

export default function DisenoLluvias() {
  const { tramosLl, updTramoLL } = useTramos();
  const { plans } = usePlans();
  const { bajantesLl } = useRainwater();

  const [, , conexionesDisplay] = useMemo(() => {
    const calculoMap: Record<string, string[]> = {};

    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { continue; } }

      const ramales = (data.ramales || []).filter((r: any) => r.net === 'll');
      const bajantes = (data.bajantes || []).filter((b: any) => b.net === 'll');

      for (const r of ramales) {
        if (!r.pts || r.pts.length < 2) continue;
        const pStart = r.pts[0];
        const pEnd = r.pts[r.pts.length - 1];
        const rKey = `${r.id}-${plan.id}`;

        const checkEndpoint = (pt: number[]) => {
          for (const b of bajantes) {
            const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
            const dist = Math.hypot(pt[0] - b.x, pt[1] - b.y);
            if (isExplicit) {
              // Explicit link doesn't say which end — assign it to whichever endpoint is
              // geometrically closer, so a bajante at each end each claims its own.
              const otherPt = pt === pEnd ? pStart : pEnd;
              const otherDist = Math.hypot(otherPt[0] - b.x, otherPt[1] - b.y);
              if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
              continue;
            }
            if (dist < 2.0) {
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

        // A ramal can have a bajante at EACH end (e.g. connecting two downpipes) — check both
        // endpoints independently instead of short-circuiting on the first match, otherwise the
        // second bajante is silently dropped from calculoMap/ramalToBajantes.
        const endConnection = checkEndpoint(pEnd);
        const startConnection = checkEndpoint(pStart);
        const connections = [endConnection, startConnection].filter(
          (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null
        );

        for (const connection of connections) {
          const targetKey = `${connection.id}-${plan.id}`;
          if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
          if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
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

    const ramalToBajantes: Record<string, string[]> = {};
    const bajanteKeys = tramosLl.filter(t => t.esBajante && t._key).map(t => ({ key: t._key!, code: t.code || t.id }));
    
    for (const b of bajanteKeys) {
      const queue = [b.key];
      const visited = new Set<string>();
      visited.add(b.key);
      
      while (queue.length > 0) {
        const node = queue.shift()!;
        const children = calculoMap[node] || [];
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

    return [calculoMap, displayMap, ramalToBajantes];
  }, [plans, tramosLl]);

  const getAssociatedBajantes = useCallback((tKey: string): string[] => {
    return (conexionesDisplay as any)[tKey] || [];
  }, [conexionesDisplay]);



  const qMap = useMemo(() => {
    const areaAcumMap: Record<string, number> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { continue; } }
      const totalArea = (data.areas || []).reduce((s: number, a: any) => s + (a.areaM2 || 0), 0);
      areaAcumMap[String(plan.nivel)] = totalArea;
    }

    const ownQMap: Record<string, number> = {};
    for (const t of tramosLl) {
      if (!t._key) continue;
      let ownQ = 0;
      // Prioritize manually edited caudal field
      if (t.caudal != null && t.caudal > 0) {
        ownQ = t.caudal;
      } else if (t.area_m2 && t.area_m2 > 0) {
        const manual = bajantesLl.find(b => 
          b.bajante === t.id || b.bajante === t.code || b.id === t.id || b.id === t.code
        );
        const int = manual?.intensidad ?? 100;
        const coef = manual?.coeficienteC ?? 0.0278;
        ownQ = t.area_m2 * int * coef / 100;
      } else {
        ownQ = t.qLps || 0;
      }
      ownQMap[t._key] = ownQ;
    }

    const totalQMap: Record<string, number> = {};
    for (const t of tramosLl) {
      if (!t._key) continue;
      
      let total = 0;
      if (t.tipo === 'ramal' && !t.esBajante) {
        const associatedCodes = getAssociatedBajantes(t._key);
        for (const code of associatedCodes) {
          const bajante = bajantesLl.find(b => b.bajante === code || b.id === code);
          const trBaj = tramosLl.find(tb => tb.code === code || tb.id === code);

          const areaAcum = areaAcumMap[String(trBaj?.piso)] || bajante?.areaAcumulada || 0;
          
          if (bajante) {
             const Q = chequeoBajanteLluvia({ areaAcumulada: areaAcum, intensidad: bajante.intensidad ?? 100, coeficienteC: bajante.coeficienteC ?? 0.0278 }).Q;
             total += Q;
          } else if (trBaj) {
             const Q = chequeoBajanteLluvia({ areaAcumulada: areaAcum, intensidad: 100, coeficienteC: 0.0278 }).Q;
             total += Q;
          }
        }
        if (total === 0 && t.qLps) {
           total = t.qLps;
        }
      } else {
         total = ownQMap[t._key] || 0;
      }
      totalQMap[t._key] = total;
    }
    return totalQMap;
  }, [tramosLl, bajantesLl, getAssociatedBajantes, plans]);


  const handleDiamChange = useCallback((tramoKey: string, tramoId: string, newPulg: number) => {
    updTramoLL(tramoKey, 'diamDisPulg', newPulg);
    const opt = DIAM_OPTIONS.find(o => o.pulg === newPulg);
    if (opt && tramoId) {
      writeDiametroToDrawing(tramoId, 'll', opt.label, plans);
    }
  }, [updTramoLL, plans]);



  const tribIds = getTributarioIds(tramosLl);
  const displayTramos = tramosLl.filter(t => t._key != null && !t.esBajante && !tribIds.has(t._key) && !tribIds.has(t.id));

  return (
  <>
    <section className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/aguas_lluvias/RALL_Diseno_red.webp" alt="Diseño red aguas lluvias"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Diseño de red aguas lluvias</h3>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner">
          <table className="tbl" style={{fontSize: 10}}>
            <thead>
              <tr>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Tramo</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Nivel</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Inicio</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Fin</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Bajantes<br/>asociadas</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Caudal<br/><small>(LPS)</small></th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Manning</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Pendiente<br/><small>(%)</small></th>
                <th scope="col" className="col-h ok" colSpan={3} style={{textAlign:'center',fontSize:9,padding:'1px 2px'}}>Diámetro</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Qo<br/><small>(LPS)</small></th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Vo<br/><small>(m/s)</small></th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Q/Qo</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>V. real<br/><small>(m/s)</small></th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Chequeo velocidad</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Yc<br/><small>(mm)</small></th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Yn<br/><small>(mm)</small></th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Froude</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Flujo</th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Ymax<br/><small>(mm)</small></th>
                <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>Yn vs Yc</th>
                <th scope="col" className="col-h ven" colSpan={2} style={{textAlign:'center',fontSize:9,padding:'1px 2px'}}>Fuerza Tractiva</th>
              </tr>
              <tr>
                <th scope="col" className="col-h ok" style={TH_HDR}>Calculado<br/><small>(")</small></th>
                <th scope="col" className="col-h ok" style={TH_HDR}>Diseño<br/><small>(")</small></th>
                <th scope="col" className="col-h ok" style={TH_HDR}>Interior<br/><small>(mm)</small></th>
                <th scope="col" className="col-h ven" style={TH_HDR}>Real<br/><small>(kg/m²)</small></th>
                <th scope="col" className="col-h ven" style={TH_HDR}>&gt;0.15</th>
              </tr>
            </thead>
            <tbody>
              {displayTramos.length === 0 ? (
                <tr>
                  <td colSpan={24} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 10 }}>
                    No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                  </td>
                </tr>
              ) : displayTramos.toSorted((a,b)=>(a.piso||0)-(b.piso||0)).map(t=>{
const n=t.nmaning??0;
const sVal=t.sPercent??0;
const S=sVal!=null&&sVal>0?sVal/100:null;
const Q = qMap[t._key ?? ''] || 0;
              const dSel=DIAM_OPTIONS.find(d=>d.pulg===(t.diamDisPulg||0))||null;
      let DcalcPulg = 0;
      const DdisPulg = dSel ? dSel.pulg : 0;
      const DintMm = dSel ? dSel.mm : 0;
      let Qo=0,Vo=0,qqo=0;
      let Vreal=0,chequeoV='—';
      let Yc=0,Yn=0,Froude=0,tipoFlujo='—',Ymax=0,chequeoYn='—';
      let fuerzaTractiva=0,chequeoFT='—';
if(Q>0&&S!=null&&S>0&&n!=null&&n>0){
DcalcPulg=Math.round(diametroManning(Q/1000,n,S)*1000/25.4*100)/100;
}
if(Q>0&&S!=null&&S>0&&n!=null&&n>0&&DintMm>0){
const hc = calcHydraulicCheck({ Q, S, n, DintMm });
 Qo = hc.Qo; Vo = hc.Vo; qqo = hc.qqo;
  Vreal = hc.Vreal; chequeoV = hc.chequeoV;
  Yc = hc.Yc; Yn = hc.Yn; Froude = hc.Froude; tipoFlujo = hc.tipoFlujo;
  Ymax = hc.Ymax; chequeoYn = hc.chequeoYn; fuerzaTractiva = hc.fuerzaTractiva; chequeoFT = hc.chequeoFT;
}
              return(
                <tr key={t._key}>
                  <td className="c" style={{padding:'1px 2px'}}><span className="sigla" style={{fontSize: 10}}>{t.id || t._key}</span></td>
                  <td className="c" style={{padding:'1px 2px'}}><span style={{fontSize: 10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.piso ? pisoCorto(t.piso) : '—'}</span></td>
                  <td className="c" style={{padding:'1px 2px'}}><span style={{fontSize: 10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.desde || '—'}</span></td>
                  <td className="c" style={{padding:'1px 2px'}}><span style={{fontSize: 10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.hasta || '—'}</span></td>
                  <td className="c" style={{padding:'1px 2px',minWidth:60,maxWidth:120}}>
                    {(() => {
                      const associatedBajantes = (conexionesDisplay as any)[t._key ?? ''] || [];
                      return associatedBajantes.length === 0 ? (
                        <span style={{fontSize: 10,color:'var(--txt3)'}}>—</span>
                      ) : (
                        <div style={{display:'flex',flexWrap:'wrap',gap:2,justifyContent:'center',alignItems:'center'}}>
                          {associatedBajantes.map((bajName: string) => (
                            <span key={bajName}
                              style={{fontSize: 10,padding:'1px 2px',border:'1px solid var(--ll)',borderRadius:3,color:'var(--ll)',fontFamily:'var(--mono)',lineHeight:1.3}}>
                              {bajName}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{Q>0?Q.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{sVal > 0 ? sVal : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
                  <td className="c" style={{padding:'1px 1px'}}>
          <select
            aria-label="Seleccionar diámetro"
            value={DdisPulg||''}
            onChange={e=>handleDiamChange(t._key ?? '',t.id,parseFloat(e.target.value)||0)}
            style={RainwaterDesign_S2}
          >
            <option value="">—</option>
            {DIAM_OPTIONS.map(o=><option key={o.pulg} value={o.pulg}>{o.label}</option>)}
          </select>
        </td>
                  <td className="c" style={{fontSize: 10,padding:'1px 2px'}}>{DintMm>0?DintMm:'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{Qo>0?Qo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{Vo>0?Vo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{qqo>0?qqo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{Vreal>0?Vreal.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize: 10,padding:'1px 2px'}}>{renderStatus(chequeoV)}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{Yc>0?Yc.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{Yn>0?Yn.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize: 10,padding:'1px 2px'}}>{Froude>0?Froude.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize: 10,padding:'1px 2px'}}>{tipoFlujo}</td>
                  <td className="c" style={{fontSize: 10,padding:'1px 2px'}}>{Ymax>0?Ymax.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize: 10,padding:'1px 2px'}}>{renderStatus(chequeoYn)}</td>
                  <td className="c" style={{fontSize: 10,padding:'1px 2px'}}>{fuerzaTractiva>0?fuerzaTractiva.toFixed(2):'—'}</td>
        <td className="c" style={{fontSize: 10,padding:'1px 2px'}}>{renderStatus(chequeoFT)}</td>
      </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
    </section>
  </>);
}
