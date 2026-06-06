import { useRainwater } from "../context/RainwaterContext";
import { chequeoCanalLluvia } from "../utils/calcSanitary";
import { parseDecimalInput } from "../utils/parseDecimal";
import FloatingPanel, { thS, tdS, inputStyle, btnDelStyle, btnAddStyle, tableStyle } from "./FloatingPanel";

export default function PanelCanalesLluvias({ onClose }) {
  const { canalesLl, addCanalLL, delCanalLL, updCanalLL } = useRainwater();

  return (
    <FloatingPanel title="Canales cubierta" icon="🌧️" count={`${canalesLl.length} canales`} onClose={onClose} minW={620}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {['Sector','Área P','Área A','I mm/hr','C','Q LPS','n','S (%)','b','h','bl','Total','Q max','Chequeo',''].map(h=>
              <th key={h} style={thS}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {canalesLl.map(c=>{
            const { Qreal: Qr, Qmax, chequeo: chk, totalStr } = chequeoCanalLluvia(c);
            return(
              <tr key={c.id} style={{borderBottom:'1px solid #2a2c30'}}>
                <td style={tdS}><input style={inputStyle(80)} value={c.sector} onChange={e=>updCanalLL(c.id,'sector',e.target.value)}/></td>
                <td style={tdS}><input style={inputStyle(60)} defaultValue={c.areaParcial||''} key={c.id+'ap'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'areaParcial',v);}}/></td>
                <td style={tdS}><input style={inputStyle(60)} defaultValue={c.areaAcumulada||''} key={c.id+'aa'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'areaAcumulada',v);}}/></td>
                <td style={tdS}><input style={inputStyle(56)} defaultValue={c.intensidad||''} key={c.id+'in'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'intensidad',v);}}/></td>
                <td style={tdS}><input style={inputStyle(50)} defaultValue={c.coeficienteC||''} key={c.id+'cc'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'coeficienteC',v);}}/></td>
                <td style={{...tdS,fontWeight:700,fontSize:13}}>{Qr>0?Qr.toFixed(2):'—'}</td>
                <td style={tdS}><input style={inputStyle(50)} defaultValue={c.manning||''} key={c.id+'mn'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'manning',v);}}/></td>
                <td style={tdS}><input style={inputStyle(50)} defaultValue={c.pendiente||''} key={c.id+'pe'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'pendiente',v);}}/></td>
                <td style={tdS}><input style={inputStyle(50)} defaultValue={c.b||''} key={c.id+'b'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'b',v);}}/></td>
                <td style={tdS}><input style={inputStyle(50)} defaultValue={c.h||''} key={c.id+'h'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'h',v);}}/></td>
                <td style={tdS}><input style={inputStyle(50)} defaultValue={c.bl||''} key={c.id+'bl'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(c.id,'bl',v);}}/></td>
                <td style={tdS}>{totalStr}</td>
                <td style={{...tdS,fontWeight:700}}>{Qmax > 0 ? Qmax.toFixed(2) : '—'}</td>
                <td style={{...tdS,fontWeight:700,color:chk==='O.K.'?'#2ff801':'#ffb4ab'}}>{chk}</td>
                <td style={tdS}><button onClick={()=>delCanalLL(c.id)} style={btnDelStyle}>✕</button></td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={15} style={{textAlign:'center',padding:'6px 0'}}>
              <button onClick={addCanalLL} style={btnAddStyle}>+ Agregar canal</button>
            </td>
          </tr>
        </tbody>
      </table>
    </FloatingPanel>
  );
}
