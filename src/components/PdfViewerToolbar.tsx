export interface ToolDef {
  id: string;
  label: string;
  ico: string;
  key: string;
  icoCol: string;
  shortcut: string;
}

export const TOOLS: ToolDef[] = [
  { id: "sel", label: "Seleccionar", ico: "🖱", key: "S", icoCol: "#849495", shortcut: "S" },
  { id: "line", label: "Ramal/Tributario", ico: "╱", key: "L", icoCol: "#4D8FF7", shortcut: "L" },
  { id: "area", label: "Área", ico: "⬡", key: "A", icoCol: "#22D3EE", shortcut: "A" },
  { id: "dim", label: "Cota", ico: "📏", key: "D", icoCol: "#22D3EE", shortcut: "D" },
  { id: "text", label: "Texto", ico: "T", key: "T", icoCol: "#A855F7", shortcut: "T" },
  { id: "baj", label: "Bajante", ico: "↓", key: "B", icoCol: "#F04545", shortcut: "B" },
  { id: "segdel", label: "Eliminar segmento", ico: "✂", key: "K", icoCol: "#ffb4ab", shortcut: "K" },
  { id: "erase", label: "Eliminar ramal/tributario", ico: "🧹", key: "E", icoCol: "#ffb4ab", shortcut: "E" },
  { id: "pan", label: "Mover", ico: "✋", key: "Espacio", icoCol: "#10B981", shortcut: "Espacio" },
];

interface PdfViewerToolbarProps {
  tool: string;
  snapOn: boolean;
  onSelectTool: (toolId: string) => void;
  onSnapToggle: () => void;
}

export default function PdfViewerToolbar({ tool, snapOn, onSelectTool, onSnapToggle }: PdfViewerToolbarProps) {
  return (
    <div style={{ padding: "6px 8px 4px", borderBottom: "1px solid #3a494a" }}>
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 9, color: "#849495", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Herramientas</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => onSelectTool(t.id)} title={`${t.label} (${t.shortcut})`} style={{
            padding: "5px 8px", background: tool === t.id ? "#2563EB" : "#1e2024",
            border: `1px solid ${tool === t.id ? "#2563EB" : "#3a494a"}`, borderRadius: "3px",
            color: "#b9caca", cursor: "pointer",
            fontFamily: "'Geist',monospace", fontWeight: 600, transition: "all .12s",
            display: "flex", alignItems: "center", gap: 6, width: "100%",
          }}>
            <span style={{ fontSize: 14, width: 18, textAlign: "center", color: tool === t.id ? "#fff" : t.icoCol }}>{t.ico}</span>
            <span style={{ fontSize: 10, flex: 1, textAlign: 'left' }}>{t.label}</span>
            <span style={{ fontSize: 8, color: tool === t.id ? 'rgba(255,255,255,.6)' : '#6b8cae', fontFamily: "'Geist',monospace", marginLeft: 'auto' }}>{t.shortcut}</span>
          </button>
        ))}
      </div>
      <div style={{marginTop:4}}>
        <button onClick={onSnapToggle}
          style={{
            padding: "5px 8px", background: snapOn ? "#10B98122" : "#1e2024",
            border: `1px solid ${snapOn ? "#10B981" : "#3a494a"}`, borderRadius: "3px",
            color: snapOn ? "#10B981" : "#849495", cursor: "pointer",
            fontFamily: "'Geist',monospace", fontWeight: 600, transition: "all .12s",
            display: "flex", alignItems: "center", gap: 6, width: "100%", fontSize: 10,
          }}>
          <span style={{fontSize:14,width:18,textAlign:"center",color:snapOn?"#10B981":"#6b8cae"}}>{snapOn?'◉':'○'}</span>
          <span style={{flex:1}}>Snap</span>
          <span style={{fontSize:8,color:snapOn?'rgba(255,255,255,.6)':'#6b8cae',fontFamily:"'Geist',monospace"}}>G</span>
        </button>
      </div>
    </div>
  );
}
