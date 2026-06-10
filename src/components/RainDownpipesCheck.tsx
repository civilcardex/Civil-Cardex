import { useRainwater } from "../context/RainwaterContext";
import { chequeoBajanteLluvia } from "../utils/calcSanitary";

export default function ChequeoBajantesLluvias() {
  const { bajantesLl } = useRainwater();

  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t"><img src="/iconos_diseno_redes/RALL_Chequeo_bajantes.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} /> Chequeo capacidad bajantes aguas lluvias</span>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize:13}}>
          <thead>
            <tr>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Bajante #</th>
              <th className="col-h ll" colSpan={2} style={{textAlign:'center',fontSize:11}}>Área</th>
<th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Intensidad promedio<br/>mm/hr/m²</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Coeficiente de<br/>Escorrentía C</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>R</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Q = C×I×A<br/>LPS</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Manning</th>
              <th className="col-h ok" colSpan={2} style={{textAlign:'center',fontSize:11}}>Diámetro</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Chequeo<br/>Dcal&lt;Dprop</th>
            </tr>
            <tr>
              <th className="col-h ll" style={{fontSize:10,textAlign:'center'}}>Parcial<br/>m²</th>
              <th className="col-h ll" style={{fontSize:10,textAlign:'center'}}>Acumulada<br/>m²</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>Calculado<br/>(")</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>Propuesto<br/>(")</th>
            </tr>
          </thead>
          <tbody>
{bajantesLl.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
) : bajantesLl.map(b=>{
const { Q, dCalc: diamCalc, chequeo } = chequeoBajanteLluvia(b);
const diamProp = b.diamPropuesto || 0;
return(
                <tr key={b.id}>
                  <td className="c"><span className="sigla" style={{fontSize:11}}>{b.bajante || '—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{b.areaParcial||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{b.areaAcumulada||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{b.intensidad||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{b.coeficienteC||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{b.R || '—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13}}>{Q>0?Q.toFixed(2):'—'}</td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{b.manning||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:12}}>{diamCalc > 0 ? diamCalc.toFixed(2) : '—'}</td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{diamProp ? diamProp+'"' : '—'}</span></td>
                  <td className="c" style={{fontWeight:700}}>{chequeo}</td>
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