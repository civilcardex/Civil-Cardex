import PlanoEngine from "../../lib/PlanoEngine/PlanoEngine";
import { useNavigate } from 'react-router-dom';
import { saveToStorage } from "../../services/storageService";
import { writeSanDrawingSync, writeHydroDrawingSync } from "../../utils/drawingSync";

export interface ToolDef {
  id: string;
  label: string;
  ico: string;
  key: string;
  icoCol: string;
  shortcut: string;
}

export const TOOLS: ToolDef[] = [
  { id: "sel", label: "Seleccionar elemento", ico: "\uD83D\uDC46", key: "S", icoCol: "#9BA8AA", shortcut: "S" },
  { id: "line", label: "Ramal/Tributario", ico: "\u2571", key: "L", icoCol: "#4D8FF7", shortcut: "L" },
  { id: "area", label: "Área", ico: "\u2B21", key: "A", icoCol: "#22D3EE", shortcut: "A" },
  { id: "dim", label: "Cota", ico: "\uD83D\uDCCF", key: "D", icoCol: "#22D3EE", shortcut: "D" },
  { id: "text", label: "Texto", ico: "T", key: "T", icoCol: "#A855F7", shortcut: "T" },
  { id: "baj", label: "Bajante", ico: "\u2193", key: "B", icoCol: "#F04545", shortcut: "B" },
  { id: "mon", label: "Montante", ico: "\u2191", key: "M", icoCol: "#3B82F6", shortcut: "M" },
  { id: "erase", label: "Borrador", ico: "🧽", key: "E", icoCol: "#ffb4ab", shortcut: "E" },
  { id: "pan", label: "Mover", ico: "\u270B", key: "Espacio", icoCol: "#10B981", shortcut: "Espacio" },
];

export const STATUS: Record<string, { color: string; label: string }> = {
  saved: { color: '#22c55e', label: '\u2714 Guardado' },
  saving: { color: '#3b82f6', label: '\u23F3 Guardando...' },
  error: { color: '#ef4444', label: '\u26A0 Sin guardar' },
};

const accBtn: React.CSSProperties = {
  padding: "6px 8px", background: "#1e2024", border: "1px solid #3a494a",
  borderRadius: "4px", color: "#b9caca", cursor: "pointer",
  fontFamily: "'Geist',monospace", display: "flex", alignItems: "center", gap: 6,
  transition: "all .12s",
};

interface PdfViewerToolbarProps {
  tool: string;
  snapOn: boolean;
  activeNet: string;
  currentFile: File | null;
  saveStatus: string;
  onSelectTool: (toolId: string) => void;
  onSnapToggle: () => void;
  onFit: () => void;
  onSave: () => void;
  onUndo: () => void;
  onClear: () => void;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  currentIdRef: React.MutableRefObject<string | undefined>;
  currentId: string | undefined;
  plansRef: React.MutableRefObject<any[]>;
}

export default function PdfViewerToolbar({
  tool, snapOn, activeNet, currentFile, saveStatus,
  onSelectTool, onSnapToggle, onFit, onSave, onUndo, onClear,
  engineRef, currentIdRef, currentId, plansRef,
}: PdfViewerToolbarProps) {
  const navigate = useNavigate();
  const netTools = [...TOOLS];
  if (activeNet === 'af' || activeNet === 'ac' || activeNet === 'gas') {
    netTools.splice(7, 0,
      { id: "calent", label: "Calentador", ico: "🔥", key: "H", icoCol: "#ff7b00", shortcut: "H" }
    );
  }
  if (activeNet === 'af' || activeNet === 'gas') {
    netTools.splice(7, 0,
      { id: "cont", label: "Contador", ico: "🔳", key: "C", icoCol: "#4D8FF7", shortcut: "C" }
    );
  }

  return (
    <>
      <div style={{ padding: "6px 8px 4px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 9, color: "#9BA8AA", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Herramientas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {netTools.map(t => {
            const isBajanteDisabled = t.id === 'baj' && (activeNet === 'af' || activeNet === 'ac');
            return (
              <button key={t.id} disabled={isBajanteDisabled} onClick={() => onSelectTool(t.id)} title={isBajanteDisabled ? "No disponible para esta red" : t.shortcut ? `${t.label} (${t.shortcut})` : t.label} style={{
                padding: "5px 8px", background: tool === t.id ? "#2563EB" : "#1e2024",
                border: `1px solid ${tool === t.id ? "#2563EB" : "#3a494a"}`, borderRadius: "3px",
                color: "#b9caca", cursor: isBajanteDisabled ? "not-allowed" : "pointer",
                opacity: isBajanteDisabled ? 0.3 : 1,
                fontFamily: "'Geist',monospace", fontWeight: 600, transition: "all .12s",
                display: "flex", alignItems: "center", gap: 6, width: "100%",
              }}>
                <span style={{ fontSize: 14, width: 18, textAlign: "center", color: tool === t.id ? "#fff" : t.icoCol }}>{t.ico}</span>
                <span style={{ fontSize: 10, flex: 1, textAlign: 'left' }}>{t.label}</span>
                <span style={{ fontSize: 8, color: tool === t.id ? 'rgba(255,255,255,.6)' : '#8AB4D6', fontFamily: "'Geist',monospace", marginLeft: 'auto' }}>{t.shortcut}</span>
              </button>
            );
          })}
        </div>
        <div style={{marginTop:4}}>
          <button onClick={onSnapToggle}
            style={{
              padding: "5px 8px", background: snapOn ? "#10B98122" : "#1e2024",
              border: `1px solid ${snapOn ? "#10B981" : "#3a494a"}`, borderRadius: "3px",
              color: snapOn ? "#10B981" : "#9BA8AA", cursor: "pointer",
              fontFamily: "'Geist',monospace", fontWeight: 600, transition: "all .12s",
              display: "flex", alignItems: "center", gap: 6, width: "100%", fontSize: 10,
            }}>
            <span style={{fontSize:14,width:18,textAlign:"center",color:snapOn?"#10B981":"#8AB4D6"}}>{snapOn?'\u25C9':'\u25CB'}</span>
            <span style={{flex:1}}>Snap</span>
            <span style={{fontSize:8,color:snapOn?'rgba(255,255,255,.6)':'#8AB4D6',fontFamily:"'Geist',monospace"}}>G</span>
          </button>
        </div>
      </div>

      <div style={{ padding: "6px 8px 4px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 9, color: "#9BA8AA", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Acciones</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={onFit} disabled={!currentFile}
            style={{ ...accBtn, width: "100%", borderColor: "#10B98155", color: "#10B981",
              opacity: !currentFile ? 0.4 : 1, cursor: !currentFile ? 'not-allowed' : 'pointer',
            }}
            title={currentFile ? "Ajustar PDF al visor" : "Carga un plano para poder ajustarlo"}>
            <span style={{ fontSize: 14 }}>{'\u26F6'}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, lineHeight: 1.1 }}>
              <span style={{ fontSize: 10, fontWeight: 700 }}>Ajustar</span>
              <span style={{ fontSize: 8, opacity: 0.7, fontWeight: 400 }}>Encajar PDF al visor</span>
            </div>
          </button>
          <button onClick={onSave} style={{ ...accBtn, width: "100%" }} title="Guarda los trazados y cambios realizados en el plano para la red activa">
            <span style={{ fontSize: 14 }}>{'\uD83D\uDCBE'}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 0, lineHeight: 1.1, flex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textAlign: "left" }}>Guardar</span>
              <span style={{
                fontSize: 10, fontWeight: 600, textAlign: "left",
                color: STATUS[saveStatus]?.color || STATUS.error.color,
              }}>
                {STATUS[saveStatus]?.label || STATUS.error.label}
              </span>
            </div>
          </button>
          <button onClick={onUndo} style={{ ...accBtn, width: "100%" }} title="Deshace el último elemento dibujado: ramal, bajante, área, cota o texto. (Ctrl+Z)">
            <span style={{ fontSize: 14 }}>{'\u21A9'}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, lineHeight: 1.1 }}>
              <span style={{ fontSize: 10, fontWeight: 700 }}>Deshacer</span>
              <span style={{ fontSize: 8, opacity: 0.7, fontWeight: 400 }}>Último trazo · Ctrl+Z</span>
            </div>
          </button>
          <button onClick={onClear} style={{ ...accBtn, width: "100%", borderColor: "rgba(255,180,171,.3)", color: "#ffb4ab" }} title="Eliminar todo el trazado de la red activa">
            <span style={{ fontSize: 14 }}>{'\uD83D\uDDD1'}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0, lineHeight: 1.1 }}>
              <span style={{ fontSize: 10, fontWeight: 700 }}>Limpiar</span>
              <span style={{ fontSize: 8, opacity: 0.7, fontWeight: 400 }}>Borrar trazado de red activa</span>
            </div>
          </button>
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{padding:"6px 8px",borderTop:"1px solid #3a494a"}}>
      <button onClick={()=>{
        const eng = engineRef.current;
        const key = `trazos_${currentIdRef.current || currentId || 'work'}`;
        if (eng) {
          const work = eng.saveWork();
          saveToStorage(key, work);
          try { writeSanDrawingSync(plansRef.current); } catch { /* ignore */ }
          try { writeHydroDrawingSync(plansRef.current); } catch { /* ignore */ }
        }
        navigate('/civilflowareatrabajo');
      }}
          style={{
            padding: "8px", background: "rgba(211,47,47,.12)", border: "1px solid rgba(211,47,47,.3)", borderRadius: "3px",
            color: "#ef5350", cursor: "pointer", fontFamily: "'Geist',monospace", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", fontSize: 10,
            transition:"all .15s",
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>)=>{e.currentTarget.style.background='rgba(211,47,47,.25)';e.currentTarget.style.borderColor='rgba(211,47,47,.5)'}}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>)=>{e.currentTarget.style.background='rgba(211,47,47,.12)';e.currentTarget.style.borderColor='rgba(211,47,47,.3)'}}>
          <svg viewBox="0 0 22 22" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 3H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Cerrar dibujo
        </button>
      </div>
    </>
  );
}
