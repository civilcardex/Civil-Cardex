import { GAS_DN_LABELS } from '../../../constants/engineeringDataGas';
import { DIAMETROS_AF } from '../../../constants/hydraulicData';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import { SELECT_STYLE } from './context';

/** Editor del contador seleccionado: diámetro de la conexión a red. */
export function ContadorEditor({
  selElement,
  activeNet,
  handleUpdateSel,
}: {
  selElement: PlanoBajante;
  activeNet: string;
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
            Datos del Contador
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
          Conexión
        </div>
        <select
          value={selElement.diametro ?? ''}
          aria-label="Conexión"
          onChange={(e) => {
            handleUpdateSel('diametro', e.target.value);
          }}
          style={SELECT_STYLE}
        >
          <option value="">— Seleccionar —</option>
          {activeNet === 'gas'
            ? GAS_DN_LABELS.map((d) => (
                <option key={d} value={d}>
                  {normalizeDnLabel(d)}
                </option>
              ))
            : DIAMETROS_AF.map((d) => (
                <option key={d.nominal} value={d.nominal}>
                  {normalizeDnLabel(d.nominal)}
                </option>
              ))}
        </select>
      </div>
    </>
  );
}
