/* eslint-disable react-hooks/refs */
import React, { type RefObject, useMemo } from 'react'
import { DIAM_BY_MAT, DIAM_DEFAULT_BY_NET } from '../../constants'
import { VENTILACION } from '../../pages/catalog/catalogData'
import ContadorEditor from './ContadorEditor'
import CalentadorEditor from './CalentadorEditor'
import BajanteEditor from './BajanteEditor'
import RamalEditor from './RamalEditor'
import ExtremeAccessoryEditor from './ExtremeAccessoryEditor'
import { bajanteLabel } from '../../utils/accessoryAbbreviations'

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
  plans?: any[]
  pisos?: any[]
}

export default function TramoEditor({
  selElement, activeNet, engineRef,
  diamSel, gasMatSel, pendSel, pendInput,
  mats, matLongName,
  setDiamSel, setGasMatSel, setPendSel, setPendInput,
  setSelElement, handleUpdateSel, handleRotateLabel,
  plans,
  pisos,
}: TramoEditorProps) {
  const isSelActiveNet = selElement && selElement.net === activeNet

  const allBajantes = useMemo(() => {
    if (!plans) return [];
    const list: Array<{ key: string; id: string; label: string; planId: string; planName: string; planNivel: number; descargaEnId: string | null }> = [];
    for (const plan of plans) {
      if (plan.status !== 'confirmed') continue;
      const key = 'civilflow_trazos_' + plan.id;
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          const bajs = data.bajantes || [];
          for (const b of bajs) {
            if (b.net === activeNet) {
              list.push({
                key: `${b.id}-${plan.id}`,
                id: b.id,
                label: b.code || b.id,
                planId: String(plan.id),
                planName: plan.name,
                planNivel: plan.nivel,
                descargaEnId: b.descargaEnId || null
              });
            }
          }
        } catch (_) {}
      }
    }
    return list;
  }, [plans, activeNet]);

  const adjacentLevels = useMemo(() => {
    const list: number[] = [];
    const currentPlanNivel = engineRef.current?.nivelActual?.n;
    if (typeof currentPlanNivel !== 'number') return [];

    if (pisos && pisos.length > 0) {
      const sorted = [...pisos].sort((a, b) => a.n - b.n);
      const currIdx = sorted.findIndex(s => s.n === currentPlanNivel);
      if (currIdx !== -1) {
        if (currIdx > 0) list.push(sorted[currIdx - 1].n);
        if (currIdx < sorted.length - 1) list.push(sorted[currIdx + 1].n);
        return list;
      }
    }
    
    if (plans && plans.length > 0) {
      const uniqueLevels = Array.from(new Set(plans.map(p => p.nivel).filter(n => typeof n === 'number'))) as number[];
      uniqueLevels.sort((a, b) => a - b);
      const currIdx = uniqueLevels.indexOf(currentPlanNivel);
      if (currIdx !== -1) {
        if (currIdx > 0) list.push(uniqueLevels[currIdx - 1]);
        if (currIdx < uniqueLevels.length - 1) list.push(uniqueLevels[currIdx + 1]);
      }
    }
    return list;
  }, [pisos, plans, engineRef.current?.nivelActual?.n]);

  const adjacentBajantes = useMemo(() => {
    if (adjacentLevels.length === 0) return allBajantes;
    const allowed = new Set(adjacentLevels);
    return allBajantes.filter(b => allowed.has(b.planNivel));
  }, [allBajantes, adjacentLevels]);
  const eng = engineRef.current;
  const lvl = eng?.nivelActual?.label ?? '';
  const isGhostSel = (selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante') && eng?._isGhostSel) || false;

  const displayLabelWithPiso = (label: string | null | undefined, pisoLabel: string) => {
    if (!label) return '';
    if (label.includes('-')) return label;
    if (!pisoLabel) return label;
    const n = (engineRef.current?.nivelActual as any)?.n;
    let corto: string | null = null;
    if (typeof n === 'number') {
      if (n < 0) corto = `S${Math.abs(n)}`;
      else if (n === 99) corto = 'C';
      else corto = `P${n}`;
    }
    if (!corto) {
      const match = /(\d+)$/.exec(pisoLabel);
      if (match) {
        const num = parseInt(match[1], 10);
        const prefixMatch = /^(\D+)/.exec(pisoLabel);
        const prefix = prefixMatch ? prefixMatch[1].trim().toLowerCase() : '';
        if (prefix.startsWith('s') || prefix.startsWith('só') || prefix.includes('sot')) corto = `S${num}`;
        else if (prefix.startsWith('c')) corto = 'C';
        else corto = `P${num}`;
      }
    }
    return corto ? `${label}-${corto}` : `${label}-${pisoLabel}`;
  };

  if (selElement && selElement.tipo === 'contador') {
    return <ContadorEditor selElement={selElement} activeNet={activeNet} handleUpdateSel={handleUpdateSel} />;
  }

  if (selElement && selElement.tipo === 'calentador') {
    return <CalentadorEditor selElement={selElement} handleUpdateSel={handleUpdateSel} />;
  }

  const isVen = activeNet === 'vent';
  const matList = mats?.[activeNet] || [];
  const matShort = matList[0]?.val || '—';
  let diamList: any[] = [];
  if (isVen) {
    diamList = VENTILACION[0]?.rows.map((r: any) => ({ n: r.dn })) || [];
  } else {
    diamList = DIAM_BY_MAT[matShort] || [];
  }

  return (
    <form onSubmit={e => e.preventDefault()}>
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
            {(selElement.tipo === 'ramal' || selElement.tipo === 'tributario' || selElement.pts) && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1.5fr',gap:3}}>
                <div>
                  <div style={{fontSize:8.5,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Nombre</div>
                  <input value={displayLabelWithPiso(selElement.label, engineRef.current?.nivelActual?.label)} placeholder="Tramo" aria-label="Nombre del tramo"
                    onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({label:v});setSelElement({...selElement,label:v})}}}
                    style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace",minWidth:0}}/>
                </div>
                <div>
                  <div style={{fontSize:8.5,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Inicio</div>
                  <input value={selElement.ini||''} placeholder="— inicial —" aria-label="Conexión de inicio"
                    onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({ini:v});setSelElement({...selElement,ini:v})}}}
                    style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace",minWidth:0}}/>
                </div>
                <div>
                  <div style={{fontSize:8.5,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Final</div>
                  <input value={selElement.fin||''} placeholder="— final —" aria-label="Conexión de fin"
                    onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({fin:v});setSelElement({...selElement,fin:v})}}}
                    style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace",minWidth:0}}/>
                </div>
              </div>
            )}
            {(selElement.tipo === 'bajante' || selElement.tipo === 'montante' || selElement.id?.startsWith('B'))&&(
              <div>
                <div style={{fontSize:8.5,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Código</div>
                <input value={selElement.code||''} placeholder="Código bajante" aria-label="Código"
                  onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({code:v});setSelElement({...selElement,code:v})}}}
                  style={{width:'50%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace"}}/>
              </div>
            )}
            {selElement.id?.startsWith('T')&&(
              <div>
                <div style={{fontSize:8.5,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Texto</div>
                <input value={selElement.text||''} placeholder="Texto" aria-label="Texto adicional"
                  onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({text:v});setSelElement({...selElement,text:v})}}}
                  style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace"}}/>
              </div>
            )}
            {selElement.id?.startsWith('AR')&&(
              <>
                <div>
                  <div style={{fontSize:8.5,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Etiqueta</div>
                  <input value={selElement.label||''} placeholder="Etiqueta área" aria-label="Etiqueta"
                    onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({label:v});setSelElement({...selElement,label:v})}}}
                    style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace"}}/>
                </div>
                <div>
                  <div style={{fontSize:8.5,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Área calculada</div>
                  <div style={{width:'100%',padding:"3px 5px",background:"#1a1c1f",border:"1px solid #2a3435",borderRadius:3,color:"#b9caca",fontSize:10,fontFamily:"'Geist',monospace"}}>
                    {selElement.areaM2 ? `${selElement.areaM2} m²` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:8.5,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Asociar Bajante</div>
                  <select
                    aria-label="Asociar bajante"
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
                    style={{width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize:10,fontFamily:"'Geist',monospace"}}
                  >
                    <option value="">— Sin bajante —</option>
                    {(engineRef.current?.bajantes || []).filter((b: any) => b.net === selElement.net).map((b: any) => (
                      <option key={b.id} value={b.id}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</option>
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
          return (
            <BajanteEditor
              selElement={selElement}
              activeNet={activeNet}
              engineRef={engineRef}
              setSelElement={setSelElement}
              handleUpdateSel={handleUpdateSel}
              isGhostSel={isGhostSel}
              lvl={lvl}
              allBajantes={adjacentBajantes}
              plans={plans}
            />
          );
        }

        return (
          <>
            <RamalEditor
              selElement={selElement}
              activeNet={activeNet}
              engineRef={engineRef}
              setSelElement={setSelElement}
              isSelActiveNet={isSelActiveNet}
              diamSel={diamSel}
              gasMatSel={gasMatSel}
              pendSel={pendSel}
              pendInput={pendInput}
              mats={mats}
              matLongName={matLongName}
              setDiamSel={setDiamSel}
              setGasMatSel={setGasMatSel}
              setPendSel={setPendSel}
              setPendInput={setPendInput}
            />
            {(['tributario', 'ramal'].includes(selElement?.tipo)) && ['san', 'af', 'ac'].includes(activeNet) && (
              <ExtremeAccessoryEditor
                selElement={selElement}
                engineRef={engineRef}
                setSelElement={setSelElement}
                diamList={diamList}
                activeNet={activeNet}
                plans={plans}
              />
            )}
            {selElement?.pts && engineRef.current?.bajantes?.length > 0 && ['san', 'll'].includes(activeNet) && (
              <div style={{ padding: "10px 12px 8px", borderBottom: '1px solid #3a494a' }}>
                <div style={{ fontSize: 9, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', padding: '4px', background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3 }}>
                  {(() => {
                    const netBajs = (engineRef.current?.bajantes || []).filter((b: any) => b.net === activeNet && b.tipo !== 'tributario');
                    if (netBajs.length === 0) return <div style={{ fontSize: 10, color: '#8AB4D6', fontFamily: "'Geist',monospace", padding: '4px', gridColumn: 'span 2' }}>Sin bajantes en esta red</div>;
                    return netBajs.map((b: any) => {
                      const isAssoc = (b.recibeDeIds || []).includes(selElement.id);
                      return (
                        <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 9, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 }}>
                          <input type="checkbox" checked={isAssoc}
                            onChange={e => {
                              const val = e.target.checked;
                              const oldRecibe = b.recibeDeIds || [];
                              const newRecibe = val
                                ? (oldRecibe.includes(selElement.id) ? oldRecibe : [...oldRecibe, selElement.id])
                                : oldRecibe.filter((id: string) => id !== selElement.id);
                              engineRef.current?.updateElementById(b.id, { recibeDeIds: newRecibe });
                              engineRef.current?.render();
                              engineRef.current?._markDirty();
                            }}
                            style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </form>
  )
}

export { DIAM_BY_MAT, DIAM_DEFAULT_BY_NET }
