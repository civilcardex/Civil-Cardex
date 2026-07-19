import type { PlanoNet } from "../../lib/PlanoEngine/PlanoState";

const PdfViewerNetworkBar_S1: React.CSSProperties = { height: 38, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", background: "#14161a", borderBottom: "1px solid #3a494a", overflowX: "auto", overflowY: "hidden", };
const PdfViewerNetworkBar_S2: React.CSSProperties = { padding:"2px 8px", background:"#1e2024", border:"1px solid #2a3435", borderRadius:2, color:"#8AB4D6", fontSize: 12, fontFamily:"'Geist',monospace", fontWeight: 600 };
const PdfViewerNetworkBar_closeBtn: React.CSSProperties = { padding: "4px 10px", background: "rgba(211,47,47,.15)", border: "1px solid rgba(211,47,47,.4)", borderRadius: "3px", color: "#ef5350", cursor: "pointer", fontFamily: "'Geist',monospace", fontWeight: 600, fontSize: 11, display: "flex", alignItems: "center", gap: 4, transition: "all .15s", marginRight: 6, flexShrink: 0 };

interface PdfViewerNetworkBarProps {
  nets: PlanoNet[];
  activeNet: string;
  hiddenNets: Set<string>;
  lockedNets: Set<string>;
  onSelectNet: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  scaleText?: React.ReactNode;
  onClose?: () => void;
}

export default function PdfViewerNetworkBar({
  nets,
  activeNet,
  hiddenNets,
  lockedNets,
  onSelectNet,
  onToggleHidden,
  onToggleLocked,
  scaleText,
  onClose,
}: PdfViewerNetworkBarProps) {
  return (
    <div style={PdfViewerNetworkBar_S1}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#6b8cae", textTransform: "uppercase", letterSpacing: 1 }}>Escala:</div>
        <div style={PdfViewerNetworkBar_S2}>
          {scaleText || '1:100'}
        </div>
      </div>
      <div style={{ width: 12 }} />
      <div style={{ flex: 1, minWidth: 4 }} />
      {nets.map((n) => {
        const isActive = activeNet === n.id;
        const isHidden = hiddenNets.has(n.id);
        const isLocked = lockedNets.has(n.id);
        return (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <button type="button"
              onClick={() => onSelectNet(n.id)}
              aria-label={`Red ${n.name.charAt(0).toLowerCase() + n.name.slice(1)}${isActive ? ' (activa)' : ' (inactiva)'}${isLocked ? ' bloqueada' : ''}`}
              title={`Red ${n.name.charAt(0).toLowerCase() + n.name.slice(1)}${isLocked ? ' (bloqueada)' : ''}`}
              style={{
                padding: "2px 8px", background: isActive ? n.col + '22' : "transparent",
                borderTop: `1px solid ${isActive ? n.col : '#3a494a'}`,
                borderRight: `1px solid ${isActive ? n.col : '#3a494a'}`,
                borderBottom: `1px solid ${isActive ? n.col : '#3a494a'}`,
                borderLeft: `3px solid ${n.col}`,
                borderRadius: "3px", color: isActive ? n.col : "#9BA8AA",
                cursor: "pointer", fontFamily: "'Geist',monospace", fontWeight: 600,
                fontSize: 12, whiteSpace: "nowrap", opacity: isHidden ? 0.5 : 1,
                textDecoration: isLocked && isActive ? 'line-through' : 'none',
              }}
            >
              {isLocked && isActive ? '\u{1F512} ' : ' '}{isHidden ? '\u{1F47B} ' : ' '}Red {n.name.charAt(0).toLowerCase() + n.name.slice(1)}
            </button>
            <button type="button"
              onClick={() => onToggleHidden(n.id)}
              aria-label={isHidden ? 'Mostrar red' : 'Ocultar red'}
              style={{
                padding: "3px 6px", background: "transparent", border: "none",
                cursor: "pointer", fontSize: 14, flexShrink: 0, lineHeight: 1,
                color: isHidden ? '#8AB4D6' : n.col,
                opacity: isHidden ? 0.5 : 1,
                textDecoration: isHidden ? 'line-through' : 'none',
              }}
              title={isHidden ? 'Mostrar' : 'Ocultar'}
            >
              {isHidden ? '\u{1F441}\u200D\u{1F5E8}' : '\u{1F441}'}
            </button>
            <button type="button"
              onClick={() => onToggleLocked(n.id)}
              aria-label={lockedNets.has(n.id) ? 'Desbloquear red' : 'Bloquear red'}
              style={{
                padding: "3px 3px", background: "transparent", border: "none",
                cursor: "pointer", fontSize: 12, flexShrink: 0, lineHeight: 1,
                color: lockedNets.has(n.id) ? '#8AB4D6' : n.col,
              }}
              title={lockedNets.has(n.id) ? 'Desbloquear red' : 'Bloquear red'}
            >
              {lockedNets.has(n.id) ? '\u{1F512}' : '\u{1F513}'}
            </button>
          </div>
        );
      })}
      <div style={{ flex: 1, minWidth: 4 }} />
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={PdfViewerNetworkBar_closeBtn}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>)=>{e.currentTarget.style.background='rgba(211,47,47,.25)';e.currentTarget.style.borderColor='rgba(211,47,47,.5)'}}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>)=>{e.currentTarget.style.background='rgba(211,47,47,.15)';e.currentTarget.style.borderColor='rgba(211,47,47,.4)'}}
        >
          <svg viewBox="0 0 22 22" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 3H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Cerrar dibujo
        </button>
      )}
    </div>
  );
}
