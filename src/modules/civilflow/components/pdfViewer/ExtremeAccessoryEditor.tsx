import { syncExtremeAccessoryToHidroData } from '../../utils/syncExtremeAccessory';
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
  const mainDiamRaw = selElement.diametro || '';

  const onAccChange =
    (field: 'accesorioInicio' | 'accesorioFin') => (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (engineRef.current) {
        const eng = engineRef.current;
        if (val === 'sifon' && selElement.net === 'san') {
          if (field === 'accesorioFin') {
            eng.triggerAlert(
              'Sifón al revés',
              'El sifón debe ir en el extremo de ENTRADA (inicio del ramal). Colócalo en el otro extremo.',
            );
            return;
          }
        }
        if (
          (val === 'llaveTerminal' || val === 'teeLlaveTerminal') &&
          field === 'accesorioInicio'
        ) {
          eng.triggerAlert(
            'Llave terminal al revés',
            'La llave terminal debe ir en el extremo de SALIDA (fin del ramal). Colócala en el otro extremo.',
          );
          return;
        }
        const oldVal = selElement[field] || '';
        const updates: Record<string, unknown> = { [field]: val };
        const fieldDiam: 'diametroInicio' | 'diametroFin' =
          field === 'accesorioInicio' ? 'diametroInicio' : 'diametroFin';
        const fieldApp: 'aparatoInicio' | 'aparatoFin' =
          field === 'accesorioInicio' ? 'aparatoInicio' : 'aparatoFin';
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

  const onDiamChange =
    (fieldDiam: 'diametroInicio' | 'diametroFin') => (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (!engineRef.current) return;
      const eng = engineRef.current;
      // Extract inch part from formatted strings like '1-1/2" — 42.7 mm' → '1-1/2'
      const inchFromDiam = (d: string) => {
        const q = d.indexOf('"');
        return q > 0 ? d.slice(0, q) : d;
      };
      if (val && mainDiamRaw) {
        if (diamPulgFromLabel(inchFromDiam(val)) < diamPulgFromLabel(inchFromDiam(mainDiamRaw))) {
          eng.triggerAlert(
            'Diámetro no permitido',
            'El diámetro del accesorio no puede ser menor al diámetro del ramal.',
          );
          return;
        }
      }
      engineRef.current.updateSelected({ [fieldDiam]: val });
      setSelElement({ ...selElement, [fieldDiam]: val });
      engineRef.current.render();
      engineRef.current._markDirty();
    };

  const diamOptions = diamList.map((d) => ({ n: d.n }));

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
                  {o.n}
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
                  {o.n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
