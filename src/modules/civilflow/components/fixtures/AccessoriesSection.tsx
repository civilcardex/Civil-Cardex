import {  useState  } from 'react';
const AccessoriesSection_S1: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderTop: '1px solid var(--bg4)', textAlign: 'left', };
const AccessoriesSection_S2: React.CSSProperties = { flex: 1, padding: '1px 0', border: 'none', background: 'transparent', fontSize: 12, fontWeight: 800, lineHeight: 1, fontFamily: "'Geist',monospace" } as const;
const AccessoriesSection_S3: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3px 2px 1px', gap: 1, minHeight: 42, border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', width: '100%' } as const;


interface AccessoriesSectionProps {
  targetId: string | null;
  curHidro: Record<string, any>;
  incAcc: (accId: string) => void;
  decAcc: (accId: string) => void;
  accent: string;
  items: any[];
}

export default function AccessoriesSection({ targetId, curHidro, incAcc, decAcc, accent, items }: AccessoriesSectionProps) {
  const [accOpen, setAccOpen] = useState(true);
  const acc = curHidro.accesorios || {};

  return (
    <div style={{ borderBottom: '1px solid #3a494a' }}>
      <button type="button" onClick={() => setAccOpen(o => !o)} aria-expanded={accOpen} style={AccessoriesSection_S1}>
        <span style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1 }}>
          🔩 Accesorios
        </span>
        <span style={{ fontSize: 12, color: 'var(--txt2)', fontFamily: "'Geist',monospace" }}>
          {accOpen ? '▾' : '▸'}
        </span>
      </button>
      {accOpen && (
        <div style={{
          padding: '0 10px 10px',
          opacity: targetId ? 1 : 0.45, pointerEvents: targetId ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {items.map((a: any) => {
              const v = acc[a.id] || 0;
              return (
                <div key={a.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                  background: v > 0 ? 'rgba(37,99,235,.12)' : 'var(--bg2)',
                  border: `1px solid ${v > 0 ? accent : 'var(--line)'}`,
                  borderRadius: 4, overflow: 'hidden', transition: 'all .12s',
                }}>
                  <button type="button" onClick={() => targetId && incAcc(a.id)} disabled={!targetId}
                    style={{ ...AccessoriesSection_S3, cursor: targetId ? 'pointer' : 'default' }}>
                    <img src={a.icono} alt={a.nombre}  width={26} height={26} style={{width:26,height:26,objectFit:'contain'}}  loading="lazy" />
                    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: .2, color: v > 0 ? accent : '#b9caca', fontFamily: "'Geist',monospace", textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1 }}>{a.nombre}</span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, background: v > 0 ? 'rgba(37,99,235,.06)' : 'transparent' }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (targetId) decAcc(a.id); }} disabled={!targetId || v === 0}
                      style={{ ...AccessoriesSection_S2, borderRight: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, color: v === 0 || !targetId ? 'var(--line)' : '#ffb4ab', cursor: v === 0 || !targetId ? 'not-allowed' : 'pointer' }}>−</button>
                    <div style={{ flex: 1.2, textAlign: 'center', fontSize: 12, fontWeight: 800, lineHeight: '14px', color: v > 0 ? accent : 'var(--txt2)', fontFamily: "'Geist',monospace", background: v > 0 ? 'rgba(37,99,235,.18)' : 'transparent' }}>{v}</div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (targetId) incAcc(a.id); }} disabled={!targetId}
                      style={{ ...AccessoriesSection_S2, borderLeft: `1px solid ${v > 0 ? accent + '55' : 'var(--bg4)'}`, color: !targetId ? 'var(--line)' : accent, cursor: !targetId ? 'not-allowed' : 'pointer' }}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
