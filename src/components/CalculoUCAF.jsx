import { useSanitario } from "../context/SanitarioContext";
import { APARATOS_DEF, AF_UC_IDS } from "./constants";
import { calcUCparcial, calcUCacumulado } from "./utils";
import AccesoriosTable from "./AccesoriosTable";

export default function CalculoUCAF() {
const { tramosAf, pisos, updTramoAfFix, updTramoAfHidro, updTramoAfAcc, aps } = useSanitario();
const AP = AF_UC_IDS.map(id => {
  const a = APARATOS_DEF.find(x => x.id === id);
  if (!a) return null;
  const fromAps = aps.find(p => p.id === id);
  const merged = fromAps ? { ...a, uc_af: fromAps.ucaf ?? a.uc_af } : a;
  return { ...merged, _disabled: (a.uc_af || 0) === 0 };
}).filter(Boolean);

const field = 'uc_af';
const monof = "'Courier New',Courier,monospace";
const txt2 = '#94a3b8';
const txt = '#e2e8f0';

return (
<>
<div className="card">
<div className="card-h">
<span className="card-t">📊 C&aacute;lculo Unidades de Consumo Agua Fr&iacute;a</span>
<span className="card-s">{tramosAf.length} tramos</span>
</div>
<div className="scroll-top" style={{padding:'16px'}}>
<div className="scroll-inner" style={{minWidth:'max-content'}}>
<table className="tbl" style={{minWidth:800}}>
<thead>
<tr>
<th className="col-h" rowSpan={2} style={{minWidth:64,textAlign:'center'}}>Tramo</th>
<th className="col-h" rowSpan={2} style={{minWidth:44,textAlign:'center'}}>Piso</th>
<th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Inicia</th>
<th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Termina</th>
<th className="col-h af" colSpan={AP.length} style={{textAlign:'center'}}>Aparatos</th>
<th className="col-h ok" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Parcial</th>
<th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>Lh (m)</th>
<th className="col-h" rowSpan={2} style={{minWidth:52,textAlign:'center'}}>No de salida<br/>Simult&aacute;neas</th>
</tr>
<tr>
{AP.map(d => (
<th key={d.id} className="col-h af" style={{minWidth:70,fontSize:9,textAlign:'center',whiteSpace:'nowrap',padding:'4px 2px'}}>
{d.nombre}<br/><span style={{fontSize:8,fontWeight:400}}>{d.uc_af} UC</span>
</th>
))}
</tr>
</thead>
<tbody>
{tramosAf.map((t, i) => {
const parcial = calcUCparcial(t, AP, field);
const vLh = t.Lh ?? 0;
const vNS = t.nSalidas ?? 0;
const desde = t.recibeDe?.[0] || '';
const hasta = t.id;
return (
<tr key={i}>
<td className="c"><input className="ni" style={{width:58,padding:'3px 6px',fontSize:11,textAlign:'center'}} value={t.id} disabled/></td>
<td className="c">
<select className="ni" style={{width:44,padding:'3px 4px',fontSize:11,textAlign:'center'}} value={t.piso} onChange={e => updTramoAfHidro(t.id, 'piso', parseInt(e.target.value))}>
{pisos.filter(p => p.tipo !== 'cubierta').map(p => <option key={p.id} value={p.n}>{p.n}</option>)}
</select>
</td>
<td className="c" style={{fontFamily:monof,fontSize:11,color:txt2}}>{desde || '\u2014'}</td>
<td className="c" style={{fontFamily:monof,fontSize:11,color:txt2}}>{hasta}</td>
{AP.map(d => {
const v = t.fixtures?.[d.id] || 0;
return (
<td key={d.id} className="c" style={{padding:'2px 3px'}}>
                <input type="number" className="ni" style={{width:40,textAlign:'center',padding:'3px 4px',fontSize:12}}
                  value={v} min={0} disabled={d._disabled}
                  onChange={e => updTramoAfFix(t.id, d.id, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}/>
</td>
);
})}
<td className="c" style={{fontFamily:monof,fontWeight:700,color:txt,fontSize:13}}>{parcial}</td>
<td className="c">
<input type="number" className="ni" style={{width:48,textAlign:'center',padding:'3px 4px',fontSize:12}}
                  value={vLh} min={0} step={0.1}
                  onChange={e => updTramoAfHidro(t.id, 'Lh', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}/>
              </td>
              <td className="c">
                <input type="number" className="ni" style={{width:42,textAlign:'center',padding:'3px 4px',fontSize:12}}
                  value={vNS} min={0}
onChange={e => updTramoAfHidro(t.id, 'nSalidas', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}/>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>
</div>
<AccesoriosTable tramos={tramosAf} updAcc={updTramoAfAcc} net="af" />
</>
);
}