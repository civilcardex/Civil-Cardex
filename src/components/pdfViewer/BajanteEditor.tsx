import { DIAM_BAN, DIAM_VENT } from '../../constants'
import { writeBajantePropToDrawing } from '../../utils/writeDiameterToDrawing'

interface BajanteEditorProps {
  selElement: any;
  activeNet: string;
  engineRef: any;
  setSelElement: React.Dispatch<React.SetStateAction<any>>;
  handleUpdateSel: (field: string, value: any) => void;
  isGhostSel: boolean;
  lvl: string;
  allBajantes: any[];
  plans?: any[];
}

export default function BajanteEditor({ selElement, activeNet, engineRef, setSelElement, handleUpdateSel, isGhostSel, lvl, allBajantes, plans }: BajanteEditorProps) {
  if (isGhostSel) {
    const gd = selElement.ghostData?.[lvl] || {};
    const currentGhostDiam = gd.dNominal || '';
    const currentGhostDir = gd.direccion || '';

    return (
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Datos específicos (Fantasma)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Diámetro</div>
            <select value={currentGhostDiam} aria-label="Diámetro"
              onChange={e => {
                const val = e.target.value;
                const gdNew = { ...(selElement.ghostData || {}) };
                const cd = { ...(gdNew[lvl] || {}) };
                cd.dNominal = val;
                gdNew[lvl] = cd;
                if (engineRef.current) {
                  const fields = { ghostData: gdNew };
                  engineRef.current.updateSelected(fields);
                  setSelElement({ ...selElement, ghostData: fields.ghostData });
                  engineRef.current.render();
                }
              }}
              style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
              <option value="">—</option>
              {(selElement.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
                <option key={d.pulg} value={d.nom}>{d.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Dirección de flujo</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {([['sube','↑ Sube'],['baja','↓ Baja'],['continua','➜ Continua']] as const).map(([val, lbl]) => {
                const isActive = currentGhostDir === val;
                return (
                  <button key={val} onClick={() => {
                    const gdNew = { ...(selElement.ghostData || {}) };
                    const cd = { ...(gdNew[lvl] || {}) };
                    const newDir = cd.direccion === val ? undefined : val;
                    if (newDir) {
                      cd.direccion = newDir;
                    } else {
                      delete cd.direccion;
                    }
                    gdNew[lvl] = cd;
                    if (engineRef.current) {
                      engineRef.current.updateSelected({ ghostData: gdNew });
                      setSelElement({ ...selElement, ghostData: gdNew });
                      engineRef.current.render();
                    }
                  }} style={{
                    flex: 1, padding: '4px 6px', fontSize: 10, fontFamily: "'Geist',monospace", borderRadius: 3,
                    border: `1px solid ${isActive ? '#F5A623' : '#3a494a'}`,
                    background: isActive ? 'rgba(245,166,35,.15)' : '#1e2024',
                    color: isActive ? '#F5A623' : '#9BA8AA',
                    cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                  }}>{lbl}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Datos específicos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>H (m)</div>
          <input type="number" step="0.01" value={selElement.hVert ?? ''} placeholder="0.00" aria-label="Altura H (m)"
            onChange={e => { const v = e.target.value; handleUpdateSel('hVert', v ? parseFloat(v) : 0); }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", textAlign: 'center' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Diámetro</div>
          <select value={selElement.dNominal !== undefined && selElement.dNominal !== '0' && selElement.dNominal !== '' ? selElement.dNominal : ''} aria-label="Diámetro"
            onChange={e => { handleUpdateSel('dNominal', e.target.value); }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">—</option>
            {(selElement.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
              <option key={d.pulg} value={d.nom}>{d.nom}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Llenado (R)</div>
          <select value={selElement.bajR != null ? (Math.abs(selElement.bajR - 7/24) < 0.001 ? '7/24' : '1/4') : '7/24'} aria-label="Llenado (R)"
            onChange={e => {
              const val = e.target.value;
              const valNum = val === '7/24' ? 7/24 : 0.25;
              handleUpdateSel('bajR', valNum);
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="7/24">7/24</option>
            <option value="1/4">1/4</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Área asociada</div>
          <select value={selElement.area_m2 ? String(selElement.area_m2) : ''} aria-label="Área asociada"
            onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              handleUpdateSel('area_m2', val);
            }}
            style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
            <option value="">— Sin área —</option>
            {(engineRef.current?.areas || []).filter((a: any) => a.net === selElement.net).map((a: any) => (
              <option key={a.id} value={a.areaM2}>{a.label} · {a.areaM2} m²</option>
            ))}
          </select>
        </div>
      </div>
        <div>
          <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Dirección</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {([['sube','↑ Sube'],['baja','↓ Baja'],['continua','➜ Continua'],['desplazamiento','↔ Desplaz.']] as const).map(([val, lbl]) => {
              const eng = engineRef.current;
              const lvl = eng?.nivelActual?.label ?? '';
              const hasDesplazamiento = val === 'desplazamiento' && !!(selElement.desplazamientos && selElement.desplazamientos[lvl]);
              const isActive = val === 'desplazamiento' ? hasDesplazamiento : selElement.direccion === val;
              
              return (
              <button key={val} onClick={() => {
                if (val === 'desplazamiento') {
                  if (eng && lvl !== undefined) {
                    const currentDesp = { ...(selElement.desplazamientos || {}) };
                    if (currentDesp[lvl] && !selElement.direccion) {
                      delete currentDesp[lvl];
                    } else if (!currentDesp[lvl]) {
                      currentDesp[lvl] = { dx: 2, dy: 0 };
                    }
                    eng.updateSelected({ desplazamientos: currentDesp, direccion: undefined });
                    setSelElement({ ...selElement, desplazamientos: currentDesp, direccion: undefined });
                    eng.render();
                  }
                } else {
                  const newDir = selElement.direccion === val ? undefined : val;
                  const currentDesp = { ...(selElement.desplazamientos || {}) };
                  eng.updateSelected({ direccion: newDir, desplazamientos: currentDesp });
                  setSelElement({ ...selElement, direccion: newDir, desplazamientos: currentDesp });
                  eng.render();
                }
              }} style={{
                flex: 1, padding: '4px 6px', fontSize: 10, fontFamily: "'Geist',monospace", borderRadius: 3,
                border: `1px solid ${isActive ? '#F5A623' : '#3a494a'}`,
                background: isActive ? 'rgba(245,166,35,.15)' : '#1e2024',
                color: isActive ? '#F5A623' : '#9BA8AA',
                cursor: 'pointer', fontWeight: isActive ? 600 : 400,
              }}>{lbl}</button>
            )})}
          </div>
        </div>
        {activeNet === 'san' && (
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Ramales asociados</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', padding: '4px', background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3 }}>
              {(() => {
                const bajRamales = (engineRef.current?.ramales || []).filter((r: any) => r.net === 'san' && r.tipo !== 'tributario');
                if (bajRamales.length === 0) return <div style={{ fontSize: 10, color: '#8AB4D6', fontFamily: "'Geist',monospace", padding: '4px', gridColumn: 'span 4' }}>Sin ramales en esta red</div>;
                const recibidos = (selElement.recibeDeIds || []);
                return bajRamales.map((r: any) => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                    <input type="checkbox" checked={recibidos.includes(r.id)}
                      onChange={e => {
                        const newRecibe = e.target.checked
                          ? [...recibidos, r.id]
                          : recibidos.filter((id: string) => id !== r.id);
                        handleUpdateSel('recibeDeIds', newRecibe);
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                  </label>
                ));
              })()}
            </div>
          </div>
        )}
        {activeNet === 'san' && (
          <div style={{ width: '100%', marginTop: 8 }}>
            <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Bajantes asociadas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', padding: '4px', background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3 }}>
              {(() => {
                const others = allBajantes.filter((b: any) => b.key !== `${selElement.id}-${engineRef.current?.planId}`);
                if (others.length === 0) return <div style={{ fontSize: 10, color: '#8AB4D6', fontFamily: "'Geist',monospace", padding: '4px', gridColumn: 'span 2' }}>Sin otras bajantes en esta red</div>;
                
                return others.map((b: any) => {
                  const isAssoc = b.descargaEnId === `${engineRef.current?.planId}|${selElement.id}`;
                  return (
                    <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                      <input type="checkbox" checked={isAssoc}
                        onChange={e => {
                          const checked = e.target.checked;
                          const val = checked ? `${engineRef.current?.planId}|${selElement.id}` : null;
                          
                          // Update target bajante property in localStorage/DB
                          writeBajantePropToDrawing(b.key, activeNet, 'descargaEnId', val, plans || []);
                          
                          // Trigger a re-render/sync event
                          window.dispatchEvent(new CustomEvent('civilflow_nets_changed', { detail: [activeNet] }));
                        }}
                        style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.label}>{b.label}</span>
                    </label>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
