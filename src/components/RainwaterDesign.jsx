import { useSanitario } from "../context/SanitarioContext";
import { pisoCorto, DIAM_OPTIONS, V_MIN, V_MAX, Y_D_MAX, FR_SUBCRITICO, FR_SUPERCRITICO, FUERZA_TRACTIVA_MIN } from "./constants";
import { parseDescripcion } from "../utils/parseDescripcion";
import { relacionesHidraulicas, caudalTuboLleno, velocidadTuboLleno, diametromaning, tipoRegimen, numeroFroude, tiranteCritico, GRAVEDAD } from "../utils/calcSanitario";

function getTributarioIds(tramos) {
  const tribSet = new Set();
  for (const t of tramos) {
    if (t.recibeDe) { for (const id of t.recibeDe) tribSet.add(id); }
    if (t.descripcion) {
      const ids = t.descripcion.split('+').map(s => s.trim()).filter(Boolean);
      for (const id of ids) tribSet.add(id);
    }
  }
  return tribSet;
}

export default function DisenoLluvias() {
  const { tramosLl } = useSanitario();

  const tribIds = getTributarioIds(tramosLl);
  const displayTramos = tramosLl.filter(t => !tribIds.has(t._key) && !tribIds.has(t.id));
  const bajantes=tramosLl.filter(o=>o.esBajante);

  return (
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
            </tr>
          </thead>
          <tbody>
            {[...displayTramos].sort((a,b)=>(b.piso||0)-(a.piso||0)).map(t=>{
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
                  <td className="c"><span style={{fontFamily:'var(--mono)'}}>{DdisPulg>0?DdisPulg+'"':'—'}</span></td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}