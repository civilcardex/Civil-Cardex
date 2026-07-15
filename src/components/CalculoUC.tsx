import React, { useMemo } from "react";
import { useTramos } from "../context/TramosContext";
import { useApparatus } from "../context/ApparatusContext";
import { APARATOS_DEF, AF_UC_IDS, AC_UC_IDS, pisoCorto } from "../constants";
import { calcUCparcial, calcUCacumulado } from "../utils/componentHelpers";
const CalculoUC_S1: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };


interface CalculoUCProps {
  tipo: 'af' | 'ac';
}

const monof = "'Courier New',Courier,monospace";
const txt2 = '#94a3b8';
const txt = '#e2e8f0';

function CalculoUC({ tipo }: CalculoUCProps) {
  const { tramosAf, tramosAc } = useTramos();
  const { aps } = useApparatus();
  const TIPO_CFG = {
    af: {
      tramos: tramosAf, ucIds: AF_UC_IDS, field: 'uc_af', apField: 'ucaf',
      colorVar: 'var(--af)', clsHeader: 'af',
      icon: '/iconos_diseno_redes/hidraulica/RAF_Calculo_UC.webp',
      title: 'agua fr\u00EDa', showTotal: true,
    },
    ac: {
      tramos: tramosAc, ucIds: AC_UC_IDS, field: 'uc_ac', apField: 'ucac',
      colorVar: 'var(--ac)', clsHeader: 'ac',
      icon: '/iconos_diseno_redes/hidraulica/RAC_Calculo_UC.webp',
      title: 'agua caliente', showTotal: false,
    },
  } as const;
  const { tramos, ucIds, field, apField, colorVar, clsHeader, icon, title, showTotal } = TIPO_CFG[tipo];

  const AP = useMemo(() => {
    return ucIds.map(id => {
      const a = APARATOS_DEF.find(x => x.id === id);
      if (!a) return null;
      const fromAps = aps.find(p => p.id === id);
      const merged = fromAps ? { ...a, [field]: fromAps[apField] || a[field] } : a;
      return { ...merged, _disabled: (a[field] || 0) === 0 };
    }).filter((x): x is NonNullable<typeof x> => x != null);
  }, [ucIds, aps, field, apField]);

  const totales = useMemo(() => {
    return AP.map(d => ({
      id: d.id, nombre: d.nombre, uc: (d as any)[field],
      cant: tramos.reduce((s, t) => s + ((t.fixtures?.[d.id] || 0)), 0)
    }));
  }, [AP, tramos, field]);

  const totalUC = useMemo(() => {
    return totales.reduce((s, d) => s + (d.cant || 0) * (d.uc || 0), 0);
  }, [totales]);

  const acumMap = useMemo(() => {
    return showTotal ? calcUCacumulado(tramos, AP as any, field) : {};
  }, [showTotal, tramos, AP, field]);

  const sortedTramos = useMemo(() => {
    return tramos.toSorted((a, b) => (a.piso || 0) - (b.piso || 0));
  }, [tramos]);

  return (
    <>
      <section className="card">
        <div className="card-h">
          <h3 className="card-t"><img src={icon} alt={`${title}`}  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle',marginRight:4}}  loading="lazy" /> Cálculo de unidades de consumo {title}</h3>
          <span className="card-s">{tramos.length} tramos</span>
        </div>
        <div className="scroll-top" style={{padding:'16px'}}>
          <div className="scroll-inner" style={{minWidth:'max-content'}}>
            <table className="tbl" style={{minWidth:800}}>
              <caption style={CalculoUC_S1}>{`Cálculo de unidades de consumo ${title}`}</caption>
              <thead>
                <tr>
                  <th scope="col" className="col-h" rowSpan={2} style={{minWidth:64,textAlign:'center'}}>Tramo</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{minWidth:44,textAlign:'center'}}>Nivel</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{minWidth:44,textAlign:'center',padding:'4px'}}>Inicio</th>
                  <th scope="col" className="col-h" rowSpan={2} style={{minWidth:44,textAlign:'center',padding:'4px'}}>Fin</th>
                  <th scope="col" className={`col-h ${clsHeader}`} colSpan={AP.length} style={{textAlign:'center',padding:'4px'}}>Aparatos</th>
                  {showTotal ? (
                    <th scope="col" className="col-h ok" colSpan={2} style={{textAlign:'center',padding:'4px'}}>Unidades de consumo</th>
                  ) : (
                    <th scope="col" className="col-h ok" rowSpan={2} style={{minWidth:52,textAlign:'center',padding:'4px'}}>Parcial</th>
                  )}
                  {showTotal && <th scope="col" className="col-h" rowSpan={2} style={{minWidth:44,textAlign:'center',padding:'4px'}}>Longitud (m)</th>}
                  {showTotal && <th scope="col" className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center',padding:'4px'}}>No de descarga<br/>Simultáneas</th>}
                </tr>
                <tr>
                  {AP.map(d => (
                    <th key={d.id} className={`col-h ${clsHeader}`} style={{minWidth:70,fontSize: 12,textAlign:'center',whiteSpace:'nowrap',padding:'4px 2px'}}>
                      {d.nombre}<br/><span style={{fontSize: 12,fontWeight:400}}>{(d as any)[field]} UC</span>
                    </th>
                  ))}
                  {showTotal && (
                    <>
                      <th scope="col" className="col-h ok" style={{textAlign:'center'}}>Parcial</th>
                      <th scope="col" className="col-h ok" style={{textAlign:'center'}}>Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tramos.length === 0 ? (
                  <tr>
                    <td colSpan={showTotal ? 4 + AP.length + 2 + 2 : 4 + AP.length + 3} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 12 }}>
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                ) : sortedTramos.map((t, i) => {
                  const parcial = calcUCparcial(t, AP as any, field);
                  const acum = showTotal ? (acumMap[t.id] || 0) : 0;
                  const vLh = t.totalL || t.Lh || 0;
                  const vNS = t.nSalidas ?? 0;
                  return (
                    <tr key={i}>
                      <td className="c"><span className="sigla" style={{fontSize: 12}}>{t.id}</span></td>
                      <td className="c"><span style={{fontSize: 12,fontFamily:monof,color:txt2}}>{pisoCorto(t.piso)}</span></td>
                      <td className="c" style={{fontFamily:monof,fontSize: 12,color:txt2,padding:'2px 4px'}}>{t.ini && typeof t.ini === 'object' ? `${t.ini.x},${t.ini.y}` : t.ini || '\u2014'}</td>
                      <td className="c" style={{fontFamily:monof,fontSize: 12,color:txt2,padding:'2px 4px'}}>{t.fin && typeof t.fin === 'object' ? `${t.fin.x},${t.fin.y}` : t.fin || '\u2014'}</td>
                      {AP.map(d => {
                        const v = t.fixtures?.[d.id] || 0;
                        return (
                          <td key={d.id} className="c" style={{padding:'2px 3px'}}>
                            <span style={{fontSize:12,fontFamily:monof,color:(d as any)._disabled?txt2:txt}}>{v}</span>
                          </td>
                        );
                      })}
                      <td className="c" style={{fontFamily:monof,fontWeight:700,color:txt,fontSize:13}}>{parcial}</td>
                      {showTotal && (
                        <td className="c" style={{fontFamily:monof,fontWeight:700,color:colorVar,fontSize:14}}>{acum}</td>
                      )}
                      {showTotal && <td className="c" style={{padding:'2px 4px'}}><span style={{fontFamily:monof,fontSize:12,color:txt2}}>{vLh > 0 ? vLh.toFixed(2) : '\u2014'}</span></td>}
                      {showTotal && <td className="c" style={{padding:'2px 4px'}}><span style={{fontFamily:monof,fontSize:12,color:txt2}}>{vNS > 0 ? vNS : '\u2014'}</span></td>}
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
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,fontSize: 12,fontFamily:monof}}>
                          <span style={{fontWeight:600,color:txt,fontSize:12}}>{d.cant}</span>
                          <span style={{color:txt2,fontSize: 12}}>&times; {d.uc} UC</span>
                          {showTotal && (
                            <span style={{fontWeight:700,color:colorVar,fontSize: 12}}>{subtotal}</span>
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
                    <td className="c" style={{fontWeight:700,fontSize:14,color:txt,fontFamily:monof,textAlign:'center',borderTop:'2px solid var(--line)'}}>
                      {totalUC} UC
                    </td>
                  )}
                  {showTotal && <td colSpan={2} style={{borderTop:'2px solid var(--line)'}}></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
export default React.memo(CalculoUC);