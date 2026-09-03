import type { Tramo } from '../../context/tramosReducer';

// Chips de la columna "Otros Ramales": los tramos conectados al tramo de la fila, cada uno con
// su UC total en el tooltip. Si no hay conexiones muestra un guion.
/** Chips de la columna "Otros Ramales": los tramos conectados al de la fila, cada uno con su
 *  UC total en el tooltip. Sin conexiones muestra un guion. */
export function OtrosRamalesChips({
  connectedKeys,
  tramos,
  displayTotalMap,
  colorVar,
}: {
  connectedKeys: string[];
  tramos: Tramo[];
  displayTotalMap: Record<string, number>;
  colorVar: string;
}) {
  return connectedKeys.length === 0 ? (
    <span style={{ fontSize: 9, color: 'var(--txt3)' }}>—</span>
  ) : (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {connectedKeys.map((childKey) => {
        const parts = childKey.split('-');
        const rId = parts[0];
        const childTramo = tramos.find((tr) => (tr._key || tr.id) === childKey);
        const childOwnKey = childTramo?._key || childTramo?.id || childKey;
        const childTotalUd = displayTotalMap[childOwnKey] || 0;
        return (
          <span
            key={childKey}
            title={`${rId} (${childTotalUd.toFixed(2)} UC)`}
            style={{
              fontSize: 9,
              padding: '1px 1px',
              border: `1px solid ${colorVar}`,
              borderRadius: 3,
              color: colorVar,
              fontFamily: 'var(--mono)',
              lineHeight: 1.3,
            }}
          >
            {rId}
          </span>
        );
      })}
    </div>
  );
}
