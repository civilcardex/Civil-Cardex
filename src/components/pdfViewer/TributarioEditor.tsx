interface TributarioEditorProps {
  selElement: any;
  engineRef: any;
  setSelElement: React.Dispatch<React.SetStateAction<any>>;
  diamList: any[];
}

export default function TributarioEditor({ selElement, engineRef, setSelElement, diamList }: TributarioEditorProps) {
  return (
    <div style={{ borderTop: '1px solid #3a494a', paddingTop: 8, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>Accesorios Extremos</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <div style={{ fontSize: 8, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2 }}>Inicio (Aparato)</div>
          <select value={selElement.accesorioInicio || ''} aria-label="Accesorio inicio"
            onChange={e => {
              const val = e.target.value;
              if (engineRef.current) {
                const updates: any = { accesorioInicio: val };
                if (val && !selElement.diametroInicio) {
                  updates.diametroInicio = selElement.diametro || '';
                }
                engineRef.current.updateSelected(updates);
                setSelElement({ ...selElement, ...updates });
                engineRef.current.render();
                engineRef.current._markDirty();
              }
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">Ninguno</option>
            <option value="sifon">🧼 Sifón</option>
            <option value="codoSube">🔩 Codo Sube</option>
            <option value="codoBaja">🔩 Codo Baja</option>
            <option value="codoReventilado">🔩 Codo reventilado</option>
          </select>
          {selElement.accesorioInicio && (
            <select value={(selElement.diametroInicio || selElement.diametro || '').split(' — ')[0].trim()} aria-label="Diámetro inicio"
              onChange={e => {
                const val = e.target.value;
                if (engineRef.current) {
                  engineRef.current.updateSelected({ diametroInicio: val });
                  setSelElement({ ...selElement, diametroInicio: val });
                  engineRef.current.render();
                  engineRef.current._markDirty();
                }
              }}
              style={{ width: '100%', padding: "2px 4px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 9, fontFamily: "'Geist',monospace", cursor: 'pointer', marginTop: 3 }}>
              <option value="">Usar red</option>
              {diamList.map((d: any) => {
                const valClean = d.n.split(' — ')[0].trim();
                return <option key={d.n} value={valClean}>{valClean}</option>;
              })}
            </select>
          )}
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2 }}>Fin (Ramal)</div>
          <select value={selElement.accesorioFin || ''} aria-label="Accesorio fin"
            onChange={e => {
              const val = e.target.value;
              if (engineRef.current) {
                const updates: any = { accesorioFin: val };
                if (val && !selElement.diametroFin) {
                  updates.diametroFin = selElement.diametro || '';
                }
                engineRef.current.updateSelected(updates);
                setSelElement({ ...selElement, ...updates });
                engineRef.current.render();
                engineRef.current._markDirty();
              }
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">Ninguno</option>
            <option value="sifon">🧼 Sifón</option>
            <option value="codoSube">🔩 Codo Sube</option>
            <option value="codoBaja">🔩 Codo Baja</option>
            <option value="codoReventilado">🔩 Codo reventilado</option>
          </select>
          {selElement.accesorioFin && (
            <select value={(selElement.diametroFin || selElement.diametro || '').split(' — ')[0].trim()} aria-label="Diámetro fin"
              onChange={e => {
                const val = e.target.value;
                if (engineRef.current) {
                  engineRef.current.updateSelected({ diametroFin: val });
                  setSelElement({ ...selElement, diametroFin: val });
                  engineRef.current.render();
                  engineRef.current._markDirty();
                }
              }}
              style={{ width: '100%', padding: "2px 4px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 9, fontFamily: "'Geist',monospace", cursor: 'pointer', marginTop: 3 }}>
              <option value="">Usar red</option>
              {diamList.map((d: any) => {
                const valClean = d.n.split(' — ')[0].trim();
                return <option key={d.n} value={valClean}>{valClean}</option>;
              })}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
