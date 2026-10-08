// Campos de cabecera por tipo de tramo: bajante, rejillas, área, texto y ramal.
// Extraídos verbatim de variants.
import { bajanteLabel } from '../../../utils/accessoryAbbreviations';
import type {
  PlanoBajante,
  PlanoArea,
  PlanoRamal,
  PlanoTextAnnotation,
} from '../../../lib/PlanoEngine/PlanoState';
import { useTramoEditorContext, INPUT_50_STYLE, INPUT_STYLE, READONLY_STYLE } from './context';

export function BajanteHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = useTramoEditorContext();
  if (!rawSelElement) return null;
  const selElement = rawSelElement as PlanoBajante;
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: '#8AB4D6',
          fontFamily: "'Geist',monospace",
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        Código
      </div>
      <input
        value={selElement.code || ''}
        placeholder="Código bajante"
        aria-label="Código"
        onChange={(e) => {
          if (engineRef.current) {
            const v = e.target.value;
            engineRef.current.updateSelected({ code: v });
            setSelElement({ ...selElement, code: v });
          }
        }}
        style={INPUT_50_STYLE}
      />
    </div>
  );
}

/** Sección del módulo Rejillas de ventilación (NTC 3631) para áreas de sector dibujadas con
 *  la pestaña Gas: la Etiqueta del área es el nombre del Sector y aquí se define su altura
 *  libre (m) — ambos alimentan las columnas Sector/Área/Alto de la tabla Tipologías. */
export function RejillasSectorFields() {
  const { selElement: rawSelElement, engineRef } = useTramoEditorContext();
  if (!rawSelElement) return null;
  const selElement = rawSelElement as PlanoArea;
  const altura = selElement.alturaM ?? 2.4;
  return (
    <div style={{ borderTop: '1px solid #3a494a', paddingTop: 8 }}>
      <div
        style={{
          fontSize: 12,
          color: '#9BA8AA',
          fontFamily: "'Geist',monospace",
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        Sector · Rejillas (NTC 3631)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: '#849495',
              fontFamily: "'Geist',monospace",
              marginBottom: 3,
            }}
          >
            Sector (etiqueta)
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#b9caca',
              fontFamily: "'Geist',monospace",
              padding: '4px 0',
            }}
          >
            {selElement.label || '—'}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: '#849495',
              fontFamily: "'Geist',monospace",
              marginBottom: 3,
            }}
          >
            Altura libre (m)
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            defaultValue={altura}
            key={`${selElement.id}_${altura}`}
            aria-label="Altura libre del sector (m)"
            onBlur={(e) => {
              const v = Math.max(0, parseFloat(e.target.value) || 0);
              engineRef.current?.updateSelected({ alturaM: v });
              engineRef.current?.render();
            }}
            style={{
              width: '100%',
              background: '#0d1117',
              border: '1px solid #3a494a',
              borderRadius: 4,
              color: '#e6edf3',
              fontFamily: "'Geist',monospace",
              fontSize: 12,
              padding: '4px 6px',
              textAlign: 'center',
            }}
          />
        </div>
      </div>
      <div
        style={{ fontSize: 10.5, color: '#849495', fontFamily: "'Geist',monospace", marginTop: 5 }}
      >
        El área ({selElement.areaM2} m²) y los gasodomésticos asignados alimentan la tabla
        Tipologías de Rejillas de ventilación.
      </div>
    </div>
  );
}

export function AreaHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = useTramoEditorContext();
  if (!rawSelElement) return null;
  const selElement = rawSelElement as PlanoArea;
  // Área de sector del módulo Rejillas (NTC 3631): sin sección Asociar Bajante —
  // el sector no drena a un bajante, ventilá por rejillas.
  const esRejillas = selElement.net === 'gas';
  return (
    <div>
      <div>
        <div
          style={{
            fontSize: 12,
            color: '#8AB4D6',
            fontFamily: "'Geist',monospace",
            marginBottom: 2,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
          Etiqueta
        </div>
        <input
          value={selElement.label || ''}
          placeholder="Etiqueta área"
          aria-label="Etiqueta"
          onChange={(e) => {
            if (engineRef.current) {
              const v = e.target.value;
              engineRef.current.updateSelected({ label: v });
              setSelElement({ ...selElement, label: v });
            }
          }}
          style={INPUT_STYLE}
        />
      </div>
      <div>
        <div
          style={{
            fontSize: 12,
            color: '#8AB4D6',
            fontFamily: "'Geist',monospace",
            marginBottom: 2,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
          Área calculada
        </div>
        <div style={READONLY_STYLE}>{selElement.areaM2 ? `${selElement.areaM2} m²` : '—'}</div>
      </div>
      {!esRejillas && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: '#8AB4D6',
              fontFamily: "'Geist',monospace",
              marginBottom: 2,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
            }}
          >
            Asociar Bajante
          </div>
          <select
            aria-label="Asociar bajante"
            value={
              (engineRef.current?.bajantes || []).find((b) => b.area_m2 === selElement.areaM2)
                ?.id || ''
            }
            onChange={(e) => {
              const bajanteId = e.target.value;
              (engineRef.current?.bajantes || []).forEach((b) => {
                if (b.area_m2 === selElement.areaM2) {
                  engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                }
              });
              if (bajanteId) {
                engineRef.current?.updateElementById(bajanteId, { area_m2: selElement.areaM2 });
              }
              if (engineRef.current) engineRef.current._markDirty();
              setSelElement({ ...selElement });
            }}
            style={INPUT_STYLE}
          >
            <option value="">— Sin bajante —</option>
            {(engineRef.current?.bajantes || [])
              .filter((b) => b.net === selElement.net && b.tipo !== 'canal')
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {bajanteLabel(b, engineRef.current?.nivelActual?.label)}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function TextHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = useTramoEditorContext();
  if (!rawSelElement) return null;
  const selElement = rawSelElement as PlanoTextAnnotation;
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: '#8AB4D6',
          fontFamily: "'Geist',monospace",
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        Texto
      </div>
      <input
        value={selElement.text || ''}
        placeholder="Texto"
        aria-label="Texto adicional"
        onChange={(e) => {
          if (engineRef.current) {
            const v = e.target.value;
            engineRef.current.updateSelected({ text: v });
            setSelElement({ ...selElement, text: v });
          }
        }}
        style={INPUT_STYLE}
      />
    </div>
  );
}

export function RamalHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = useTramoEditorContext();
  if (!rawSelElement) return null;
  const selElement = rawSelElement as PlanoRamal;

  const displayLabelWithPiso = (label: string | null | undefined, pisoLabel: string) => {
    if (!label) return '';
    if (label.includes('-')) return label;
    if (!pisoLabel) return label;
    const n = engineRef.current?.nivelActual?.n;
    let corto: string | null = null;
    if (typeof n === 'number') {
      if (n < 0) corto = `S${Math.abs(n)}`;
      else if (n === 99) corto = 'C';
      else corto = `P${n}`;
    }
    if (!corto) {
      const match = /(\d+)$/.exec(pisoLabel);
      if (match) {
        const num = parseInt(match[1], 10);
        const prefixMatch = /^(\D+)/.exec(pisoLabel);
        const prefix = prefixMatch ? prefixMatch[1].trim().toLowerCase() : '';
        if (prefix.startsWith('s') || prefix.startsWith('só') || prefix.includes('sot'))
          corto = `S${num}`;
        else if (prefix.startsWith('c')) corto = 'C';
        else corto = `P${num}`;
      }
    }
    return corto ? `${label}-${corto}` : `${label}-${pisoLabel}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 3 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              color: '#8AB4D6',
              fontFamily: "'Geist',monospace",
              marginBottom: 2,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
            }}
          >
            Nombre
          </div>
          <input
            value={displayLabelWithPiso(
              selElement.label,
              engineRef.current?.nivelActual?.label ?? '',
            )}
            placeholder="Tramo"
            aria-label="Nombre del tramo"
            onChange={(e) => {
              if (engineRef.current) {
                const v = e.target.value;
                engineRef.current.updateSelected({ label: v });
                setSelElement({ ...selElement, label: v });
              }
            }}
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              color: '#8AB4D6',
              fontFamily: "'Geist',monospace",
              marginBottom: 2,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
            }}
          >
            Inicio
          </div>
          <input
            value={selElement.ini || ''}
            placeholder="— inicial —"
            aria-label="Conexión de inicio"
            onChange={(e) => {
              if (engineRef.current) {
                const v = e.target.value;
                engineRef.current.updateSelected({ ini: v });
                setSelElement({ ...selElement, ini: v });
              }
            }}
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              color: '#8AB4D6',
              fontFamily: "'Geist',monospace",
              marginBottom: 2,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
            }}
          >
            Final
          </div>
          <input
            value={selElement.fin || ''}
            placeholder="— final —"
            aria-label="Conexión de fin"
            onChange={(e) => {
              if (engineRef.current) {
                const v = e.target.value;
                engineRef.current.updateSelected({ fin: v });
                setSelElement({ ...selElement, fin: v });
              }
            }}
            style={INPUT_STYLE}
          />
        </div>
      </div>
    </div>
  );
}
