import { useTramos } from "../context/TramosContext";
import { useApparatus } from "../context/ApparatusContext";
import { APARATOS_DEF, AF_UC_IDS, AC_UC_IDS, pisoCorto } from "../constants";
import { calcUCparcial, calcUCacumulado } from "../utils/componentHelpers";

interface CalculoUCProps {
  tipo: 'af' | 'ac';
}

const monof = "'Courier New',Courier,monospace";
const txt2 = '#94a3b8';
const txt = '#e2e8f0';

export default function CalculoUC({ tipo }: CalculoUCProps) {
  const { tramosAf, tramosAc } = useTramos();
  const { aps } = useApparatus();
  const tramos = tipo === 'af' ? tramosAf : tramosAc;
  const ucIds = tipo === 'af' ? AF_UC_IDS : AC_UC_IDS;
  const field = tipo === 'af' ? 'uc_af' : 'uc_ac';
  const apField = tipo === 'af' ? 'ucaf' : 'ucac';
  const colorVar = tipo === 'af' ? 'var(--af)' : 'var(--ac)';
  const clsHeader = tipo === 'af' ? 'af' : 'ac';
  const icon = tipo === 'af' ? '/iconos_diseno_redes/hidraulica/RAF_Calculo_UC.webp' : '/iconos_diseno_redes/hidraulica/RAC_Calculo_UC.webp';
  const title = tipo === 'af' ? 'agua fr\u00EDa' : 'agua caliente';
  const showTotal = tipo === 'af';

  const AP = ucIds.map(id => {
    const a = APARATOS_DEF.find(x => x.id === id);
    if (!a) return null;
    const fromAps = aps.find(p => p.id === id);
    const merged = fromAps ? { ...a, [field]: fromAps[apField] || a[field] } : a;
    return { ...merged, _disabled: (a[field] || 0) === 0 };
  }).filter((x): x is NonNullable<typeof x> => x != null);

  const totales = AP.map(d => ({
    id: d!.id, nombre: d!.nombre, uc: (d as any)[field],
    cant: tramos.reduce((s, t) => s + ((t.fixtures?.[d!.id] || 0)), 0)
  }));
  const totalUC = totales.reduce((s, d) => s + (d.cant || 0) * (d.uc || 0), 0);

  const acumMap = showTotal ? calcUCacumulado(tramos, AP as any, field) : {};

  return (
    <>
      <div className="card">
        <div className="card-h">
          <span className="card-t"><img src={icon} alt="" style={{width:24,height:24,verticalAlign:'middle',marginRight:4}} /> Cálculo de unidades de consumo {title}</span>
          <span className="card-s">{tramos.length} tramos</span>
        </div>
        <div className="scroll-top" style={{padding:'16px'}}>
          <div className="scroll-inner" style={{minWidth:'max-content'}}>
            <table className="tbl" style={{minWidth:800}}>
              <thead>
                <tr>
                  <th className="col-h" rowSpan={2} style={{minWidth:64,textAlign:'center'}}>Tramo</th>
                  <th className="col-h" rowSpan={2} style={{minWidth:44,textAlign:'center'}}>Nivel</th>
                  <th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Inicia</th>
                  <th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Termina</th>
                  <th className={`col-h ${clsHeader}`} colSpan={AP.length} style={{textAlign:'center'}}>Aparatos</th>
                  {showTotal ? (
                    <th className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Unidades de Consumo</th>
                  ) : (
                    <th className="col-h ok" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Parcial</th>
                  )}
                  <th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Lh (m)</th>
                  <th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>No de descarga<br/>Simultáneas</th>
                </tr>
                <tr>
                  {AP.map(d => (
                    <th key={d!.id} className={`col-h ${clsHeader}`} style={{minWidth:70,fontSize:9,textAlign:'center',whiteSpace:'nowrap',padding:'4px 2px'}}>
                      {d!.nombre}<br/><span style={{fontSize:8,fontWeight:400}}>{(d as any)[field]} UC</span>
                    </th>
                  ))}
                  {showTotal && (
                    <>
                      <th className="col-h ok" style={{textAlign:'center'}}>Parcial</th>
                      <th className="col-h ok" style={{textAlign:'center'}}>Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tramos.length === 0 ? (
                  <tr>
                    <td colSpan={showTotal ? 4 + AP.length + 2 + 2 : 4 + AP.length + 3} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                ) : [...tramos].sort((a, b) => (a.piso || 0) - (b.piso || 0)).map((t, i) => {
                  const parcial = calcUCparcial(t, AP as any, field);
                  const acum = showTotal ? (acumMap[t.id] || 0) : 0;
                  const vLh = t.Lh ?? 0;
                  const vNS = t.nSalidas ?? 0;
                  return (
                    <tr key={i}>
                      <td className="c"><span className="sigla" style={{fontSize:11}}>{t.id}</span></td>
                      <td className="c"><span style={{fontSize:11,fontFamily:monof,color:txt2}}>{pisoCorto(t.piso)}</span></td>
                      <td className="c" style={{fontFamily:monof,fontSize:11,color:txt2}}>{t.ini || '\u2014'}</td>
                      <td className="c" style={{fontFamily:monof,fontSize:11,color:txt2}}>{t.fin || '\u2014'}</td>
                      {AP.map(d => {
                        const v = t.fixtures?.[d!.id] || 0;
                        return (
                          <td key={d!.id} className="c" style={{padding:'2px 3px'}}>
                            <span style={{fontSize:12,fontFamily:monof,color:(d as any)._disabled?txt2:txt}}>{v}</span>
                          </td>
                        );
                      })}
                      <td className="c" style={{fontFamily:monof,fontWeight:700,color:txt,fontSize:13}}>{parcial}</td>
                      {showTotal && (
                        <td className="c" style={{fontFamily:monof,fontWeight:700,color:colorVar,fontSize:14}}>{acum}</td>
                      )}
                      <td className="c"><span style={{fontFamily:monof,fontSize:12,color:txt2}}>{vLh > 0 ? vLh.toFixed(1) : '\u2014'}</span></td>
                      <td className="c"><span style={{fontFamily:monof,fontSize:12,color:txt2}}>{vNS > 0 ? vNS : '\u2014'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="c" style={{fontWeight:600,fontSize:13,color:txt2,textAlign:'center',borderTop:'2px solid var(--line)'}}>&sum;</td>
                  <td colSpan={3} style={{borderTop:'2px solid var(--line)'}}></td>
                  {totales.map(d => {
                    const subtotal = (d.cant || 0) * (d.uc || 0);
                    return (
                      <td key={d.id} className="c" style={{padding:'4px 3px',borderTop:'2px solid var(--line)'}}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,fontSize:10,fontFamily:monof}}>
                          <span style={{fontWeight:600,color:txt,fontSize:12}}>{d.cant}</span>
                          <span style={{color:txt2,fontSize:8}}>&times; {d.uc} UC</span>
                          {showTotal && (
                            <span style={{fontWeight:700,color:colorVar,fontSize:11}}>{subtotal}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {showTotal ? (
                    <td colSpan={2} className="c" style={{fontWeight:700,fontSize:14,color:colorVar,fontFamily:monof,textAlign:'center',borderTop:'2px solid var(--line)'}}>
                      {totalUC} UC
                    </td>
                  ) : (
                    <>
                      <td style={{borderTop:'2px solid var(--line)'}}></td>
                      <td className="c" style={{fontWeight:700,fontSize:14,color:txt,fontFamily:monof,textAlign:'center',borderTop:'2px solid var(--line)'}}>
                        {totalUC} UC
                      </td>
                    </>
                  )}
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
