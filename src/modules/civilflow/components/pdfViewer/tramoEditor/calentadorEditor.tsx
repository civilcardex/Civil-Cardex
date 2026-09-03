import { CAT_GAS } from '../../../constants/engineeringDataGas';
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import { SELECT_STYLE } from './context';

/** Editor del calentador seleccionado: capacidad del equipo. */
export function CalentadorEditor({
  selElement,
  handleUpdateSel,
}: {
  selElement: PlanoBajante;
  handleUpdateSel: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: "'Geist',monospace",
              fontSize: 12,
              color: '#9BA8AA',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Datos del Calentador
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#b9caca',
              fontFamily: "'Geist',monospace",
              padding: '2px 0',
            }}
          >
            {selElement.code || selElement.id}
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: '#9BA8AA',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Capacidad
        </div>
        <select
          value={selElement.capacidad ?? ''}
          aria-label="Capacidad"
          onChange={(e) => {
            handleUpdateSel('capacidad', e.target.value);
          }}
          style={SELECT_STYLE}
        >
          <option value="">— Seleccionar —</option>
          {CAT_GAS.filter((g) => g.id.startsWith('cal')).map((g) => (
            <option key={g.id} value={g.id}>
              {g.n}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
