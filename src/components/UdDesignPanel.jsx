import { useSanitario } from "../context/SanitarioContext";
import { calcUDparcial, calcUDacumulado } from "./utils";
import { pisoCorto } from "./constants";
import FloatingPanel, { thS, tdS, inputStyle, btnDelStyle, btnAddStyle, tableStyle } from "./FloatingPanel";

export default function DisenoUDPanel({ onClose }) {
  const { tramosSan, udBase, pisos, addTramoSan, delTramoSan, updTramoSan, updTramoSanFix } = useSanitario();

  const pisosSelect = pisos.filter(p => p.tipo !== 'cubierta');

  const acumMap = calcUDacumulado(tramosSan, udBase);
  const colCount = 2 + udBase.length + 2 + 1 + 1;

  return (
    <FloatingPanel title="Diseño UD por tramos" icon="📊" count={`${tramosSan.length} tramos`} onClose={onClose} minW={520}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thS}>Tramo</th>
            <th style={thS}>Nivel</th>
            {udBase.map(d => (
              <th key={d.id} style={{...thS, minWidth: 44}}>
                {d.nombre}<br/>
                <span style={{fontSize:8,fontWeight:400,color:'#849495'}}>{d.ud} UD</span>
              </th>
            ))}
            <th style={thS}>Parc.</th>
            <th style={thS}>Total</th>
            <th style={thS}>Bajante</th>
            <th style={{...thS, width: 30}}></th>
          </tr>
        </thead>
        <tbody>
          {tramosSan.map((t) => {
            const parcial = calcUDparcial(t, udBase);
            const acum = acumMap[t.id] || 0;
            return (
              <tr key={t.id} style={{ borderBottom: '1px solid #2a2c30' }}>
                <td style={tdS}>
                  <input className="ni" style={inputStyle(56)} value={t.id} onChange={e=>updTramoSan(t.id,'id',e.target.value)}/>
                </td>
                <td style={tdS}>
                  <select className="ni" style={{...inputStyle(44), padding:'2px 3px'}} value={t.piso} onChange={e=>updTramoSan(t.id,'piso',parseInt(e.target.value))}>
                    {pisosSelect.map(p=><option key={p.id} value={p.n}>{pisoCorto(p.n)}</option>)}
                  </select>
                </td>
                {udBase.map(d=>(
                  <td key={d.id} style={{...tdS, padding:'2px 2px'}}>
                    <input type="number" className="ni" style={{...inputStyle(40), padding:'2px 3px'}}
                      value={t.fixtures[d.id]===0?'':t.fixtures[d.id]??''} min={0}
                      onChange={e=>updTramoSanFix(t.id,d.id,e.target.value===''?0:parseInt(e.target.value)||0)}/>
                  </td>
                ))}
                <td style={{...tdS, fontWeight:700, color:'#e2e2e8', fontSize:12}}>{parcial}</td>
                <td style={{...tdS, fontWeight:700, color:'#e2e2e8', fontSize:13}}>{acum}</td>
                <td style={{...tdS, textAlign:'center'}}>
                  <input type="checkbox" checked={t.esBajante||false} onChange={e=>updTramoSan(t.id,'esBajante',e.target.checked)} style={{cursor:'pointer',width:14,height:14,accentColor:'#2563EB'}}/>
                </td>
                <td style={{...tdS, textAlign:'center'}}>
                  <button onClick={()=>delTramoSan(t.id)} style={btnDelStyle}>✕</button>
                </td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={colCount} style={{ padding: '6px 0', textAlign: 'center' }}>
              <button onClick={addTramoSan} style={btnAddStyle}>+ Agregar tramo</button>
            </td>
          </tr>
        </tbody>
      </table>
    </FloatingPanel>
  );
}
