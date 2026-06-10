import { useRainwater } from "../context/RainwaterContext";
import { chequeoCanalLluvia } from "../utils/calcSanitary";

export default function ChequeoCanalesLluvias() {
  const { canalesLl } = useRainwater();

  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t"><img src="/iconos_diseno_redes/RALL_Chequeo_canal_cubierta.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} /> Chequeo capacidad canal cubierta aguas lluvias</span>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize:13}}>
          <thead>
            <tr>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Sector</th>
              <th className="col-h ll" colSpan={2} style={{textAlign:'center',fontSize:11}}>Área</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Intensidad promedio<br/>mm/hr/m²</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Coeficiente de<br/>Escorrentía C</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Q real<br/>LPS</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Manning</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Pendiente<br/>(%)</th>
              <th className="col-h ok" colSpan={4} style={{textAlign:'center',fontSize:11}}>Sección propuesta</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Q max<br/>LPS</th>
              <th className="col-h ll" rowSpan={2} style={{fontSize:11,textAlign:'center'}}>Chequeo<br/>Qreal&lt;Qmax</th>
            </tr>
            <tr>
              <th className="col-h ll" style={{fontSize:10,textAlign:'center'}}>Parcial<br/>m²</th>
              <th className="col-h ll" style={{fontSize:10,textAlign:'center'}}>Acumulada<br/>m²</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>b<br/>(cm)</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>h<br/>(cm)</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>bl<br/>(cm)</th>
              <th className="col-h ok" style={{fontSize:10,textAlign:'center'}}>Total<br/>(cm)</th>
            </tr>
          </thead>
          <tbody>
{canalesLl.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
) : canalesLl.map(c=>{
const { Qreal, Qmax, chequeo, totalStr } = chequeoCanalLluvia(c);
return(
                <tr key={c.id}>
                  <td className="c"><span className="sigla" style={{fontSize:11}}>{c.sector || '—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.areaParcial||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.areaAcumulada||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.intensidad||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.coeficienteC||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13}}>{Qreal>0?Qreal.toFixed(2):'—'}</td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.manning||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.pendiente||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.b||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.h||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize:11}}>{c.bl||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:11}}>{totalStr}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:12}}>{Qmax > 0 ? Qmax.toFixed(2) : '—'}</td>
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