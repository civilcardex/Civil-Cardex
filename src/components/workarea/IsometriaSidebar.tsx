import type { Dispatch, SetStateAction } from "react";

const IsometriaSidebar_S7: React.CSSProperties = { padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #2a3a3b', fontFamily: 'Geist,monospace', userSelect: 'none', };

interface IsometriaSidebarProps {
  tramoTree: { netId: string; netName: string; netColor: string; niveles: { nivel: number; label: string; ramales: any[]; bajantes: any[] }[] }[];
  collapsedNets: Set<string>;
  toggleCollapsedNet: (netId: string) => void;
  selTramo: string | null;
  setSelTramo: Dispatch<SetStateAction<string | null>>;
  totals: { ramales: number; bajantes: number; len: string };
}

export default function IsometriaSidebar({ tramoTree, collapsedNets, toggleCollapsedNet, selTramo, setSelTramo, totals }: IsometriaSidebarProps) {
  return (
    <div style={{ width: 200, flexShrink: 0, background: '#0d0f12', borderRight: '1px solid #3a494a', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {tramoTree.length === 0 && (
        <div style={{ padding: '20px 12px', fontSize: 12, color: '#5a6a6b', fontFamily: 'Geist,monospace', textAlign: 'center' }}>
          Sin datos
        </div>
      )}
      {tramoTree.map(net => {
        const isCollapsed = collapsedNets.has(net.netId);
        const netRamales = net.niveles.reduce((s, nv) => s + nv.ramales.length, 0);
        const netBajantes = net.niveles.reduce((s, nv) => s + nv.bajantes.length, 0);
        return (
          <div key={net.netId}>
            <button type="button" aria-label={`Alternar visibilidad de red ${net.netId}`} onClick={() => toggleCollapsedNet(net.netId)} style={{ ...IsometriaSidebar_S7, background: 'none', border: 'none', width: '100%', textAlign: 'left', font: 'inherit' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: net.netColor, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: net.netColor, fontWeight: 700, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{net.netName}</span>
              <span style={{ fontSize: 12, color: '#5a6a6b', whiteSpace: 'nowrap' }}>{netRamales + netBajantes}</span>
              <span style={{ fontSize: 12, color: '#5a6a6b', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .15s' }}>▾</span>
            </button>
            {!isCollapsed && net.niveles.map(nv => (
              <div key={nv.nivel}>
                <div style={{ padding: '3px 10px 2px 20px', fontSize: 12, color: '#5a6a6b', fontFamily: 'Geist,monospace', fontWeight: 600, letterSpacing: 0.5 }}>
                  {nv.label}
                </div>
                <ul role="listbox" aria-label="Ramales" style={{listStyle:'none',margin:0,padding:0}}>
                {nv.ramales.map(r => {
                  const selKey = `${net.netId}:${r.planId}:${r.id}`;
                  const isSel = selKey === selTramo;
                  return (
                    <li key={selKey} role="option" tabIndex={0} aria-label={`Seleccionar ${selKey}`} aria-selected={isSel} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelTramo(prev => prev === selKey ? null : selKey);}}} onClick={() => setSelTramo(prev => prev === selKey ? null : selKey)} style={{
                      padding: '3px 10px 3px 26px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                      background: isSel ? '#2563EB22' : 'transparent',
                      borderLeft: isSel ? '2px solid ' + net.netColor : '2px solid transparent',
                      fontFamily: 'Geist,monospace', fontSize: 12,
                    }}>
                      <span style={{ color: net.netColor, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                      <span style={{ fontSize: 12, color: '#5a6a6b' }}>L={r.totalL}m</span>
                    </li>
                  );
                })}
                </ul>
                <ul role="listbox" aria-label="Bajantes" style={{listStyle:'none',margin:0,padding:0}}>
                {nv.bajantes.map(b => {
                  const selKey = `${net.netId}:${b.planId}:${b.id}`;
                  const isSel = selKey === selTramo;
                  const dInches = b.dNominal ? Math.round(Number(b.dNominal) / 25.4) : 0;
                  const lbl = dInches > 0 ? `${b.code || b.id}:${dInches}"` : (b.code || b.id);
                  return (
                    <li key={selKey} role="option" tabIndex={0} aria-label={`Seleccionar ${selKey}`} aria-selected={isSel} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelTramo(prev => prev === selKey ? null : selKey);}}} onClick={() => setSelTramo(prev => prev === selKey ? null : selKey)} style={{
                      padding: '3px 10px 3px 26px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                      background: isSel ? '#2563EB22' : 'transparent',
                      borderLeft: isSel ? '2px solid ' + net.netColor : '2px solid transparent',
                      fontFamily: 'Geist,monospace', fontSize: 12,
                    }}>
                      <span style={{ color: net.netColor, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lbl}</span>
                      {!(b.tipo === 'contador' || b.tipo === 'calentador') && <span style={{ fontSize: 12, color: '#5a6a6b' }}>h={b.hVert}m</span>}
                    </li>
                  );
                })}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
      <div style={{ marginTop: 'auto', padding: '8px 12px', borderTop: '1px solid #3a494a', fontSize: 12, color: '#5a6a6b', fontFamily: 'Geist,monospace' }}>
        Tramos: {totals.ramales} · Bajantes: {totals.bajantes} · Long: {totals.len}m
      </div>
    </div>
  );
}
