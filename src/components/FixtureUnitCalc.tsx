import React from "react";
import { useTramos } from "../context/TramosContext";
import { useApparatus } from "../context/ApparatusContext";
import { calcUDparcial, calcUDacumulado } from "../utils/componentHelpers";
import { pisoCorto, APARATOS_DEF, SAN_UC_IDS } from "../constants";
import { getTributarioIds } from "../utils/tramoUtils";

function CalculoUD() {
const { tramosSan, updTramoSan } = useTramos();
const { aps } = useApparatus();
const mergedBase = SAN_UC_IDS.map(id => {
  const fromAps = aps.find(p => p.id === id);
  const def = APARATOS_DEF.find(x => x.id === id);
  return { id, nombre: def?.nombre || id, ud: fromAps?.ud || def?.ud || 0, _disabled: (def?.ud || 0) === 0 };
});
const acumMap = calcUDacumulado(tramosSan, mergedBase);

const tribIds = getTributarioIds(tramosSan);
const displayTramos = tramosSan.filter(t => !tribIds.has(t.id) && !t.esBajante)
  .sort((a, b) => (a.piso || 0) - (b.piso || 0));

const totales = mergedBase.map(d => ({
  id: d.id, nombre: d.nombre, ud: d.ud,
  cant: tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0)
}));
const totalUD = totales.reduce((s, d) => s + (d.cant || 0) * (d.ud || 0), 0);

return (
<>
  <div className="card">
    <div className="card-h">
      <span className="card-t"><img src="/iconos_diseno_redes/sanitaria/RS_Calculo_UC.webp" alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Cálculo de unidades de descarga</span>
      <span className="card-s">{tramosSan.length} tramos</span>
    </div>
    <div className="scroll-top" style={{padding:'16px'}}>
      <div className="scroll-inner" style={{minWidth:'max-content'}}>
        <table className="tbl" style={{minWidth:900}}>
          <thead>
            <tr>
              <th className="col-h" rowSpan={2} style={{minWidth:70,textAlign:'center'}}>Tramo</th>
              <th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Nivel</th>
              <th className="col-h" rowSpan={2} style={{minWidth:60,textAlign:'center'}}>Inicio</th>
              <th className="col-h" rowSpan={2} style={{minWidth:60,textAlign:'center'}}>Fin</th>
              <th className="col-h san" colSpan={mergedBase.length} style={{textAlign:'center'}}>Aparatos</th>
              <th className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Unidades de Descarga</th>
              <th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Bajante</th>
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
{displayTramos.length === 0 ? (
              <tr>
                <td colSpan={4 + mergedBase.length + 3} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                  No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                </td>
              </tr>
) : displayTramos.map((t) => {
const parcial=calcUDparcial(t,mergedBase);
const acum=acumMap[t.id]||0;
              return(
                <tr key={t.id}>
                  <td className="c"><span className="sigla" style={{fontSize:11,fontWeight:600}}>{t.id}</span></td>
                  <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt2)'}}>{pisoCorto(t.piso)}</span></td>
                  <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt)'}}>{t.ini ? `${t.ini.x},${t.ini.y}` : '—'}</span></td>
                  <td className="c"><span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--txt)'}}>{t.fin ? `${t.fin.x},${t.fin.y}` : '—'}</span></td>
                  {mergedBase.map(d=>(
                    <td key={d.id} className="c" style={{padding:'2px 3px'}}>
                      <span style={{fontSize:12,fontFamily:'var(--mono)',color:d._disabled?'var(--txt3)':'var(--txt)'}}>{t.fixtures[d.id]??0}</span>
                    </td>
                  ))}
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--txt)',fontSize:13}}>{parcial}</td>
                  <td className="c" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--txt)',fontSize:14}}>{acum}</td>
                  <td className="c">
                    <input type="checkbox" checked={!!t.esBajante} onChange={e=>updTramoSan(t.id,'esBajante',e.target.checked)} style={{width:16,height:16,cursor:'pointer',accentColor:'var(--san)'}} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="c" style={{fontWeight:600,fontSize:13,color:'var(--txt3)',textAlign:'center',borderTop:'2px solid var(--line)'}}>∑</td>
              <td style={{borderTop:'2px solid var(--line)'}}></td>
              <td style={{borderTop:'2px solid var(--line)'}}></td>
              <td style={{borderTop:'2px solid var(--line)'}}></td>
              {totales.map(d => {
                const subtotal = (d.cant || 0) * (d.ud || 0);
                return (
                  <td key={d.id} className="c" style={{padding:'4px 3px',borderTop:'2px solid var(--line)'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,fontSize:10,fontFamily:'var(--mono)'}}>
                      <span style={{fontWeight:600,color:'var(--txt)',fontSize:12}}>{d.cant}</span>
                      <span style={{color:'var(--txt3)',fontSize:8}}>× {d.ud} UD</span>
                      <span style={{fontWeight:700,color:'var(--san)',fontSize:11}}>{subtotal}</span>
                    </div>
                  </td>
                );
              })}
              <td style={{borderTop:'2px solid var(--line)'}}></td>
              <td className="c" style={{fontWeight:700,fontSize:14,color:'var(--txt)',fontFamily:'var(--mono)',textAlign:'center',borderTop:'2px solid var(--line)'}}>
                {totalUD} UD
              </td>
              <td style={{borderTop:'2px solid var(--line)'}}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</>
  );
}
export default React.memo(CalculoUD);