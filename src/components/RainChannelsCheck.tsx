import { useRainwater } from "../context/RainwaterContext";
import { chequeoCanalLluvia } from "../utils/calcRainwater";

const renderStatus = (val: string) => {
  if (val === 'O.K.' || val === 'Ok' || val === 'OK') {
    return (
      <span style={{
        color: 'var(--ok)',
        background: 'rgba(47, 248, 1, 0.08)',
        border: '1px solid rgba(47, 248, 1, 0.15)',
        padding: '1px 5px',
        borderRadius: '3px',
        fontWeight: 600,
        fontSize: '9px',
        fontFamily: 'var(--mono)',
        display: 'inline-block'
      }}>
        {val}
      </span>
    );
  }
  if (val === 'NO CUMPLE' || val === 'No cumple' || val === 'NO') {
    return (
      <span style={{
        color: 'var(--err)',
        background: 'rgba(255, 180, 171, 0.08)',
        border: '1px solid rgba(255, 180, 171, 0.15)',
        padding: '1px 5px',
        borderRadius: '3px',
        fontWeight: 600,
        fontSize: '9px',
        fontFamily: 'var(--mono)',
        display: 'inline-block',
        whiteSpace: 'nowrap'
      }}>
        {val}
      </span>
    );
  }
  return <span style={{ color: 'var(--txt3)' }}>{val}</span>;
};

export default function ChequeoCanalesLluvias() {
  const { canalesLl } = useRainwater();

  return (
    <div className="card">
      <div className="card-h">
        <h3 className="card-t"><img src="/iconos_diseno_redes/aguas_lluvias/RALL_Chequeo_canal_cubierta.webp" alt="Chequeo canal cubierta"  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Chequeo capacidad canal cubierta aguas lluvias</h3>
      </div>
      <div className="scroll-top" style={{padding:'16px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{fontSize:10, tableLayout:'auto', width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Sector</th>
              <th scope="col" className="col-h ll" colSpan={2} style={{textAlign:'center',fontSize:9,padding:'3px 2px'}}>Área (m²)</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Intensidad (I)<br/><small>mm/hr</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Coef.<br/>Escorrentía (C)</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Q real<br/><small>(LPS)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Manning<br/>(n)</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Pendiente<br/>S <small>(%)</small></th>
              <th scope="col" className="col-h ok" colSpan={4} style={{textAlign:'center',fontSize:9,padding:'3px 2px'}}>Sección propuesta (cm)</th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Q max<br/><small>(LPS)</small></th>
              <th scope="col" className="col-h ll" rowSpan={2} style={{fontSize:9,textAlign:'center',padding:'3px 2px'}}>Chequeo<br/>Qreal &lt; Qmax</th>
            </tr>
            <tr>
              <th scope="col" className="col-h ll" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>Parcial</th>
              <th scope="col" className="col-h ll" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>Acumulada</th>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>b</th>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>h</th>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>bl</th>
              <th scope="col" className="col-h ok" style={{fontSize:8,textAlign:'center',padding:'2px 2px'}}>Total</th>
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
                  <td className="c" style={{fontSize:11}}>{renderStatus(chequeo)}</td>
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