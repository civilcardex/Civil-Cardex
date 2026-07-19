import PlanoEngine, { type ElementItem } from "../../lib/PlanoEngine/PlanoEngine";
import type { PlanoElement } from "../../lib/PlanoEngine/PlanoState";
const PdfViewerDrawnElements_S1: React.CSSProperties = { padding:'6px 8px',background:'transparent',border:'1px solid #3a494a',borderRadius:2,color:'#ffb4ab',cursor:'pointer',fontSize: 12,fontFamily:"'Geist',monospace",flexShrink:0,lineHeight:1 };


interface PdfViewerDrawnElementsProps {
  drawnElements: ElementItem[];
  activeNet: string;
  selElement: PlanoElement | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
}

export default function PdfViewerDrawnElements({ drawnElements, activeNet, selElement, engineRef }: PdfViewerDrawnElementsProps) {
  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
        Trazos de red ({drawnElements.length})
      </div>
      {drawnElements.length===0 ? (
        <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",padding:'4px 0'}}>
          Ningún trazo dibujado en esta red
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:3}}>
          {drawnElements.map(el=>(
            <div key={el.id}
              style={{
                padding:'6px 8px',background:selElement?.id===el.id?'#2563EB22':'#1a1c20',
                borderRadius:3,cursor:'pointer',border:`1px solid ${selElement?.id===el.id?'rgba(37,99,235,.4)':'#3a494a'}`,
                display:'flex',flexDirection:'column',gap:4,
              }}>
              <div role="button" tabIndex={0} aria-label={`Seleccionar elemento ${el.id}`} aria-current={el.id === selElement?.id ? 'true' : undefined} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();engineRef.current?.selectById(el.id);}}} style={{display:'flex',alignItems:'center',gap:4}} onClick={()=>{if(engineRef.current)engineRef.current.selectById(el.id);}}>
                <span style={{fontSize: 12,color:el.tipo==='montante'?'#3B82F6':el.type==='bajante'?'#F04545':'#4D8FF7'}}>
                  {el.tipo==='montante'?'\u2B06':el.type==='bajante'?'\u2B07':'\u2571'}
                </span>
                <span style={{fontSize:12,fontWeight:600,color:'#b9caca',fontFamily:"'Geist',monospace",flex:1}}>{el.tipo==='tributario'?((()=>{try{const p=drawnElements.find(x=>x.id===el.padre&&x.tipo==='ramal');return p?p.label:el.label;}catch{return el.label}})()):el.label}</span>
                <span style={{fontSize: 12,fontWeight:600,color:'#8AB4D6',fontFamily:"'Geist',monospace",textTransform:'uppercase'}}>{(el.tipo==='ramal'?'ramal':el.tipo==='tributario'?el.label:el.tipo==='bajante'?'baj':el.tipo==='montante'?'mon':el.tipo)||''}</span>
                <button type="button" onClick={e=>{e.stopPropagation();if(engineRef.current){engineRef.current.selectById(el.id);engineRef.current.deleteSelected();}}}
                  style={PdfViewerDrawnElements_S1}>{'\u2715'}</button>
              </div>
              <div style={{
                display:'flex',flexWrap:'wrap',gap:'2px 8px',fontSize: 12,
                color:'#8AB4D6',fontFamily:"'Geist',monospace",paddingLeft:17
              }}>
                <span>L={typeof el.totalL==='number'?el.totalL.toFixed(1):el.totalL}m</span>
                {el.type !== 'bajante' && <span>{'\u00B7'} {el.segs} {el.segs === 1 ? 'seg' : 'segs'}</span>}
                {(el.pendiente !== undefined && el.pendiente !== null && el.pendiente !== 0 && (activeNet === 'san' || activeNet === 'll')) && (
                  <span>{'\u00B7'} S={el.pendiente}%</span>
                )}
                {el.diametro && <span>{'\u00B7'} {'\u00D8'} {el.diametro}</span>}
                {el.piso && <span>{'\u00B7'} {el.piso}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
