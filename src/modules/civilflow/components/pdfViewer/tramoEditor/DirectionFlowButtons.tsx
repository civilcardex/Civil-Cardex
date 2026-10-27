// Botonera ↑Sube / ↓Baja / ➜Continua (compartida por el editor de fantasma y el real —
// antes estaban los 3 botones duplicados en los dos branches).
import { DIRECCIONES } from './directionOptions.ts';

/** Botonera de dirección de flujo: resalta `current` y llama a onPick con el valor
 *  (el padre decide reglas — baja permitida, toggle-off — y persiste). */
export function DireccionFlowButtons({
  current,
  onPick,
}: {
  current: string;
  onPick: (val: 'sube' | 'baja' | 'continua') => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {DIRECCIONES.map(([val, lbl]) => {
        const isActive = current === val;
        return (
          <button
            type="button"
            key={val}
            onClick={() => onPick(val)}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: 12,
              fontFamily: "'Geist',monospace",
              borderRadius: 3,
              border: `1px solid ${isActive ? '#F5A623' : '#3a494a'}`,
              background: isActive ? 'rgba(245,166,35,.15)' : '#1e2024',
              color: isActive ? '#F5A623' : '#9BA8AA',
              cursor: 'pointer',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}
