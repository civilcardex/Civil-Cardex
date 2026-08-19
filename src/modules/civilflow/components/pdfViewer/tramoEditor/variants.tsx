import { useState } from 'react';
import { bajanteLabel } from '../../../utils/accessoryAbbreviations';
import ExtremeAccessoryEditor from '../ExtremeAccessoryEditor';
import type {
  PlanoBajante,
  PlanoArea,
  PlanoRamal,
  PlanoTextAnnotation,
} from '../../../lib/PlanoEngine/PlanoState';
import {
  useTramoEditorContext,
  INPUT_CENTER_STYLE,
  CHECK_GRID_STYLE,
  CHECK_ROW_STYLE,
  INPUT_50_STYLE,
  INPUT_STYLE,
  READONLY_STYLE,
  type ProbedElement,
} from './context';
import { ContadorEditor, CalentadorEditor, BajanteEditor, RamalEditor } from './legacyEditors';

export function ContadorTramoEditor() {
  const { selElement, activeNet, handleUpdateSel } = useTramoEditorContext();
  return (
    <ContadorEditor
      selElement={selElement as PlanoBajante}
      activeNet={activeNet}
      handleUpdateSel={handleUpdateSel}
    />
  );
}

export function CalentadorTramoEditor() {
  const { selElement, handleUpdateSel } = useTramoEditorContext();
  return (
    <CalentadorEditor selElement={selElement as PlanoBajante} handleUpdateSel={handleUpdateSel} />
  );
}

// Patrón de texto libre con commit al perder el foco (buffer local de edición) — igual que CanalDimField
// en RainChannelsCheck.tsx y CanalDimInput en DrawingElementContextMenu, porque un input
// controlado por tecla pelea contra el tipeo decimal ('.' final, números parciales).
function CanalNumField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const display = editing ? text : value > 0 ? String(value) : '';
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder="0"
      aria-label={label}
      onFocus={() => {
        setEditing(true);
        setText(display);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
        setText(raw);
      }}
      onKeyDown={(e) => {
        // Enter commitea el cambio (mismo comportamiento que el resto de campos numéricos)
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        setEditing(false);
        const v = parseFloat(text) || 0;
        onCommit(text === '' ? 0 : v);
      }}
      style={INPUT_CENTER_STYLE}
    />
  );
}

export function CanalTramoEditor() {
  const { selElement: rawSelElement, handleUpdateSel } = useTramoEditorContext();
  if (!rawSelElement) return null;
  const selElement = rawSelElement as PlanoBajante;
  // Ítem 3.2: los tres campos del canal viven en una sola fila para no inflar el panel.
  const fieldLabel: React.CSSProperties = {
    fontFamily: "'Geist',monospace",
    fontSize: 12,
    color: '#9BA8AA',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  };
  return (
    <>
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div style={fieldLabel}>Datos del canal</div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#b9caca',
            fontFamily: "'Geist',monospace",
            padding: '2px 0',
          }}
        >
          {selElement.code || selElement.id}
        </div>
      </div>

      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div>
            <div style={fieldLabel}>Base (cm)</div>
            <CanalNumField
              label="Base (cm)"
              value={selElement.base || 0}
              onCommit={(v) => handleUpdateSel('base', v)}
            />
          </div>
          <div>
            <div style={fieldLabel}>Altura (cm)</div>
            <CanalNumField
              label="Altura (cm)"
              value={selElement.altura || 0}
              onCommit={(v) => handleUpdateSel('altura', v)}
            />
          </div>
          <div>
            <div style={fieldLabel}>Longitud (cm)</div>
            <CanalNumField
              label="Longitud (cm)"
              value={selElement.longitud || 0}
              onCommit={(v) => handleUpdateSel('longitud', v)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

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

export function AreaHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = useTramoEditorContext();
  if (!rawSelElement) return null;
  const selElement = rawSelElement as PlanoArea;
  return (
    <>
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
            (engineRef.current?.bajantes || []).find((b) => b.area_m2 === selElement.areaM2)?.id ||
            ''
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
    </>
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

export function BajanteEditorSection() {
  const ctx = useTramoEditorContext();
  const { engineRef, activeNet } = ctx;
  const selElement = ctx.selElement as ProbedElement | null;
  const lvl = engineRef.current?.nivelActual?.label ?? '';

  const isGhostSel =
    (selElement &&
      (selElement.tipo === 'bajante' || selElement.tipo === 'montante') &&
      engineRef.current?._isGhostSel) ||
    false;

  return (
    <BajanteEditor
      selElement={selElement as PlanoBajante}
      activeNet={activeNet}
      engineRef={engineRef}
      setSelElement={ctx.setSelElement}
      handleUpdateSel={ctx.handleUpdateSel}
      isGhostSel={isGhostSel}
      lvl={lvl}
    />
  );
}

export function RamalEditorSection() {
  const ctx = useTramoEditorContext();
  const {
    engineRef,
    setSelElement,
    activeNet,
    plans,
    diamSel,
    gasMatSel,
    pendSel,
    pendInput,
    mats,
    matLongName,
    setDiamSel,
    setGasMatSel,
    setPendSel,
    setPendInput,
  } = ctx;
  const selElement = ctx.selElement as ProbedElement | null;
  const isSelActiveNet = selElement && selElement.net === activeNet;

  return (
    <>
      <RamalEditor
        selElement={selElement as PlanoRamal | null}
        activeNet={activeNet}
        engineRef={engineRef}
        setSelElement={setSelElement}
        isSelActiveNet={isSelActiveNet}
        diamSel={diamSel}
        gasMatSel={gasMatSel}
        pendSel={pendSel}
        pendInput={pendInput}
        mats={mats}
        matLongName={matLongName}
        setDiamSel={setDiamSel}
        setGasMatSel={setGasMatSel}
        setPendSel={setPendSel}
        setPendInput={setPendInput}
      />
      {selElement && ['tributario', 'ramal'].includes(selElement.tipo ?? '') && (
        <ExtremeAccessoryEditor
          selElement={selElement as PlanoRamal}
          engineRef={engineRef}
          setSelElement={(el) => setSelElement(el)}
          activeNet={activeNet}
          plans={plans}
        />
      )}
      {selElement?.pts &&
        (engineRef.current?.bajantes?.length ?? 0) > 0 &&
        ['san', 'll'].includes(activeNet) && (
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
            <div
              style={{
                fontSize: 12,
                color: '#9BA8AA',
                fontFamily: "'Geist',monospace",
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Bajantes asociados
            </div>
            <div style={CHECK_GRID_STYLE}>
              {(() => {
                const netBajs = (engineRef.current?.bajantes || []).filter(
                  (b) => b.net === activeNet && b.tipo !== 'tributario',
                );
                if (netBajs.length === 0)
                  return (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#8AB4D6',
                        fontFamily: "'Geist',monospace",
                        padding: '4px',
                        gridColumn: 'span 2',
                      }}
                    >
                      Sin bajantes en esta red
                    </div>
                  );
                return netBajs.map((b) => {
                  const isAssoc = (b.recibeDeIds || []).includes(selElement.id);
                  return (
                    <label key={b.id} style={CHECK_ROW_STYLE}>
                      <input
                        type="checkbox"
                        checked={isAssoc}
                        onChange={(e) => {
                          const newRecibe = e.target.checked
                            ? b.recibeDeIds.includes(selElement.id)
                              ? b.recibeDeIds
                              : [...b.recibeDeIds, selElement.id]
                            : b.recibeDeIds.filter((id: string) => id !== selElement.id);
                          engineRef.current?.updateElementById(b.id, { recibeDeIds: newRecibe });
                          engineRef.current?.render();
                          engineRef.current?._markDirty();
                        }}
                        style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {bajanteLabel(b, engineRef.current?.nivelActual?.label)}
                      </span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>
        )}
    </>
  );
}
