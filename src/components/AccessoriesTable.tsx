import { memo } from 'react';
import { ACCESORIOS_HIDRO } from "../constants";

function calcLe(tramo: any) {
  const d = tramo.dInt || tramo.diametro_interno || 0;
  if (!d) return null;
  const a = tramo.accesorios || {};
  const sum = (a.codos_90_std||0)*30 + (a.codos_90_rl||0)*20 + (a.te_linea||0)*20 + (a.te_ramal||0)*20 + (a.valvula_bola||0)*8;
  return Math.round(d * sum / 1000 * 100) / 100;
}

const AccesoriosTable = memo(function AccesoriosTable({ tramos, updAcc, net, readOnly }: { tramos: any[]; updAcc: (id: string, accId: string, val: any) => void; net?: string; readOnly?: boolean }) {
  const cMono = "'Courier New',Courier,monospace";
  const cBg2 = '#1e293b';
  const cTxt3 = '#94a3b8';
  return (
    <div className="card">
      <div className="card-h">
        <span className="card-t"><img src="/iconos_diseno_redes/Accesorios.webp" alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} /> Accesorios por ramal</span>
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
                <th className="col-h" style={{minWidth:80,fontSize:10,textAlign:'center',whiteSpace:'nowrap',padding:'5px 4px',borderLeft:'2px solid var(--line)'}}>
                  <span style={{fontSize:9,fontWeight:600}}>Le (m)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tramos.map((t, i) => {
                const le = calcLe(t);
                return (
                  <tr key={i}>
                    <td className="c" style={{fontSize:13,textAlign:'center',fontWeight:600,position:'sticky',left:0,background:cBg2,zIndex:1,padding:'4px 4px'}}>{t.id}</td>
                    {ACCESORIOS_HIDRO.map(a => {
                      const v = t.accesorios?.[a.id] || 0;
                      if (readOnly) {
                        return (
                          <td key={a.id} className="c" style={{padding:'4px 2px'}}>
                            <span style={{fontSize:13,fontFamily:cMono,color:v>0?'var(--txt)':'var(--txt3)'}}>{v || '\u2014'}</span>
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
                    <td className="c" style={{padding:'4px 4px',borderLeft:'2px solid var(--line)'}}>
                      <span style={{fontSize:12,fontFamily:cMono,fontWeight:600,color:le!=null&&le>0?'var(--acc2)':'var(--txt3)'}}>
                        {le!=null&&le>0?le.toFixed(2):'\u2014'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {tramos.length === 0 && (
                <tr>
                  <td className="c" colSpan={2 + ACCESORIOS_HIDRO.length} style={{fontSize:11,color:'var(--txt3)',padding:'24px 0',textAlign:'center'}}>
                    No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default AccesoriosTable;
