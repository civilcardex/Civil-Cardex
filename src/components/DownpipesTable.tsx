import { useMemo } from "react";
import { useTramos } from "../context/TramosContext";
import { useProject } from "../context/ProjectContext";
import { usePlans } from "../context/PlansContext";
import { useApparatus } from "../context/ApparatusContext";
import { TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import { pisoCorto, pisoLbl, DIAM_BAN, DIAM_VENT } from "../constants";
import { calcUDparcial } from "../utils/componentHelpers";
import { calculateVentStack } from "../utils/calcSanitary";

export default function BajantesTable() {
  const { tramosSan, updTramoSan } = useTramos();
  const { udBase } = useApparatus();
  const { pisos } = useProject();
  const { plans } = usePlans();
  const sortedPisos = [...pisos].sort((a: any, b: any) => a.n - b.n);

  const bajRecibidos = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data = raw as Record<string, any>;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { continue; } }
      for (const b of (data.bajantes || [])) {
        if (b.recibeDeIds?.length) {
          map[b.id] = b.recibeDeIds;
          if (b.code) map[b.code] = b.recibeDeIds;
        }
      }
    }
    return map;
  }, [plans]);

  return (
    <div className="card">
      <div className="card-h">
          <span className="card-t"><img src="/iconos_diseno_redes/sanitaria/RS_Bajantes.webp" alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Bajantes de aguas negras y ventilación</span>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize:13}}>
          <caption className="visually-hidden">Bajantes de aguas negras y ventilación</caption>
          <thead>
            <tr>
              <th scope="col" className="col-h san" colSpan={8} style={{textAlign:'center'}}>INFORMACIÓN COMÚN</th>
              <th scope="col" className="col-h ok" colSpan={7} style={{textAlign:'center'}}>BAJANTES A.N.</th>
              <th scope="col" className="col-h ven" colSpan={6} style={{textAlign:'center'}}>TUBERÍA DE VENTILACIÓN</th>
            </tr>
            <tr>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center'}}>Bajante<br/>No.</th>
              <th scope="col" className="col-h san" colSpan={2} style={{textAlign:'center'}}>Nivel</th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center'}}>Ramales<br/>asociados</th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center'}}>Total<br/>UD</th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center'}}>r</th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center'}}>Q<br/><small>lps</small></th>
              <th scope="col" className="col-h san" rowSpan={2} style={{textAlign:'center',minWidth:70}}>Manning</th>
              <th scope="col" className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Diametro</th>
              <th scope="col" className="col-h ok" rowSpan={2} style={{textAlign:'center'}}>Chequeo<br/><small>Dcal&lt;Dprop</small></th>
              <th scope="col" className="col-h ok" rowSpan={2} style={{textAlign:'center'}}>Q max<br/><small>Bajante</small></th>
              <th scope="col" className="col-h ok" rowSpan={2} style={{textAlign:'center'}}>Velocidad<br/>Terminal<br/><small>m/s</small></th>
              <th scope="col" className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Longitud<br/>Terminal (m)</th>
              <th scope="col" className="col-h ven" rowSpan={2} style={{textAlign:'center'}}>Velocidad<br/>Aire<br/><small>m/s</small></th>
              <th scope="col" className="col-h ven" rowSpan={2} style={{textAlign:'center'}}>ƒ<br/><small>Darcy</small></th>
              <th scope="col" className="col-h ven" rowSpan={2} style={{textAlign:'center'}}>Q aire<br/><small>LPS</small></th>
              <th scope="col" className="col-h ven" rowSpan={2} style={{textAlign:'center'}}>Longitud<br/>bajante<br/><small>m</small></th>
              <th scope="col" className="col-h ven" colSpan={2} style={{textAlign:'center'}}>Diámetro</th>
            </tr>
            <tr>
              <th scope="col" className="col-h san" style={{textAlign:'center'}}>Origen</th>
              <th scope="col" className="col-h san" style={{textAlign:'center'}}>Destino</th>
              <th scope="col" className="col-h ok" style={{textAlign:'center'}}>Calculado<br/><small>Pulg.</small></th>
              <th scope="col" className="col-h ok" style={{textAlign:'center'}}>Propuesto<br/><small>Pulg.</small></th>
              <th scope="col" className="col-h ok" style={{textAlign:'center'}}>calculada</th>
              <th scope="col" className="col-h ok" style={{textAlign:'center'}}>Minima</th>
              <th scope="col" className="col-h ven" style={{textAlign:'center'}}>Calculado<br/><small>Pulg.</small></th>
              <th scope="col" className="col-h ven" style={{textAlign:'center'}}>Propuesto<br/><small>Pulg.</small></th>
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const banTramos=tramosSan.filter(t=>t.esBajante);
              if(banTramos.length===0) return <tr><td colSpan={21} style={{textAlign:'center',color:'var(--txt3)',padding:'24px 0',fontSize:11}}>No hay bajantes definidos. Marque un tramo como bajante en la tabla de Cálculo UD.</td></tr>;
              const rowKey = (t: any) => t.id + '_' + (t._key || '') + '_' + (t.piso || 0);
              return banTramos.map(t=>{
const rVal=t.bajR;
const rStr=rVal!=null?(Math.abs(rVal-7/24)<0.001?'7/24':'1/4'):null;
const propiasUD = calcUDparcial(t, udBase);
const ramalesIds = ((t.recibeDeIds?.length ? t.recibeDeIds : (bajRecibidos[t.id] || (t.code ? bajRecibidos[t.code] : undefined))) || []) as string[];
const ramalesUD = ramalesIds.reduce((sum: number, rid: string) => {
  const rt = tramosSan.find(tr => tr.id === rid);
  return sum + (rt ? calcUDparcial(rt, udBase) : 0);
}, 0);
const totalUD = propiasUD + ramalesUD;
const ramalesLbl = ramalesIds.map((rid: string) => {
  const rt = tramosSan.find(tr => tr.id === rid);
  return rt ? (rt.label || rt.id) : rid;
}).join(', ');
const n=t.nmaning??0;
const res=calculateVentStack({
bajante:t.id,
pisos:`${t.pisoBase||t.piso||''}-${t.pisoCima||t.piso||''}`,
UD_propias:propiasUD,
UD_otros:ramalesUD,
UD_acum:totalUD,
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
const fDarcy=t.bajFDarcy??0;
const Vair=res.V_aire;
const Qair=res.Q_aire_Ls;
const Lbaj=res.longBajante_m;
const DventCalcPulg=res.D_vent_calc_pulg;
const DventPropPulg=res.D_vent_prop_pulg;
const chequeoVent=res.D_vent_prop_pulg>0?(res.D_vent_calc_pulg<=res.D_vent_prop_pulg?'O.K.':'NO CUMPLE'):(res.D_vent_calc_pulg>0?'Sin diseño':'—');
const origenVal = t.pisoBase || t.piso || '';
const destinoVal = t.pisoCima || t.piso || '';
                return(
                  <tr key={rowKey(t)}>
                    <td className="c"><span className="sigla" style={{fontSize:10}}>{t.code || t.id}</span></td>
                    <td className="c" style={{padding:'2px'}}>
                      <select aria-label="Origen" value={String(origenVal)}
                        onChange={e => updTramoSan(t.id, 'pisoBase', e.target.value)}
                        style={{width:'100%',padding:'1px 2px',background:'var(--bg2)',border:'1px solid var(--line)',borderRadius:2,color:'var(--txt)',fontSize:10,fontFamily:'var(--mono)',cursor:'pointer',textAlign:'center'}}>
                        <option value="">—</option>
                        {sortedPisos.map(p => <option key={p.id} value={p.n}>{pisoCorto(p.n)}</option>)}
                      </select>
                    </td>
                    <td className="c" style={{padding:'2px'}}>
                      <select aria-label="Destino" value={String(destinoVal)}
                        onChange={e => updTramoSan(t.id, 'pisoCima', e.target.value)}
                        style={{width:'100%',padding:'1px 2px',background:'var(--bg2)',border:'1px solid var(--line)',borderRadius:2,color:'var(--txt)',fontSize:10,fontFamily:'var(--mono)',cursor:'pointer',textAlign:'center'}}>
                        <option value="">—</option>
                        {sortedPisos.map(p => <option key={p.id} value={p.n}>{pisoCorto(p.n)}</option>)}
                      </select>
                    </td>
                    <td className="c" style={{fontSize:10,color:'var(--txt2)',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={ramalesLbl}>
                      {ramalesLbl || '—'}
                    </td>
                    <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700}}>{totalUD > 0 ? totalUD : (propiasUD > 0 ? propiasUD : '—')}</td>
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
                    <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{(t.bajLong??0) > 0 ? t.bajLong : '—'}</span></td>
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