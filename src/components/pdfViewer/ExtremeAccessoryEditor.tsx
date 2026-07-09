import { syncExtremeAccessoryToHidroData } from '../../utils/syncExtremeAccessory';
import { normalizeDnLabel } from '../../utils/formatUtils';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
const ExtremeAccessoryEditor_S1: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const ExtremeAccessoryEditor_S2: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const ExtremeAccessoryEditor_S4: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const ExtremeAccessoryEditor_S5: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };

import {
  ACCESORIOS_HIDRO,
  SAN_ACCESORIOS,
  GAS_ACCESORIOS
} from '../../constants';

interface ExtremeAccessoryEditorProps {
  selElement: any;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  setSelElement: React.Dispatch<React.SetStateAction<any>>;
  diamList: any[];
  activeNet: string;
  plans?: any[];
}

function getAccessoryOptions(netId: string) {
  if (netId === 'san') {
    return SAN_ACCESORIOS.filter(a => a.id === 'codo90rmSube' || a.id === 'codo90rmBaja' || a.id === 'codoReventilado' || a.id === 'sifon').map(a => ({ value: a.id, label: a.nombre.toUpperCase() }));
  }
  if (['ll', 'vent'].includes(netId)) {
    return SAN_ACCESORIOS.map(a => ({ value: a.id, label: a.nombre.toUpperCase() }));
  }
  if (netId === 'gas') {
    return GAS_ACCESORIOS.map(a => ({ value: a.id, label: a.nombre.toUpperCase() }));
  }
  if (['af', 'ac', 'rci', 'rec'].includes(netId)) {
    // AF/AC: válvulas, válvulas de pie, reducciones, ampliaciones, otros, y codos de subida/bajada (sin tees ni el resto de codos)
    return ACCESORIOS_HIDRO.filter(a => (a.cat !== 'Codos' && a.cat !== 'Tees') || a.id === 'codo90rmSube' || a.id === 'codo90rmBaja').map(a => ({ value: a.id, label: a.nombre.toUpperCase() }));
  }
  return [];
}

export default function ExtremeAccessoryEditor({ selElement, engineRef, setSelElement, diamList, activeNet, plans }: ExtremeAccessoryEditorProps) {
  const accOptions = getAccessoryOptions(activeNet);

  const onAccChange = (field: 'accesorioInicio' | 'accesorioFin') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (engineRef.current) {
      const oldVal = selElement[field] || '';
      const updates: any = { [field]: val };
      const fieldDiam = field === 'accesorioInicio' ? 'diametroInicio' : 'diametroFin';
      // Mutually exclusive with appliance — clear aparato when accesorio is selected
      const fieldApp = field === 'accesorioInicio' ? 'aparatoInicio' : 'aparatoFin';
      if (val && selElement[fieldApp]) {
        updates[fieldApp] = null;
      }
      if (val && !selElement[fieldDiam]) {
        updates[fieldDiam] = selElement.diametro || '';
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
    <div style={{ padding: "10px 12px 8px", borderBottom: '1px solid #3a494a', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 2 }}>Extremos del ramal</div>

      {/* INICIO */}
      <div>
        <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>INICIO</div>
        <div style={{ fontSize: 12, color: '#9BA8AA', marginBottom: 2 }}>Seleccionar Accesorio</div>
        <div style={{ display: 'grid', gridTemplateColumns: selElement.accesorioInicio ? '1fr 1fr' : '1fr', gap: 4, marginBottom: 4 }}>
          <select value={selElement.accesorioInicio || ''} aria-label="Accesorio inicio"
            onChange={onAccChange('accesorioInicio')}
            style={ExtremeAccessoryEditor_S1}>
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
              style={ExtremeAccessoryEditor_S2}>
              <option value="">Usar red</option>
              {(selElement.accesorioInicio === 'sifon' 
                ? diamList.filter((d: any) => { const v = parseFloat(d.n); return v === 2 || v === 3 || v === 4; })
                : diamList
              ).map((d: any) => {
                const valClean = d.n.split(' — ')[0].trim();
                return <option key={d.n} value={valClean}>{normalizeDnLabel(valClean)}</option>;
              })}
            </select>
          )}
        </div>
      </div>

      {/* FIN */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>FIN</div>
        <div style={{ fontSize: 12, color: '#9BA8AA', marginBottom: 2 }}>Seleccionar Accesorio</div>
        <div style={{ display: 'grid', gridTemplateColumns: selElement.accesorioFin ? '1fr 1fr' : '1fr', gap: 4, marginBottom: 4 }}>
          <select value={selElement.accesorioFin || ''} aria-label="Accesorio fin"
            onChange={onAccChange('accesorioFin')}
            style={ExtremeAccessoryEditor_S4}>
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
              style={ExtremeAccessoryEditor_S5}>
              <option value="">Usar red</option>
              {(selElement.accesorioFin === 'sifon' 
                ? diamList.filter((d: any) => { const v = parseFloat(d.n); return v === 2 || v === 3 || v === 4; })
                : diamList
              ).map((d: any) => {
                const valClean = d.n.split(' — ')[0].trim();
                return <option key={d.n} value={valClean}>{normalizeDnLabel(valClean)}</option>;
              })}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
