import { useState, useCallback } from "react";

let _zCounter = 50;
export function nextZ() { return ++_zCounter; }
export function useZIndex() {
  const [z, setZ] = useState(() => nextZ());
  const bringToFront = useCallback(() => setZ(nextZ()), []);
  return [z, bringToFront];
}

export default function FloatingPanel({ title, icon, count = undefined, onClose, children = null, defaultPos = { x: 40, y: 40 }, minW = 460 }) {
  const [pos, setPos] = useState(defaultPos);
  const [collapsed, setCollapsed] = useState(false);
  const [zIndex, bringToFront] = useZIndex();

  const onMouseDown = useCallback((e) => {
    bringToFront();
    if (e.target.closest('.no-drag')) return;
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('button') || e.target.closest('label')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = pos.x;
    const origY = pos.y;
    const onMove = (ev) => {
      setPos({ x: origX + ev.clientX - startX, y: origY + ev.clientY - startY });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, bringToFront]);

  return (
    <div
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
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e2e8', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{fontSize:15}}>{icon}</span> {title}
          {count !== undefined && <span style={{ fontSize: 10, color: '#849495', fontWeight: 400 }}>{count}</span>}
        </span>
        <div style={{ display: 'flex', gap: 4 }} className="no-drag">
          <button onClick={() => setCollapsed(c => !c)} style={{
            padding: '2px 8px', background: 'transparent', border: '1px solid #3a494a',
            borderRadius: 4, color: '#849495', cursor: 'pointer', fontSize: 12,
          }}>{collapsed ? '▾' : '_'}</button>
          <button onClick={onClose} style={{
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

export const thS = {
  padding: '6px 6px', fontSize: 10, fontWeight: 600, textAlign: 'center',
  color: '#849495', borderBottom: '2px solid #3a494a', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: '#121416',
};

export const tdS = {
  padding: '3px 4px', textAlign: 'center', verticalAlign: 'middle',
};

export const inputStyle = (w = 56) => ({
  width: w, padding: '2px 4px', fontSize: 11, textAlign: 'center',
  background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3, color: '#e2e2e8',
});

export const numInputStyle = (w = 56) => ({
  ...inputStyle(w),
});

export const btnDelStyle = {
  background: 'transparent', border: '1px solid rgba(255,100,100,.3)',
  borderRadius: 3, color: '#ffb4ab', padding: '1px 4px', fontSize: 9, cursor: 'pointer',
};

export const btnAddStyle = {
  padding: '4px 12px', background: '#1e2024', border: '1px dashed #3a494a',
  borderRadius: 4, color: '#b9caca', cursor: 'pointer', fontSize: 11,
  fontFamily: "'Hanken Grotesk',sans-serif",
};

export const tableStyle = {
  borderCollapse: 'collapse', width: '100%',
  fontFamily: "'Geist',monospace", fontSize: 11, color: '#e2e2e8',
};
