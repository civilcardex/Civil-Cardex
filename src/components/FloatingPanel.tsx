import { useState, useCallback, useEffect, useRef } from "react";

// Module-level counter for z-index stacking across independently rendered FloatingPanel instances.
// Each panel calls nextZ() on mount and on bring-to-front, ensuring the most recently
// interacted panel always renders above others. This global counter bypasses React's
// component-local state tree intentionally — it must be shared across sibling panels
// that don't share a common parent state. Reset to 50 so panels start above other UI.
const Z_INDEX_BASE = 50;
let _zCounter = Z_INDEX_BASE;
function nextZ() { return ++_zCounter; }
export function useZIndex(): [number, () => void] {
  const [z, setZ] = useState(() => nextZ());
  const bringToFront = useCallback(() => setZ(nextZ()), []);
  return [z, bringToFront];
}

interface FloatingPanelProps {
  title: string;
  icon: string;
  count?: string | undefined;
  onClose: () => void;
  children?: React.ReactNode;
  defaultPos?: { x: number; y: number };
  minW?: number;
}

export default function FloatingPanel({ title, icon, count = undefined, onClose, children = null, defaultPos = { x: 40, y: 40 }, minW = 460 }: FloatingPanelProps) {
  const [pos, setPos] = useState(defaultPos);
  const [collapsed, setCollapsed] = useState(false);
  const [zIndex, bringToFront] = useZIndex();
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: any) => {
    bringToFront();
    if (e.target.closest('.no-drag')) return;
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('button') || e.target.closest('label')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = pos.x;
    const origY = pos.y;
    const onMove = (ev: MouseEvent) => {
      setPos({ x: origX + ev.clientX - startX, y: origY + ev.clientY - startY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, bringToFront]);

  useEffect(() => {
    if (panelRef.current) {
      const first = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="floating-panel-title"
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        zIndex,
        minWidth: collapsed ? 180 : minW,
        maxWidth: '95vw',
        maxHeight: '80vh',
        background: 'rgba(18,20,24,0.96)',
        border: '1px solid #3a494a',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Hanken Grotesk',sans-serif",
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: '#1a1c20',
        borderBottom: collapsed ? 'none' : '1px solid #3a494a',
        cursor: 'grab', userSelect: 'none',
      }}>
        <span id="floating-panel-title" style={{ fontSize: 13, fontWeight: 600, color: '#e2e2e8', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{fontSize:15}} aria-hidden="true">{icon}</span> {title}
          {count !== undefined && <span style={{ fontSize: 10, color: '#849495', fontWeight: 400 }}>{count}</span>}
        </span>
        <div style={{ display: 'flex', gap: 4 }} className="no-drag">
          <button onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expandir' : 'Colapsar'} aria-expanded={!collapsed} style={{
            padding: '2px 8px', background: 'transparent', border: '1px solid #3a494a',
            borderRadius: 4, color: '#849495', cursor: 'pointer', fontSize: 12,
          }}>{collapsed ? '▾' : '_'}</button>
          <button onClick={onClose} aria-label="Cerrar" style={{
            padding: '2px 8px', background: 'transparent', border: '1px solid #3a494a',
            borderRadius: 4, color: '#ffb4ab', cursor: 'pointer', fontSize: 12,
          }}>✕</button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ overflow: 'auto', flex: 1, padding: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export const thS: React.CSSProperties = {
  padding: '6px 6px', fontSize: 10, fontWeight: 600, textAlign: 'center',
  color: '#849495', borderBottom: '2px solid #3a494a', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: '#121416',
};

export const tdS: React.CSSProperties = {
  padding: '3px 4px', textAlign: 'center', verticalAlign: 'middle',
};

export const inputStyle = (w = 56): React.CSSProperties => ({
  width: w, padding: '2px 4px', fontSize: 11, textAlign: 'center',
  background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3, color: '#e2e2e8',
});

export const btnDelStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(255,100,100,.3)',
  borderRadius: 3, color: '#ffb4ab', padding: '1px 4px', fontSize: 9, cursor: 'pointer',
};

export const btnAddStyle: React.CSSProperties = {
  padding: '4px 12px', background: '#1e2024', border: '1px dashed #3a494a',
  borderRadius: 4, color: '#b9caca', cursor: 'pointer', fontSize: 11,
  fontFamily: "'Hanken Grotesk',sans-serif",
};

export const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse', width: '100%',
  fontFamily: "'Geist',monospace", fontSize: 11, color: '#e2e2e8',
};
