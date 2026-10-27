import { useState } from 'react';
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState.ts';
import {
  useDrawingElementContextMenu,
  MENU_SELECT_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
} from './context.ts';
import {
  ASSOC_CHECKBOX_STYLE,
  ASSOC_ROW_STYLE,
  MaterialesCanalSection,
} from './associatedChannels';
import { ElementCodeEditor } from './elementEditor.tsx';
import {
  ramalesDelCanal,
  moverAsociacionCanal,
  normalizarCanal,
  vetarSelloCanal,
  levantarVetoSelloCanal,
} from '../../../lib/PlanoEngine/channelAssociation';
import { dec, sanitizarInputDecimal } from '../../../utils/parseDecimal.ts';
import { EV_STORAGE } from '../../../utils/fixtureEvents.ts';

/** Menú contextual de un área del plano: reutiliza el editor de código/etiqueta genérico
 *  (ElementCodeEditor) para el elemento seleccionado. */
export function AreaMenu() {
  const ctx = useDrawingElementContextMenu();
  return (
    <ElementCodeEditor
      element={ctx.element}
      engineRef={ctx.engineRef}
      selElement={ctx.selElement}
      setSelElement={ctx.setSelElement}
      setContextMenuState={ctx.setContextMenuState}
      mats={ctx.mats}
      activeNet={ctx.activeNet}
      setDiamSel={ctx.setDiamSel}
      planosCtx={ctx.planosCtx}
    />
  );
}

/** Menú contextual de un contador de agua del plano: editor de código del elemento
 *  (ElementCodeEditor). */
export function ContadorMenu() {
  const ctx = useDrawingElementContextMenu();
  return (
    <ElementCodeEditor
      element={ctx.element}
      engineRef={ctx.engineRef}
      selElement={ctx.selElement}
      setSelElement={ctx.setSelElement}
      setContextMenuState={ctx.setContextMenuState}
      mats={ctx.mats}
      activeNet={ctx.activeNet}
      setDiamSel={ctx.setDiamSel}
      planosCtx={ctx.planosCtx}
    />
  );
}

/** Menú contextual de un calentador de agua del plano (equipo de ac (Agua Caliente)): editor de
 *  código del elemento (ElementCodeEditor). */
export function CalentadorMenu() {
  const ctx = useDrawingElementContextMenu();
  return (
    <ElementCodeEditor
      element={ctx.element}
      engineRef={ctx.engineRef}
      selElement={ctx.selElement}
      setSelElement={ctx.setSelElement}
      setContextMenuState={ctx.setContextMenuState}
      mats={ctx.mats}
      activeNet={ctx.activeNet}
      setDiamSel={ctx.setDiamSel}
      planosCtx={ctx.planosCtx}
    />
  );
}

const CANAL_FIELD_LABELS: Record<'base' | 'altura' | 'longitud' | 'pendiente', string> = {
  base: 'Base (cm)',
  altura: 'Altura (cm)',
  longitud: 'Longitud (cm)',
  pendiente: 'Pendiente (%)',
};

// Patrón de commit con texto libre (buffer de edición local, commit al perder el foco) — igual
// que CanalDimField en RainChannelsCheck.tsx, ya que los demás campos numéricos de este archivo
// son todos desplegables <select> y base/altura necesitan entrada decimal arbitraria.
function CanalDimInput({
  field,
  value,
  onCommit,
}: {
  field: 'base' | 'altura' | 'longitud' | 'pendiente';
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
      aria-label={CANAL_FIELD_LABELS[field]}
      onFocus={() => {
        setEditing(true);
        setText(display);
      }}
      onChange={(e) => {
        const raw = sanitizarInputDecimal(e.target.value);
        setText(raw);
      }}
      onKeyDown={(e) => {
        // Enter commitea el cambio (mismo comportamiento que el resto de campos numéricos)
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        setEditing(false);
        const v = dec(text);
        onCommit(text === '' ? 0 : v);
      }}
      style={MENU_SELECT_STYLE}
    />
  );
}

/** Menú contextual de un canal de lluvias (ll (Lluvias)): dimensiones editables (base/altura/
 *  longitud en cm, pendiente 0-15 %), materiales, bajantes ll asociados (checkbox bidireccional
 *  canal↔bajante) y sus ramales con el bajante que recibe cada uno. */
export function CanalMenu() {
  const { element, engineRef, selElement, setSelElement, setContextMenuState, activeNet } =
    useDrawingElementContextMenu();
  const canal = element as PlanoBajante;
  const engine = engineRef.current;

  const commit = (field: 'base' | 'altura' | 'longitud' | 'pendiente', v: number) => {
    if (field === 'pendiente' && (v <= 0 || v > 15)) {
      engineRef.current?.triggerAlert(
        'Pendiente no permitida',
        'La pendiente del canal debe ser mayor que 0% y hasta 15%. Se conserva el valor anterior.',
      );
      return;
    }
    engineRef.current?.updateElementById(canal.id, { [field]: v });
    // Base/longitud se normalizan a base-corta en el acto (ítem 5 usuario); se avisa a
    // las tablas vía evento 'storage'.
    const eng = engineRef.current;
    const live = eng?.bajantes.find((b) => b.id === canal.id);
    if (eng && live && (field === 'base' || field === 'longitud')) {
      try {
        normalizarCanal(eng.cmToPlanePx(1), live);
      } catch {
        // Canal corrupto: se conserva lo escrito sin normalizar.
      }
      eng.render();
    }
    window.dispatchEvent(new Event(EV_STORAGE));
    setContextMenuState((prev) =>
      prev ? { ...prev, element: { ...prev.element, [field]: v } } : null,
    );
    if (selElement?.id === canal.id) {
      setSelElement({ ...selElement, [field]: v });
    }
  };

  // Ramales que nacen de este canal (orig. usuario: la asociación canal↔bajante vive en estos
  // ramales, nada automático). Cada uno elige/limpia su bajante asociado por desplegable.
  const canalRamales = engine ? ramalesDelCanal(engine, canal.id) : [];
  const bajantesLl = (engine?.bajantes || []).filter((b) => b.net === 'll' && b.tipo === 'bajante');

  return (
    <>
      {(['base', 'longitud', 'altura', 'pendiente'] as const).map((field) => (
        <div key={field} style={{ padding: '0 8px 8px' }}>
          <div style={MENU_SECTION_LABEL_ROW_STYLE}>{CANAL_FIELD_LABELS[field]}</div>
          <CanalDimInput
            field={field}
            value={canal[field] || 0}
            onCommit={(v) => commit(field, v)}
          />
        </div>
      ))}
      <MaterialesCanalSection
        ctx={{ engineRef, activeNet, setContextMenuState }}
        canalId={canal.id}
      />
      {/* BIDIRECCIONAL (orig. usuario): la asociación canal↔bajante vive en b.canalId —
          desde el canal se ven y marcan los mismos bajantes que desde el lado del bajante. */}
      <div style={{ padding: '0 8px 8px' }}>
        <div style={MENU_SECTION_LABEL_ROW_STYLE}>Bajantes asociados</div>
        {(() => {
          const bajantesLlDir = (engine?.bajantes || []).filter(
            (b) => b.net === 'll' && b.tipo === 'bajante',
          );
          if (bajantesLlDir.length === 0)
            return (
              <div style={{ ...MENU_SELECT_STYLE, border: 'none', color: 'var(--txt3)' }}>
                Sin bajantes de lluvias dibujados.
              </div>
            );
          return bajantesLlDir.map((b) => (
            <label key={b.id} style={ASSOC_ROW_STYLE}>
              <input
                type="checkbox"
                style={ASSOC_CHECKBOX_STYLE}
                checked={b.canalId === canal.id}
                onChange={() => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  const desmarcando = b.canalId === canal.id;
                  const pid = String(engineRef.current?._loadedPlanId ?? '');
                  if (desmarcando) vetarSelloCanal(pid, 'baj', b.id, canal.id);
                  else levantarVetoSelloCanal(pid, 'baj', b.id, canal.id);
                  eng.updateElementById(b.id, {
                    canalId: desmarcando ? null : canal.id,
                  });
                  eng.render();
                  eng._markDirty();
                  setContextMenuState((prev) => (prev ? { ...prev } : null));
                }}
              />
              {b.code || b.id}
            </label>
          ));
        })()}
      </div>
      <div style={{ padding: '0 8px 8px' }}>
        <div style={MENU_SECTION_LABEL_ROW_STYLE}>Ramales del canal</div>
        {canalRamales.length === 0 && (
          <div style={{ ...MENU_SELECT_STYLE, border: 'none', color: 'var(--txt3)' }}>
            Dibuja un ramal desde dentro del canal hacia un bajante.
          </div>
        )}
        {canalRamales.map((r) => {
          const asociado = bajantesLl.find((b) => b.recibeDeIds?.includes(r.id));
          return (
            <div key={r.id} style={{ paddingBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--txt2)', fontFamily: 'var(--mono)' }}>
                {r.label || r.id} → {asociado?.code || asociado?.id || '— sin bajante —'}
              </div>
              <select
                value={asociado?.id || ''}
                aria-label={`Bajante asociado de ${r.label || r.id}`}
                onChange={(e) => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  moverAsociacionCanal(eng, r.id, e.target.value || null);
                  setContextMenuState((prev) => (prev ? { ...prev } : null));
                  engineRef.current?.render();
                }}
                style={MENU_SELECT_STYLE}
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
