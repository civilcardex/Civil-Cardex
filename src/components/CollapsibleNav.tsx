import { useState } from 'react';

export default function CollapsibleNav({ items, collapsedLabel, renderTab, mode = 'grid' }: {
  items: any[];
  collapsedLabel?: string;
  renderTab: (item: any, i: number) => React.ReactNode;
  mode?: string;
}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={() => setOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'var(--body)', fontSize: 13, color: 'var(--acc2)', fontWeight: 600, transition: 'all .15s', width: '100%' }}>
          <span style={{ fontSize: 12, opacity: .6 }}>▶</span>
          <span>{collapsedLabel || items[0]?.label}</span>
        </button>
      </div>
    );
  }

  const layoutStyle = mode === 'flex'
    ? { display: 'flex', gap: 5, padding: '10px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 'var(--r2)', justifyContent: 'space-evenly' }
    : { display: 'grid', gridTemplateColumns: `repeat(${items.length},1fr)`, gap: 6, padding: '12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 'var(--r2)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={layoutStyle}>
        {items.map((item: any, i: number) => renderTab(item, i))}
      </div>
      <button onClick={() => setOpen(false)} title="Colapsar"
        style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-end', padding: '4px 12px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt3)', cursor: 'pointer', fontSize: 18, fontFamily: 'var(--mono)', transition: 'all .15s' }}>▲</button>
    </div>
  );
}
