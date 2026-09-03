import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import { READONLY_CENTER_STYLE } from './context';

/** Campo de caudal del extremo con aparato de un ramal. */
export function CaudalField({ selElement }: { selElement: PlanoRamal | null }) {
  const extVal = selElement?.caudal;
  const display =
    extVal != null && (extVal as unknown as string) !== '' && !isNaN(Number(extVal))
      ? Number(extVal).toFixed(2)
      : '—';
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: '#9BA8AA',
          fontFamily: "'Geist',monospace",
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Caudal (LPS)
      </div>
      <div style={{ ...READONLY_CENTER_STYLE, display: 'flex', alignItems: 'center' }}>
        {display}
      </div>
    </div>
  );
}
