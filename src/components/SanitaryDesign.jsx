import { useSanitario } from "../context/SanitarioContext";
import { calcUDparcial, calcUDacumulado } from "./utils";
import { pisoCorto, DIAM_OPTIONS, V_MIN, V_MAX, Y_D_MAX, FR_SUBCRITICO, FR_SUPERCRITICO, FUERZA_TRACTIVA_MIN } from "./constants";
import { parseDescripcion } from "../utils/parseDescripcion";
import { relacionesHidraulicas, caudalTuboLleno, velocidadTuboLleno, diametromaning, tipoRegimen, numeroFroude, tiranteCritico, caudalHunterLPS, factorSimultaneidad, GRAVEDAD } from "../utils/calcSanitario";

function getTributarioIds(tramos) {
  const tribSet = new Set();
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

export default function DisenosSanitarios() {
const { tramosSan, udBase } = useSanitario();

const tribIds = getTributarioIds(tramosSan);
const displayTramos = tramosSan.filter(t => !tribIds.has(t.id));

return (
  <div className="card">
    <div className="card-h">
      <span className="card-t">📊 Diseño Red sanitaria</span>
    </div>
    <div className="scroll-top" style={{padding:'16px'}}>
      <div className="scroll-inner">
        <table className="tbl" style={{fontSize:11}}>
          <thead>
            <tr>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Tramo<br/>o Ramal</th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Nivel</th>
              <th className="col-h san" colSpan={4} style={{textAlign:'center',fontSize:9,padding:'2px 4px'}}>UD DE DESCARGA</th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>#<br/>Desc.</th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>K</th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Q<br/><small>LPS</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Maning</th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>S %</th>
              <th className="col-h ok" colSpan={3} style={{textAlign:'center',fontSize:9,padding:'2px 4px'}}>Diámetro</th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Qo<br/><small>LPS</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Vo<br/><small>m/s</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Q/Qo</th>
               <th className="col-h" rowSpan={2} style={{display:'none',fontSize:9,textAlign:'center',padding:'2px 4px'}}>Vreal<br/><small>m/s</small></th>
              <th className="col-h" rowSpan={2} style={{display:'none',fontSize:9,textAlign:'center',padding:'2px 4px'}}>Chequeo<br/><small>0.45&lt;Vr&lt;4.0</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Yc<br/><small>mm</small></th>
              <th className="col-h" rowSpan={2} style={{display:'none',fontSize:9,textAlign:'center',padding:'2px 4px'}}>Yn<br/><small>mm</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Froude</th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Tipo de<br/>Flujo</th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Ymax<br/><small>0.75D mm</small></th>
              <th className="col-h" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'2px 4px'}}>Yn vs Yc</th>
              <th className="col-h ven" colSpan={2} style={{textAlign:'center',fontSize:9,padding:'2px 4px'}}>F. Tractiva</th>
            </tr>
            <tr>
              <th className="col-h san" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>Propias</th>
              <th className="col-h san" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>Otros<br/>Ram.</th>
              <th className="col-h san" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>Ramas<br/>con.</th>
              <th className="col-h san" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>Total</th>
              <th className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>Calc.<br/>pulg</th>
              <th className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>Diseño<br/>pulg</th>
              <th className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>Int.<br/>mm</th>
              <th className="col-h ven" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>Vr<br/><small>kg/m2</small></th>
              <th className="col-h ven" style={{fontSize:8,textAlign:'center',padding:'2px 4px'}}>&gt;0.15</th>
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const acumMap=calcUDacumulado(tramosSan,udBase);
              return [...displayTramos].sort((a,b)=>(b.piso||0)-(a.piso||0)).map(t=>{
                const udPropias=calcUDparcial(t,udBase);
                const descIds=parseDescripcion(t.descripcion);
                const udOtros=descIds.reduce((s,id)=>s+(acumMap[id]||0),0);
                const udAcum=udPropias+udOtros;
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
Qo=Math.round(caudalTuboLleno(DintMm/1000,n,S)*1000*100)/100;
Vo=Math.round(velocidadTuboLleno(DintMm/1000,n,S)*100)/100;
qqo=Qo>0?Math.round(Q/Qo*100)/100:0;
const q=Qo>0?Q/Qo:0;
const rel=relacionesHidraulicas(q);
Vreal=Math.round(rel.v_V0*Vo*100)/100;
chequeoV=(Vreal<V_MIN||Vreal>V_MAX)?'NO CUMPLE':'O.K.';
const Rh=rel.Rh_D*DintMm;
Yc=Math.round(tiranteCritico(DintMm/1000,Q/1000)*1000*100)/100;
Yn=Math.round(rel.h_D*DintMm*100)/100;
Ymax=Math.round(DintMm*Y_D_MAX*100)/100;
chequeoYn=Math.max(Yc,Yn)<Ymax?'O.K.':'NO CUMPLE';
Froude=Math.round(numeroFroude(Vreal,rel.Rh_D*DintMm/1000)*100)/100;
tipoFlujo=tipoRegimen(Froude)==='Supercritico'?'Supercrítico':tipoRegimen(Froude)==='Subcritico'?'Subcrítico':'Crítico';
fuerzaTractiva=Math.round(1000*Rh/1000*S*100)/100;
chequeoFT=fuerzaTractiva>FUERZA_TRACTIVA_MIN?'O.K.':'NO CUMPLE';
        }
        return(
        <tr key={t.id}>
          <td className="c" style={{padding:'3px 5px'}}><span className="sigla" style={{fontSize:9}}>{t.id}</span></td>
          <td className="c" style={{padding:'3px 5px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{pisoCorto(t.piso)}</span></td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{udPropias}</td>
          <td className="c" style={{fontFamily:'var(--mono)',color:'var(--txt3)',padding:'3px 5px'}}>{udOtros||'—'}</td>
          <td className="c" style={{fontSize:9,color:'var(--txt2)',padding:'3px 5px'}}>
            {descIds.length > 0 ? descIds.join(', ') : '—'}
          </td>
          <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:11,padding:'3px 5px'}}>{udAcum}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{nSalidas > 0 ? nSalidas : '—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'3px 5px'}}>{K!=null?K.toFixed(2):'—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,padding:'3px 5px'}}>{Q>0?Q.toFixed(3):'—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{sVal > 0 ? sVal : '—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',fontSize:9,padding:'3px 5px'}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{DdisPulg>0?DdisPulg+'"':'—'}</td>
          <td className="c" style={{padding:'3px 5px'}}>{DintMm>0?DintMm:'—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{Qo>0?Qo.toFixed(2):'—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{Vo>0?Vo.toFixed(2):'—'}</td>
          <td className="c" style={{fontFamily:'var(--mono)',padding:'3px 5px'}}>{qqo>0?qqo.toFixed(2):'—'}</td>
          <td className="c" style={{display:'none',fontFamily:'var(--mono)',padding:'3px 5px'}}>{Vreal>0?Vreal.toFixed(2):'—'}</td>
          <td className="c" style={{display:'none',padding:'3px 5px'}}>{chequeoV}</td>
          <td className="c" style={{padding:'3px 5px'}}>{Yc>0?Yc.toFixed(2):'—'}</td>
          <td className="c" style={{display:'none',padding:'3px 5px'}}>{Yn>0?Yn.toFixed(2):'—'}</td>
          <td className="c" style={{padding:'3px 5px'}}>{Froude>0?Froude.toFixed(2):'—'}</td>
          <td className="c" style={{fontSize:9,padding:'3px 5px'}}>{tipoFlujo}</td>
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
  );
}