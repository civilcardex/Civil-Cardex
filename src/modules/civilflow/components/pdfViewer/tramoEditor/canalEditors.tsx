// CanalNumField (privado) + CanalTramoEditor: editor del canal (ancho, ramales, asociación).
// Extraído verbatim de variants (des-monolitización 2026-10-06).
import { useContext, useState } from 'react';
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import { useTramoEditorContext, INPUT_CENTER_STYLE, SELECT_STYLE } from './context';
import {
  ramalesDelCanal,
  moverAsociacionCanal,
  normalizarCanal,
} from '../../../lib/PlanoEngine/canalAssociation';
import { RainwaterContext } from '../../../context/RainwaterContext';

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
  const { selElement: rawSelElement, handleUpdateSel, engineRef } = useTramoEditorContext();
  // Intensidad vive en los overrides del RainwaterContext (no en el glifo) — acceso
  // null-safe: el panel también corre en árboles sin provider (tests).
  const rw = useContext(RainwaterContext);
  // Refresco local tras cambiar una asociación ramal→bajante (vive en los bajantes, no en el
  // canal seleccionado — sin esto el panel mostraría el desplegable viejo hasta re-seleccionar).
  const [, setAssocTick] = useState(0);
  if (!rawSelElement) return null;
  const selElement = rawSelElement as PlanoBajante;
  // Ítem 3.2: los campos del canal viven en una sola fila para no inflar el panel
  // (base/altura/longitud/pendiente — ítem 7 usuario añade pendiente bidireccional).
  const fieldLabel: React.CSSProperties = {
    fontFamily: "'Geist',monospace",
    fontSize: 12,
    color: '#9BA8AA',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  };
  // Ramales que nacen de este canal (orig. usuario) + su bajante asociado explícito.
  const engine = engineRef.current;
  const canalRamales = engine ? ramalesDelCanal(engine, selElement.id) : [];
  const bajantesLl = (engine?.bajantes || []).filter((b) => b.net === 'll' && b.tipo === 'bajante');
  // Commit de dims del canal (ítem 7 usuario): pendiente con rango 0-15 (alerta y sin
  // commit fuera de rango); base/longitud se normalizan a base-corta en el acto para que
  // el dibujo nunca viole el invariante; se avisa a las tablas vía evento 'storage'.
  const onCanalField = (field: 'base' | 'altura' | 'longitud' | 'pendiente', v: number) => {
    if (field === 'pendiente' && (v <= 0 || v > 15)) {
      engineRef.current?.triggerAlert(
        'Pendiente no permitida',
        'La pendiente del canal debe ser mayor que 0% y hasta 15%. Se conserva el valor anterior.',
      );
      return;
    }
    handleUpdateSel(field, v);
    const eng = engineRef.current;
    const live = eng?.bajantes.find((b) => b.id === selElement.id);
    if (eng && live && (field === 'base' || field === 'longitud')) {
      try {
        normalizarCanal(eng.cmToPlanePx(1), live);
      } catch {
        // Canal corrupto: se conserva lo escrito sin normalizar.
      }
    }
    eng?.render();
    window.dispatchEvent(new Event('storage'));
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
        {/* 2 filas × 2 columnas (pedido usuario): Base|Altura arriba, Longitud|Pendiente abajo. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div>
            <div style={fieldLabel}>Base (cm)</div>
            <CanalNumField
              label="Base (cm)"
              value={selElement.base || 0}
              onCommit={(v) => onCanalField('base', v)}
            />
          </div>
          <div>
            <div style={fieldLabel}>Altura (cm)</div>
            <CanalNumField
              label="Altura (cm)"
              value={selElement.altura || 0}
              onCommit={(v) => onCanalField('altura', v)}
            />
          </div>
          <div>
            <div style={fieldLabel}>Longitud (cm)</div>
            <CanalNumField
              label="Longitud (cm)"
              value={selElement.longitud || 0}
              onCommit={(v) => onCanalField('longitud', v)}
            />
          </div>
          <div>
            <div style={fieldLabel}>Pendiente (%)</div>
            <CanalNumField
              label="Pendiente (%)"
              value={selElement.pendiente ?? 2}
              onCommit={(v) => onCanalField('pendiente', v)}
            />
          </div>
          <div>
            <div style={fieldLabel}>Intensidad (mm/h)</div>
            <CanalNumField
              label="Intensidad (mm/h)"
              value={
                rw?.canalesLl.find(
                  (c) => (c.sector || c.id) === (selElement.code || selElement.id).split('-')[0],
                )?.intensidad ?? 100
              }
              onCommit={(v) => {
                const sector = (selElement.code || selElement.id).split('-')[0];
                // Bidireccional con la tabla de chequeo (orig. usuario): mismo override por
                // sector; default 100 si viene vacío.
                if (sector) rw?.updCanalSector(sector, 'intensidad', v || 100);
                else rw?.updCanalLL(selElement.id, 'intensidad', v || 100);
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
        <div style={fieldLabel}>Ramales del canal</div>
        {canalRamales.length === 0 && (
          <div style={{ fontSize: 11, color: '#8fa0a2', fontFamily: "'Geist',monospace" }}>
            Dibuja un ramal desde dentro del canal hacia un bajante.
          </div>
        )}
        {canalRamales.map((r) => {
          const asociado = bajantesLl.find((b) => b.recibeDeIds?.includes(r.id));
          return (
            <div key={r.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#b9caca', fontFamily: "'Geist',monospace" }}>
                {r.label || r.id} → {asociado?.code || asociado?.id || '— sin bajante —'}
              </div>
              <select
                value={asociado?.id || ''}
                aria-label={`Bajante asociado de ${r.label || r.id}`}
                onChange={(e) => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  moverAsociacionCanal(eng, r.id, e.target.value || null);
                  setAssocTick((n) => n + 1);
                  engineRef.current?.render();
                }}
                style={SELECT_STYLE}
              >
                <option value="">— Sin bajante —</option>
                {bajantesLl.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code || b.id}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </>
  );
}
