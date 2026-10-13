import { leerHeredadosPresion } from '../../utils/aparatosPresion';
import type { SelectableTarget } from '../fixturesStorage';
import type { ProbedElement } from '../pdfViewer/tramoEditor/context';

// HEREDADOS (AGUAS ARRIBA) — af/ac (orig. usuario): aparatos que llegan por propagación
// (libro aparatos_heredados_v1, escrito por propagarAparatosPresion). Read-only: la edición
// es en los ramales/montante fuente.
export function SecHeredados({
  netId,
  storageKey,
  selElement,
}: {
  netId: string;
  storageKey: string | null;
  selElement: SelectableTarget | ProbedElement | null;
}) {
  if (!(netId === 'af' || netId === 'ac')) return null;
  if (!storageKey || !selElement?.pts) return null;
  const her = leerHeredadosPresion(storageKey);
  const entradas = Object.entries(her).filter(([, v]) => v > 0);
  if (entradas.length === 0) return null;
  return (
    <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
      <div
        style={{
          fontFamily: "'Geist',monospace",
          fontSize: 12,
          color: 'var(--txt3)',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Heredados (aguas arriba)
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--txt2)',
          fontFamily: "'Geist',monospace",
          padding: '2px 0',
          lineHeight: 1.6,
        }}
      >
        {entradas.map(([ap, n]) => (
          <span
            key={ap}
            style={{
              display: 'inline-block',
              background: '#1e2024',
              borderRadius: 3,
              padding: '2px 6px',
              marginRight: 6,
              marginBottom: 4,
              fontSize: 11.5,
            }}
          >
            {ap} × {n}
          </span>
        ))}
        <span style={{ color: 'var(--txt3)', fontSize: 11 }}>
          {' '}
          — se propagan solos desde el montante/ramales fuente.
        </span>
      </div>
    </div>
  );
}
