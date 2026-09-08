import { useState } from 'react';
import PlanoEngine, { type ElementItem } from '../../lib/PlanoEngine/PlanoEngine';
import type { PlanoElement } from '../../lib/PlanoEngine/PlanoState';

interface PdfViewerDrawnElementsProps {
  drawnElements: ElementItem[];
  activeNet: string;
  selElement: PlanoElement | null;
  engineRef: React.MutableRefObject<PlanoEngine | null>;
}

const GROUP_ORDER = [
  'bajante',
  'ramal',
  'tributario',
  'montante',
  'canal',
  'caja_san',
  'caja_ll',
  'area',
] as const;
const GROUP_LABEL: Record<string, string> = {
  bajante: 'Bajantes',
  ramal: 'Ramales',
  tributario: 'Tributarios',
  montante: 'Montantes',
  canal: 'Canales',
  caja_san: 'Cajas aguas negras',
  caja_ll: 'Cajas aguas lluvias',
  area: 'Áreas',
};

export default function PdfViewerDrawnElements({
  drawnElements,
  activeNet,
  selElement,
  engineRef,
}: PdfViewerDrawnElementsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const groups = new Map<string, ElementItem[]>();
  for (const el of drawnElements) {
    const k = el.tipo || el.type || 'otro';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(el);
  }
  const orderedKeys = [
    ...GROUP_ORDER.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !(GROUP_ORDER as readonly string[]).includes(k)),
  ];

  return (
    <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3a494a' }}>
      <div
        style={{
          fontFamily: "'Geist',monospace",
          fontSize: 12,
          color: '#9BA8AA',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Elementos de red ({drawnElements.length})
      </div>
      {drawnElements.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: '#8AB4D6',
            fontFamily: "'Geist',monospace",
            padding: '4px 0',
          }}
        >
          Ningún trazo dibujado en esta red
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orderedKeys.map((gk) => (
            <div key={gk} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  fontFamily: "'Geist',monospace",
                  fontSize: 10,
                  color: '#6b7a7c',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  padding: '2px 0',
                  borderBottom: '1px solid #2a3a3b',
                }}
              >
                {GROUP_LABEL[gk] || gk} ({groups.get(gk)!.length})
              </div>
              {groups.get(gk)!.map((el) => {
                const isExp = expanded.has(el.id);
                return (
                  <div
                    key={el.id}
                    style={{
                      padding: '6px 8px',
                      background: selElement?.id === el.id ? '#2563EB22' : '#1a1c20',
                      borderRadius: 3,
                      cursor: 'pointer',
                      border: `1px solid ${selElement?.id === el.id ? 'rgba(37,99,235,.4)' : '#3a494a'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`Seleccionar elemento ${el.id}`}
                      aria-current={el.id === selElement?.id ? 'true' : undefined}
                      onClick={() => {
                        if (engineRef.current) engineRef.current.selectById(el.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flex: 1,
                        minWidth: 0,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        color: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color:
                            el.tipo === 'montante'
                              ? '#3B82F6'
                              : el.type === 'bajante'
                                ? '#F04545'
                                : '#4D8FF7',
                        }}
                      >
                        {el.tipo === 'montante'
                          ? '\u2B06'
                          : el.type === 'bajante'
                            ? '\u2B07'
                            : '\u2571'}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#b9caca',
                          fontFamily: "'Geist',monospace",
                          flex: 1,
                        }}
                      >
                        {el.tipo === 'tributario'
                          ? (() => {
                              try {
                                const p = drawnElements.find(
                                  (x) => x.id === el.padre && x.tipo === 'ramal',
                                );
                                return p ? p.label : el.label;
                              } catch {
                                return el.label;
                              }
                            })()
                          : el.label}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#8AB4D6',
                          fontFamily: "'Geist',monospace",
                          textTransform: 'uppercase',
                        }}
                      >
                        {(el.tipo === 'ramal'
                          ? 'ramal'
                          : el.tipo === 'tributario'
                            ? el.label
                            : el.tipo === 'bajante'
                              ? 'baj'
                              : el.tipo === 'montante'
                                ? 'mon'
                                : el.tipo) || ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(el.id)}
                      style={{
                        fontSize: 10,
                        color: '#8AB4D6',
                        background: 'transparent',
                        border: '1px solid #2f3f40',
                        borderRadius: 2,
                        padding: '2px 6px',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                        fontFamily: "'Geist',monospace",
                      }}
                    >
                      {isExp ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                    {isExp && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '2px 8px',
                          fontSize: 12,
                          color: '#8AB4D6',
                          fontFamily: "'Geist',monospace",
                          paddingLeft: 17,
                        }}
                      >
                        <span>
                          L={typeof el.totalL === 'number' ? el.totalL.toFixed(1) : el.totalL}m
                        </span>
                        {el.type !== 'bajante' && (
                          <span>
                            {'\u00B7'} {el.segs} {el.segs === 1 ? 'seg' : 'segs'}
                          </span>
                        )}
                        {el.pendiente !== undefined &&
                          el.pendiente !== null &&
                          el.pendiente !== 0 &&
                          (activeNet === 'san' || activeNet === 'll') && (
                            <span>
                              {'\u00B7'} S={el.pendiente}%
                            </span>
                          )}
                        {el.diametro && (
                          <span>
                            {'\u00B7'} {'\u00D8'} {el.diametro}
                          </span>
                        )}
                        {el.piso && (
                          <span>
                            {'\u00B7'} Piso: {el.piso}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
