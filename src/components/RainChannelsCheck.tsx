import { renderStatus } from "../utils/componentHelpers";
import { useRainwater } from "../context/RainwaterContext";
import { chequeoCanalLluvia } from "../utils/calcRainwater";

export default function ChequeoCanalesLluvias() {
  const { canalesLl } = useRainwater();

  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/aguas_lluvias/RALL_Chequeo_canal_cubierta.svg" alt="Chequeo canal cubierta"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Chequeo capacidad canal cubierta aguas lluvias</h3>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize: 9, tableLayout:'auto', width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Sector</th>
              <th scope="col" className="col-h ll" colSpan={2} style={{textAlign:'center',fontSize: 9,padding:'1px 1px'}}>Área (m²)</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Intensidad (I)<br/><small>mm/hr</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Coeficiente<br/>Escorrentía</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Caudal real<br/><small>(LPS)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Manning</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Pendiente<br/><small>(%)</small></th>
              <th scope="col" className="col-h ok" colSpan={4} style={{textAlign:'center',fontSize: 9,padding:'1px 1px'}}>Sección propuesta (cm)</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Caudal máximo<br/><small>(LPS)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Chequeo<br/>Qreal &lt; Qmax</th>
            </tr>
            <tr>
              <th scope="col" className="col-h ll" style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Parcial</th>
              <th scope="col" className="col-h ll" style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Acumulada</th>
              <th scope="col" className="col-h ok" style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>b</th>
              <th scope="col" className="col-h ok" style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>h</th>
              <th scope="col" className="col-h ok" style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>bl</th>
              <th scope="col" className="col-h ok" style={{fontSize: 9,textAlign:'center',padding:'1px 1px'}}>Total</th>
            </tr>
          </thead>
          <tbody>
{canalesLl.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 9 }}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
) : canalesLl.map(c=>{
const { Qreal, Qmax, chequeo, totalStr } = chequeoCanalLluvia(c);
return(
                <tr key={c.id}>
                  <td className="c"><span className="sigla" style={{fontSize: 9}}>{c.sector || '—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.areaParcial||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.areaAcumulada||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.intensidad||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.coeficienteC||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize: 9}}>{Qreal>0?Qreal.toFixed(2):'—'}</td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.manning||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.pendiente||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.b||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.h||'—'}</span></td>
                  <td className="c"><span style={{fontFamily:'var(--mono)',fontSize: 9}}>{c.bl||'—'}</span></td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:600,fontSize: 9}}>{totalStr}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,fontSize: 9}}>{Qmax > 0 ? Qmax.toFixed(2) : '—'}</td>
                  <td className="c" style={{fontSize: 9}}>{renderStatus(chequeo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}