import { useState, useMemo, useEffect } from "react";
import { GAS, APARATOS_DEF, pisoCorto } from "../constants";
import { usePlans } from "../context/PlansContext";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiameterToDrawing";
import { safeParse } from "../utils/parseUtils";
import GasCalcUC from "./GasCalcUC";
import PageNav from './PageNav';

import { TRAZOS_PREFIX, GAS_ACC_KEY, APARATOS_BY_TRAMO_KEY } from "../constants/storage-keys";

const GAS_APPARATUS = APARATOS_DEF.filter(a => a.grupo === 'g' && (a.qgas || 0) > 0);

const SI: React.CSSProperties = {border:'1px solid var(--line)',borderRadius:3,background:'var(--bg4)',fontFamily:'var(--mono)',fontSize:11,color:'var(--txt)',width:'100%',boxSizing:'border-box',textAlign:'center',outline:'none',padding:'3px 5px'};
const SD: React.CSSProperties = {...SI,textAlign:'left',fontFamily:'var(--body)',cursor:'pointer'};
const TH: React.CSSProperties = {fontSize:10,fontWeight:600,color:'var(--txt3)',fontFamily:'var(--mono)',textAlign:'center',padding:'5px 6px',borderBottom:'1px solid var(--line)',borderRight:'1px solid var(--line)',whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.4px',background:'var(--bg3)',verticalAlign:'middle'};
const TD: React.CSSProperties = {fontSize:11,fontFamily:'var(--mono)',padding:'4px 6px',borderBottom:'1px solid var(--line)',borderRight:'1px solid var(--line)',color:'var(--txt2)',textAlign:'center',verticalAlign:'middle'};

const ALL_DN: {mat: string; K: number; dn: string; d: number}[] = [];
GAS.forEach(g=>{g.rows.forEach(r=>{ALL_DN.push({mat:g.mat,K:g.K,dn:r.dn,d:r.d});});});

const ACC_KEYS=['codos_90_std','codos_90_rl','te_linea','te_ramal','valvula_bola'];
const LE_K={codos_90_std:30,codos_90_rl:20,te_linea:20,te_ramal:20,valvula_bola:8};

function lookupDn(mat: string, dn: string){
  const match=ALL_DN.find(x=>x.mat===mat&&x.dn===dn);
  return match||null;
}

function renouardByType(counts: Record<string, number>) {
  const products = [];
  for (const ap of GAS_APPARATUS) {
    const n = counts[ap.id] || 0;
    if (n > 0) products.push({ q: ap.qgas, n, product: ap.qgas * n });
  }
  const sorted = products.sort((a, b) => b.product - a.product);
  const nTypes = sorted.length;
  if (nTypes === 0) return 0;
  if (nTypes === 1) return sorted[0].product / 2;
  if (nTypes === 2) return (sorted[0].product + sorted[1].product) / 2;
  return (sorted[0].product + sorted[1].product) / 2 + sorted.slice(2).reduce((s, p) => s + p.product, 0);
}

function computeQDiseno(plans: any[]) {
  const aparatos: Record<string, any> = safeParse(localStorage.getItem(APARATOS_BY_TRAMO_KEY), {}) || {};
  const totalByAp: Record<string, number> = {};
  for (const ap of GAS_APPARATUS) totalByAp[ap.id] = 0;

  for (const plano of plans) {
    if (!plano || plano.status !== 'confirmed' || plano.nivel == null) continue;
    const raw = safeParse(localStorage.getItem(TRAZOS_PREFIX + plano.id), null);
    if (!raw) continue;
    const data = (typeof raw === 'string' ? safeParse(raw, {}) : raw) as Record<string, any>;
    for (const r of data.ramales || []) {
      if (r.net !== 'gas') continue;
      const counts = aparatos[`gas_${r.id}`] || {};
      for (const ap of GAS_APPARATUS) {
        const n = Number(counts[ap.id]) || 0;
        if (n > 0) totalByAp[ap.id] = (totalByAp[ap.id] || 0) + n;
      }
    }
  }

  return renouardByType(totalByAp);
}

export default function GasDesign(){
  const [gp,setGp]=useState(1);
  const [alt,setAlt]=useState('959');
  const [patm,setPatm]=useState('90.32');
  const [temp,setTemp]=useState('23');
  const [pmin,setPmin]=useState('17');
  const [densRel,setDensRel]=useState('0.67');
  const { plans } = usePlans();

  const [gasRefreshKey, setGasRefreshKey] = useState(0);
  const [diamMat, setDiamMat] = useState<Record<string, string>>(() => ({}));
  const [diamDn, setDiamDn] = useState<Record<string, string>>(() => ({}));
  const [diamInt, setDiamInt] = useState<Record<string, number>>(() => ({}));
  const [diamK, setDiamK] = useState<Record<string, number>>(() => ({}));

  const [gasAcc, setGasAcc] = useState<Record<string, any>>(() => {
    try { return safeParse(localStorage.getItem(GAS_ACC_KEY), {}); } catch (_) { return {}; }
  });

  useEffect(() => {
    const existingIds = new Set<string>();
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      try {
        const raw = localStorage.getItem(TRAZOS_PREFIX + plano.id);
        if (!raw) continue;
        const data = JSON.parse(raw);
        for (const r of data.ramales || []) {
          if (r.net === 'gas') existingIds.add(r.id);
        }
      } catch (_) {}
    }
    setGasAcc(prev => {
      let changed = false;
    const next: Record<string, any> = {};
      for (const id of existingIds) {
        if (prev[id]) next[id] = prev[id];
      }
      if (Object.keys(next).length !== Object.keys(prev).length) changed = true;
      return changed ? next : prev;
    });
  }, [plans]);

  const gasTramos = useMemo(() => {
    const tramos = [];
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed' || plano.nivel == null) continue;
      const raw = safeParse(localStorage.getItem(TRAZOS_PREFIX + plano.id), null);
      if (!raw) continue;
    const data = (typeof raw === 'string' ? safeParse(raw, {}) : raw) as Record<string, any>;
      for (const r of data.ramales || []) {
        if (r.net !== 'gas') continue;
        const mat = r.material || '';
        const dn = r.diametro || '';
        const opt = lookupDn(mat, dn);
        tramos.push({
          id: r.id,
          piso: r.piso ?? plano.nivel,
          ini: r.ini || '',
          fin: r.fin || '',
          longitud: r.totalL || r.Lh || 0,
        });
        if (opt) {
          if (!diamMat[r.id]) setDiamMat(prev => ({ ...prev, [r.id]: mat }));
          if (!diamDn[r.id]) setDiamDn(prev => ({ ...prev, [r.id]: dn }));
          if (!diamInt[r.id]) setDiamInt(prev => ({ ...prev, [r.id]: opt.d }));
          if (!diamK[r.id]) setDiamK(prev => ({ ...prev, [r.id]: opt.K }));
        }
      }
    }
    return tramos.sort((a, b) => (b.piso || 0) - (a.piso || 0));
  }, [plans, gasRefreshKey]);

  const handleDiamChange = (tramoId: string, mat: string, dn: string) => {
    const opt = lookupDn(mat, dn);
    setDiamMat(prev => ({ ...prev, [tramoId]: mat }));
    setDiamDn(prev => ({ ...prev, [tramoId]: dn }));
    setDiamInt(prev => ({ ...prev, [tramoId]: opt ? opt.d : 0 }));
    setDiamK(prev => ({ ...prev, [tramoId]: opt ? opt.K : 0 }));
    if (opt) writeDiametroToDrawing(tramoId, 'gas', dn, plans);
  };

  const handleDelete = (tramoId: string) => {
    deleteRamalFromDrawing(tramoId, 'gas', plans);
    setGasRefreshKey(k => k + 1);
  };

  const getAcc = (tramoId: string) => (gasAcc[tramoId] || {}) as Record<string, number>;

  const checkRows = useMemo(() => {
    const pMin = Number(pmin) || 17;
    const DR = Number(densRel) || 0.67;
  const aparatos: Record<string, any> = safeParse(localStorage.getItem(APARATOS_BY_TRAMO_KEY), {}) || {};
    const result = [];
    let pAcum = pMin;
    for (const t of gasTramos) {
      const dInt = diamInt[t.id] || 0;
      const K = diamK[t.id] || 0;
      const acc: Record<string, number> = gasAcc[t.id] || {};
      let sumLe = 0;
      for (const k of ACC_KEYS) sumLe += (acc[k] || 0) * ((LE_K as Record<string, number>)[k] || 0);
      const le = dInt > 0 ? dInt * sumLe / 1000 : 0;
      const appCounts: Record<string, number> = aparatos[`gas_${t.id}`] || {};
      let q = 0;
      for (const ap of GAS_APPARATUS) q += (Number(appCounts[ap.id]) || 0) * (ap.qgas || 0);
      const dP = dInt > 0 ? 23200 * (le + (t.longitud || 0)) * Math.pow(q, 1.82) / Math.pow(dInt, 4.82) * Math.pow(DR, 0.82) : 0;
      const vel = dInt > 0 ? 354 * q * 101.325 / (dInt * dInt) / (Number(patm) || 101.325) : 0;
      const pIni = pAcum;
      const pFin = pAcum - dP;
      pAcum = pFin;
      const ok = (vel > 0 && vel <= 10 && dP > 0) ? 'O.K.' : (dP > 0 ? 'NO' : '—');
      result.push({ id: t.id, le, dP, vel, pIni, pFin, chequeo: ok });
    }
    return result;
  }, [gasTramos, diamInt, diamK, gasAcc, pmin, densRel, patm]);

  const COLS=['Tramo','Piso','Inicio','Fin','Diseño (pulg)','Interno mm','Coef. K','Longitud (m)'];
  const colW=['8%','5%','8%','8%','18%','10%','8%','12%'];

  const page1=<>
    <div className="card" style={{flexShrink:0,alignSelf:'start'}}>
      <div className="card-h" style={{padding:'6px 12px'}}>
        <span className="card-t">
          <img src="/iconos_diseno_redes/datos_generales_red_gas.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} />
          Datos generales
        </span>
      </div>
      <div style={{padding:'6px 10px',display:'flex',flexDirection:'column',alignItems:'start'}}>
        <table className="tbl" style={{fontSize:12,whiteSpace:'nowrap'}}>
          <tbody>
            {[
              ['Altitud de la ciudad del proyecto',alt,setAlt,'msnm'],
              ['Presión atmosférica de la ciudad de diseño',patm,setPatm,'kPa'],
              ['Temperatura promedio de la ciudad',temp,setTemp,'°C'],
              ['Presión mínima de la red según operador',pmin,setPmin,'mbar'],
              ['Densidad relativa del gas a utilizar',densRel,setDensRel,'kPa'],
            ].map((row, i, arr)=>{const [lbl,val,setVal,uni] = row as [string, string, any, string];return (
              <tr key={i}>
                <td style={{padding:'4px 8px',fontWeight:600,color:'var(--txt)',fontSize:12,borderBottom:i<arr.length-1?'1px solid var(--line)':'none',borderRight:'1px solid var(--line)'}}>{lbl}</td>
                <td style={{padding:'4px 8px',borderBottom:i<arr.length-1?'1px solid var(--line)':'none',borderRight:'1px solid var(--line)'}}><input type="text" inputMode="decimal" value={val} onChange={e=>setVal(e.target.value)} style={{...SI,textAlign:'right',fontSize:12,padding:'4px 8px',width:90}}/></td>
                <td style={{padding:'4px 8px',color:'var(--txt2)',fontSize:12,fontWeight:500,borderBottom:i<arr.length-1?'1px solid var(--line)':'none'}}>{uni}</td>
              </tr>
            );})}
          </tbody>
            </table>
        </div>
      </div>
  </>;

  const page2=<GasCalcUC patm={patm} temp={temp} densRel={densRel} />;

  const page3=<>
    <div style={{display:'flex',flexDirection:'column',gap:6,flex:1,minHeight:0}}>
      <div className="card" style={{display:'flex',flexDirection:'column'}}>
        <div className="card-h" style={{justifyContent:'space-between'}}>
          <span className="card-t">
            <img src="/iconos_diseno_redes/diseno_red_gas.webp" alt="" style={{width:20,height:20,verticalAlign:'middle',marginRight:4}} />
            Diseño de red
          </span>
          <span className="card-s">{gasTramos.length} tramos</span>
        </div>
        <div style={{padding:6}}>
            <table className="tbl" style={{fontSize:11,tableLayout:'auto',width:'100%',borderCollapse:'collapse'}}>
              <colgroup>
                {colW.map((w,i)=><col key={i} style={{width:w}}/>)}
                <col style={{width:'4%'}}/>
              </colgroup>
              <thead><tr>
                {COLS.map((c,i)=><th key={i} style={TH}>{c}</th>)}
                <th style={TH}></th>
              </tr></thead>
              <tbody>
                {gasTramos.length===0&&(
                  <tr><td colSpan={COLS.length+1} style={{padding:'24px 0',textAlign:'center',color:'var(--txt3)',fontSize:11,border:'none'}}>No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.</td></tr>
                )}
                {gasTramos.map(t=>{
                  const mat=diamMat[t.id]||'';
                  const dn=diamDn[t.id]||'';
                  const dInt=diamInt[t.id]||0;
                  const kVal=diamK[t.id]||0;
                  return(
                    <tr key={t.id}>
                      <td className="c" style={{padding:'0 1px'}}><span className="sigla" style={{fontSize:11,padding:'1px 4px'}}>{t.id}</span></td>
                      <td className="c" style={{padding:'0 1px',color:'var(--txt2)',fontSize:11}}>{pisoCorto(t.piso)}</td>
                      <td className="c" style={{...TD,padding:'2px 3px'}}>{t.ini||'—'}</td>
                      <td className="c" style={{...TD,padding:'2px 3px'}}>{t.fin||'—'}</td>
                      <td className="c" style={{padding:'0 1px'}}>
                        <select value={mat?`${mat}|${dn}`:''} onChange={e=>{
                          const val=e.target.value;
                          if(!val){handleDiamChange(t.id,'','');return;}
                          const sep=val.lastIndexOf('|');
                          handleDiamChange(t.id,val.substring(0,sep),val.substring(sep+1));
                        }} style={{...SD,width:'100%',fontSize:11}}>
                          <option value="">—</option>
                          {GAS.map(g=><optgroup key={g.mat} label={`${g.mat} (K=${g.K})`}>
                            {g.rows.map(r=><option key={r.dn} value={`${g.mat}|${r.dn}`}>{r.dn}&quot; ({r.d} mm)</option>)}
                          </optgroup>)}
                        </select>
                      </td>
                      <td className="c" style={{...TD,padding:'2px 3px',color:dInt?'var(--txt)':'var(--txt3)'}}>{dInt?dInt.toFixed(2):'—'}</td>
                      <td className="c" style={{...TD,padding:'2px 3px',color:kVal?'var(--txt)':'var(--txt3)'}}>{kVal||'—'}</td>
                      <td className="c" style={{...TD,padding:'2px 3px'}}>{t.longitud>0?t.longitud.toFixed(2):'—'}</td>
                      <td className="c" style={{padding:'0 1px'}}>
                        <button onClick={()=>handleDelete(t.id)} title="Eliminar" style={{border:'none',background:'transparent',color:'var(--txt3)',cursor:'pointer',fontSize:11,padding:'2px 6px',lineHeight:1}}>&#x2715;</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
      </div>
      <div className="card" style={{display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden',...(gasTramos.length===0?{}:{flex:1})}}>
        <div className="card-h" style={{justifyContent:'space-between'}}>
          <span className="card-t">
            <img src="/iconos_diseno_redes/chequeo_red_gas.webp" alt="" style={{width:20,height:20,verticalAlign:'middle',marginRight:4}} />
            Chequeo red de gas
          </span>
          <span className="card-s">{gasTramos.length} tramos</span>
        </div>
        <div style={{padding:6,overflow:'auto'}}>
            <table className="tbl" style={{fontSize:10,tableLayout:'auto',width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  <th style={{...TH}} rowSpan={2}>Tramo</th>
                  <th style={{...TH}} rowSpan={2}>L (m)</th>
                  <th style={{...TH}} rowSpan={2}>d<sub>int</sub> (mm)</th>
                  <th style={{...TH,borderBottom:'2px solid var(--line)'}} colSpan={5}>Accesorios</th>
                  <th style={{...TH,borderLeft:'2px solid var(--line)'}} rowSpan={2}>Le (m)</th>
                  <th style={TH} rowSpan={2}>{'Δ'}P (mbar)</th>
                  <th style={{...TH}} rowSpan={2}>Vel (m/s)</th>
                  <th style={{...TH,borderBottom:'2px solid var(--line)'}} colSpan={2}>P tramo (mbar)</th>
                  <th style={{...TH}} rowSpan={2}>Vel {'≤'}10</th>
                </tr>
                <tr>
                  <th style={{...TH,fontSize:8}}>Codos 90{'°'} std</th>
                  <th style={{...TH,fontSize:8}}>Codos 90{'°'} rl</th>
                  <th style={{...TH,fontSize:8}}>Te en l&iacute;nea (flujo recto)</th>
                  <th style={{...TH,fontSize:8}}>Te ramal (flujo desviado)</th>
                  <th style={{...TH,fontSize:8}}>Válvula de bola (1/4 de vuelta)</th>
                  <th style={{...TH,fontSize:9}}>INI</th>
                  <th style={{...TH,fontSize:9}}>FIN</th>
                </tr>
              </thead>
              <tbody>
                {gasTramos.length===0&&(
                  <tr><td colSpan={14} style={{padding:'24px 0',textAlign:'center',color:'var(--txt3)',fontSize:11,border:'none'}}>No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.</td></tr>
                )}
                {gasTramos.map(t=>{
                  const dInt=diamInt[t.id]||0;
                  const chk=checkRows.find(r=>r.id===t.id);
                  const le=chk?chk.le:0;
                  const dP=chk?chk.dP:0;
                  const vel=chk?chk.vel:0;
                  const pIni=chk?chk.pIni:0;
                  const pFin=chk?chk.pFin:0;
                  const ok=chk?chk.chequeo:'—';
                  const acc=getAcc(t.id);
                  return(
                    <tr key={t.id}>
                      <td className="c" style={{padding:'0 1px'}}><span className="sigla" style={{fontSize:10,padding:'1px 3px'}}>{t.id}</span></td>
                      <td className="c" style={{...TD,padding:'3px 2px',fontSize:10}}>{t.longitud>0?t.longitud.toFixed(2):'—'}</td>
                      <td className="c" style={{...TD,padding:'3px 2px',fontSize:10,color:dInt?'var(--txt)':'var(--txt3)'}}>{dInt?dInt.toFixed(2):'—'}</td>
                      {ACC_KEYS.map(k=>(
                        <td key={k} className="c" style={{padding:'2px 1px',textAlign:'center',verticalAlign:'middle'}}>
                          <span style={{fontSize:10,fontWeight:600,fontFamily:'var(--mono)',color:(acc[k]||0)>0?'var(--txt)':'var(--txt3)'}}>{acc[k]||0}</span>
                        </td>
                      ))}
                      <td className="c" style={{...TD,padding:'3px 2px',fontSize:10,fontWeight:600,borderLeft:'2px solid var(--line)'}}>{le.toFixed(2)}</td>
                      <td className="c" style={{...TD,padding:'3px 2px',fontSize:10,fontWeight:600,color:dP>0?'var(--txt)':'var(--txt3)'}}>{dP.toFixed(2)}</td>
                      <td className="c" style={{...TD,padding:'3px 2px',fontSize:10,color:vel>0?'var(--txt)':'var(--txt3)'}}>{vel.toFixed(2)}</td>
                      <td className="c" style={{...TD,padding:'3px 2px',fontSize:10}}>{pIni.toFixed(2)}</td>
                      <td className="c" style={{...TD,padding:'3px 2px',fontSize:10}}>{pFin.toFixed(2)}</td>
                      <td className="c" style={{padding:'3px 2px'}}>
                        <span style={{fontSize:10,fontWeight:700,fontFamily:'var(--mono)',color:ok==='O.K.'?'#22c55e':ok==='NO'?'#ef5350':'var(--txt3)'}}>{ok}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  </>;

  return(
    <div className="fu" style={{display:'flex',flexDirection:'column',gap:6,flex:1,minHeight:0}}>
      <PageNav page={gp} setPage={setGp} total={3} color="var(--gas)"
        labels={['Datos generales','Cálculo UC','Diseño de red + Chequeo']} />
      <div style={{padding:6,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {gp===1?page1:gp===2?page2:page3}
      </div>
    </div>
  );
}
