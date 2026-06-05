import { useSanitario } from "../context/SanitarioContext";
import { APARATOS_DEF, AF_UC_IDS, pisoCorto } from "./constants";
import { calcUCparcial, calcUCacumulado } from "./utils";
export default function CalculoUCAF() {
const { tramosAf, pisos, aps } = useSanitario();
const AP = AF_UC_IDS.map(id => {
  const a = APARATOS_DEF.find(x => x.id === id);
  if (!a) return null;
  const fromAps = aps.find(p => p.id === id);
  const merged = fromAps ? { ...a, uc_af: fromAps.ucaf || a.uc_af } : a;
  return { ...merged, _disabled: (a.uc_af || 0) === 0 };
}).filter(Boolean);

const field = 'uc_af';
const monof = "'Courier New',Courier,monospace";
const txt2 = '#94a3b8';
const txt = '#e2e8f0';

const totales = AP.map(d => ({
  id: d.id, nombre: d.nombre, uc: d.uc_af,
  cant: tramosAf.reduce((s, t) => s + ((t.fixtures?.[d.id] || 0)), 0)
}));
const totalUC = totales.reduce((s, d) => s + (d.cant || 0) * (d.uc || 0), 0);

const acumMap = calcUCacumulado(tramosAf, AP, field);

return (
<>
<div className="card">
<div className="card-h">
<span className="card-t"><img src="/iconos_diseno_redes/RAF_Calculo_UC.webp" alt="" style={{width:20,height:20,verticalAlign:'middle',marginRight:4}} /> C&aacute;lculo Unidades de Consumo Agua Fr&iacute;a</span>
<span className="card-s">{tramosAf.length} tramos</span>
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
<th className="col-h af" colSpan={AP.length} style={{textAlign:'center'}}>Aparatos</th>
<th className="col-h ok" colSpan={2} style={{textAlign:'center'}}>Unidades de Consumo</th>
<th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Lh (m)</th>
<th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>No de descarga<br/>Simult&aacute;neas</th>
</tr>
<tr>
{AP.map(d => (
<th key={d.id} className="col-h af" style={{minWidth:70,fontSize:9,textAlign:'center',whiteSpace:'nowrap',padding:'4px 2px'}}>
{d.nombre}<br/><span style={{fontSize:8,fontWeight:400}}>{d.uc_af} UC</span>
</th>
))}
<th className="col-h ok" style={{textAlign:'center'}}>Parcial</th>
<th className="col-h ok" style={{textAlign:'center'}}>Total</th>
</tr>
</thead>
<tbody>
{[...tramosAf].sort((a, b) => (a.piso || 0) - (b.piso || 0)).map((t, i) => {
const parcial = calcUCparcial(t, AP, field);
const acum = acumMap[t.id] || 0;
                  const vLh = t.Lh ?? 0;
                  const vNS = t.nSalidas ?? 0;
return (
<tr key={i}>
                  <td className="c"><span className="sigla" style={{fontSize:11}}>{t.id}</span></td>
                  <td className="c"><span style={{fontSize:11,fontFamily:monof,color:txt2}}>{pisoCorto(t.piso)}</span></td>
                  <td className="c" style={{fontFamily:monof,fontSize:11,color:txt2}}>{t.ini || '\u2014'}</td>
                  <td className="c" style={{fontFamily:monof,fontSize:11,color:txt2}}>{t.fin || '\u2014'}</td>
{AP.map(d => {
const v = t.fixtures?.[d.id] || 0;
return (
<td key={d.id} className="c" style={{padding:'2px 3px'}}>
<span style={{fontSize:12,fontFamily:monof,color:d._disabled?txt2:txt}}>{v}</span>
</td>
);
})}
<td className="c" style={{fontFamily:monof,fontWeight:700,color:txt,fontSize:13}}>{parcial}</td>
<td className="c" style={{fontFamily:monof,fontWeight:700,color:'var(--af)',fontSize:14}}>{acum}</td>
<td className="c"><span style={{fontFamily:monof,fontSize:12,color:txt2}}>{vLh > 0 ? vLh.toFixed(1) : '—'}</span></td>
<td className="c"><span style={{fontFamily:monof,fontSize:12,color:txt2}}>{vNS > 0 ? vNS : '—'}</span></td>
</tr>
);
})}
</tbody>
<tfoot>
<tr>
<td className="c" style={{fontWeight:600,fontSize:13,color:txt2,textAlign:'center',borderTop:'2px solid var(--line)'}}>∑</td>
<td colSpan={3} style={{borderTop:'2px solid var(--line)'}}></td>
{AP.map(d => {
const subtotal = (d.cant || 0) * (d.uc || 0);
return (
<td key={d.id} className="c" style={{padding:'4px 3px',borderTop:'2px solid var(--line)'}}>
<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,fontSize:10,fontFamily:monof}}>
<span style={{fontWeight:600,color:txt,fontSize:12}}>{d.cant}</span>
<span style={{color:txt2,fontSize:8}}>× {d.uc} UC</span>
<span style={{fontWeight:700,color:'var(--af)',fontSize:11}}>{subtotal}</span>
</div>
</td>
);
})}
<td colSpan={2} className="c" style={{fontWeight:700,fontSize:14,color:'var(--af)',fontFamily:monof,textAlign:'center',borderTop:'2px solid var(--line)'}}>
{totalUC} UC
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