import React from "react";

interface PdfViewerNetworkBarProps {
  nets: any[];
  activeNet: string;
  hiddenNets: Set<string>;
  lockedNets: Set<string>;
  onSelectNet: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
}

export default function PdfViewerNetworkBar({
  nets,
  activeNet,
  hiddenNets,
  lockedNets,
  onSelectNet,
  onToggleHidden,
  onToggleLocked,
}: PdfViewerNetworkBarProps) {
  return (
    <div style={{
      height: 38, flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
      padding: "0 8px", background: "#14161a", borderBottom: "1px solid #3a494a",
      overflowX: "auto", overflowY: "hidden", justifyContent: "center",
    }}>
      <div style={{ flex: 1, minWidth: 4 }} />
      {nets.map((n: any) => {
        const isActive = activeNet === n.id;
        const isHidden = hiddenNets.has(n.id);
        const isLocked = lockedNets.has(n.id);
        return (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <button
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
                fontSize: 10, whiteSpace: "nowrap", opacity: isHidden ? 0.5 : 1,
                textDecoration: isLocked && isActive ? 'line-through' : 'none',
              }}
            >
              {isLocked && isActive ? '\u{1F512} ' : ' '}{isHidden ? '\u{1F47B} ' : ' '}Red {n.name.charAt(0).toLowerCase() + n.name.slice(1)}
            </button>
            <button
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
            <button
              onClick={() => onToggleLocked(n.id)}
              aria-label={lockedNets.has(n.id) ? 'Desbloquear red' : 'Bloquear red'}
              style={{
                padding: "3px 3px", background: "transparent", border: "none",
                cursor: "pointer", fontSize: 11, flexShrink: 0, lineHeight: 1,
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
    </div>
  );
}
