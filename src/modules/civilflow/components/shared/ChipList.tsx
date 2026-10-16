/** Celda de elementos asociados como chips (borde/color de red, mono, wrap centrado).
 *  items acepta texto o {label, title} para tooltip. */
export default function ChipList({
  items,
  colorVar = 'var(--ll)',
  fontSize = 11,
  pad = '2px 3px',
}: {
  items: Array<string | { key?: string; label: string; title?: string }>;
  colorVar?: string;
  fontSize?: number;
  pad?: string;
}) {
  if (items.length === 0) {
    return <span style={{ fontSize, color: 'var(--txt3)' }}>—</span>;
  }
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {items.map((it) => {
        const label = typeof it === 'string' ? it : it.label;
        const title = typeof it === 'string' ? undefined : it.title;
        const key = typeof it === 'string' ? it : (it.key ?? it.label);
        return (
          <span
            key={key}
            title={title}
            style={{
              fontSize,
              padding: pad,
              border: `1px solid ${colorVar}`,
              borderRadius: 3,
              color: colorVar,
              fontFamily: 'var(--mono)',
              lineHeight: 1.3,
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
