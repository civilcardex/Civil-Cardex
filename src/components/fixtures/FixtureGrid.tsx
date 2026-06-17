import React from 'react';
import { APARATO_IMG } from '../../constants';

function corto(sigla: string) {
  return (sigla || '').replace(/:$/, '').trim();
}

interface FixtureGridProps {
  items: any[];
  currentMap: Record<string, any>;
  unitKey: string | null;
  unidadLbl: string;
  inc: (apId: string) => void;
  dec: (apId: string) => void;
  targetId: string | null;
  accent: string;
}

export default function FixtureGrid({ items, currentMap, unitKey, unidadLbl, inc, dec, targetId, accent }: FixtureGridProps) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
    }}>
      {items.map(ap => {
        const c = currentMap[ap.id] || 0;
        const u = unitKey ? ((ap as any)[unitKey] || 0) : 0;
        const abbr = corto(ap.sigla);
        const active = c > 0;
        const uStr = Number.isInteger(u) ? String(u) : u.toFixed(2).replace(/\.?0+$/, '');
        return (
          <div key={ap.id}
            title={targetId ? ap.nombre : `Asigna un tramo primero`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'stretch',
              background: active ? 'rgba(37,99,235,.12)' : 'var(--bg2)',
              border: `1px solid ${active ? accent : 'var(--line)'}`,
              borderRadius: 4, overflow: 'hidden',
              transition: 'all .12s',
            }}>
            <button onClick={() => targetId && inc(ap.id)} disabled={!targetId}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '4px 2px 2px', gap: 1, minHeight: 48,
                border: 'none', background: 'transparent', cursor: targetId ? 'pointer' : 'default',
                font: 'inherit', color: 'inherit', width: '100%',
              }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{(APARATO_IMG as Record<string, string>)[ap.id] ? <img src={(APARATO_IMG as Record<string, string>)[ap.id]} alt=""  width={24} height={24} style={{width:24,height:24,verticalAlign:'middle'}}  loading="lazy" /> : '•'}</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: .3, color: active ? accent : '#b9caca', fontFamily: "'Geist',monospace", textTransform: 'uppercase' }}>{abbr}</span>
              <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1, color: 'var(--txt2)', fontFamily: "'Geist',monospace", padding: '1px 4px', marginTop: 1, background: 'rgba(0,0,0,.25)', border: '1px solid var(--bg4)', borderRadius: 2 }}>{uStr} {unidadLbl}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'stretch', borderTop: `1px solid ${active ? accent + '55' : 'var(--bg4)'}`, background: active ? 'rgba(37,99,235,.06)' : 'transparent' }}>
              <button onClick={(e) => { e.stopPropagation(); targetId && dec(ap.id); }} disabled={!targetId || c === 0}
                style={{ flex: 1, padding: '2px 0', background: 'transparent', color: c === 0 || !targetId ? 'var(--line)' : '#ffb4ab', cursor: c === 0 || !targetId ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, fontFamily: "'Geist',monospace", border: 'none', borderRight: `1px solid ${active ? accent + '55' : 'var(--bg4)'}` }}>−</button>
              <div style={{ flex: 1.2, textAlign: 'center', fontSize: 10, fontWeight: 800, lineHeight: '14px', color: c > 0 ? accent : 'var(--txt2)', fontFamily: "'Geist',monospace", background: c > 0 ? 'rgba(37,99,235,.18)' : 'transparent' }}>{c}</div>
              <button onClick={(e) => { e.stopPropagation(); targetId && inc(ap.id); }} disabled={!targetId}
                style={{ flex: 1, padding: '2px 0', background: 'transparent', color: !targetId ? 'var(--line)' : accent, cursor: !targetId ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, fontFamily: "'Geist',monospace", border: 'none', borderLeft: `1px solid ${active ? accent + '55' : 'var(--bg4)'}` }}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
