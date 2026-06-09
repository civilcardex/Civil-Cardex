import type { ReactNode, Key } from "react";

interface NormaCardProps {
  key?: Key;
  id: string;
  titulo: string;
  subt: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

export default function NormaCard({ id, titulo, subt, isOpen, onToggle, children }: NormaCardProps) {
  return (
    <div className={`card${isOpen ? ' sec-open' : ''}`}
      style={{ borderTop: '1px solid var(--line)', borderRadius: 0 }}>
      <div className="card-h" onClick={() => onToggle(id)}
        style={{ cursor: "pointer", userSelect: "none" }}>
        <div>
          <span className="card-t" style={{ fontSize: 15, color: 'var(--txt)' }}>{titulo}</span>
          <span className="td-mono" style={{ display:"block", fontSize:11, marginTop:2 }}>{subt}</span>
        </div>
        <span style={{ fontSize:14 }}>{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="card-body-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
