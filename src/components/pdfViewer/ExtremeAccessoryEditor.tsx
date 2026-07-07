import { syncExtremeAccessoryToHidroData } from '../../utils/syncExtremeAccessory';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys';
import { writeSanDrawingSync, writeHydroDrawingSync } from '../../utils/drawingSync';
import {
  APARATOS_DEF,
  AF_UC_IDS,
  AC_UC_IDS,
  SAN_UC_IDS,
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
    return SAN_ACCESORIOS.filter(a => a.id === 'codo90rmSube' || a.id === 'codo90rmBaja').map(a => ({ value: a.id, label: a.nombre.toUpperCase() }));
  }
  if (['ll', 'vent'].includes(netId)) {
    return SAN_ACCESORIOS.map(a => ({ value: a.id, label: a.nombre.toUpperCase() }));
  }
  if (netId === 'gas') {
    return GAS_ACCESORIOS.map(a => ({ value: a.id, label: a.nombre.toUpperCase() }));
  }
  if (['af', 'ac', 'rci', 'rec'].includes(netId)) {
    // AF/AC: Solo válvulas, válvulas de pie, reducciones, ampliaciones y otros (sin tees ni codos)
    return ACCESORIOS_HIDRO.filter(a => a.cat !== 'Codos' && a.cat !== 'Tees').map(a => ({ value: a.id, label: a.nombre.toUpperCase() }));
  }
  return [];
}

function getApplicableAppliances(netId: string) {
  if (netId === 'gas') {
    return APARATOS_DEF.filter(ap => ap.grupo === 'g' && (ap.qgas || 0) > 0);
  }
  if (netId === 'san') {
    return APARATOS_DEF.filter(ap => SAN_UC_IDS.includes(ap.id));
  }
  if (netId === 'af') {
    return APARATOS_DEF.filter(ap => AF_UC_IDS.includes(ap.id));
  }
  if (netId === 'ac') {
    return APARATOS_DEF.filter(ap => AC_UC_IDS.includes(ap.id));
  }
  return [];
}

export default function ExtremeAccessoryEditor({ selElement, engineRef, setSelElement, diamList, activeNet, plans }: ExtremeAccessoryEditorProps) {
  const accOptions = getAccessoryOptions(activeNet);
  const applicableAps = getApplicableAppliances(activeNet);

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

  const onAppChange = (field: 'aparatoInicio' | 'aparatoFin') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (engineRef.current) {
      const oldVal = selElement[field] || '';
      const updates: any = { [field]: val || null };
      // Mutually exclusive with accessory — clear accesorio when aparato is selected
      const fieldAcc = field === 'aparatoInicio' ? 'accesorioInicio' : 'accesorioFin';
      if (val && selElement[fieldAcc]) {
        updates[fieldAcc] = '';
        updates[fieldAcc === 'accesorioInicio' ? 'diametroInicio' : 'diametroFin'] = '';
      }
      
      // Update engine
      engineRef.current.updateSelected(updates);
      setSelElement({ ...selElement, ...updates });
      engineRef.current.render();
      engineRef.current._markDirty();

      // Sync to plans trace data
      if (val !== oldVal && plans) {
        for (const plan of plans) {
          if (!plan || plan.status !== 'confirmed') continue;
          const raw = loadFromStorage<any>(TRAZOS_PREFIX + plan.id, null);
          if (!raw) continue;
          let data = raw;
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch { continue; }
          }
          const r = (data.ramales || []).find((x: any) => x.id === selElement.id);
          if (r) {
            r[field] = val || undefined;
            data.ts = Date.now();
            saveToStorage(TRAZOS_PREFIX + plan.id, data);
          }
        }

        // Update counts in localStorage APARATOS_BY_TRAMO_KEY (aparatos_by_tramo_v2)
        const planId = engineRef.current._loadedPlanId;
        const allCounts = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {}) || {};
        const storageKey = planId ? `${activeNet}_${selElement.id}_${planId}` : `${activeNet}_${selElement.id}`;
        const cur = { ...(allCounts[storageKey] || {}) };
        
        if (oldVal) {
          const v = (cur[oldVal] || 0) - 1;
          if (v <= 0) delete cur[oldVal]; else cur[oldVal] = v;
        }
        if (val) {
          cur[val] = (cur[val] || 0) + 1;
        }

        if (Object.keys(cur).length === 0) {
          delete allCounts[storageKey];
        } else {
          allCounts[storageKey] = cur;
        }
        saveToStorage(APARATOS_BY_TRAMO_KEY, allCounts);

        // Update sync data for calculations
        try {
          writeSanDrawingSync(plans);
          writeHydroDrawingSync(plans);
        } catch (err) {
          if (import.meta.env.DEV) console.error(err);
        }

        // Dispatch sidebar event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('aparatos-clear'));
        }
      }
    }
  };

  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: '1px solid #3a494a', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 2 }}>Extremos del ramal</div>

      {/* INICIO */}
      <div>
        <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>INICIO</div>
        <div style={{ fontSize: 10, color: '#9BA8AA', marginBottom: 2 }}>Seleccionar Accesorio</div>
        <div style={{ display: 'grid', gridTemplateColumns: selElement.accesorioInicio ? '1fr 1fr' : '1fr', gap: 4, marginBottom: 4 }}>
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
        {/* Aparato Dropdown */}
        {applicableAps.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, color: '#9BA8AA', marginBottom: 2 }}>Seleccionar Aparato</div>
            <select value={selElement.aparatoInicio || ''} aria-label="Aparato inicio"
              onChange={onAppChange('aparatoInicio')}
              style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
              <option value="">Ninguno</option>
              {applicableAps.map(o => (
                <option key={o.id} value={o.id}>{o.nombre.toUpperCase()}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* FIN */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>FIN</div>
        <div style={{ fontSize: 10, color: '#9BA8AA', marginBottom: 2 }}>Seleccionar Accesorio</div>
        <div style={{ display: 'grid', gridTemplateColumns: selElement.accesorioFin ? '1fr 1fr' : '1fr', gap: 4, marginBottom: 4 }}>
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
        {/* Aparato Dropdown */}
        {applicableAps.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, color: '#9BA8AA', marginBottom: 2 }}>Seleccionar Aparato</div>
            <select value={selElement.aparatoFin || ''} aria-label="Aparato fin"
              onChange={onAppChange('aparatoFin')}
              style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 10, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
              <option value="">Ninguno</option>
              {applicableAps.map(o => (
                <option key={o.id} value={o.id}>{o.nombre.toUpperCase()}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
