import { syncExtremeAccessoryToHidroData } from '../../utils/syncExtremeAccessory';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';

interface ExtremeAccessoryEditorProps {
  selElement: any;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  setSelElement: React.Dispatch<React.SetStateAction<any>>;
  diamList: any[];
  activeNet: string;
  plans?: any[];
}

export default function ExtremeAccessoryEditor({ selElement, engineRef, setSelElement, diamList, activeNet, plans }: ExtremeAccessoryEditorProps) {
  const accOptions = activeNet === 'san'
    ? [
        { value: 'sifon', label: 'Sifón' },
        { value: 'codoSube', label: 'Codo Sube' },
        { value: 'codoBaja', label: 'Codo Baja' },
        { value: 'codoReventilado', label: 'Codo reventilado' },
      ]
    : [
        { value: 'valvCompuerta', label: 'Válvula compuerta' },
        { value: 'valvGlobo', label: 'Válvula globo' },
        { value: 'valvCheque', label: 'Válvula cheque' },
        { value: 'valvAngulo', label: 'Válvula ángulo' },
      ];

  const onAccChange = (field: 'accesorioInicio' | 'accesorioFin') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (engineRef.current) {
      const oldVal = selElement[field] || '';
      const updates: any = { [field]: val };
      if (val && !selElement.diametroInicio && field === 'accesorioInicio') {
        updates.diametroInicio = selElement.diametro || '';
      }
      if (val && !selElement.diametroFin && field === 'accesorioFin') {
        updates.diametroFin = selElement.diametro || '';
      }
      engineRef.current.updateSelected(updates);
      setSelElement({ ...selElement, ...updates });
      engineRef.current.render();
      engineRef.current._markDirty();
      if (val !== oldVal && plans) {
        syncExtremeAccessoryToHidroData(selElement.id, field, oldVal, val, plans);
      }
    }
  };

  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: '1px solid #3a494a', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 2 }}>Accesorios Extremos</div>

      {/* INICIO */}
      <div>
        <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>INICIO</div>
        <div style={{ display: 'grid', gridTemplateColumns: selElement.accesorioInicio ? '1fr 1fr' : '1fr', gap: 4 }}>
          <select value={selElement.accesorioInicio || ''} aria-label="Accesorio inicio"
            onChange={onAccChange('accesorioInicio')}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">Ninguno</option>
            {accOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
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
              style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
              <option value="">Usar red</option>
              {(selElement.accesorioInicio === 'sifon' 
                ? diamList.filter((d: any) => { const v = parseFloat(d.n); return v === 2 || v === 3 || v === 4; })
                : diamList
              ).map((d: any) => {
                const valClean = d.n.split(' — ')[0].trim();
                return <option key={d.n} value={valClean}>{valClean}</option>;
              })}
            </select>
          )}
        </div>
      </div>

      {/* FIN */}
      <div>
        <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>FIN</div>
        <div style={{ display: 'grid', gridTemplateColumns: selElement.accesorioFin ? '1fr 1fr' : '1fr', gap: 4 }}>
          <select value={selElement.accesorioFin || ''} aria-label="Accesorio fin"
            onChange={onAccChange('accesorioFin')}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">Ninguno</option>
            {accOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
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
              style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
              <option value="">Usar red</option>
              {(selElement.accesorioFin === 'sifon' 
                ? diamList.filter((d: any) => { const v = parseFloat(d.n); return v === 2 || v === 3 || v === 4; })
                : diamList
              ).map((d: any) => {
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
