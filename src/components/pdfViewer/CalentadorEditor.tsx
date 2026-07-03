import { CAT_GAS } from '../../constants/engineeringDataGas'

interface CalentadorEditorProps {
  selElement: any;
  handleUpdateSel: (field: string, value: any) => void;
}

export default function CalentadorEditor({ selElement, handleUpdateSel }: CalentadorEditorProps) {
  return (
    <>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#9BA8AA", textTransform: "uppercase", letterSpacing: 1 }}>
            Datos del Calentador
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
            Equipo (Capacidad)
          </div>
          <select
            value={selElement.capacidad || ''}
            aria-label="Capacidad del Calentador"
            onChange={e => {
              const val = e.target.value;
              handleUpdateSel('capacidad', val);
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
            <option value="">— Seleccionar —</option>
            {CAT_GAS.filter(g => g.id.startsWith('cal')).map(g => (
              <option key={g.id} value={g.id}>
                {g.n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
