import { useRainwater } from "../context/RainwaterContext";
import { chequeoBajanteLluvia } from "../utils/calcSanitary";
import { parseDecimalInput } from "../utils/parseDecimal";
import FloatingPanel, { thS, tdS, inputStyle, btnDelStyle, btnAddStyle, tableStyle } from "./FloatingPanel";
import { R_OPTIONS } from "../constants";

export default function PanelBajantesLluvias({ onClose }) {
  const { bajantesLl, addBajanteLL, delBajanteLL, updBajanteLL } = useRainwater();

  return (
    <FloatingPanel title="Bajantes agua lluvias" icon="🌧️" count={`${bajantesLl.length} bajantes`} onClose={onClose} minW={580}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {['Bajante','Área P','Área A','I mm/hr','C','R','Q LPS','n','D calc','D prop','Chequeo',''].map(h=>
              <th key={h} style={thS}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {bajantesLl.map(b=>{
            const { Q, dCalc, chequeo: chk } = chequeoBajanteLluvia(b);
            return(
              <tr key={b.id} style={{borderBottom:'1px solid #2a2c30'}}>
                <td style={tdS}><input style={inputStyle(72)} value={b.bajante} onChange={e=>updBajanteLL(b.id,'bajante',e.target.value)}/></td>
                <td style={tdS}><input style={inputStyle(60)} defaultValue={b.areaParcial||''} key={b.id+'ap'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updBajanteLL(b.id,'areaParcial',v);}}/></td>
                <td style={tdS}><input style={inputStyle(60)} defaultValue={b.areaAcumulada||''} key={b.id+'aa'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updBajanteLL(b.id,'areaAcumulada',v);}}/></td>
                <td style={tdS}><input style={inputStyle(56)} defaultValue={b.intensidad||''} key={b.id+'in'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updBajanteLL(b.id,'intensidad',v);}}/></td>
                <td style={tdS}><input style={inputStyle(50)} defaultValue={b.coeficienteC||''} key={b.id+'cc'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updBajanteLL(b.id,'coeficienteC',v);}}/></td>
                <td style={tdS}>
                  <select style={{...inputStyle(52),padding:'2px 2px'}} value={b.R} onChange={e=>updBajanteLL(b.id,'R',e.target.value)}>
                    <option value="">—</option>{R_OPTIONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td style={{...tdS,fontWeight:700,fontSize:13}}>{Q>0?Q.toFixed(2):'—'}</td>
                <td style={tdS}><input style={inputStyle(50)} defaultValue={b.manning||''} key={b.id+'mn'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updBajanteLL(b.id,'manning',v);}}/></td>
                <td style={tdS}>{dCalc > 0 ? dCalc.toFixed(2) : '—'}</td>
                <td style={tdS}><select style={{...inputStyle(56),padding:'2px 2px'}} value={b.diamPropuesto||''} onChange={e=>updBajanteLL(b.id,'diamPropuesto',e.target.value?Number(e.target.value):0)}><option value="">—</option><option value="1.5">1½"</option><option value="2">2"</option><option value="3">3"</option><option value="4">4"</option><option value="6">6"</option></select></td>
                <td style={{...tdS,fontWeight:700,color:chk==='O.K.'?'#2ff801':'#ffb4ab'}}>{chk}</td>
                <td style={tdS}><button onClick={()=>delBajanteLL(b.id)} style={btnDelStyle}>✕</button></td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={12} style={{textAlign:'center',padding:'6px 0'}}>
              <button onClick={addBajanteLL} style={btnAddStyle}>+ Agregar bajante</button>
            </td>
          </tr>
        </tbody>
      </table>
    </FloatingPanel>
  );
}
