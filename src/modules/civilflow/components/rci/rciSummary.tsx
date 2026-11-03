/** Franja de métricas de resumen de las secciones del diseño RCI (Red Contra Incendio): celda
 *  etiqueta arriba / valor en negrita abajo, como el .summary del HTML de referencia.
 *  Ej: <ResumenRci items={[{ k: 'Bomba', v: '500 gpm @ 141 psi' }]} />. */
import type { CSSProperties } from 'react';

/** Una métrica del resumen: clave (qué es) y valor ya formateado. */
export interface MetricaRci {
  k: string;
  v: string;
  /** Title con la explicación larga (el title= del HTML). */
  ayuda?: string;
  /** true pinta el valor en rojo (una estática fuera de límites, p. ej.). */
  peligro?: boolean;
}

const FILA: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: 'var(--bg3)',
  marginBottom: 8,
};

const CELDA: CSSProperties = { padding: '4px 12px', minWidth: 0, flex: '1 1 auto' };

/** Franja de métricas: una celda por item, separadas por línea. Ej: la de Gabinetes pinta
 *  «Presión mínima · salida más remota» con su 100 psi. */
export function ResumenRci({ items }: { items: readonly MetricaRci[] }) {
  return (
    <div style={FILA}>
      {items.map((m, i) => (
        <div
          key={m.k}
          title={m.ayuda}
          style={{
            ...CELDA,
            borderRight: i === items.length - 1 ? undefined : '1px solid var(--line)',
          }}
        >
          <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginBottom: 2 }}>{m.k}</div>
          <b style={{ fontSize: 13, color: m.peligro ? 'var(--err, #F04545)' : 'var(--txt)' }}>
            {m.v}
          </b>
        </div>
      ))}
    </div>
  );
}
