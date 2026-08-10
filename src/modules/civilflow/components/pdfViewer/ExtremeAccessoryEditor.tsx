import {
  syncExtremeAccessoryToHidroData,
  syncExtremeAparatoToCounts,
} from '../../utils/syncExtremeAccessory';
import { getAccessoryOptions } from '../../utils/accessoryOptions';
import { DIAM_BY_MAT } from '../../constants';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoRamal } from '../../lib/PlanoEngine/PlanoState';
import type { PlanItem } from '../../context/PlansContext';
const ExtremeAccessoryEditor_S1: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};
const ExtremeAccessoryEditor_S4: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: 3,
  color: '#e2e2e8',
  fontSize: 12,
  fontFamily: "'Geist',monospace",
  cursor: 'pointer',
};

interface ExtremeAccessoryEditorProps {
  selElement: PlanoRamal;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  setSelElement: (el: PlanoRamal | null) => void;
  activeNet: string;
  plans?: PlanItem[];
}

export default function ExtremeAccessoryEditor({
  selElement,
  engineRef,
  setSelElement,
  activeNet,
  plans,
}: ExtremeAccessoryEditorProps) {
  const accOptions = getAccessoryOptions(activeNet).map((o) => ({
    ...o,
    label: o.label.toUpperCase(),
  }));
  const matShort = selElement.material || (selElement.net === 'san' ? 'PVC' : '');
  const diamList = (selElement.net === 'san' && DIAM_BY_MAT['PVC']) || DIAM_BY_MAT[matShort] || [];

  const onAccChange =
    (field: 'accesorioInicio' | 'accesorioFin') => (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (engineRef.current) {
        const eng = engineRef.current;
        if (val === 'sifon' && selElement.net === 'san') {
          if (field === 'accesorioFin') {
            eng.triggerAlert('Revisar ubicación del sifón', 'El sifón no puede recibir flujo.');
            return;
          }
        }
        if (
          (val === 'llaveTerminal' || val === 'teeLlaveTerminal') &&
          field === 'accesorioInicio'
        ) {
          eng.triggerAlert(
            'Revisar ubicación llave terminal',
            'La llave terminal debe recibir el flujo.',
          );
          return;
        }
        const oldVal = selElement[field] || '';
        const updates: Record<string, unknown> = { [field]: val };
        const fieldApp: 'aparatoInicio' | 'aparatoFin' =
          field === 'accesorioInicio' ? 'aparatoInicio' : 'aparatoFin';
        const removedApp = val && selElement[fieldApp] ? selElement[fieldApp] : '';
        if (removedApp) {
          updates[fieldApp] = null;
        }
        // Los accesorios ya no heredan el diámetro propio del ramal como predeterminado — todo
        // accesorio (sifón incluido) empieza sin diámetro elegido hasta que el usuario lo elige
        // explícitamente.
        engineRef.current.updateSelected(updates);
        setSelElement({ ...selElement, ...updates });
        engineRef.current.render();
        // El sync de conteos debe correr ANTES del reconcile (_markDirty → calcHydroAccessories
        // / calcSanitaryAccessories), que reconstruye hidroData/aparatos desde los campos del
        // ramal: si corre después, el bump +1 se suma sobre el valor ya reconciliado y el
        // accesorio queda duplicado (p. ej. una reducción contada dos veces en el resumen).
        if (val !== oldVal && plans) {
          syncExtremeAccessoryToHidroData(selElement.id, field, oldVal, val, plans);
        }
        engineRef.current._markDirty();
        if (removedApp && plans) {
          syncExtremeAparatoToCounts(selElement.id, removedApp, '', plans);
        }
      }
    };

  const onDiamChange =
    (fieldDiam: 'diametroInicio' | 'diametroFin') => (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (!engineRef.current) return;
      if (val && selElement.diametro) {
        const inchFrom = (d: string) => {
          const q = d.indexOf('"');
          return q > 0 ? d.slice(0, q) : d;
        };
        if (diamPulgFromLabel(inchFrom(val)) > diamPulgFromLabel(inchFrom(selElement.diametro))) {
          engineRef.current.triggerAlert(
            'Diámetro no permitido',
            'El diámetro del accesorio no puede ser mayor al diámetro del ramal.',
          );
          return;
        }
      }
      engineRef.current.updateSelected({ [fieldDiam]: val });
      setSelElement({ ...selElement, [fieldDiam]: val });
      engineRef.current.render();
      engineRef.current._markDirty();
    };

  const diamLabel = (dn: string) => {
    const idx = dn.indexOf(' — ');
    return idx > 0 ? dn.slice(0, idx) : dn;
  };
  const diamOptions = diamList.map((d) => ({ n: d.n, label: diamLabel(d.n) }));

  return (
    <div
      style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid #3a494a',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: '#9BA8AA',
          fontFamily: "'Geist',monospace",
          textTransform: 'uppercase',
          letterSpacing: 1,
          paddingBottom: 2,
        }}
      >
        Extremos del ramal
      </div>

      {/* INICIO */}
      <div>
        <div
          style={{
            fontSize: 12,
            color: '#9BA8AA',
            fontFamily: "'Geist',monospace",
            marginBottom: 5,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: 600,
          }}
        >
          INICIO
        </div>
        <div style={{ fontSize: 12, color: '#9BA8AA', marginBottom: 2 }}>Seleccionar Accesorio</div>
        <div style={{ marginBottom: 4 }}>
          <select
            value={selElement.accesorioInicio || ''}
            aria-label="Accesorio inicio"
            onChange={onAccChange('accesorioInicio')}
            style={ExtremeAccessoryEditor_S1}
          >
            <option value="">Ninguno</option>
            {accOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {selElement.accesorioInicio && diamOptions.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: '#9BA8AA', marginBottom: 2 }}>
              Diámetro del accesorio
            </div>
            <select
              value={selElement.diametroInicio || selElement.diametro || ''}
              aria-label="Diámetro inicio"
              onChange={onDiamChange('diametroInicio')}
              style={ExtremeAccessoryEditor_S1}
            >
              {diamOptions.map((o) => (
                <option key={o.n} value={o.n}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* FIN */}
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            fontSize: 12,
            color: '#9BA8AA',
            fontFamily: "'Geist',monospace",
            marginBottom: 5,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: 600,
          }}
        >
          FIN
        </div>
        <div style={{ fontSize: 12, color: '#9BA8AA', marginBottom: 2 }}>Seleccionar Accesorio</div>
        <div style={{ marginBottom: 4 }}>
          <select
            value={selElement.accesorioFin || ''}
            aria-label="Accesorio fin"
            onChange={onAccChange('accesorioFin')}
            style={ExtremeAccessoryEditor_S4}
          >
            <option value="">Ninguno</option>
            {accOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {selElement.accesorioFin && diamOptions.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: '#9BA8AA', marginBottom: 2 }}>
              Diámetro del accesorio
            </div>
            <select
              value={selElement.diametroFin || selElement.diametro || ''}
              aria-label="Diámetro fin"
              onChange={onDiamChange('diametroFin')}
              style={ExtremeAccessoryEditor_S4}
            >
              {diamOptions.map((o) => (
                <option key={o.n} value={o.n}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
