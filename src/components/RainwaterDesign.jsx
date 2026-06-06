import { useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { usePlanos } from "../context/PlansContext";
import { pisoCorto, DIAM_OPTIONS, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN } from "../constants";
import { parseDescripcion } from "../utils/parseDescription";
import { diametromaning } from "../utils/calcSanitary";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiameterToDrawing";
import { getTributarioIds } from "../utils/tramoUtils";
import { calcHydraulicCheck } from "../utils/hydraulicCheck";
import HydraulicCalcTable from "./HydraulicCalcTable";

export default function DisenoLluvias() {
  const { tramosLl, updTramoLL, delTramoLL } = useTramos();
  const { planos } = usePlanos();

  const handleDiamChange = useCallback((tramoKey, tramoId, newPulg) => {
    updTramoLL(tramoKey, 'diamDisPulg', newPulg);
    const opt = DIAM_OPTIONS.find(o => o.pulg === newPulg);
    if (opt && tramoId) {
      writeDiametroToDrawing(tramoId, 'll', opt.label, planos);
    }
  }, [updTramoLL, planos]);

  const handleDelete = useCallback((tramoKey, tramoId) => {
    delTramoLL(tramoKey);
    if (tramoId) deleteRamalFromDrawing(tramoId, 'll', planos);
  }, [delTramoLL, planos]);

  const tribIds = getTributarioIds(tramosLl);
  const displayTramos = tramosLl.filter(t => !tribIds.has(t._key) && !tribIds.has(t.id));
  const bajantes=tramosLl.filter(o=>o.esBajante);

  return (
  <>
    <div className="card">
      <div className="card-h">
        <span className="card-t">🌧️ Diseño Red Agua Lluvias</span>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
          <table className="tbl" style={{fontSize:13}}>
          <thead>
            <tr>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Tramo<br/>o Ramal</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Nivel</th>
<th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Inicio</th>
               <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Fin</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center',minWidth:100}}>Puntos de conexión</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Q<br/><small>LPS</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center',minWidth:70}}>Maning</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>S %</th>
              <th className="col-h ok" colSpan={3} style={{textAlign:'center',fontSize:11}}>Diámetro</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Qo<br/><small>LPS</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Vo<br/><small>m/s</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Q/Qo</th>
               <th className="col-h ll" rowSpan={2} style={{display:'none',fontSize:11,textAlign:'center'}}>Vreal<br/><small>m/s</small></th>
              <th className="col-h ll" rowSpan={2} style={{display:'none',fontSize:11,textAlign:'center'}}>Chequeo<br/><small>0.45&lt;Vr&lt;4.0</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Yc<br/><small>mm</small></th>
              <th className="col-h ll" rowSpan={2} style={{display:'none',fontSize:11,textAlign:'center'}}>Yn<br/><small>mm</small></th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Froude</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Tipo de<br/>Flujo</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Ymax= 0.75D mm</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Yn vs Yc</th>
              <th className="col-h ven" colSpan={2} style={{textAlign:'center',fontSize:11}}>Fuerza Tractiva</th>
            </tr>
            <tr>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>Calc.<br/>pulg</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>Diseño<br/>pulgada</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>Interno<br/>mm</th>
              <th className="col-h ven" style={{fontSize:10,textAlign:'center'}}>Vr<br/><small>kg/m2</small></th>
              <th className="col-h ven" style={{fontSize:10,textAlign:'center'}}>&gt;0.15</th>
          <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}></th>
            </tr>
          </thead>
          <tbody>
            {[...displayTramos].sort((a,b)=>(a.piso||0)-(b.piso||0)).map(t=>{
const n=t.nmaning;
const sVal=t.sPercent;
const S=sVal!=null&&sVal>0?sVal/100:null;
const Q=t.qLps||0;
              const dSel=DIAM_OPTIONS.find(d=>d.pulg===(t.diamDisPulg||0))||null;
      let DcalcPulg=0,DdisPulg=dSel?dSel.pulg:0,DintMm=dSel?dSel.mm:0,chequeo='—';
      let Qo=0,Vo=0,qqo=0,Vreal=0,chequeoV='—';
      let Yc=0,Yn=0,Froude=0,tipoFlujo='—',Ymax=0,chequeoYn='—';
      let fuerzaTractiva=0,chequeoFT='—';
if(Q>0&&S!=null&&S>0&&n!=null&&n>0){
DcalcPulg=Math.round(diametromaning(Q/1000,n,S)*1000/25.4*100)/100;
if(DdisPulg>0){chequeo=DcalcPulg<=DdisPulg?'O.K.':'NO CUMPLE';}
}
if(Q>0&&S!=null&&S>0&&n!=null&&n>0&&DintMm>0){
const hc = calcHydraulicCheck({ Q, S, n, DintMm, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN });
Qo = hc.Qo; Vo = hc.Vo; qqo = hc.qqo; Vreal = hc.Vreal; chequeoV = hc.chequeoV;
Yc = hc.Yc; Yn = hc.Yn; Froude = hc.Froude; tipoFlujo = hc.tipoFlujo;
Ymax = hc.Ymax; chequeoYn = hc.chequeoYn; fuerzaTractiva = hc.fuerzaTractiva; chequeoFT = hc.chequeoFT;
}
const descIds=parseDescripcion(t.descripcion);
              return(
                <tr key={t._key}>
                  <td className="c"><span className="sigla" style={{fontSize:10}}>{t.id || t._key}</span></td>
                  <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.piso ? pisoCorto(t.piso) : '—'}</span></td>
                  <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.desde || '—'}</span></td>
                  <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.hasta || '—'}</span></td>
                  <td className="c" style={{fontSize:10,color:'var(--txt2)'}}>
                    {descIds.length > 0 ? descIds.join(', ') : '—'}
                  </td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600}}>{Q>0?Q.toFixed(3):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{sVal > 0 ? sVal : '—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontSize:10}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
                  <td className="c">
          <select
            value={DdisPulg||''}
            onChange={e=>handleDiamChange(t._key,t.id,parseFloat(e.target.value)||0)}
            style={{fontFamily:'var(--mono)',fontSize:10,padding:'1px 2px',border:'1px solid var(--line)',borderRadius:2,background:'var(--bg2)',color:'var(--txt)',cursor:'pointer'}}
          >
            <option value="">—</option>
            {DIAM_OPTIONS.map(o=><option key={o.pulg} value={o.pulg}>{o.label}</option>)}
          </select>
        </td>
                  <td className="c">{DintMm>0?DintMm:'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{Qo>0?Qo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{Vo>0?Vo.toFixed(2):'—'}</td>
                  <td className="c" style={{fontFamily:'var(--mono)'}}>{qqo>0?qqo.toFixed(2):'—'}</td>
                  <td className="c" style={{display:'none',fontFamily:'var(--mono)'}}>{Vreal>0?Vreal.toFixed(2):'—'}</td>
                  <td className="c" style={{display:'none'}}>{chequeoV}</td>
                  <td className="c">{Yc>0?Yc.toFixed(2):'—'}</td>
                  <td className="c" style={{display:'none'}}>{Yn>0?Yn.toFixed(2):'—'}</td>
                  <td className="c">{Froude>0?Froude.toFixed(2):'—'}</td>
                  <td className="c" style={{fontSize:10}}>{tipoFlujo}</td>
                  <td className="c">{Ymax>0?Ymax.toFixed(2):'—'}</td>
                  <td className="c">{chequeoYn}</td>
                  <td className="c">{fuerzaTractiva>0?fuerzaTractiva.toFixed(2):'—'}</td>
        <td className="c">{chequeoFT}</td>
        <td className="c" style={{padding:'2px'}}>
          <button
            onClick={() => handleDelete(t._key, t.id)}
            title="Eliminar ramal"
            style={{border:'none',background:'transparent',color:'var(--txt3)',cursor:'pointer',fontSize:12,padding:'0 2px',lineHeight:1}}
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
  <HydraulicCalcTable tramos={tramosLl} mode="rainwater" titleIcon="🌧️" titleText="Cálculo de Vreal, Y real, Rh real" colorVar="var(--ll)" />
  </>);
}