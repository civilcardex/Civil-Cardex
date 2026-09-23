/** Celda de elementos asociados como chips — el mismo estilo en Diseño de red aguas lluvias
 *  y en las tablas de chequeo (borde/color de la red ll, mono, wrap centrado). */
export default function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span style={{ fontSize: 11, color: 'var(--txt3)' }}>—</span>;
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
      {items.map((it) => (
        <span
          key={it}
          style={{
            fontSize: 11,
            padding: '2px 3px',
            border: '1px solid var(--ll)',
            borderRadius: 3,
            color: 'var(--ll)',
            fontFamily: 'var(--mono)',
            lineHeight: 1.3,
          }}
        >
          {it}
        </span>
      ))}
    </div>
  );
}
