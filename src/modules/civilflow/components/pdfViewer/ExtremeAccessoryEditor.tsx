import {
  syncExtremeAccessoryToHidroData,
  syncExtremeAparatoToCounts,
} from '../../utils/syncExtremeAccessory';
import { getAccessoryOptions } from '../../utils/accessoryOptions';
import { DIAM_BY_MAT } from '../../constants';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { matchDiamOption } from '../../utils/diamOptionMatch';
import { codoPolarityOk } from '../../lib/PlanoEngine/PlanoEngineDrawing';
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
        // Ítems 12/13: la polaridad del codo de montante (sube/baja) debe ser coherente con la
        // dirección de flujo del ramal en el extremo — sube solo ENTREGA (cola de la flecha al
        // extremo: el flujo SALE de P hacia el codo), baja solo RECIBE (cabeza de la flecha al
        // extremo: el flujo LLEGA a P desde el codo).
        if (
          val === 'codoSube' ||
          val === 'codoBaja' ||
          val === 'codo90rmSube' ||
          val === 'codo90rmBaja'
        ) {
          const idx = field === 'accesorioInicio' ? 0 : selElement.pts.length - 1;
          const pt = selElement.pts[idx];
          if (pt && !codoPolarityOk(selElement, pt, val, 0.5)) {
            const isSube = val === 'codoSube' || val === 'codo90rmSube';
            eng.triggerAlert(
              'Polaridad de codo incorrecta',
              isSube
                ? 'El codo 90° sube exige que la cola de la flecha apunte a este extremo (el flujo debe salir de aquí hacia el codo). Invierte la dirección del ramal o usa "baja".'
                : 'El codo 90° baja exige que la cabeza de la flecha apunte a este extremo (el flujo debe llegar aquí desde el codo). Invierte la dirección del ramal o usa "sube".',
            );
            return;
          }
        }
        const oldVal = selElement[field] || '';
        const updates: Record<string, unknown> = { [field]: val };
        // El accesorio hereda el diámetro del ramal como valor por defecto: si el ramal ya
        // tiene diámetro asignado, el accesorio nuevo nace con ese mismo diámetro (resuelto al
        // valor canónico de las opciones del selector); si no, queda "Ninguno". (Cambiar el
        // tipo de accesorio de uno existente respeta el diámetro que el usuario ya eligió.)
        const fieldDiam: 'diametroInicio' | 'diametroFin' =
          field === 'accesorioInicio' ? 'diametroInicio' : 'diametroFin';
        if (val && !oldVal) updates[fieldDiam] = matchDiamOption(diamList, selElement.diametro);
        const fieldApp: 'aparatoInicio' | 'aparatoFin' =
          field === 'accesorioInicio' ? 'aparatoInicio' : 'aparatoFin';
        const removedApp = val && selElement[fieldApp] ? selElement[fieldApp] : '';
        if (removedApp) {
          updates[fieldApp] = null;
        }
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
      // Leer el diámetro del ramal fresco del engine — el snapshot selElement puede estar
      // stale si el cambio vino de otro componente (TramoEditor vs menú contextual).
      const fresh = engineRef.current.ramales.find((x) => x.id === selElement.id);
      const ramalDiam = fresh?.diametro || selElement.diametro || '';
      if (val && ramalDiam) {
        const inchFrom = (d: string) => {
          const q = d.indexOf('"');
          return q > 0 ? d.slice(0, q) : d;
        };
        if (diamPulgFromLabel(inchFrom(val)) > diamPulgFromLabel(inchFrom(ramalDiam))) {
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
  const diamValue = (raw: string | undefined) => matchDiamOption(diamList, raw);

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
              value={diamValue(selElement.diametroInicio) || diamValue(selElement.diametro) || ''}
              aria-label="Diámetro inicio"
              onChange={onDiamChange('diametroInicio')}
              style={ExtremeAccessoryEditor_S1}
            >
              <option value="">Ninguno</option>
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
              value={diamValue(selElement.diametroFin) || diamValue(selElement.diametro) || ''}
              aria-label="Diámetro fin"
              onChange={onDiamChange('diametroFin')}
              style={ExtremeAccessoryEditor_S4}
            >
              <option value="">Ninguno</option>
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
