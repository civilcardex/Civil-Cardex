import React, { useState } from 'react';

interface TramoDataSectionProps {
  targetId: string | null;
  curHidro: Record<string, any>;
  setHidroField: (field: string, val: any) => void;
  showLh: boolean;
  netId: string;
}

export default function TramoDataSection({ targetId, curHidro, setHidroField, showLh, netId }: TramoDataSectionProps) {
  const [dataOpen, setDataOpen] = useState(true);

  const vLh = curHidro.Lh ?? 0;
  const vNS = curHidro.nSalidas ?? 0;

  return (
    <div style={{ borderBottom: '1px solid #3a494a' }}>
      <button onClick={() => setDataOpen(o => !o)} aria-expanded={dataOpen} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
        borderTop: '1px solid var(--bg4)', textAlign: 'left',
      }}>
        <span style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          📐 Datos de Tramo
        </span>
        <span style={{ fontSize: 10, color: 'var(--txt2)', fontFamily: "'Geist',monospace" }}>
          {dataOpen ? '▾' : '▸'}
        </span>
      </button>
      {dataOpen && (
        <div style={{
          padding: '0 10px 10px',
          opacity: targetId ? 1 : 0.45, pointerEvents: targetId ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {showLh && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Lh (m)</div>
                <input type="number" value={vLh} min={0} step={0.1} disabled={!targetId}
                  onChange={e => setHidroField('Lh', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '4px 6px', background: 'var(--bg3)', border: '1px solid #3a494a', borderRadius: 3, color: 'var(--txt)', fontSize: 11, fontFamily: "'Geist',monospace" }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                {netId === 'san' ? 'Descargas' : 'No. descargas'}
              </div>
              <input type="number" value={vNS} min={0} step={1} disabled={!targetId}
                onChange={e => setHidroField('nSalidas', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg3)', border: '1px solid #3a494a', borderRadius: 3, color: 'var(--txt)', fontSize: 11, fontFamily: "'Geist',monospace" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
