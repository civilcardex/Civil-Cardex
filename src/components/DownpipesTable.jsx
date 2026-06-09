import { useTramos } from "../context/TramosContext";
import { useProject } from "../context/ProjectContext";
import { useApparatus } from "../context/ApparatusContext";
import { pisoCorto, DIAM_BAN, DIAM_VENT } from "../constants";
import { calcUDparcial, calcUDacumulado } from "../utils/componentHelpers";
import { calcularBajanteVentilacion } from "../utils/calcSanitary";

export default function BajantesTable() {
  const { tramosSan } = useTramos();
  const { udBase } = useApparatus();
  const { pisos } = useProject();

  return (
    <div className="card">
      <div className="card-h">
          <span className="card-t"><img src="/iconos_diseno_redes/RS_Bajantes.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} /> Bajantes A.N. y ventilación</span>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize:13}}>
          <thead>
            <tr>
              <th className="col-h san" colSpan={7} style={{textAlign:'center'}}>INFORMACIÓN COMÚN</th>
              <th className="col-h ok" colSpan={7} style={{textAlign:'center'}}>BAJANTES A.N.</th>
              <th className="col-h ven" colSpan={6} style={{textAlign:'center'}}>TUBERIA DE VENTILACION</th>
            </tr>
            <tr>
              <th className="col-h san" rowSpan={2} style={{textAlign:'center'}}>Bajante<br/>No.</th>
              <th className="col-h san" rowSpan={2} style={{textAlign:'center'}}>Nivel</th>
              <th className="col-h san" colSpan={2} style={{textAlign:'center'}}>Unidades de<br/>Descarga</th>
              <th className="col-h san" rowSpan={2} style={{textAlign:'center'}}>r</th>
              <th className="col-h san" rowSpan={2} style={{textAlign:'center'}}>Q<br/><small>lps</small></th>
              <th className="col-h san" rowSpan={2} style={{textAlign:'center',minWidth:70}}>Maning</th>
              <th className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Diametro</th>
              <th className="col-h ok" rowSpan={2} style={{textAlign:'center'}}>Chequeo<br/><small>Dcal&lt;Dprop</small></th>
              <th className="col-h ok" rowSpan={2} style={{textAlign:'center'}}>Q max<br/><small>Bajante</small></th>
              <th className="col-h ok" rowSpan={2} style={{textAlign:'center'}}>Velocidad<br/>Terminal<br/><small>m/s</small></th>
              <th className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Longitud<br/>Terminal (m)</th>
              <th className="col-h ven" rowSpan={2} style={{textAlign:'center'}}>Velocidad<br/>Aire<br/><small>m/s</small></th>
              <th className="col-h ven" rowSpan={2} style={{textAlign:'center'}}>ƒ<br/><small>Darcy</small></th>
              <th className="col-h ven" rowSpan={2} style={{textAlign:'center'}}>Q aire<br/><small>LPS</small></th>
              <th className="col-h ven" rowSpan={2} style={{textAlign:'center'}}>Longitud<br/>bajante<br/><small>m</small></th>
              <th className="col-h ven" colSpan={2} style={{textAlign:'center'}}>Diámetro</th>
            </tr>
            <tr>
              <th className="col-h san" style={{textAlign:'center'}}>Parcial<br/><small>UD</small></th>
              <th className="col-h san" style={{textAlign:'center'}}>Acum.<br/><small>UD</small></th>
              <th className="col-h ok" style={{textAlign:'center'}}>Calculado<br/><small>Pulg.</small></th>
              <th className="col-h ok" style={{textAlign:'center'}}>Propuesto<br/><small>Pulg.</small></th>
              <th className="col-h ok" style={{textAlign:'center'}}>calculada</th>
              <th className="col-h ok" style={{textAlign:'center'}}>Minima</th>
              <th className="col-h ven" style={{textAlign:'center'}}>Calculado<br/><small>Pulg.</small></th>
              <th className="col-h ven" style={{textAlign:'center'}}>Propuesto<br/><small>Pulg.</small></th>
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const acumMapALL=calcUDacumulado(tramosSan,udBase);
              const banTramos=tramosSan.filter(t=>t.esBajante);
              if(banTramos.length===0) return <tr><td colSpan={20} style={{textAlign:'center',color:'var(--txt3)',padding:20}}>No hay bajantes definidos. Marque un tramo como "Bajante" en la tabla de Cálculo UD.</td></tr>;
              return banTramos.map(t=>{
const rVal=t.bajR;
const rStr=rVal!=null?(Math.abs(rVal-7/24)<0.001?'7/24':'1/4'):null;
const udParcial=calcUDparcial(t,udBase);
const descArr=(t.recibeDe||[]).join('+');
const udOtros=(t.recibeDe||[]).reduce((s,id)=>s+(acumMapALL[id]||0),0);
const udAcum=udParcial+udOtros;
const n=t.nmaning;
const res=calcularBajanteVentilacion({
bajante:t.id,
pisos:`${t.pisoDesde||''}-${t.pisoHasta||''}`,
UD_propias:udParcial,
UD_otros:udOtros,
UD_acum:udAcum,
r:t.bajR,
n:t.nmaning||0.009,
bajDprop:t.bajDprop||0,
bajLong:t.bajLong||3,
bajFDarcy:t.bajFDarcy||0.025,
ventDprop:t.ventDprop||0,
});
const Q=res.Q_Ls;
const DcalcPulg=res.Dcalc_pulg;
const chequeo=res.chequeoDiam;
const QmaxB=res.QmaxBajante;
const Vt=res.Vt;
const Ltcalc=res.Lt_calc;
const Ltmin=res.Lt_min;
const fDarcy=t.bajFDarcy;
const Vair=res.V_aire;
const Qair=res.Q_aire_Ls;
const Lbaj=res.longBajante_m;
const DventCalcPulg=res.D_vent_calc_pulg;
const DventPropPulg=res.D_vent_prop_pulg;
const chequeoVent=res.D_vent_prop_pulg>0?(res.D_vent_calc_pulg<=res.D_vent_prop_pulg?'O.K.':'NO CUMPLE'):(res.D_vent_calc_pulg>0?'Sin diseño':'—');
                return(
                  <tr key={t.id}>
                    <td className="c"><span className="sigla" style={{fontSize:10}}>{t.id}</span></td>
                    <td className="c">
                      <span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>
                        {t.pisoDesde ? pisoCorto(t.pisoDesde) : '—'} – {t.pisoHasta ? pisoCorto(t.pisoHasta) : '—'}
                      </span>
                    </td>
                    <td className="c" style={{fontFamily:'var(--mono)'}}>{udParcial}</td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700}}>{udAcum}</td>
                    <td className="c">
                      <span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{rStr || '—'}</span>
                    </td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600}}>{Q>0?Q.toFixed(3):'—'}</td>
                    <td className="c" style={{fontFamily:'var(--mono)'}}>{n > 0 ? n.toFixed(3) : '—'}</td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontSize:10}}>{DcalcPulg>0?DcalcPulg.toFixed(2)+'"':'—'}</td>
                    <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{t.bajDprop ? t.bajDprop+'"' : '—'}</span></td>
                    <td className="c">{chequeo}</td>
                    <td className="c" style={{fontFamily:'var(--mono)'}}>{QmaxB>0?QmaxB.toFixed(2):'—'}</td>
                    <td className="c">{Vt>0?Vt.toFixed(2):'—'}</td>
                    <td className="c">{Ltcalc>0?Ltcalc.toFixed(2):'—'}</td>
                    <td className="c">{Ltmin>0?Ltmin.toFixed(2):'—'}</td>
                    <td className="c">{Vair>0?Vair.toFixed(2):'—'}</td>
                    <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{fDarcy > 0 ? fDarcy.toFixed(3) : '—'}</span></td>
                    <td className="c" style={{fontFamily:'var(--mono)'}}>{Qair>0?Qair.toFixed(2):'—'}</td>
                    <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{t.bajLong > 0 ? t.bajLong : '—'}</span></td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontSize:10}}>{DventCalcPulg>0?DventCalcPulg.toFixed(2)+'"':'—'}</td>
                    <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{t.ventDprop ? t.ventDprop+'"' : '—'}</span></td>
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
