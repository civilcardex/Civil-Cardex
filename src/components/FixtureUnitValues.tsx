import { useApparatus } from "../context/ApparatusContext";
import FloatingPanel, { thS, tdS, inputStyle, tableStyle } from "./FloatingPanel";
import { APARATO_IMG } from "../constants";

export default function PanelValoresUD({ onClose }) {
  const { udBase, setUdBase } = useApparatus();

  return (
    <FloatingPanel title="Valores base UD" icon="📊" onClose={onClose} minW={380}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thS}>Aparato</th>
            <th style={thS}>UD</th>
          </tr>
        </thead>
        <tbody>
          {udBase.map(d => (
            <tr key={d.id} style={{ borderBottom: '1px solid #2a2c30' }}>
              <td style={{...tdS, textAlign: 'left', paddingLeft: 8}}>
                <span style={{display:'flex',alignItems:'center',gap:6,color:'#e2e2e8',fontWeight:500,fontSize:12}}>
                  <span style={{fontSize:16}}>{APARATO_IMG[d.id] ? <img src={APARATO_IMG[d.id]} alt="" style={{width:20,height:20,verticalAlign:'middle'}} /> : '📋'}</span>
                  {d.nombre}
                </span>
              </td>
              <td style={tdS}>
                <input type="number" className="ni" style={inputStyle(56)}
                  value={d.ud === 0 ? '' : d.ud} step={1} min={0}
                  onChange={e => setUdBase(prev => prev.map(x => x.id === d.id ? {...x, ud: e.target.value === '' ? 0 : parseInt(e.target.value) || 0} : x))}/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </FloatingPanel>
  );
}
