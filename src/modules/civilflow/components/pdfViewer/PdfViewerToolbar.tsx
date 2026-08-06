import { memo } from 'react';

export interface ToolDef {
  id: string;
  label: string;
  ico: string;
  key: string;
  icoCol: string;
  shortcut: string;
}

// Bajante solo tiene sentido en san/vent/ll (bajantes); montante solo en gas/ac/af (montantes) —
// centralizado aquí para que las dos rutas de render de la barra (expandida/colapsada) y los
// atajos de teclado de PlanoEngine.ts apliquen exactamente la misma regla sin divergir.
export function isToolDisabledForNet(
  toolId: string,
  net: string,
  recolectoraActive = true,
): boolean {
  if (toolId === 'baj') return !['san', 'vent', 'll'].includes(net);
  if (toolId === 'mon') return !['gas', 'ac', 'af'].includes(net);
  // Los glifos de canal recolectora solo tienen sentido cuando esa red está activa para el
  // proyecto — de lo contrario la herramienta dibujaría formas de una red que el proyecto
  // no está diseñando.
  if (toolId === 'canal') return !recolectoraActive;
  return false;
}

export const TOOLS: ToolDef[] = [
  {
    id: 'sel',
    label: 'Seleccionar',
    ico: '\uD83D\uDC46',
    key: 'S',
    icoCol: '#9BA8AA',
    shortcut: 'S',
  },
  {
    id: 'line',
    label: 'Ramal/Tributario',
    ico: '\u2571',
    key: 'L',
    icoCol: '#4D8FF7',
    shortcut: 'L',
  },
  { id: 'area', label: 'Área', ico: '\u2B21', key: 'A', icoCol: '#22D3EE', shortcut: 'A' },
  {
    id: 'dim',
    label: 'Medir/Acotar',
    ico: '\uD83D\uDCCF',
    key: 'D',
    icoCol: '#22D3EE',
    shortcut: 'D',
  },
  {
    id: 'guide',
    label: 'L\u00EDnea gu\u00EDa',
    ico: '\u2504',
    key: 'G',
    icoCol: '#888888',
    shortcut: 'G',
  },
  { id: 'text', label: 'Texto', ico: 'T', key: 'T', icoCol: '#A855F7', shortcut: 'T' },
  { id: 'baj', label: 'Bajante', ico: '\u2193', key: 'B', icoCol: '#F04545', shortcut: 'B' },
  { id: 'mon', label: 'Montante', ico: '\u2191', key: 'M', icoCol: '#3B82F6', shortcut: 'M' },
  { id: 'erase', label: 'Borrador', ico: '🧽', key: 'E', icoCol: '#ffb4ab', shortcut: 'E' },
  {
    id: 'pan',
    label: 'Mover',
    ico: '\u270B',
    key: 'Espacio',
    icoCol: '#10B981',
    shortcut: 'Espacio',
  },
];

const PdfViewerToolbar_S2: React.CSSProperties = {
  padding: '5px 8px',
  fontFamily: "'Geist',monospace",
  fontWeight: 600,
  transition: 'all .12s',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
};
const PdfViewerToolbar_S3: React.CSSProperties = {
  padding: '5px 8px',
  fontFamily: "'Geist',monospace",
  fontWeight: 600,
  transition: 'all .12s',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  fontSize: 12,
};

export const STATUS: Record<string, { color: string; label: string }> = {
  saved: { color: '#22c55e', label: '\u2714 Guardado' },
  saving: { color: '#3b82f6', label: '\u23F3 Guardando...' },
  error: { color: '#ef4444', label: '\u26A0 Sin guardar' },
};

const accBtn: React.CSSProperties = {
  padding: '6px 8px',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: '4px',
  color: '#b9caca',
  cursor: 'pointer',
  fontFamily: "'Geist',monospace",
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all .12s',
};

type NavFn = () => void;
type SelToolFn = (toolId: string) => void;
export type PdfViewerToolbarProps = {
  tool: string;
  snapOn: boolean;
  activeNet: string;
  currentFile: File | null;
  saveStatus: string;
  collapsed?: boolean;
  recolectoraActive: boolean;
  onSelectTool: SelToolFn;
  onSnapToggle: NavFn;
  onFit: NavFn;
  onSave: NavFn;
  onUndo: NavFn;
  onRedo: NavFn;
  onClear: NavFn;
};

const compactBtn: React.CSSProperties = {
  width: '100%',
  padding: '3px 0',
  background: '#1e2024',
  border: '1px solid #3a494a',
  borderRadius: '3px',
  color: '#b9caca',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  fontFamily: "'Geist',monospace",
  transition: 'all .12s',
};

// "Espacio" no cabe en una columna de iconos de 44px — se abrevia solo para la franja colapsada;
// la palabra completa sigue viéndose en el tooltip del título y en la barra expandida.
const compactShortcut = (s: string) => (s === 'Espacio' ? 'Esp' : s);

function PdfViewerToolbar_({
  tool,
  snapOn,
  activeNet,
  currentFile,
  saveStatus,
  collapsed,
  recolectoraActive,
  onSelectTool,
  onSnapToggle,
  onFit,
  onSave,
  onUndo,
  onRedo,
  onClear,
}: PdfViewerToolbarProps) {
  const netTools = [...TOOLS];
  if (activeNet === 'af' || activeNet === 'gas') {
    netTools.splice(7, 0, {
      id: 'cont',
      label: 'Contador',
      ico: '🔳',
      key: 'C',
      icoCol: '#4D8FF7',
      shortcut: 'C',
    });
  }
  if (activeNet === 'll') {
    netTools.splice(7, 0, {
      id: 'canal',
      label: 'Canal',
      ico: '▭',
      // 'C' is shared with Contador (af/gas) — mutually exclusive nets, see PlanoEngine.ts's
      // 'c' key handler.
      key: 'C',
      icoCol: '#8B5CF6',
      shortcut: 'C',
    });
  }

  const visibleTools = netTools.filter(
    (t) => !isToolDisabledForNet(t.id, activeNet, recolectoraActive),
  );

  if (collapsed) {
    return (
      <>
        <div style={{ padding: '4px 4px', borderBottom: '1px solid #3a494a' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visibleTools.map((t) => {
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => onSelectTool(t.id)}
                  aria-label={t.label}
                  title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
                  style={{
                    ...compactBtn,
                    background: tool === t.id ? '#2563EB' : '#1e2024',
                    border: `1px solid ${tool === t.id ? '#2563EB' : '#3a494a'}`,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 14, color: tool === t.id ? '#fff' : t.icoCol }}>
                    {t.ico}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: tool === t.id ? 'rgba(255,255,255,.6)' : '#8AB4D6',
                    }}
                  >
                    {compactShortcut(t.shortcut)}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 2 }}>
            <button
              type="button"
              onClick={onSnapToggle}
              aria-label="Snap"
              title={`Snap (${'G'})`}
              style={{
                ...compactBtn,
                background: snapOn ? '#10B98122' : '#1e2024',
                border: `1px solid ${snapOn ? '#10B981' : '#3a494a'}`,
                color: snapOn ? '#10B981' : '#9BA8AA',
              }}
            >
              <span style={{ fontSize: 14, color: snapOn ? '#10B981' : '#8AB4D6' }}>
                {snapOn ? '◉' : '○'}
              </span>
              <span style={{ fontSize: 9, color: snapOn ? 'rgba(255,255,255,.6)' : '#8AB4D6' }}>
                G
              </span>
            </button>
          </div>
        </div>

        <div style={{ padding: '4px 4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              type="button"
              onClick={onFit}
              disabled={!currentFile}
              aria-label="Ajustar PDF al visor"
              style={{
                ...compactBtn,
                borderColor: '#10B98155',
                color: '#10B981',
                opacity: !currentFile ? 0.4 : 1,
                cursor: !currentFile ? 'not-allowed' : 'pointer',
              }}
              title={currentFile ? 'Ajustar PDF al visor' : 'Carga un plano para poder ajustarlo'}
            >
              <span style={{ fontSize: 14 }}>{'⛶'}</span>
            </button>
            <button
              type="button"
              onClick={onSave}
              aria-label="Guardar"
              style={compactBtn}
              title="Guarda los trazados y cambios realizados en el plano para la red activa"
            >
              <span
                style={{ fontSize: 14, color: STATUS[saveStatus]?.color || STATUS.error.color }}
              >
                {'💾'}
              </span>
            </button>
            <button
              type="button"
              onClick={onUndo}
              aria-label="Deshacer"
              style={compactBtn}
              title="Deshace el último elemento dibujado: ramal, bajante, área, cota o texto. (Ctrl+Z)"
            >
              <span style={{ fontSize: 14 }}>{'↩'}</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              aria-label="Rehacer"
              style={compactBtn}
              title="Revierte el último cambio deshecho: restaura el ramal, bajante, área, cota o texto que se deshizo. (Ctrl+Y)"
            >
              <span style={{ fontSize: 14 }}>{'↪'}</span>
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Limpiar trazado de la red activa"
              style={{ ...compactBtn, borderColor: 'rgba(255,180,171,.3)', color: '#ffb4ab' }}
              title="Eliminar todo el trazado de la red activa"
            >
              <span style={{ fontSize: 14 }}>{'🗑'}</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ padding: '6px 8px 4px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: '#9BA8AA',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Herramientas
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {visibleTools.map((t) => {
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => onSelectTool(t.id)}
                title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
                style={{
                  ...PdfViewerToolbar_S2,
                  background: tool === t.id ? '#2563EB' : '#1e2024',
                  border: `1px solid ${tool === t.id ? '#2563EB' : '#3a494a'}`,
                  borderRadius: '3px',
                  color: '#b9caca',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    width: 18,
                    textAlign: 'center',
                    color: tool === t.id ? '#fff' : t.icoCol,
                  }}
                >
                  {t.ico}
                </span>
                <span style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>{t.label}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: tool === t.id ? 'rgba(255,255,255,.6)' : '#8AB4D6',
                    fontFamily: "'Geist',monospace",
                    marginLeft: 'auto',
                  }}
                >
                  {t.shortcut}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 4 }}>
          <button
            type="button"
            onClick={onSnapToggle}
            style={{
              ...PdfViewerToolbar_S3,
              background: snapOn ? '#10B98122' : '#1e2024',
              border: `1px solid ${snapOn ? '#10B981' : '#3a494a'}`,
              borderRadius: '3px',
              color: snapOn ? '#10B981' : '#9BA8AA',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontSize: 14,
                width: 18,
                textAlign: 'center',
                color: snapOn ? '#10B981' : '#8AB4D6',
              }}
            >
              {snapOn ? '\u25C9' : '\u25CB'}
            </span>
            <span style={{ flex: 1 }}>Snap</span>
            <span
              style={{
                fontSize: 12,
                color: snapOn ? 'rgba(255,255,255,.6)' : '#8AB4D6',
                fontFamily: "'Geist',monospace",
              }}
            >
              G
            </span>
          </button>
        </div>
      </div>

      <div style={{ padding: '6px 8px 4px', borderBottom: '1px solid #3a494a' }}>
        <div
          style={{
            fontFamily: "'Geist',monospace",
            fontSize: 12,
            color: '#9BA8AA',
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Acciones
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            type="button"
            onClick={onFit}
            disabled={!currentFile}
            style={{
              ...accBtn,
              width: '100%',
              borderColor: '#10B98155',
              color: '#10B981',
              opacity: !currentFile ? 0.4 : 1,
              cursor: !currentFile ? 'not-allowed' : 'pointer',
            }}
            title={currentFile ? 'Ajustar PDF al visor' : 'Carga un plano para poder ajustarlo'}
          >
            <span style={{ fontSize: 14 }}>{'\u26F6'}</span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 0,
                lineHeight: 1.1,
                flex: 1,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'left' }}>Ajustar</span>
              <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, textAlign: 'left' }}>
                Encajar PDF al visor
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={onSave}
            style={{ ...accBtn, width: '100%' }}
            title="Guarda los trazados y cambios realizados en el plano para la red activa"
          >
            <span style={{ fontSize: 14 }}>{'\uD83D\uDCBE'}</span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 0,
                lineHeight: 1.1,
                flex: 1,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'left' }}>Guardar</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'left',
                  color: STATUS[saveStatus]?.color || STATUS.error.color,
                }}
              >
                {STATUS[saveStatus]?.label || STATUS.error.label}
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={onUndo}
            style={{ ...accBtn, width: '100%' }}
            title="Deshace el último elemento dibujado: ramal, bajante, área, cota o texto. (Ctrl+Z)"
          >
            <span style={{ fontSize: 14 }}>{'\u21A9'}</span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 0,
                lineHeight: 1.1,
                flex: 1,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'left' }}>Deshacer</span>
              <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, textAlign: 'left' }}>
                Último trazo · Ctrl+Z
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={onRedo}
            style={{ ...accBtn, width: '100%' }}
            title="Revierte el último cambio deshecho: restaura el ramal, bajante, área, cota o texto que se deshizo. (Ctrl+Y)"
          >
            <span style={{ fontSize: 14 }}>{'\u21AA'}</span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 0,
                lineHeight: 1.1,
                flex: 1,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'left' }}>Rehacer</span>
              <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, textAlign: 'left' }}>
                Revertir deshacer · Ctrl+Y
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={onClear}
            style={{
              ...accBtn,
              width: '100%',
              borderColor: 'rgba(255,180,171,.3)',
              color: '#ffb4ab',
            }}
            title="Eliminar todo el trazado de la red activa"
          >
            <span style={{ fontSize: 14 }}>{'\uD83D\uDDD1'}</span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 0,
                lineHeight: 1.1,
                flex: 1,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'left' }}>Limpiar</span>
              <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, textAlign: 'left' }}>
                Borrar trazado de red activa
              </span>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

const PdfViewerToolbar = memo(PdfViewerToolbar_);
export default PdfViewerToolbar;
