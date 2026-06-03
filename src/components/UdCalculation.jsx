import { useSanitario } from "../context/SanitarioContext";
import { calcUDparcial, calcUDacumulado } from "./utils";
import { pisoCorto, APARATOS_DEF } from "./constants";

export default function CalculoUD() {
const { tramosSan, udBase, pisos, addTramoSan, delTramoSan, updTramoSan, updTramoSanFix, aps } = useSanitario();

const pisosSelect = pisos.filter(p => p.tipo !== 'cubierta');
const mergedBase = udBase.map(d => {
  const fromAps = aps.find(p => p.id === d.id);
  const merged = fromAps ? { ...d, ud: fromAps.ud ?? d.ud } : d;
  const def = APARATOS_DEF.find(x => x.id === d.id);
  return { ...merged, _disabled: (def?.ud || 0) === 0 };
});
const acumMap = calcUDacumulado(tramosSan, mergedBase);

return (
<>
  <div className="card">
    <div className="card-h">
      <span className="card-t">📊 C&aacute;lculo Unidades de Descarga</span>
      <span className="card-s">{tramosSan.length} tramos</span>
    </div>
    <div className="scroll-top" style={{padding:'16px'}}>
      <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{minWidth:900}}>
          <thead>
            <tr>
              <th className="col-h" rowSpan={2} style={{minWidth:70,textAlign:'center'}}>Tramo</th>
              <th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Piso</th>
              <th className="col-h san" colSpan={mergedBase.length} style={{textAlign:'center'}}>Aparatos</th>
              <th className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Unidades de Descarga</th>
              <th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Bajante</th>
              <th className="col-h" rowSpan={2} style={{minWidth:34,textAlign:'center'}}></th>
            </tr>
            <tr>
              {mergedBase.map(d=>(
                <th key={d.id} className="col-h san" style={{minWidth:52,fontSize:9,textAlign:'center'}}>{d.nombre}<br/><span style={{fontSize:8,fontWeight:400}}>{d.ud} UD</span></th>
              ))}
              <th className="col-h ok" style={{textAlign:'center'}}>Parcial</th>
              <th className="col-h ok" style={{textAlign:'center'}}>Total</th>
            </tr>
          </thead>
          <tbody>
{tramosSan.map((t,i)=>{
const parcial=calcUDparcial(t,mergedBase);
const acum=acumMap[t.id]||0;
              return(
                <tr key={i}>
                  <td className="c"><input className="ni" style={{width:64,padding:'3px 6px',fontSize:11,textAlign:'center'}} value={t.id} onChange={e=>updTramoSan(t.id,'id',e.target.value)}/></td>
                  <td className="c">
                    <select className="ni" style={{width:50,padding:'3px 4px',fontSize:11,textAlign:'center'}} value={t.piso} onChange={e=>updTramoSan(t.id,'piso',parseInt(e.target.value))}>
                      {pisosSelect.map(p=><option key={p.id} value={p.n}>{pisoCorto(p.n)}</option>)}
                    </select>
                  </td>
                  {mergedBase.map(d=>(
                    <td key={d.id} className="c" style={{padding:'2px 3px'}}>
<input type="number" className="ni" style={{width:48,textAlign:'center',padding:'3px 4px',fontSize:12}} value={t.fixtures[d.id]??0} min={0} disabled={d._disabled}
onChange={e=>updTramoSanFix(t.id,d.id,e.target.value===''?0:parseInt(e.target.value)||0)}/>
                    </td>
                  ))}
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--txt)',fontSize:13}}>{parcial}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--txt)',fontSize:14}}>{acum}</td>
                  <td className="c">
                    <input type="checkbox" checked={t.esBajante||false} onChange={e=>updTramoSan(t.id,'esBajante',e.target.checked)} style={{cursor:'pointer'}}/>
                  </td>
                  <td className="c">
                    <button onClick={()=>delTramoSan(t.id)} style={{background:'var(--err-bg)',border:'1px solid var(--err-b)',borderRadius:'var(--r)',color:'var(--err)',padding:'1px 5px',fontSize:10,cursor:'pointer'}}>✕</button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={2+mergedBase.length+4} style={{padding:'8px 0'}}>
                <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8}}>
<button className="btn-xs" onClick={addTramoSan} style={{width:'auto',display:'inline-flex',alignItems:'center',gap:4}}>+ Agregar tramo</button>
</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div className="tot-bar">
      {(()=>{
        const totales=mergedBase.map(d=>({
          id:d.id,nombre:d.nombre,ud:d.ud,
          cant:tramosSan.reduce((s,t)=>s+(t.fixtures[d.id]||0),0)
        }));
        const totalUD=totales.reduce((s,d)=>s+d.cant*d.ud,0);
        return(
          <>
            {totales.map(d=>(
              <div key={d.id} className="tot">
                <div className="tot-l">{d.nombre}</div>
                <div className="tot-v san">{d.cant}<span style={{fontSize:10,color:'var(--txt3)'}}> × {d.ud}</span></div>
                <div className="tot-s">{d.cant*d.ud} UD</div>
              </div>
            ))}
            <div className="tot" style={{borderColor:'var(--line)',background:'var(--bg4)'}}>
              <div className="tot-l">TOTAL UD</div>
              <div className="tot-v" style={{color:'var(--txt)',fontSize:24}}>{totalUD}</div>
              <div className="tot-s">unidades de descarga</div>
            </div>
          </>
        );
      })()}
    </div>
  </div>
</>
);
}
