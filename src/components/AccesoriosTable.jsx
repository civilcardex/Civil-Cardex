import { ACCESORIOS_HIDRO } from "./constants";

const ACCENT = { af: '#3b82f6', ac: '#ef4444' };

export default function AccesoriosTable({ tramos, updAcc, net, readOnly }) {
  const accent = ACCENT[net] || '#3b82f6';
  const cMono = "'Courier New',Courier,monospace";
  const cBg2 = '#1e293b';
  const cTxt3 = '#94a3b8';
  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t"><img src="/iconos_diseno_redes/Accesorios.webp" alt="" style={{width:20,height:20,verticalAlign:'middle',marginRight:4}} /> Accesorios</span>
        <span className="card-s">{tramos.length} tramos</span>
      </div>
      <div className="scroll-top" style={{padding:'12px'}}>
        <div className="scroll-inner" style={{minWidth:'max-content'}}>
          <table className="tbl" style={{minWidth:700,fontSize:13}}>
            <thead>
              <tr>
                <th className="col-h" style={{minWidth:64,textAlign:'center',position:'sticky',left:0,zIndex:2,background:cBg2,fontSize:11,padding:'5px 4px'}}>Tramo</th>
                {ACCESORIOS_HIDRO.map(a => (
                  <th key={a.id} className="col-h" style={{minWidth:56,fontSize:10,textAlign:'center',whiteSpace:'nowrap',padding:'5px 2px'}}>
                    <img src={a.icono} alt={a.nombre} style={{width:24,height:24,objectFit:'contain',display:'block',margin:'0 auto 2px'}} />
                    <span style={{fontSize:9,fontWeight:500}}>{a.nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tramos.map((t, i) => (
                <tr key={i}>
                  <td className="c" style={{fontSize:13,textAlign:'center',fontWeight:600,position:'sticky',left:0,background:cBg2,zIndex:1,padding:'4px 4px'}}>{t.id}</td>
                  {ACCESORIOS_HIDRO.map(a => {
                    const v = t.accesorios?.[a.id] || 0;
                    if (readOnly) {
                      return (
                        <td key={a.id} className="c" style={{padding:'4px 2px'}}>
                          <span style={{fontSize:13,fontFamily:cMono,color:v>0?'var(--txt)':'var(--txt3)'}}>{v || '—'}</span>
                        </td>
                      );
                    }
                    return (
                      <td key={a.id} className="c" style={{padding:'4px 2px'}}>
                        <input type="number" className="ni" style={{width:48,textAlign:'center',padding:'4px 4px',fontSize:13}}
                          value={v === 0 ? '' : v} min={0} step={1}
                          onChange={e => updAcc(t.id, a.id, e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}/>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {tramos.length === 0 && (
                <tr>
                  <td className="c" colSpan={1 + ACCESORIOS_HIDRO.length} style={{fontSize:12,color:cTxt3,padding:'16px 0',textAlign:'center'}}>
                    No hay tramos. Dibuja ramales en el visor para que aparezcan aqui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}