import { useState, useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { useApparatus } from "../context/ApparatusContext";
import { usePlanos } from "../context/PlansContext";
import { calcUDparcial } from "../utils/componentHelpers";
import { pisoCorto, DIAM_OPTIONS, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN, SAN_UC_IDS, APARATOS_DEF } from "../constants";
import { diametromaning, caudalHunterLPS, factorSimultaneidad } from "../utils/calcSanitary";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiameterToDrawing";
import { getTributarioIds } from "../utils/tramoUtils";
import { calcHydraulicCheck } from "../utils/hydraulicCheck";
import { useToggleMap } from "../hooks/useToggleMap";
import HydraulicCalcTable from "./HydraulicCalcTable";

export default function DisenosSanitarios() {
  const { tramosSan, updTramoSan, delTramoSan } = useTramos();
  const { aps } = useApparatus();
  const { planos } = usePlanos();

  const handleDiamChange = useCallback((tramoId, newPulg) => {
    updTramoSan(tramoId, 'diamDisPulg', newPulg);
    const opt = DIAM_OPTIONS.find(o => o.pulg === newPulg);
    if (opt) {
      writeDiametroToDrawing(tramoId, 'san', opt.label, planos);
    }
  }, [updTramoSan, planos]);

  const handleDelete = useCallback((tramoId) => {
    delTramoSan(tramoId);
    deleteRamalFromDrawing(tramoId, 'san', planos);
  }, [delTramoSan, planos]);

const mergedBase = useMemo(() => {
  const defMap = new Map(APARATOS_DEF.map(d => [d.id, d]));
  return SAN_UC_IDS.map(id => {
    const fromAps = aps.find(p => p.id === id);
    const def = defMap.get(id);
    return { id, nombre: def?.nombre || id, ud: fromAps?.ud ?? def?.ud ?? 0 };
  });
}, [aps]);

const [otrosSel, toggleOtro] = useToggleMap();

const udMap = useMemo(() => {
  const m = {};
  for (const t of tramosSan) m[t.id] = calcUDparcial(t, mergedBase);
  return m;
}, [tramosSan, mergedBase]);

const totales = useMemo(() => mergedBase.map(d => ({
  id: d.id, nombre: d.nombre, ud: d.ud,
  cant: tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0)
})), [mergedBase, tramosSan]);

const totalUD = useMemo(() =>
  totales.reduce((s, d) => s + (d.cant || 0) * (d.ud || 0), 0),
[totales]);

const tribIds = getTributarioIds(tramosSan);
const displayTramos = tramosSan.filter(t => !tribIds.has(t.id));

  return (
  <>
  <div className="card">
    <div className="card-h">
      <span className="card-t"><img src="/iconos_diseno_redes/RS_Diseno.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} /> Diseño Red sanitaria</span>
      <span className="card-s">{tramosSan.length} tramos · {totalUD} UD totales</span>
    </div>
    <div className="scroll-top" style={{padding:'16px'}}>
      <div className="scroll-inner">
        <table className="tbl" style={{fontSize:12}}>
          <thead>
            <tr>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Tramo<br/>o Ramal</th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Nivel</th>
              <th className="col-h san" colSpan={3} style={{textAlign:'center',fontSize:10,padding:'2px 4px'}}>UD DE DESCARGA</th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>#<br/>Desc.</th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>K</th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Q<br/><small>LPS</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Maning</th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>S %</th>
              <th className="col-h ok" colSpan={3} style={{textAlign:'center',fontSize:10,padding:'2px 4px'}}>Diámetro</th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Qo<br/><small>LPS</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Vo<br/><small>m/s</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Q/Qo</th>
               <th className="col-h" rowSpan={2} style={{display:'none',fontSize:10,textAlign:'center',padding:'2px 4px'}}>Vreal<br/><small>m/s</small></th>
              <th className="col-h" rowSpan={2} style={{display:'none',fontSize:10,textAlign:'center',padding:'2px 4px'}}>Chequeo<br/><small>0.45&lt;Vr&lt;4.0</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Yc<br/><small>mm</small></th>
              <th className="col-h" rowSpan={2} style={{display:'none',fontSize:10,textAlign:'center',padding:'2px 4px'}}>Yn<br/><small>mm</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Froude</th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Tipo de<br/>Flujo</th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Ymax<br/><small>0.75D mm</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}>Yn vs Yc</th>
              <th className="col-h ven" colSpan={2} style={{textAlign:'center',fontSize:10,padding:'2px 4px'}}>F. Tractiva</th>
            </tr>
            <tr>
              <th className="col-h san" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Propias</th>
              <th className="col-h san" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Otros<br/>Ramales</th>
              <th className="col-h san" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Total</th>
              <th className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Calc.<br/>pulg</th>
              <th className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Diseño<br/>pulg</th>
              <th className="col-h ok" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Int.<br/>mm</th>
              <th className="col-h ven" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Vr<br/><small>kg/m2</small></th>
              <th className="col-h ven" style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>&gt;0.15</th>
          <th className="col-h" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'2px 4px'}}></th>
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const tramosOrden = [...tramosSan].sort((a,b)=>(a.piso||0)-(b.piso||0));
              return [...displayTramos].sort((a,b)=>(a.piso||0)-(b.piso||0)).map(t=>{
                const udPropias=calcUDparcial(t,mergedBase);
                const selected = otrosSel.get(t.id) || new Set();
                let totalExtra=0;
                for (const oId of selected) totalExtra += udMap[oId] || 0;
                const udAcum=udPropias+totalExtra;
                const otherTramos = [...tramosSan].filter(o => o.id !== t.id);
        const nSalidas=t.nSalidas;
const K=nSalidas!=null&&nSalidas>0?Math.round(factorSimultaneidad(nSalidas)*100)/100:null;
const n=t.nmaning;
const sVal=t.sPercent;
const S=sVal!=null&&sVal>0?sVal/100:null;
const Q=udAcum>0&&K!=null?Math.round(caudalHunterLPS(udAcum,K)*1000)/1000:null;
                const dSel=DIAM_OPTIONS.find(d=>d.pulg===(t.diamDisPulg||0))||null;
        let DcalcPulg=0,DdisPulg=dSel?dSel.pulg:0,DintMm=dSel?dSel.mm:0,chequeo='—';
        let Qo=0,Vo=0,qqo=0,Vreal=0,chequeoV='—';
        let Yc=0,Yn=0,Froude=0,tipoFlujo='—',Ymax=0,chequeoYn='—';
        let fuerzaTractiva=0,chequeoFT='—';
if(Q!=null&&Q>0&&S!=null&&S>0&&n!=null&&n>0){
DcalcPulg=Math.round(diametromaning(Q/1000,n,S)*1000/25.4*100)/100;
if(DdisPulg>0){chequeo=DcalcPulg<=DdisPulg?'O.K.':'NO CUMPLE';}
}
if(Q!=null&&Q>0&&S!=null&&S>0&&n!=null&&n>0&&DintMm>0){
const hc = calcHydraulicCheck({ Q, S, n, DintMm, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN });
Qo = hc.Qo; Vo = hc.Vo; qqo = hc.qqo; Vreal = hc.Vreal; chequeoV = hc.chequeoV;
Yc = hc.Yc; Yn = hc.Yn; Froude = hc.Froude; tipoFlujo = hc.tipoFlujo;
Ymax = hc.Ymax; chequeoYn = hc.chequeoYn; fuerzaTractiva = hc.fuerzaTractiva; chequeoFT = hc.chequeoFT;
        }
        return(
        <tr key={t.id}>
          <td className="c" style={{padding:'3px 5px'}}><span className="sigla" style={{fontSize:10}}>{t.id}</span></td>
          <td className="c" style={{padding:'3px 5px'}}><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{pisoCorto(t.piso)}</span></td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{udPropias}</td>
          <td className="c" style={{padding:'3px 5px',minWidth:60,maxWidth:120}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:1,justifyContent:'center',alignItems:'center'}}>
              {otherTramos.length === 0 ? (
                <span style={{fontSize:9,color:'var(--txt3)'}}>—</span>
              ) : otherTramos.map(o => {
                const isSel = selected.has(o.id);
                return (
                  <button key={o.id}
                    onClick={() => toggleOtro(t.id, o.id)}
                    title={`${o.id} (${udMap[o.id]||0} UD)`}
                    style={{fontSize:9,padding:'1px 3px',border:'1px solid',borderRadius:3,cursor:'pointer',background:isSel?'var(--san)':'transparent',color:isSel?'#fff':'var(--txt3)',borderColor:isSel?'var(--san)':'var(--line)',fontFamily:'var(--mono)',lineHeight:1.3,transition:'none'}}>
                    {o.id}
                  </button>
                );
              })}
            </div>
          </td>
          <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:11,padding:'3px 5px'}}>{udAcum}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{nSalidas > 0 ? nSalidas : '—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'3px 5px'}}>{K!=null?K.toFixed(2):'—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'3px 5px'}}>{Q>0?Q.toFixed(3):'—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{sVal > 0 ? sVal : '—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',fontSize:10,padding:'3px 5px'}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
          <td className="c" style={{padding:'3px 5px'}}>
            <select
              value={DdisPulg||''}
              onChange={e=>handleDiamChange(t.id,parseFloat(e.target.value)||0)}
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
          <td className="c" style={{display:'none',fontFamily:'var(--mono)',padding:'3px 5px'}}>{Vreal>0?Vreal.toFixed(2):'—'}</td>
          <td className="c" style={{display:'none',padding:'3px 5px'}}>{chequeoV}</td>
          <td className="c" style={{padding:'3px 5px'}}>{Yc>0?Yc.toFixed(2):'—'}</td>
          <td className="c" style={{display:'none',padding:'3px 5px'}}>{Yn>0?Yn.toFixed(2):'—'}</td>
          <td className="c" style={{padding:'3px 5px'}}>{Froude>0?Froude.toFixed(2):'—'}</td>
          <td className="c" style={{fontSize:10,padding:'3px 5px'}}>{tipoFlujo}</td>
          <td className="c" style={{padding:'3px 5px'}}>{Ymax>0?Ymax.toFixed(2):'—'}</td>
          <td className="c" style={{padding:'3px 5px'}}>{chequeoYn}</td>
          <td className="c" style={{padding:'3px 5px'}}>{fuerzaTractiva>0?fuerzaTractiva.toFixed(2):'—'}</td>
          <td className="c" style={{padding:'3px 5px'}}>{chequeoFT}</td>
          <td className="c" style={{padding:'3px 2px'}}>
            <button
              onClick={() => handleDelete(t.id)}
              title="Eliminar ramal"
              style={{border:'none',background:'transparent',color:'var(--txt3)',cursor:'pointer',fontSize:12,padding:'2px 6px',lineHeight:1}}
            >&#x2715;</button>
          </td>
        </tr>
        );
      });
      })()}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <HydraulicCalcTable tramos={tramosSan} mode="sanitary" titleIcon="♻️" titleText="Cálculo de Vreal, Y real, Rh real" colorVar="var(--txt)" />
  </>);
}