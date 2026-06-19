import { useMemo, useCallback } from "react";
import { useTramos } from "../context/TramosContext";
import { usePlans } from "../context/PlansContext";
import { pisoCorto, DIAM_OPTIONS, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN } from "../constants";
import { diametroManning } from "../utils/calcSanitary";
import { writeDiametroToDrawing, deleteRamalFromDrawing } from "../utils/writeDiameterToDrawing";
import { getTributarioIds } from "../utils/tramoUtils";
import { calcHydraulicCheck } from "../utils/hydraulicCheck";

export default function DisenoLluvias() {
  const { tramosLl, updTramoLL, delTramoLL } = useTramos();
  const { plans } = usePlans();

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
  const bajantes=tramosLl.filter(o=>o.esBajante);

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
              <th className="col-h ll" rowSpan={2} style={{fontSize:10,textAlign:'center',padding:'3px 4px'}}>Conexiones</th>
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
const Q=t.qLps||0;
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
const descIds=(t.descripcion??'').split('+').map(s=>s.trim()).filter(Boolean);
              return(
                <tr key={t._key}>
                  <td className="c" style={{padding:'2px 4px'}}><span className="sigla" style={{fontSize:10}}>{t.id || t._key}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.piso ? pisoCorto(t.piso) : '—'}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.desde || '—'}</span></td>
                  <td className="c" style={{padding:'2px 4px'}}><span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{t.hasta || '—'}</span></td>
                  <td className="c" style={{fontSize:9,color:'var(--txt2)',padding:'2px 4px'}}>
                    {descIds.length > 0 ? descIds.join(', ') : '—'}
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
