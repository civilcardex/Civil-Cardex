
import React, { useState, useMemo, useEffect } from "react";
import { LE_K, pisoCorto, GAS_DN_LABELS } from "../constants";
import { GAS, CAT_GAS } from "../constants/engineeringDataGas";
import { normalizeDnLabel } from "../utils/formatUtils";
import { CONTADORES as CONTADORES_CAT } from "../pages/catalog/catalogData";
import { usePlans } from "../context/PlansContext";
import { writeDiametroToDrawing, writeContadorDiamToDrawing, writeBajantePropToDrawing } from "../utils/writeDiameterToDrawing";
import { loadFromStorage } from "../services/storageService";
import GasCalcUC from "./GasCalcUC";
import PageNav from './PageNav';

import { TRAZOS_PREFIX, GAS_ACC_KEY, APARATOS_BY_TRAMO_KEY } from "../constants/storage-keys";
import { renouardByType } from "../utils/gasUtils";
import { SI, SD, TH as _TH, TD as _TD } from "../styles/sharedTableStyles";
const TH = { ..._TH, fontSize: 9, padding: '2px 3px' };
const TD = { ..._TD, fontSize: 9, padding: '1px 2px' };

const ALL_DN: {mat: string; K: number; dn: string; d: number}[] = [];
const SR_ONLY = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 } as const;
const EMPTY_ROW = { padding:'24px 0', textAlign:'center', color:'var(--txt3)', fontSize: 9, border:'none' } as const;
GAS.forEach(g=>{g.rows.forEach(r=>{ALL_DN.push({mat:g.mat,K:g.K,dn:r.dn,d:r.d});});});
const ACC_KEYS=['codos_90_std','codos_90_rl','te_linea','te_ramal','valvula_bola'];
const GasDesign_COLS=['Tramo','Nivel','Inicio','Fin','Material y Diámetro','Ø interno (mm)','Coeficiente K','Longitud (m)'];
const GasDesign_colW=['8%','5%','8%','8%','18%','10%','8%','12%'];

function lookupDn(mat: string, dn: string){
  const normDn = normalizeDnLabel(dn);
  const match=ALL_DN.find(x=>x.mat===mat&&(x.dn===dn||x.dn===normDn));
  return match||null;
}

function GasDesign(){
  const [gp,setGp]=useState(1);
  const [alt,setAlt]=useState('959');
  const [patm,setPatm]=useState('90.32');
  const [temp,setTemp]=useState('23');
  const [pmin,setPmin]=useState('17');
  const [densRel,setDensRel]=useState('0.67');
  const { plans } = usePlans();

  const [gasRefreshKey] = useState(0);
  const [diamMat, setDiamMat] = useState<Record<string, string>>(() => ({}));
  const [diamDn, setDiamDn] = useState<Record<string, string>>(() => ({}));
  const [diamInt, setDiamInt] = useState<Record<string, number>>(() => ({}));
  const [diamK, setDiamK] = useState<Record<string, number>>(() => ({}));

  const [gasAcc, setGasAcc] = useState<Record<string, any>>(() => {
    return loadFromStorage(GAS_ACC_KEY, {});
  });

  useEffect(() => {
    const existingIds = new Set<string>();
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      try {
        const data = loadFromStorage(TRAZOS_PREFIX + plano.id, null);
        if (!data) continue;
        for (const r of (data as any).ramales || []) {
          if (r.net === 'gas' && r.tipo !== 'tributario') existingIds.add(r.id);
        }
      } catch {
        // ignore
      }
    }
    // Pruning gasAcc against localStorage-derived plan data (an external source React can't
    // observe reactively) — this is the legitimate "synchronize with an external system" use
    // of an effect, not state derived from props/state already available during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const raw = loadFromStorage(TRAZOS_PREFIX + plano.id, null);
      if (!raw) continue;
      const data = raw as Record<string, any>;
      for (const r of data.ramales || []) {
        if (r.net !== 'gas') continue;
        if (r.tipo === 'tributario') continue;


        tramos.push({
          id: r.id,
          planId: plano.id,
          piso: r.piso ?? plano.nivel,
          ini: r.ini || '',
          fin: r.fin || '',
          longitud: r.totalL || r.Lh || 0,
        });
      }
    }
    return tramos.sort((a, b) => (b.piso || 0) - (a.piso || 0));
  }, [plans]);

  const gasContBajantes = useMemo(() => {
    const items: any[] = [];
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed') continue;
      const data = loadFromStorage(TRAZOS_PREFIX + plano.id, null);
      if (!data) continue;
      for (const b of (data as any).bajantes || []) {
        if (b.net !== 'gas') continue;
        if (b.tipo === 'contador' || b.tipo === 'calentador') {
          items.push({ ...b, planId: plano.id });
        }
      }
    }
    return items;
  }, [plans]);

  useEffect(() => {
    const toSetMat: Record<string, string> = {};
    const toSetDn: Record<string, string> = {};
    const toSetInt: Record<string, number> = {};
    const toSetK: Record<string, number> = {};
    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed' || plano.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plano.id, null);
      if (!raw) continue;
      const data = raw as Record<string, any>;
      for (const r of data.ramales || []) {
        if (r.net !== 'gas') continue;
        if (r.tipo === 'tributario') continue;
        const mat = r.material || '';
        const dn = r.diametro || '';
        const opt = lookupDn(mat, dn);
        if (opt) {
          toSetMat[r.id] = mat;
          toSetDn[r.id] = opt.dn;
          toSetInt[r.id] = opt.d;
          toSetK[r.id] = opt.K;
        }
      }
    }
    // Same external-sync rationale as gasAcc above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDiamMat(prev => { let n = prev; for (const [id, v] of Object.entries(toSetMat)) if (!(id in prev)) n = { ...n, [id]: v }; return n; });
    setDiamDn(prev => { let n = prev; for (const [id, v] of Object.entries(toSetDn)) if (!(id in prev)) n = { ...n, [id]: v }; return n; });
    setDiamInt(prev => { let n = prev; for (const [id, v] of Object.entries(toSetInt)) if (!(id in prev)) n = { ...n, [id]: v }; return n; });
    setDiamK(prev => { let n = prev; for (const [id, v] of Object.entries(toSetK)) if (!(id in prev)) n = { ...n, [id]: v }; return n; });
  }, [plans, gasRefreshKey]);

  const handleDiamChange = (tramoId: string, mat: string, dn: string) => {
    const opt = lookupDn(mat, dn);
    setDiamMat(prev => ({ ...prev, [tramoId]: mat }));
    setDiamDn(prev => ({ ...prev, [tramoId]: dn }));
    setDiamInt(prev => ({ ...prev, [tramoId]: opt ? opt.d : 0 }));
    setDiamK(prev => ({ ...prev, [tramoId]: opt ? opt.K : 0 }));
    if (opt) writeDiametroToDrawing(tramoId, 'gas', dn, plans);
  };

  const getAcc = (tramoId: string) => (gasAcc[tramoId] || {}) as Record<string, number>;

  const checkRows = useMemo(() => {
    const pMin = Number(pmin) || 17;
    const pAtm = Number(patm) || 101.325;
    const T = Number(temp) || 23;
    const DR = Number(densRel) || 0.67;
    const fAlt = 101.325 / pAtm;
    const fTemp = Math.sqrt(288 / (273 + T));
    const fDens = Math.sqrt(0.67 / DR);
  const aparatos: Record<string, any> = loadFromStorage(APARATOS_BY_TRAMO_KEY, {});
    const result = [];
    let pAcum = pMin;
    for (const t of gasTramos) {
      const dInt = diamInt[t.id] || 0;

      const acc: Record<string, number> = gasAcc[t.id] || {};
      let sumLe = 0;
      for (const k of ACC_KEYS) sumLe += (acc[k] || 0) * ((LE_K as Record<string, number>)[k] || 0);
      const le = dInt > 0 ? dInt * sumLe / 1000 : 0;
      const appPid = t.planId ? `_${String(t.planId)}` : '';
      const appCounts: Record<string, number> = aparatos[`gas_${t.id}${appPid}`] || aparatos[`gas_${t.id}`] || {};
      const qRenouard = renouardByType(appCounts);
      const qDiseno = Math.max(qRenouard * fAlt * fTemp * fDens, 2.7);
      const dP = dInt > 0 ? 23200 * (le + (t.longitud || 0)) * Math.pow(qDiseno, 1.82) / Math.pow(dInt, 4.82) * Math.pow(DR, 0.82) : 0;
      const vel = dInt > 0 ? 354 * qDiseno * 101.325 / (dInt * dInt) / pAtm : 0;
      const pIni = pAcum;
      const pFin = pAcum - dP;
      pAcum = pFin;
      const ok = (vel > 0 && vel <= 10 && dP > 0) ? 'O.K.' : (dP > 0 ? 'NO' : '—');
      result.push({ id: t.id, le, dP, vel, pIni, pFin, chequeo: ok });
    }
    return result;
  }, [gasTramos, diamInt, gasAcc, pmin, temp, densRel, patm]);

  const COLS=GasDesign_COLS;
  const colW=GasDesign_colW;

  const page1 = (<>
    <section className="card" style={{flexShrink:0,alignSelf:'center'}}>
      <div className="card-h" style={{padding:'6px 12px'}}>
        <h3 className="card-t">
          <img src="/iconos_civilflow/diseno_redes/gas/datos_generales_red_gas.webp" alt="Datos generales red de gas"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" />
          Datos generales
        </h3>
      </div>
      <div style={{padding:'8px 12px',display:'flex',flexDirection:'column',alignItems:'center'}}>
<table className="tbl" style={{fontSize: 10,whiteSpace:'nowrap'}}>
           <caption style={SR_ONLY}>Datos generales</caption>
           <tbody>
             {[
               ['Altitud de la ciudad del proyecto',alt,setAlt,'msnm'],
               ['Presión atmosférica de la ciudad de diseño',patm,setPatm,'kPa'],
               ['Temperatura promedio de la ciudad',temp,setTemp,'°C'],
               ['Presión mínima de la red según operador',pmin,setPmin,'mbar'],
               ['Densidad relativa del gas a utilizar',densRel,setDensRel,'kPa'],
             ].map((row, i, arr)=>{const [lbl,val,setVal,uni] = row as [string, string, any, string];return (
               <tr key={i}>
                 <td style={{padding:'6px 10px',fontWeight:600,color:'var(--txt)',fontSize: 10,borderBottom:i<arr.length-1?'1px solid var(--line)':'none',borderRight:'1px solid var(--line)'}}>{lbl}</td>
                 <td style={{padding:'6px 10px',borderBottom:i<arr.length-1?'1px solid var(--line)':'none',borderRight:'1px solid var(--line)'}}><input type="text" inputMode="decimal" aria-label={lbl} value={val} onChange={e=>setVal(e.target.value)} style={{...SI,textAlign:'right',fontSize: 10,padding:'5px 8px',width:100}}/></td>
                 <td style={{padding:'6px 10px',color:'var(--txt2)',fontSize: 10,fontWeight:500,borderBottom:i<arr.length-1?'1px solid var(--line)':'none'}}>{uni}</td>
               </tr>
             );})}
           </tbody>
             </table>
        </div>
      </section>
  </>);
  
  const page2=<GasCalcUC patm={patm} temp={temp} densRel={densRel} />;

  const page3 = (<>
    <div style={{display:'flex',flexDirection:'column',gap:6,flex:1,minHeight:0}}>
      <section className="card" style={{display:'flex',flexDirection:'column'}}>
        <div className="card-h" style={{justifyContent:'space-between'}}>
          <h3 className="card-t">
            <img src="/iconos_civilflow/diseno_redes/gas/diseno_red_gas.webp" alt="Diseño red de gas"  width={20} height={20} style={{width:20,height:20,verticalAlign:'middle',marginRight:4}}  loading="lazy" />
            Diseño de red de gas
          </h3>
          <span className="card-s">{gasTramos.length} tramos</span>
        </div>
        <div style={{padding:6}}>
            <table className="tbl" style={{fontSize: 9,tableLayout:'auto',width:'100%',borderCollapse:'collapse'}}>
              <caption style={SR_ONLY}>Diseño de red</caption>
              <colgroup>
                {colW.map((w,i)=><col key={i} style={{width:w}}/>)}
              </colgroup>
              <thead><tr>
                {COLS.map((c,i)=><th scope="col" key={i} style={TH}>{c}</th>)}
              </tr></thead>
              <tbody>
                {gasTramos.length===0&&(
                  <tr><td colSpan={COLS.length} style={EMPTY_ROW}>No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.</td></tr>
                )}
                {gasTramos.map(t=>{
                  const mat=diamMat[t.id]||'';
                  const dn=diamDn[t.id]||'';
                  const dInt=diamInt[t.id]||0;
                  const kVal=diamK[t.id]||0;
                  return(
                    <tr key={t.id}>
                      <td className="c" style={{padding:'0 1px'}}><span className="sigla" style={{fontSize: 9,padding:'1px 4px'}}>{t.id}</span></td>
                      <td className="c" style={{padding:'0 1px',color:'var(--txt2)',fontSize: 9}}>{pisoCorto(t.piso)}</td>
                      <td className="c" style={{...TD,padding:'1px 2px'}}>{t.ini||'—'}</td>
                      <td className="c" style={{...TD,padding:'1px 2px'}}>{t.fin||'—'}</td>
                      <td className="c" style={{padding:'0 1px'}}>
                        <select aria-label="Diámetro diseño" value={mat?`${mat}|${dn}`:''} onChange={e=>{
                          const val=e.target.value;
                          if(!val){handleDiamChange(t.id,'','');return;}
                          const sep=val.lastIndexOf('|');
                          handleDiamChange(t.id,val.substring(0,sep),val.substring(sep+1));
                        }} style={{...SD,width:'100%',fontSize: 9}}>
                          <option value="">—</option>
                          {ALL_DN.sort((a,b)=>a.mat.localeCompare(b.mat)||a.dn.localeCompare(b.dn)).map(r=><option key={`${r.mat}|${r.dn}`} value={`${r.mat}|${r.dn}`}>{r.mat} D= {r.dn}</option>)}
                        </select>
                      </td>
                      <td className="c" style={{...TD,padding:'1px 2px',color:dInt?'var(--txt)':'var(--txt3)'}}>{dInt?dInt.toFixed(2):'—'}</td>
                      <td className="c" style={{...TD,padding:'1px 2px',color:kVal?'var(--txt)':'var(--txt3)'}}>{kVal||'—'}</td>
                      <td className="c" style={{...TD,padding:'1px 2px'}}>{t.longitud>0?t.longitud.toFixed(2):'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
      </section>
      {gasContBajantes.length > 0 && (
        <section className="card" style={{flexShrink:0}}>
          <div className="card-h" style={{justifyContent:'space-between'}}>
            <h3 className="card-t">
              <img src="/iconos_civilflow/diseno_redes/hidraulica/red_agua_fria.webp" alt="Contador / Calentador"  width={20} height={20} style={{width:20,height:20,verticalAlign:'middle',marginRight:4}}  loading="lazy" />
              Contador / Calentador
            </h3>
            <span className="card-s">{gasContBajantes.length} equipos</span>
          </div>
          <div style={{padding:6}}>
            <table className="tbl" style={{fontSize: 9}}>
              <thead><tr>
                <th scope="col" style={TH}>ID</th>
                <th scope="col" style={TH}>Tipo</th>
                <th scope="col" style={TH}>Diámetro</th>
                <th scope="col" style={TH}>Conexión</th>
                <th scope="col" style={TH}>Capacidad</th>
              </tr></thead>
              <tbody>
                {gasContBajantes.map(b => (
                  <tr key={b.id}>
                    <td className="c" style={TD}>{b.code || b.id}</td>
                    <td className="c" style={TD}>{b.tipo === 'contador' ? 'Contador' : 'Calentador'}</td>
                    <td className="c" style={{padding:'1px 2px'}}>
                      {b.tipo === 'contador' ? (
                        <select value={b.dNominal ? b.dNominal.replace(/"/g,'').trim() : ''} aria-label="Diámetro" onChange={e=>{
                          const dNom = e.target.value ? `${e.target.value}"` : '';
                          writeContadorDiamToDrawing(dNom, plans, 'gas');
                        }} style={{...SD,fontSize: 9}}>
                          <option value="">—</option>
                          {CONTADORES_CAT.map((c: any) => <option key={c.dn} value={c.dn}>{c.dn}"</option>)}
                        </select>
                      ) : '—'}
                    </td>
                    <td className="c" style={{padding:'1px 2px'}}>
                      <select value={b.acoDiam || ''} aria-label="Conexión" onChange={e=>{
                        const val = e.target.value;
                        const bajKey = `${b.id}-${b.planId}`;
                        writeBajantePropToDrawing(bajKey, 'gas', 'acoDiam', val, plans);
                      }} style={{...SD,fontSize: 9}}>
                        <option value="">—</option>
                        {GAS_DN_LABELS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td className="c" style={{padding:'1px 2px'}}>
                      {b.tipo === 'calentador' ? (
                        <select value={b.capacidad || ''} aria-label="Capacidad" onChange={e=>{
                          const val = e.target.value;
                          const bajKey = `${b.id}-${b.planId}`;
                          writeBajantePropToDrawing(bajKey, 'gas', 'capacidad', val, plans);
                        }} style={{...SD,fontSize: 9}}>
                          <option value="">—</option>
                          {CAT_GAS.filter(g => g.id.startsWith('cal')).map(g => <option key={g.id} value={g.id}>{g.n}</option>)}
                        </select>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card" style={{display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden',...(gasTramos.length===0?{}:{flex:1})}}>
        <div className="card-h" style={{justifyContent:'space-between'}}>
          <h3 className="card-t">
            <img src="/iconos_civilflow/diseno_redes/gas/chequeo_red_gas.webp" alt="Chequeo red de gas"  width={20} height={20} style={{width:20,height:20,verticalAlign:'middle',marginRight:4}}  loading="lazy" />
            Chequeo red de gas
          </h3>
          <span className="card-s">{gasTramos.length} tramos</span>
        </div>
        <div style={{padding:6,overflow:'auto'}}>
            <table className="tbl" style={{fontSize: 9,tableLayout:'auto',width:'100%',borderCollapse:'collapse'}}>
              <caption style={SR_ONLY}>Chequeo red de gas</caption>
              <thead>
                <tr>
                  <th scope="col" style={{...TH}} rowSpan={2}>Tramo</th>
                  <th scope="col" style={{...TH}} rowSpan={2}>Longitud (m)</th>
                  <th scope="col" style={{...TH}} rowSpan={2}>Diámetro<br/>interno (mm)</th>
                  <th scope="col" style={{...TH,borderBottom:'2px solid var(--line)'}} colSpan={5}>Accesorios</th>
                  <th scope="col" style={{...TH,borderLeft:'2px solid var(--line)'}} rowSpan={2}>Longitud equivalente (m)</th>
                  <th scope="col" style={TH} rowSpan={2}>{'Δ'}P (mbar)</th>
                  <th scope="col" style={{...TH}} rowSpan={2}>Velocidad (m/s)</th>
                  <th scope="col" style={{...TH,borderBottom:'2px solid var(--line)'}} colSpan={2}>Presión (mbar)</th>
                  <th scope="col" style={{...TH}} rowSpan={2}>V {'≤'} 10 m/s</th>
                </tr>
                <tr>
                  <th scope="col" style={{...TH,fontSize: 9}}>Codos 90{'°'} std</th>
                  <th scope="col" style={{...TH,fontSize: 9}}>Codos 90{'°'} rl</th>
                  <th scope="col" style={{...TH,fontSize: 9}}>Te en l&iacute;nea (flujo recto)</th>
                  <th scope="col" style={{...TH,fontSize: 9}}>Te ramal (flujo desviado)</th>
                  <th scope="col" style={{...TH,fontSize: 9}}>Válvula de bola (1/4 de vuelta)</th>
                  <th scope="col" style={{...TH,fontSize: 9}}>Inicio</th>
                  <th scope="col" style={{...TH,fontSize: 9}}>Fin</th>
                </tr>
              </thead>
              <tbody>
                {gasTramos.length===0&&(
                  <tr><td colSpan={14} style={EMPTY_ROW}>No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.</td></tr>
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
                      <td className="c" style={{padding:'0 1px'}}><span className="sigla" style={{fontSize: 9,padding:'1px 1px'}}>{t.id}</span></td>
                      <td className="c" style={{...TD,padding:'1px 1px',fontSize: 9}}>{t.longitud>0?t.longitud.toFixed(2):'—'}</td>
                      <td className="c" style={{...TD,padding:'1px 1px',fontSize: 9,color:dInt?'var(--txt)':'var(--txt3)'}}>{dInt?dInt.toFixed(2):'—'}</td>
                      {ACC_KEYS.map(k=>(
                        <td key={k} className="c" style={{padding:'1px 1px',textAlign:'center',verticalAlign:'middle'}}>
                          <span style={{fontSize: 9,fontWeight:600,fontFamily:'var(--mono)',color:(acc[k]||0)>0?'var(--txt)':'var(--txt3)'}}>{acc[k]||0}</span>
                        </td>
                      ))}
                      <td className="c" style={{...TD,padding:'1px 1px',fontSize: 9,fontWeight:600,borderLeft:'2px solid var(--line)'}}>{le.toFixed(2)}</td>
                      <td className="c" style={{...TD,padding:'1px 1px',fontSize: 9,fontWeight:600,color:dP>0?'var(--txt)':'var(--txt3)'}}>{dP.toFixed(2)}</td>
                      <td className="c" style={{...TD,padding:'1px 1px',fontSize: 9,color:vel>0?'var(--txt)':'var(--txt3)'}}>{vel.toFixed(2)}</td>
                      <td className="c" style={{...TD,padding:'1px 1px',fontSize: 9}}>{pIni.toFixed(2)}</td>
                      <td className="c" style={{...TD,padding:'1px 1px',fontSize: 9}}>{pFin.toFixed(2)}</td>
                      <td className="c" style={{padding:'1px 1px'}}>
                        <span style={{fontSize: 9,fontWeight:700,fontFamily:'var(--mono)',color:ok==='O.K.'?'#22c55e':ok==='NO'?'#ef5350':'var(--txt3)'}}>{ok}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
      </section>
    </div>
  </>);
  
  return(
    <div className="fu" style={{display:'flex',flexDirection:'column',gap:6,flex:1,minHeight:0}}>
      <PageNav page={gp} setPage={setGp} total={3} color="var(--gas)"
        labels={['Datos generales','Cálculo de unidades de consumo','Diseño de red + Chequeo']} />
      <div style={{padding:6,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {gp===1?page1:gp===2?page2:page3}
      </div>
    </div>
  );
}
export default React.memo(GasDesign);