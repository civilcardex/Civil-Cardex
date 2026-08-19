import { useState } from 'react';
import type { PlanoBajante } from '../../../lib/PlanoEngine/PlanoState';
import {
  useDrawingElementContextMenu,
  MENU_SELECT_STYLE,
  MENU_SECTION_LABEL_ROW_STYLE,
} from './context';
import { BajanteCodeEditor } from './bajanteMenus';

export function AreaMenu() {
  const ctx = useDrawingElementContextMenu();
  return (
    <BajanteCodeEditor
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

export function ContadorMenu() {
  const ctx = useDrawingElementContextMenu();
  return (
    <BajanteCodeEditor
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

export function CalentadorMenu() {
  const ctx = useDrawingElementContextMenu();
  return (
    <BajanteCodeEditor
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

const CANAL_FIELD_LABELS: Record<'base' | 'altura' | 'longitud', string> = {
  base: 'Base (cm)',
  altura: 'Altura (cm)',
  longitud: 'Longitud (cm)',
};

// Patrón de commit con texto libre (buffer de edición local, commit al perder el foco) — igual
// que CanalDimField en RainChannelsCheck.tsx, ya que los demás campos numéricos de este archivo
// son todos desplegables <select> y base/altura necesitan entrada decimal arbitraria.
function CanalDimInput({
  field,
  value,
  onCommit,
}: {
  field: 'base' | 'altura' | 'longitud';
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
      style={MENU_SELECT_STYLE}
    />
  );
}

export function CanalMenu() {
  const { element, engineRef, selElement, setSelElement, setContextMenuState } =
    useDrawingElementContextMenu();
  const canal = element as PlanoBajante;

  const commit = (field: 'base' | 'altura' | 'longitud', v: number) => {
    engineRef.current?.updateElementById(canal.id, { [field]: v });
    setContextMenuState((prev) =>
      prev ? { ...prev, element: { ...prev.element, [field]: v } } : null,
    );
    if (selElement?.id === canal.id) {
      setSelElement({ ...selElement, [field]: v });
    }
  };

  return (
    <>
      {(['base', 'longitud', 'altura'] as const).map((field) => (
        <div key={field} style={{ padding: '0 8px 8px' }}>
          <div style={MENU_SECTION_LABEL_ROW_STYLE}>{CANAL_FIELD_LABELS[field]}</div>
          <CanalDimInput
            field={field}
            value={canal[field] || 0}
            onCommit={(v) => commit(field, v)}
          />
        </div>
      ))}
      <div style={{ padding: '0 8px 8px' }}>
        <div style={MENU_SECTION_LABEL_ROW_STYLE}>Asociar bajante externo</div>
        <select
          value={canal.bajanteExternoId || ''}
          aria-label="Asociar bajante externo"
          onChange={(e) => {
            const v = e.target.value || null;
            engineRef.current?.updateElementById(canal.id, { bajanteExternoId: v });
            setContextMenuState((prev) =>
              prev ? { ...prev, element: { ...prev.element, bajanteExternoId: v } } : null,
            );
            if (selElement?.id === canal.id) {
              setSelElement({ ...selElement, bajanteExternoId: v });
            }
            engineRef.current?.render();
          }}
          style={MENU_SELECT_STYLE}
        >
          <option value="">— Sin bajante —</option>
          {(engineRef.current?.bajantes || [])
            .filter((b) => b.net === 'll' && b.tipo !== 'canal')
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.code || b.id}
              </option>
            ))}
        </select>
      </div>
    </>
  );
}
