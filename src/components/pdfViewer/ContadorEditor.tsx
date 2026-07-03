import { CONTADORES as CONTADORES_CAT } from '../../pages/catalog/catalogData'
import { DIAMETROS_AF } from '../../constants/hydraulicData'
import { GAS_DN_LABELS } from '../../constants'

interface ContadorEditorProps {
  selElement: any;
  activeNet: string;
  handleUpdateSel: (field: string, value: any) => void;
}

export default function ContadorEditor({ selElement, activeNet, handleUpdateSel }: ContadorEditorProps) {
  return (
    <>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#9BA8AA", textTransform: "uppercase", letterSpacing: 1 }}>
            Datos del Contador
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#b9caca', fontFamily: "'Geist',monospace", padding: '2px 0' }}>
            {selElement.code || selElement.id}
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
          Datos específicos
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
            Diámetro
          </div>
          <select
            value={selElement.dNominal || ''}
            aria-label="Diámetro del Contador"
            onChange={e => {
              const val = e.target.value;
              handleUpdateSel('dNominal', val);
            }}
            style={{
              width: '100%',
              padding: "4px 6px",
              background: "#1e2024",
              border: "1px solid #3a494a",
              borderRadius: 3,
              color: "#e2e2e8",
              fontSize: 11,
              fontFamily: "'Geist',monospace",
              cursor: 'pointer'
            }}
          >
            <option value="">— Sin diámetro —</option>
            {CONTADORES_CAT.map((c: any) => (
              <option key={c.dn} value={`${c.dn}"`}>
                {c.dn}"
              </option>
            ))}
          </select>
        </div>
        {(activeNet === 'af' || activeNet === 'gas') && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
              {activeNet === 'gas' ? 'Diámetro conexión (Red→Contador)' : 'Diámetro AC-01 (Red→Contador)'}
            </div>
            <select
              value={selElement.acoDiam || ''}
              aria-label="Diámetro del tramo de conexión"
              onChange={e => {
                const val = e.target.value;
                handleUpdateSel('acoDiam', val);
              }}
              style={{
                width: '100%',
                padding: "4px 6px",
                background: "#1e2024",
                border: "1px solid #3a494a",
                borderRadius: 3,
                color: "#e2e2e8",
                fontSize: 11,
                fontFamily: "'Geist',monospace",
                cursor: 'pointer'
              }}
            >
              <option value="">— Sin diámetro —</option>
              {(activeNet === 'gas' ? GAS_DN_LABELS : DIAMETROS_AF.map(d => d.nominal)).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  );
}
