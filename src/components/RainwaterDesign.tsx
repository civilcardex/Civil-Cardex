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
import { loadFromStorage, savePlanTrazos } from "../services/storageService";
import { writeSanDrawingSync } from "../utils/drawingSync";
import { useRainwater } from "../context/RainwaterContext";

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

const CaudalCell = React.memo(function CaudalCell({ tramoKey, value, onCaudalChange }: { tramoKey: string; value: number; onCaudalChange: (key: string, val: number) => void }) {
  const [text, setText] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);
  const display = editing ? text : (value > 0 ? value.toFixed(2) : '');
  return (
    <input ref={ref} type="text" inputMode="decimal" 
      value={display} 
      placeholder="0.00"
      aria-label="Caudal (LPS)"
      onFocus={() => { setEditing(true); setText(display); }}
      onChange={e => {
        const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        setText(raw);
      }}
      onBlur={() => {
        setEditing(false);
        const v = parseFloat(text) || 0;
        const finalVal = text === '' ? 0 : v;
        onCaudalChange(tramoKey, finalVal);
      }}
      style={{ width: '60px', padding: '2px 4px', background: 'transparent', border: '1px solid transparent', borderRadius: 2, color: 'var(--txt)', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600, textAlign: 'center' }}
    />
  );
});

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
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { continue; } }
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
      // Prioritize manual caudal override
      if (t.caudal != null && t.caudal > 0) {
        total = t.caudal;
      } else if (t.tipo === 'ramal' && !t.esBajante) {
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

  const handleCaudalChange = useCallback((tramoKey: string, newCaudal: number) => {
    updTramoLL(tramoKey, 'caudal', newCaudal);
    // Sync to drawing plan trace data (bidirectional)
    const [ramalId, planId] = tramoKey.split('-');
    if (planId) {
      const raw = loadFromStorage<any>(TRAZOS_PREFIX + planId, null);
      if (raw) {
        let data = raw;
        if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { return; } }
        const r = (data.ramales || []).find((x: any) => x.id === ramalId);
        if (r) {
          r.caudal = newCaudal;
          data.ts = Date.now();
          savePlanTrazos(planId, data);
          writeSanDrawingSync(plans);
        }
      }
    }
  }, [updTramoLL, plans]);



  const tribIds = getTributarioIds(tramosLl);
  const displayTramos = tramosLl.filter(t => t._key != null && !t.esBajante && !tribIds.has(t._key) && !tribIds.has(t.id));

  return (
  <>
    <section className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/aguas_lluvias/RALL_Diseno_red.svg" alt="Diseño red aguas lluvias"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Diseño de red aguas lluvias</h3>
      </div>
      <div className="scroll-top" style={{padding:'12px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
          <table className="tbl" style={{fontSize:11}}>
          <thead>
            <tr>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Tramo</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Nivel</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Inicio</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Fin</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Bajantes<br/>asociadas</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Caudal<br/><small>(LPS)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Manning<br/></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Pendiente<br/><small>(%)</small></th>
              <th scope="col" className="col-h ok" colSpan={3} style={{textAlign:'center',fontSize:9,padding:'2px 3px'}}>Diámetro</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>Qo<br/><small>(LPS)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>Vo<br/><small>(m/s)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>Q/Qo</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>Vr<br/><small>(m/s)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>CHEQUEO VELOCIDAD</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>Yc<br/><small>(mm)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>Yn<br/><small>(mm)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>FROUDE</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px'}}>Flujo</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>Ymax<br/><small>(mm)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 3px',textTransform:'none'}}>Yn vs Yc</th>
              <th scope="col" className="col-h ven" colSpan={2} style={{textAlign:'center',fontSize:9,padding:'2px 3px'}}>Fuerza Tractiva</th>
            </tr>
            <tr>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 3px'}}>Calculado<br/><small>(")</small></th>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 3px'}}>Diseño<br/><small>(")</small></th>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 3px'}}>Interior<br/><small>(mm)</small></th>
              <th scope="col" className="col-h ven" style={{fontSize:8,textAlign:'center',padding:'2px 3px'}}>Real<br/><small>(kg/m²)</small></th>
              <th scope="col" className="col-h ven" style={{fontSize:8,textAlign:'center',padding:'2px 3px'}}>&gt;0.15</th>
            </tr>
          </thead>
          <tbody>
            {displayTramos.length === 0 ? (
              <tr>
                <td colSpan={24} style={{ padding: "16px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
            ) : [...displayTramos].sort((a,b)=>(a.piso||0)-(b.piso||0)).map(t=>{
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
 if(DdisPulg>0){const ok=DcalcPulg<=DdisPulg?'O.K.':'NO CUMPLE'; void ok;}
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
                  <td className="c" style={{padding:'2px 4px'}}><span className="sigla" style={{fontSize:10}}>{t.id || t._key}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.piso ? pisoCorto(t.piso) : '—'}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.desde || '—'}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.hasta || '—'}</span></td>
                  <td className="c" style={{padding:'2px 4px',minWidth:60,maxWidth:120}}>
                    {(() => {
                      const associatedBajantes = (conexionesDisplay as any)[t._key ?? ''] || [];
                      return associatedBajantes.length === 0 ? (
                        <span style={{fontSize:9,color:'var(--txt3)'}}>—</span>
                      ) : (
                        <div style={{display:'flex',flexWrap:'wrap',gap:2,justifyContent:'center',alignItems:'center'}}>
                          {associatedBajantes.map((bajName: string) => (
                            <span key={bajName}
                              style={{fontSize:9,padding:'1px 3px',border:'1px solid var(--ll)',borderRadius:3,color:'var(--ll)',fontFamily:'var(--mono)',lineHeight:1.3}}>
                              {bajName}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="c" style={{padding:'2px 4px',minWidth:60}}>
                    <CaudalCell tramoKey={t._key ?? ''} value={Q} onCaudalChange={handleCaudalChange} />
                  </td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{sVal > 0 ? sVal : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:9,padding:'2px 4px'}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
                  <td className="c" style={{padding:'2px 2px'}}>
          <select
            aria-label="Seleccionar diámetro"
            value={DdisPulg||''}
            onChange={e=>handleDiamChange(t._key ?? '',t.id,parseFloat(e.target.value)||0)}
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
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{Vreal>0?Vreal.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{renderStatus(chequeoV)}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{Yc>0?Yc.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{Yn>0?Yn.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 4px'}}>{Froude>0?Froude.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:9,padding:'2px 4px'}}>{tipoFlujo}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{Ymax>0?Ymax.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{renderStatus(chequeoYn)}</td>
                  <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{fuerzaTractiva>0?fuerzaTractiva.toFixed(2):'—'}</td>
        <td className="c" style={{fontSize:10,padding:'2px 4px'}}>{renderStatus(chequeoFT)}</td>
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
