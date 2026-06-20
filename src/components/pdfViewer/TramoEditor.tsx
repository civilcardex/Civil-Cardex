import React, { type RefObject } from 'react'
import { DIAM_BAN, DIAM_BY_MAT, DIAM_DEFAULT_BY_NET, GAS } from '../../constants'

interface TramoEditorProps {
  selElement: any
  activeNet: string
  engineRef: RefObject<any | null>
  diamSel: Record<string, string>
  gasMatSel: Record<string, string>
  pendSel: Record<string, number>
  pendInput: string
  mats: Record<string, Array<{ val: string }>> | null
  matLongName: (short: string) => string
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setPendInput: React.Dispatch<React.SetStateAction<string>>
  setSelElement: React.Dispatch<React.SetStateAction<any>>
  handleUpdateSel: (field: string, value: any) => void
  handleRotateLabel: () => void
  handleDelete: () => void
}

export default function TramoEditor({
  selElement, activeNet, engineRef,
  diamSel, gasMatSel, pendSel, pendInput,
  mats, matLongName,
  setDiamSel, setGasMatSel, setPendSel, setPendInput, setSelElement,
  handleUpdateSel, handleRotateLabel, handleDelete,
}: TramoEditorProps) {

  const isSelActiveNet = selElement && selElement.net === activeNet
  const eng = engineRef.current;
  const lvl = eng?.nivelActual?.label ?? '';
  const isGhostSel = (selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante') && eng?._isGhostSel) || false;

  return (
    <>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#9BA8AA", textTransform: "uppercase", letterSpacing: 1 }}>
            {isGhostSel ? 'Datos del bajante fantasma' : (selElement && selElement.id?.startsWith('AR') ? 'Datos del área' : 'Datos del tramo')}
          </div>
          {selElement && (selElement.pts || selElement.id?.startsWith('T')) && (
            <button onClick={handleRotateLabel} title="Rotar etiqueta (0°/45°/90°/-90°/-45°)" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 6px', background: 'rgba(168,85,247,.1)',
              border: '1px solid rgba(168,85,247,.35)', borderRadius: 3,
              color: '#A855F7', cursor: 'pointer',
              fontFamily: "'Geist',monospace", fontSize: 9, fontWeight: 700,
            }}>
              <span style={{ fontSize: 12, lineHeight: 1 }}>↻</span>
              <span>{selElement.labelAngle || selElement.textAngle || 0}°</span>
            </button>
          )}
        </div>
        {selElement ? (
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            {selElement.label&&!(
              selElement.id?.startsWith('R') && selElement.pts
            )&&(
              <div style={{fontSize:13,fontWeight:600,color:'#b9caca',fontFamily:"'Geist',monospace",padding:'2px 0'}}>
                {selElement.label}
              </div>
            )}
            {selElement.id?.startsWith('R') && selElement.pts && (
              <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr 1fr',gap:3}}>
                <div>
                  <div style={{fontSize:8,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Nombre</div>
                  <input value={selElement.label||''} placeholder="Tramo"
                    onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({label:v});setSelElement({...selElement,label:v})}}}
                    style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace",minWidth:0}}/>
                </div>
                <div>
                  <div style={{fontSize:8,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Ini</div>
                  <input value={selElement.ini||''} placeholder="— ini —"
                    onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({ini:v});setSelElement({...selElement,ini:v})}}}
                    style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace",minWidth:0}}/>
                </div>
                <div>
                  <div style={{fontSize:8,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Fin</div>
                  <input value={selElement.fin||''} placeholder="— fin —"
                    onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({fin:v});setSelElement({...selElement,fin:v})}}}
                    style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace",minWidth:0}}/>
                </div>
              </div>
            )}
            {(selElement.tipo === 'bajante' || selElement.tipo === 'montante' || selElement.id?.startsWith('B'))&&(
              <div>
                <div style={{fontSize:8,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Código</div>
                <input value={selElement.code||''} placeholder="Código bajante"
                  onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({code:v});setSelElement({...selElement,code:v})}}}
                  style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace"}}/>
              </div>
            )}
            {selElement.id?.startsWith('T')&&(
              <div>
                <div style={{fontSize:8,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Texto</div>
                <input value={selElement.text||''} placeholder="Texto"
                  onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({text:v});setSelElement({...selElement,text:v})}}}
                  style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace"}}/>
              </div>
            )}
            {selElement.id?.startsWith('AR')&&(
              <>
                <div>
                  <div style={{fontSize:8,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Etiqueta</div>
                  <input value={selElement.label||''} placeholder="Etiqueta área"
                    onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({label:v});setSelElement({...selElement,label:v})}}}
                    style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace"}}/>
                </div>
                <div>
                  <div style={{fontSize:8,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Área calculada</div>
                  <div style={{width:'100%',padding:"4px 6px",background:"#1a1c1f",border:"1px solid #2a3435",borderRadius:3,color:"#b9caca",fontSize:11,fontFamily:"'Geist',monospace"}}>
                    {selElement.areaM2 ? `${selElement.areaM2} m²` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:8,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Asociar Bajante</div>
                  <select
                    value={(engineRef.current?.bajantes || []).find((b:any) => b.area_m2 === selElement.areaM2)?.id || ''}
                    onChange={e => {
                      const bajanteId = e.target.value;
                      (engineRef.current?.bajantes || []).forEach((b:any) => {
                        if (b.area_m2 === selElement.areaM2) {
                          engineRef.current?.updateElementById(b.id, { area_m2: 0 });
                        }
                      });
                      if (bajanteId) {
                        engineRef.current?.updateElementById(bajanteId, { area_m2: selElement.areaM2 });
                      }
                      if (engineRef.current) engineRef.current._markDirty();
                      setSelElement({...selElement});
                    }}
                    style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace"}}
                  >
                    <option value="">— Sin bajante —</option>
                    {(engineRef.current?.bajantes || []).filter((b: any) => b.net === selElement.net).map((b: any) => (
                      <option key={b.id} value={b.id}>{b.code || b.id}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {selElement.pts&&(
              <div style={{fontSize:10,color:'#8AB4D6',fontFamily:"'Geist',monospace"}}>
                L={selElement.totalL}m · {selElement.pts.length} pts
                {selElement.tipo?` · ${selElement.tipo}`:''}
              </div>
            )}
          </div>
        ) : (
          <div style={{fontSize:11,color:'#8AB4D6',fontFamily:"'Geist',monospace",padding:'4px 0'}}>
            Selecciona un elemento en el plano
          </div>
        )}
      </div>

      {(() => {
        const isBajMont = selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante');
        const isArea = selElement && selElement.id?.startsWith('AR');

        if (isArea) return null;

        if (isBajMont) {
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
                    <select value={currentGhostDiam}
                      onChange={e => {
                        const val = e.target.value;
                        const gdNew = { ...(selElement.ghostData || {}) };
                        const cd = { ...(gdNew[lvl] || {}) };
                        cd.dNominal = val;
                        gdNew[lvl] = cd;
                        if (engineRef.current) {
                          engineRef.current.updateSelected({ ghostData: gdNew });
                          setSelElement({ ...selElement, ghostData: gdNew });
                          engineRef.current.render();
                        }
                      }}
                      style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                      <option value="">—</option>
                      {DIAM_BAN.map(d => (
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
                  <input type="number" step="0.01" value={selElement.hVert ?? ''} placeholder="0.00"
                    onChange={e => { const v = e.target.value; handleUpdateSel('hVert', v ? parseFloat(v) : 0); }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", textAlign: 'center' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Diámetro</div>
                  <select value={selElement.dNominal !== undefined && selElement.dNominal !== '0' && selElement.dNominal !== '' ? selElement.dNominal : ''}
                    onChange={e => { handleUpdateSel('dNominal', e.target.value); }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                    <option value="">—</option>
                    {DIAM_BAN.map(d => (
                      <option key={d.pulg} value={d.nom}>{d.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
                <div>
                  <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Área asociada</div>
                  <select value={selElement.area_m2 ? String(selElement.area_m2) : ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      handleUpdateSel('area_m2', val);
                    }}
                    style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer' }}>
                    <option value="">— Sin área —</option>
                    {(engineRef.current?.areas || []).map((a: any) => (
                      <option key={a.id} value={a.areaM2}>{a.label} · {a.areaM2} m²</option>
                    ))}
                  </select>
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
                  <div>
                    <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Ramales asociados</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 120, overflowY: 'auto', padding: '4px', background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3 }}>
                      {(() => {
                        const bajRamales = (engineRef.current?.ramales || []).filter((r: any) => r.net === 'san' && r.tipo !== 'tributario');
                        if (bajRamales.length === 0) return <div style={{ fontSize: 10, color: '#8AB4D6', fontFamily: "'Geist',monospace", padding: '4px' }}>Sin ramales en esta red</div>;
                        const recibidos = (selElement.recibeDeIds || []) as string[];
                        return bajRamales.map((r: any) => (
                          <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', cursor: 'pointer', borderRadius: 2, fontSize: 10, color: '#b9caca', fontFamily: "'Geist',monospace" }}>
                            <input type="checkbox" checked={recibidos.includes(r.id)}
                              onChange={e => {
                                const newRecibe = e.target.checked
                                  ? [...recibidos, r.id]
                                  : recibidos.filter(id => id !== r.id);
                                handleUpdateSel('recibeDeIds', newRecibe);
                              }}
                              style={{ accentColor: '#F5A623', margin: 0 }} />
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label || r.id}</span>
                            <span style={{ fontSize: 9, color: '#8AB4D6' }}>{r.totalL?.toFixed(1)}m</span>
                          </label>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }

        const isGas = activeNet === 'gas';
        const matList = mats?.[activeNet] || [];
        const matShort = matList[0]?.val || '—';
        const matName = matLongName(matShort);
        const diamList = DIAM_BY_MAT[matShort] || [];
        let currentDiam, currentMat;
        if (isGas) {
          const selMat = (isSelActiveNet && selElement.material) || gasMatSel[activeNet] || '';
          const selDn = (isSelActiveNet && selElement.diametro !== undefined && selElement.diametro !== '')
            ? selElement.diametro : (diamSel[activeNet] || '');
          currentMat = selMat || GAS[0]?.mat || '';
          currentDiam = selDn || GAS[0]?.rows[0]?.dn || '';
        } else {
          currentDiam = (isSelActiveNet && selElement.diametro !== undefined && selElement.diametro !== '')
            ? selElement.diametro
            : (diamSel[activeNet] || DIAM_DEFAULT_BY_NET[activeNet] || (diamList[0]?.n || ''));
        }
        const showPend = activeNet === 'san' || activeNet === 'll';
        const showDeltaZ = activeNet === 'af' || activeNet === 'ac' || activeNet === 'gas';
        const showDescargas = activeNet === 'af' || activeNet === 'ac' || activeNet === 'san';
        return (
          <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
            <div style={{ fontFamily: "'Geist',monospace", fontSize: 10, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Datos específicos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '3px 8px', background: '#1a1c20', border: '1px solid #282a2e', borderRadius: 3 }}>
                <span style={{ fontSize: 9, color: '#8AB4D6', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>Material</span>
                <span style={{ fontSize: 10, color: '#b9caca', fontFamily: "'Geist',monospace", fontWeight: 600, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={isGas ? currentMat : matName}>{isGas ? currentMat : matName}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: showPend ? '1fr 1fr' : '1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Diámetro</div>
      {isGas ? (
        <select value={currentMat && currentDiam ? `${currentMat}|${currentDiam}` : ''}
        onChange={e => {
          const v = e.target.value;
          if (!v) return;
          const lastBar = v.lastIndexOf('|');
          const mat = v.substring(0, lastBar);
          const dn = v.substring(lastBar + 1);
          setDiamSel(prev => ({ ...prev, [activeNet]: dn }));
          setGasMatSel(prev => ({ ...prev, [activeNet]: mat }));
          if (engineRef.current && selElement) {
            engineRef.current.updateSelected({ material: mat, diametro: dn });
            setSelElement({ ...selElement, material: mat, diametro: dn });
          } else if (engineRef.current && !selElement) {
            const eng = engineRef.current;
            const lastRamal = [...eng.ramales].reverse().find((r: any) => r.net === activeNet);
            if (lastRamal) {
              eng.selId = lastRamal.id;
              eng.updateSelected({ material: mat, diametro: dn });
              const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = lastRamal;
              setSelElement({ ...rest, material: mat, diametro: dn });
            }
          }
        }}
        style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer', textAlign: 'center' }}>
          {GAS.map(g => (
            <optgroup key={g.mat} label={`${g.mat} (K=${g.K})`}>
              {g.rows.map((r: any) => (
                <option key={r.dn} value={`${g.mat}|${r.dn}`}>{r.dn}" ({r.d} mm)</option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : diamList.length > 0 ? (
        <select value={currentDiam}
        onChange={e => {
          const v = e.target.value;
          setDiamSel(prev => ({ ...prev, [activeNet]: v }));
          if (engineRef.current && selElement) {
            engineRef.current.updateSelected({ diametro: v });
            setSelElement({ ...selElement, diametro: v });
          } else if (engineRef.current && !selElement) {
            const eng = engineRef.current;
            const lastRamal = [...eng.ramales].reverse().find((r: any) => r.net === activeNet);
            if (lastRamal) {
              eng.selId = lastRamal.id;
              eng.updateSelected({ diametro: v });
              const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = lastRamal;
              setSelElement({ ...rest, diametro: v });
            }
          }
        }}
        style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", cursor: 'pointer', textAlign: 'center' }}>
        {diamList.map((d: any) => <option key={d.n} value={d.n}>{d.n.split(' — ')[0]}</option>)}
        </select>
                  ) : (
                    <div style={{ padding: '4px 6px', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, color: '#8AB4D6', fontSize: 11, fontFamily: "'Geist',monospace" }}>— Sin opciones —</div>
                  )}
              </div>
      {showPend && (
        <div>
          <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Pendiente %</div>
          <input type="text" inputMode="decimal" value={pendInput}
            onChange={e => {
              const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
              setPendInput(raw);
            }}
            onBlur={e => {
              const v = parseFloat(e.target.value.replace(/,/g, '.')) || 0;
              setPendInput(v > 0 ? String(v) : '');
              setPendSel(prev => ({ ...prev, [activeNet]: v }));
              if (engineRef.current && selElement) {
                engineRef.current.updateSelected({ pendiente: v });
                setSelElement({ ...selElement, pendiente: v });
              } else if (engineRef.current && !selElement) {
                const eng = engineRef.current;
                const lastRamal = [...eng.ramales].reverse().find((r: any) => r.net === activeNet);
                if (lastRamal) {
                  eng.selId = lastRamal.id;
                  eng.updateSelected({ pendiente: v });
                  const { _circ, _ghost, _box, _polyBox, _labelBox, ...rest } = lastRamal;
                  setSelElement({ ...rest, pendiente: v });
                }
              }
            }}
            onFocus={() => {
              const current = (isSelActiveNet && selElement?.pendiente !== undefined)
                ? selElement.pendiente
                : (pendSel[activeNet] !== undefined ? pendSel[activeNet] : 2.0);
              setPendInput(current > 0 ? String(current) : '');
            }}
          style={{ width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", textAlign: 'center' }}
          />
                </div>
                )}
              </div>
              {showDeltaZ && (
                <div style={{ display: 'grid', gridTemplateColumns: showDescargas ? '1fr 1fr' : '1fr', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>ΔZ / L vert (m)</div>
                    <input type="number" step="0.01" value={selElement?.dz ?? ''} placeholder="0.00"
                      onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({dz:v,lvert:v});setSelElement({...selElement,dz:v,lvert:v})}}}
                      style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace",textAlign:'center'}}/>
                  </div>
                  {showDescargas && (
                    <div>
                      <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}># Descargas</div>
                      <input type="number" step="1" min="0" value={selElement?.nSalidas ?? ''} placeholder="0"
                        onChange={e=>{if(engineRef.current){const v=parseInt(e.target.value)||0;engineRef.current.updateSelected({nSalidas:v});setSelElement({...selElement,nSalidas:v})}}}
                        style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace",textAlign:'center'}}/>
                    </div>
                  )}
                </div>
              )}
              {!showDeltaZ && showDescargas && (
                <div>
                  <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}># Descargas</div>
                  <input type="number" step="1" min="0" value={selElement?.nSalidas ?? ''} placeholder="0"
                    onChange={e=>{if(engineRef.current){const v=parseInt(e.target.value)||0;engineRef.current.updateSelected({nSalidas:v});setSelElement({...selElement,nSalidas:v})}}}
                    style={{width:'100%',padding:"4px 6px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:11,fontFamily:"'Geist',monospace",textAlign:'center'}}/>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  )
}

export { DIAM_BY_MAT, DIAM_DEFAULT_BY_NET }
