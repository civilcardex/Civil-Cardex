import { useRainwater } from "../context/RainwaterContext";
import { chequeoCanalLluvia, chequeoBajanteLluvia } from "../utils/calcSanitary";
import { parseDecimalInput } from "../utils/parseDecimal";
import { R_OPTIONS } from "../constants";
import FloatingPanel, { thS, tdS, inputStyle, btnDelStyle, btnAddStyle, tableStyle } from "./FloatingPanel";

interface RainInputPanelProps {
  type: 'channels' | 'downpipes';
  onClose: () => void;
}

export default function RainInputPanel({ type, onClose }: RainInputPanelProps) {
  const { canalesLl, addCanalLL, delCanalLL, updCanalLL, bajantesLl, addBajanteLL, delBajanteLL, updBajanteLL } = useRainwater();

  const isChannels = type === 'channels';

  const items = isChannels ? canalesLl : bajantesLl;
  const addFn = isChannels ? addCanalLL : addBajanteLL;
  const title = isChannels ? 'Canales cubierta' : 'Bajantes agua lluvias';
  const countLabel = isChannels ? `${items.length} canales` : `${items.length} bajantes`;
  const minW = isChannels ? 620 : 580;
  const addLabel = isChannels ? '+ Agregar canal' : '+ Agregar bajante';
  const colSpan = isChannels ? 15 : 12;

  const channelHeaders = ['Sector','Área P','Área A','I mm/hr','C','Q LPS','n','S (%)','b','h','bl','Total','Q max','Chequeo',''];
  const downpipeHeaders = ['Bajante','Área P','Área A','I mm/hr','C','R','Q LPS','n','D calc','D prop','Chequeo',''];

  const headers = isChannels ? channelHeaders : downpipeHeaders;

  const renderRow = (item: any) => {
    if (isChannels) {
      const { Qreal: Qr, Qmax, chequeo: chk, totalStr } = chequeoCanalLluvia(item);
      return (
        <tr key={item.id} style={{borderBottom:'1px solid #2a2c30'}}>
          <td style={tdS}><input style={inputStyle(80)} value={item.sector} onChange={e=>updCanalLL(item.id,'sector',e.target.value)}/></td>
          <td style={tdS}><input style={inputStyle(60)} defaultValue={item.areaParcial||''} key={item.id+'ap'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'areaParcial',v);}}/></td>
          <td style={tdS}><input style={inputStyle(60)} defaultValue={item.areaAcumulada||''} key={item.id+'aa'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'areaAcumulada',v);}}/></td>
          <td style={tdS}><input style={inputStyle(56)} defaultValue={item.intensidad||''} key={item.id+'in'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'intensidad',v);}}/></td>
          <td style={tdS}><input style={inputStyle(50)} defaultValue={item.coeficienteC||''} key={item.id+'cc'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'coeficienteC',v);}}/></td>
          <td style={{...tdS,fontWeight:700,fontSize:13}}>{Qr>0?Qr.toFixed(2):'—'}</td>
          <td style={tdS}><input style={inputStyle(50)} defaultValue={item.manning||''} key={item.id+'mn'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'manning',v);}}/></td>
          <td style={tdS}><input style={inputStyle(50)} defaultValue={item.pendiente||''} key={item.id+'pe'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'pendiente',v);}}/></td>
          <td style={tdS}><input style={inputStyle(50)} defaultValue={item.b||''} key={item.id+'b'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'b',v);}}/></td>
          <td style={tdS}><input style={inputStyle(50)} defaultValue={item.h||''} key={item.id+'h'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'h',v);}}/></td>
          <td style={tdS}><input style={inputStyle(50)} defaultValue={item.bl||''} key={item.id+'bl'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updCanalLL(item.id,'bl',v);}}/></td>
          <td style={tdS}>{totalStr}</td>
          <td style={{...tdS,fontWeight:700}}>{Qmax > 0 ? Qmax.toFixed(2) : '—'}</td>
          <td style={{...tdS,fontWeight:700,color:chk==='O.K.'?'#2ff801':'#ffb4ab'}}>{chk}</td>
          <td style={tdS}><button onClick={()=>delCanalLL(item.id)} style={btnDelStyle}>✕</button></td>
        </tr>
      );
    } else {
      const { Q, dCalc, chequeo: chk } = chequeoBajanteLluvia({ ...item, coeficienteC: 0.0278 });
      return (
        <tr key={item.id} style={{borderBottom:'1px solid #2a2c30'}}>
          <td style={tdS}><input style={inputStyle(72)} value={item.bajante} onChange={e=>updBajanteLL(item.id,'bajante',e.target.value)}/></td>
          <td style={tdS}><input style={inputStyle(60)} defaultValue={item.areaParcial||''} key={item.id+'ap'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updBajanteLL(item.id,'areaParcial',v);}}/></td>
          <td style={tdS}><input style={inputStyle(60)} defaultValue={item.areaAcumulada||''} key={item.id+'aa'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updBajanteLL(item.id,'areaAcumulada',v);}}/></td>
          <td style={tdS}><input style={inputStyle(56)} defaultValue={item.intensidad||''} key={item.id+'in'} onChange={e=>{const v=parseDecimalInput(e.target.value);if(v!==null)updBajanteLL(item.id,'intensidad',v);}}/></td>
          <td style={tdS}><input style={inputStyle(50)} value="0.0278" readOnly disabled /></td>
          <td style={tdS}>
            <select style={{...inputStyle(52),padding:'2px 2px'}} value={item.R} onChange={e=>updBajanteLL(item.id,'R',e.target.value)}>
              <option value="">—</option>{R_OPTIONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </td>
          <td style={{...tdS,fontWeight:700,fontSize:13}}>{Q>0?Q.toFixed(2):'—'}</td>
          <td style={tdS}><input style={inputStyle(50)} value="0.009" readOnly disabled /></td>
          <td style={tdS}>{dCalc > 0 ? dCalc.toFixed(2) : '—'}</td>
          <td style={tdS}><select style={{...inputStyle(56),padding:'2px 2px'}} value={item.diamPropuesto||''} onChange={e=>updBajanteLL(item.id,'diamPropuesto',e.target.value?Number(e.target.value):0)}><option value="">—</option><option value="1.5">1½"</option><option value="2">2"</option><option value="3">3"</option><option value="4">4"</option><option value="6">6"</option></select></td>
          <td style={{...tdS,fontWeight:700,color:chk==='O.K.'?'#2ff801':'#ffb4ab'}}>{chk}</td>
          <td style={tdS}><button onClick={()=>delBajanteLL(item.id)} style={btnDelStyle}>✕</button></td>
        </tr>
      );
    }
  };

  return (
    <FloatingPanel title={title} icon="🌧️" count={countLabel} onClose={onClose} minW={minW}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {headers.map(h=>
              <th key={h} style={thS}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={colSpan} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>
                No hay {isChannels ? 'canales' : 'bajantes'}. Presiona "+ Agregar" para empezar.
              </td>
            </tr>
          ) : items.map(renderRow)}
          <tr>
            <td colSpan={colSpan} style={{textAlign:'center',padding:'6px 0'}}>
              <button onClick={addFn} style={btnAddStyle}>{addLabel}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </FloatingPanel>
  );
}
