import React, { type RefObject, useMemo, createContext } from 'react'
import { DIAM_BY_MAT, DIAM_BAN, DIAM_VENT } from '../../constants'
import { VENTILACION } from '../../pages/catalog/catalogData'
import { DIAMETROS_AF } from '../../constants/hydraulicData'
import { CAT_GAS, GAS_DN_LABELS, GAS } from '../../constants/engineeringDataGas'
import { writeBajantePropToDrawing } from '../../utils/writeDiameterToDrawing'
import { normalizeDnLabel } from '../../utils/formatUtils'
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel'
import ExtremeAccessoryEditor from './ExtremeAccessoryEditor'
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine'
import { bajanteLabel } from '../../utils/accessoryAbbreviations'
import { TRAZOS_PLAN_PREFIX, NETS_CHANGED_EVENT } from '../../constants/storage-keys'
import type { PlanoElement, PlanoRamal, PlanoBajante, PlanoArea, PlanoTextAnnotation } from '../../lib/PlanoEngine/PlanoState'
import type { Piso } from '../useWorkAreaState'
import type { PlanItem } from '../../context/PlansContext'

// Structural probe of a PlanoElement union: lets code sniff `tipo`/`pts` (present on some
// element kinds, absent on others) without narrowing via the exported type guards at every
// access site.
type ProbedElement = PlanoElement & { tipo?: string; pts?: number[][]; labelAngle?: number; textAngle?: number; totalL?: number; net?: string };

interface AdjacentBajanteInfo {
  key: string; id: string; label: string; planId: string; planName: string; planNivel: number; descargaEnId: string | null;
}

interface TramoEditorContextValue {
  engineRef: React.MutableRefObject<PlanoEngine | null>
  selElement: PlanoElement | null
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>
  activeNet: string
  handleUpdateSel: (field: string, value: unknown) => void
  handleRotateLabel: () => void
  diamSel: Record<string, string>
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>
  gasMatSel: Record<string, string>
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>
  pendSel: Record<string, number>
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>
  pendInput: string
  setPendInput: React.Dispatch<React.SetStateAction<string>>
  mats: Record<string, Array<{ val: string }>> | null
  matLongName: (short: string) => string
  plans?: PlanItem[]
  pisos?: Piso[]
}

const TramoEditorCtx = createContext<TramoEditorContextValue | null>(null)

// A sanitary main only needs the 3" minimum when it actually carries a codo reventilado
// connection (endpoint or mid-body) — not every main-line ramal in the network.
function ramalHasCodoReventilado(r: PlanoRamal | null): boolean {
  if (!r) return false;
  if (r.accesorioInicio === 'codoReventilado' || r.accesorioFin === 'codoReventilado') return true;
  return Object.values(r.accMed || {}).includes('codoReventilado');
}
const TramoEditor_S1: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer' };
const TramoEditor_S4: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", textAlign: 'center' };
const TramoEditor_S8: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', maxHeight: 120, overflowY: 'auto', padding: '4px', background: '#1a1c20', border: '1px solid #3a494a', borderRadius: 3 };
const TramoEditor_S9: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#b9caca', fontFamily: "'Geist',monospace", minWidth: 0 };
const TramoEditor_S12: React.CSSProperties = { width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize: 12,fontFamily:"'Geist',monospace",textAlign:'center' };
const TramoEditor_S13: React.CSSProperties = { width: '100%', padding: "4px 6px", background: "#1e2024", border: "1px solid #3a494a", borderRadius: 3, color: "#e2e2e8", fontSize: 12, fontFamily: "'Geist',monospace", cursor: 'pointer', textAlign: 'center' };
const TramoEditor_S14: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '3px 8px', background: '#1a1c20', border: '1px solid #282a2e', borderRadius: 3 };
const TramoEditor_S15: React.CSSProperties = { fontSize: 12, color: '#b9caca', fontFamily: "'Geist',monospace", fontWeight: 600, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const TramoEditor_S21: React.CSSProperties = { width:'50%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize: 12,fontFamily:"'Geist',monospace" };
const TramoEditor_S22: React.CSSProperties = { width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize: 12,fontFamily:"'Geist',monospace",minWidth:0 };
const TramoEditor_S23: React.CSSProperties = { width:'100%',padding:"3px 5px",background:"#1a1c1f",border:"1px solid #2a3435",borderRadius:3,color:"#b9caca",fontSize: 12,fontFamily:"'Geist',monospace" };
const TramoEditor_S24: React.CSSProperties = { width:'100%',padding:"3px 5px",background:"#1e2024",border:"1px solid #3a494a",borderRadius:3,color:"#e2e2e8",fontSize: 12,fontFamily:"'Geist',monospace" };
const TramoEditor_S31: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(168,85,247,.1)', border: '1px solid rgba(168,85,247,.35)', borderRadius: 3, color: '#C084FC', cursor: 'pointer', fontFamily: "'Geist',monospace", fontSize: 12, fontWeight: 700, };


/* ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Legacy sub-editor components (shared by variants, still prop-driven)
 * ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――― */

function ContadorEditor({ selElement, activeNet, handleUpdateSel }: { selElement: PlanoBajante; activeNet: string; handleUpdateSel: (field: string, value: unknown) => void }) {
  return (
    <>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", textTransform: "uppercase", letterSpacing: 1 }}>
            Datos del Contador
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#b9caca', fontFamily: "'Geist',monospace", padding: '2px 0' }}>
            {selElement.code || selElement.id}
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Conexión</div>
          <select value={selElement.diametro ?? ''} aria-label="Conexión"
            onChange={e => { handleUpdateSel('diametro', e.target.value); }}
            style={TramoEditor_S1}
          >
            <option value="">— Seleccionar —</option>
            {activeNet === 'gas'
              ? GAS_DN_LABELS.map(d => <option key={d} value={d}>{normalizeDnLabel(d)}</option>)
              : DIAMETROS_AF.map(d => <option key={d.nominal} value={d.nominal}>{normalizeDnLabel(d.nominal)}</option>)
            }
          </select>
      </div>
    </>
  );
}

function CalentadorEditor({ selElement, handleUpdateSel }: { selElement: PlanoBajante; handleUpdateSel: (field: string, value: unknown) => void }) {
  return (
    <>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", textTransform: "uppercase", letterSpacing: 1 }}>
            Datos del Calentador
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#b9caca', fontFamily: "'Geist',monospace", padding: '2px 0' }}>
            {selElement.code || selElement.id}
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Capacidad</div>
          <select value={selElement.capacidad ?? ''} aria-label="Capacidad"
            onChange={e => { handleUpdateSel('capacidad', e.target.value); }}
            style={TramoEditor_S1}
          >
            <option value="">— Seleccionar —</option>
            {CAT_GAS.filter(g => g.id.startsWith('cal')).map(g => (
              <option key={g.id} value={g.id}>{g.n}</option>
            ))}
          </select>
      </div>
    </>
  );
}

function BajanteEditor({
  selElement, activeNet, engineRef, setSelElement, handleUpdateSel, isGhostSel, lvl, allBajantes, plans
}: {
  selElement: PlanoBajante; activeNet: string; engineRef: React.MutableRefObject<PlanoEngine | null>; setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  handleUpdateSel: (field: string, value: unknown) => void; isGhostSel: boolean; lvl: string;
  allBajantes: AdjacentBajanteInfo[]; plans?: PlanItem[];
}) {
  if (isGhostSel) {
    const gd = selElement.ghostData?.[lvl] || {};
    const currentGhostDiam = gd.dNominal || '';
    const currentGhostDir = gd.direccion || '';

    const updateGhostField = (mutate: (cd: NonNullable<PlanoBajante['ghostData']>[string]) => void) => {
      const gdNew = { ...(selElement.ghostData || {}) };
      const cd = { ...(gdNew[lvl] || {}) };
      mutate(cd);
      gdNew[lvl] = cd;
      if (engineRef.current) {
        engineRef.current.updateSelected({ ghostData: gdNew });
        setSelElement({ ...selElement, ghostData: gdNew });
        engineRef.current.render();
      }
    };

    return (
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Datos específicos (Fantasma)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Diámetro</div>
            <select value={currentGhostDiam} aria-label="Diámetro"
              onChange={e => {
                const val = e.target.value;
                updateGhostField(cd => { cd.dNominal = val; });
              }}
              style={TramoEditor_S1}>
              <option value="">—</option>
              {(selElement.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
                <option key={d.pulg} value={d.nom}>{normalizeDnLabel(d.nom)}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Dirección de flujo</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {([['sube','↑ Sube'],['baja','↓ Baja'],['continua','➜ Continua']] as const).map(([val, lbl]) => {
                const isActive = currentGhostDir === val;
                return (
                  <button type="button" key={val} onClick={() => {
                    updateGhostField(cd => {
                      const newDir = cd.direccion === val ? undefined : val;
                      if (newDir) { cd.direccion = newDir; } else { delete cd.direccion; }
                    });
                  }} style={{
                    flex: 1, padding: '4px 6px', fontSize: 12, fontFamily: "'Geist',monospace", borderRadius: 3,
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
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Datos específicos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>H (m)</div>
          <input type="number" step="0.01" value={selElement.hVert ?? ''} placeholder="0.00" aria-label="Altura H (m)"
            onChange={e => { const v = e.target.value; handleUpdateSel('hVert', v ? parseFloat(v) : 0); }}
            style={TramoEditor_S4} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Diámetro</div>
          <select value={selElement.dNominal !== undefined && selElement.dNominal !== '0' && selElement.dNominal !== '' ? selElement.dNominal : ''} aria-label="Diámetro"
            onChange={e => {
              const val = e.target.value;
              if (selElement.net === 'vent') {
                const opt = DIAM_VENT.find((d) => d.nom === val);
                if (opt && opt.pulg > 2) {
                  engineRef.current?.triggerAlert('Diámetro no permitido', 'Los ramales de ventilación no pueden superar 2" de diámetro.');
                  return;
                }
              }
              handleUpdateSel('dNominal', val);
            }}
            style={TramoEditor_S1}>
            <option value="">—</option>
            {(selElement.net === 'vent' ? DIAM_VENT : DIAM_BAN).map(d => (
              <option key={d.pulg} value={d.nom}>{normalizeDnLabel(d.nom)}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Llenado (R)</div>
          <select value={selElement.bajR != null ? (Math.abs(selElement.bajR - 7/24) < 0.001 ? '7/24' : '1/4') : '7/24'} aria-label="Llenado (R)"
            onChange={e => {
              const val = e.target.value;
              handleUpdateSel('bajR', val === '7/24' ? 7/24 : 0.25);
            }}
            style={TramoEditor_S1}>
            <option value="7/24">7/24</option>
            <option value="1/4">1/4</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Área</div>
          <select value={selElement.area_m2 ? String(selElement.area_m2) : ''} aria-label="Área"
            onChange={e => { handleUpdateSel('area_m2', parseFloat(e.target.value) || 0); }}
            style={TramoEditor_S1}>
            <option value="">— Sin área —</option>
            {(engineRef.current?.areas || []).filter((a) => a.net === selElement.net).map((a) => (
              <option key={a.id} value={a.areaM2}>{a.label} · {a.areaM2} m²</option>
            ))}
          </select>
        </div>
      </div>
        <div>
          <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Dirección</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {([['sube','↑ Sube'],['baja','↓ Baja'],['continua','➜ Continua']] as const).map(([val, lbl]) => {
              const eng = engineRef.current;
              const isActive = selElement.direccion === val;
              
              return (
              <button type="button" key={val} onClick={() => {
                if (!eng) return;
                const newDir = selElement.direccion === val ? undefined : val;
                eng.updateSelected({ direccion: newDir, desplazamientos: { ...(selElement.desplazamientos || {}) } });
                setSelElement({ ...selElement, direccion: newDir });
                eng.render();
              }} style={{
                flex: 1, padding: '4px 6px', fontSize: 12, fontFamily: "'Geist',monospace", borderRadius: 3,
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
            <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Ramales asociados</div>
            <div style={TramoEditor_S8}>
              {(() => {
                const bajRamales = (engineRef.current?.ramales || []).filter((r) => r.net === 'san' && r.tipo !== 'tributario');
                if (bajRamales.length === 0) return <div style={{ fontSize: 12, color: '#8AB4D6', fontFamily: "'Geist',monospace", padding: '4px', gridColumn: 'span 4' }}>Sin ramales en esta red</div>;
                const recibidos = (selElement.recibeDeIds || []);
                return bajRamales.map((r) => (
                  <label key={r.id} style={TramoEditor_S9}>
                    <input type="checkbox" checked={recibidos.includes(r.id)}
                      onChange={e => {
                        handleUpdateSel('recibeDeIds', e.target.checked ? [...recibidos, r.id] : recibidos.filter((id: string) => id !== r.id));
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
            <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Bajantes asociadas</div>
            <div style={TramoEditor_S8}>
              {(() => {
                const others = allBajantes.filter((b) => selElement && b.key !== `${selElement.id}-${engineRef.current?.planId}`);
                if (others.length === 0) return <div style={{ fontSize: 12, color: '#8AB4D6', fontFamily: "'Geist',monospace", padding: '4px', gridColumn: 'span 2' }}>Sin otras bajantes en esta red</div>;
                return others.map((b) => {
                  const isAssoc = b.descargaEnId === `${engineRef.current?.planId}|${selElement.id}`;
                  return (
                    <label key={b.key} style={TramoEditor_S9}>
                      <input type="checkbox" checked={isAssoc}
                        onChange={e => {
                          const val = e.target.checked ? `${engineRef.current?.planId}|${selElement.id}` : null;
                          writeBajantePropToDrawing(b.key, activeNet, 'descargaEnId', val, plans || []);
                          window.dispatchEvent(new CustomEvent(NETS_CHANGED_EVENT, { detail: [activeNet] }));
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

function CaudalField({ selElement }: { selElement: PlanoRamal | null }) {
  const extVal = selElement?.caudal;
  const display = extVal != null && (extVal as unknown as string) !== '' && !isNaN(Number(extVal)) ? Number(extVal).toFixed(2) : '—';
  return (
    <div>
      <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0, whiteSpace: 'nowrap' }}>Caudal (LPS)</div>
      <div style={{ ...TramoEditor_S12, display: 'flex', alignItems: 'center' }}>{display}</div>
    </div>
  );
}

function RamalEditor({
  selElement, activeNet, engineRef, setSelElement,
  isSelActiveNet, diamSel, gasMatSel, pendSel, pendInput,
  mats, matLongName,
  setDiamSel, setGasMatSel, setPendSel, setPendInput,
}: {
  selElement: PlanoRamal | null; activeNet: string; engineRef: React.MutableRefObject<PlanoEngine | null>; setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>;
  isSelActiveNet: boolean | null; diamSel: Record<string, string>; gasMatSel: Record<string, string>;
  pendSel: Record<string, number>; pendInput: string;
  mats: Record<string, Array<{ val: string }>> | null; matLongName: (short: string) => string;
  setDiamSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setGasMatSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPendSel: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPendInput: React.Dispatch<React.SetStateAction<string>>;
}) {
  const isGas = activeNet === 'gas';
  const isVen = activeNet === 'vent';
  const matList = mats?.[activeNet] || [];
  const matShort = matList[0]?.val || '—';
  const matName = matLongName(matShort);
  let diamList: Array<{ n: string }> = [];
  if (isVen) {
    diamList = VENTILACION[0]?.rows.map((r) => ({ n: r.dn })) || [];
  } else {
    diamList = DIAM_BY_MAT[matShort] || [];
  }
  let currentDiam: string = '', currentMat: string = '';
  if (isGas) {
    const selMat = (isSelActiveNet && selElement?.material) || gasMatSel[activeNet] || '';
    currentMat = selMat || GAS[0]?.mat || '';
    currentDiam = (isSelActiveNet && selElement?.diametro !== undefined && selElement?.diametro !== '')
      ? selElement!.diametro : (diamSel[activeNet] || GAS[0]?.rows[0]?.dn || '');
  } else {
    currentDiam = (isSelActiveNet && selElement?.diametro !== undefined && selElement?.diametro !== '')
      ? selElement!.diametro.split(' — ')[0].trim()
      : (diamSel[activeNet] || '');
  }
  const showPend = activeNet === 'san' || activeNet === 'll';
  const showDeltaZ = activeNet === 'af' || activeNet === 'ac' || activeNet === 'gas';
  const showDescargas = activeNet === 'af' || activeNet === 'ac' || activeNet === 'san';
  const showCaudal = activeNet === 'll';
  return (
    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
      <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Datos específicos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isGas ? (
          <div>
            <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Material</div>
            <select value={currentMat} aria-label="Material"
              onChange={e => {
                const mat = e.target.value;
                const g = GAS.find((x) => x.mat === mat);
                const dn = g ? g.rows[0]?.dn || '' : '';
                setGasMatSel(prev => ({ ...prev, [activeNet]: mat }));
                setDiamSel(prev => ({ ...prev, [activeNet]: dn }));
                if (engineRef.current && selElement) {
                  engineRef.current.updateSelected({ material: mat, diametro: dn });
                  setSelElement({ ...selElement, material: mat, diametro: dn });
                }
              }}
              style={TramoEditor_S13}>
              {GAS.map((g) => (
                <option key={g.mat} value={g.mat}>{g.mat}</option>
              ))}
            </select>
          </div>
        ) : (
          <div style={TramoEditor_S14}>
            <span style={{ fontSize: 12, color: '#8AB4D6', fontFamily: "'Geist',monospace", textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>Material</span>
            <span style={TramoEditor_S15} title={matName}>{matName}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: showPend ? '1fr 1fr' : '1fr', gap: 6 }}>
          <div>
            <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Diámetro</div>
    {isGas ? (
      <select value={currentDiam} aria-label="Diámetro"
      onChange={e => {
        const dn = e.target.value;
        setDiamSel(prev => ({ ...prev, [activeNet]: dn }));
        if (engineRef.current && selElement) {
          engineRef.current.updateSelected({ diametro: dn });
          setSelElement({ ...selElement, diametro: dn });
        } else if (engineRef.current && !selElement) {
          const eng = engineRef.current;
          const lastRamal = [...eng.ramales].reverse().find((r) => r.net === activeNet);
          if (lastRamal) {
            eng.selId = lastRamal.id;
            eng.updateSelected({ diametro: dn });
            const { _labelBox, ...rest } = lastRamal;
            setSelElement({ ...rest, diametro: dn });
          }
        }
      }}
      style={TramoEditor_S13}>
        {(() => {
          const gasMat = GAS.find((g) => g.mat === currentMat);
          return gasMat ? gasMat.rows.map((r) => (
            <option key={r.dn} value={r.dn}>{normalizeDnLabel(r.dn)}</option>
          )) : <option value="">—</option>;
        })()}
      </select>
    ) : diamList.length > 0 ? (
      <select value={currentDiam} aria-label="Diámetro"
      onChange={e => {
        const v = e.target.value;
        const targetRamal = selElement || (engineRef.current && [...engineRef.current.ramales].reverse().find((r) => r.net === activeNet));
        if (activeNet === 'san' && (diamPulgFromLabel(v) < 3 || diamPulgFromLabel(v) > 4) &&
            targetRamal?.tipo === 'ramal' && ramalHasCodoReventilado(targetRamal)) {
          engineRef.current?.triggerAlert('Diámetro no permitido', 'La tubería principal sanitaria con codo reventilado solo admite diámetro de 3" o 4".');
          return;
        }
        setDiamSel(prev => ({ ...prev, [activeNet]: v }));
        if (engineRef.current && selElement) {
          engineRef.current.updateSelected({ diametro: v });
          setSelElement({ ...selElement, diametro: v });
        } else if (engineRef.current && !selElement) {
          const eng = engineRef.current;
          const lastRamal = [...eng.ramales].reverse().find((r) => r.net === activeNet);
          if (lastRamal) {
            eng.selId = lastRamal.id;
            eng.updateSelected({ diametro: v });
            const { _labelBox, ...rest } = lastRamal;
            setSelElement({ ...rest, diametro: v });
          }
        }
      }}
      style={TramoEditor_S13}>
      <option value="">Sin diámetro</option>
      {diamList.map((d) => {
        const valClean = d.n.split(' — ')[0].trim();
        return <option key={d.n} value={valClean}>{normalizeDnLabel(valClean)}</option>;
      })}
      </select>
                ) : (
                  <div style={{ padding: '4px 6px', background: '#1e2024', border: '1px solid #3a494a', borderRadius: 3, color: '#8AB4D6', fontSize: 12, fontFamily: "'Geist',monospace" }}>— Sin opciones —</div>
                )}
            </div>
    {showPend ? (
      <div>
        <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>Pendiente %</div>
        <input type="text" inputMode="decimal" value={pendInput} aria-label="Pendiente (%)"
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
              const lastRamal = [...eng.ramales].reverse().find((r) => r.net === activeNet);
              if (lastRamal) {
                eng.selId = lastRamal.id;
                eng.updateSelected({ pendiente: v });
                const { _labelBox, ...rest } = lastRamal;
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
        style={TramoEditor_S4}
        />
            </div>
            ) : null}
          </div>
          {showCaudal && (
            <CaudalField selElement={selElement} />
          )}
          {(showDeltaZ || showDescargas) && (
            <div style={{ display: 'grid', gridTemplateColumns: (showDeltaZ || showDescargas) ? '1fr 1fr' : '1fr', gap: 6 }}>
              {showDeltaZ && (
              <div>
                <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0, whiteSpace: 'nowrap' }}>Altura (m)</div>
                <input type="number" step="0.01" value={selElement?.dz ?? ''} placeholder="0.00" aria-label="Delta Z o longitud vertical (m)"
                  onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({dz:v,lvert:v});setSelElement({...selElement,dz:v,lvert:v} as PlanoRamal)}}}
                  style={TramoEditor_S12}/>
              </div>
              )}
              {showDescargas && (
                <div>
                  <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0, whiteSpace: 'nowrap' }}>Descargas</div>
                  <input type="number" step="1" min="1" value={selElement?.nSalidas ?? 1} placeholder="1" aria-label="Número de descargas en simultáneo"
                    onChange={e=>{if(engineRef.current){const v=parseInt(e.target.value)||1;engineRef.current.updateSelected({nSalidas:v});setSelElement({...selElement,nSalidas:v} as PlanoRamal)}}}
                    style={TramoEditor_S12}/>
                </div>
              )}
            </div>
          )}
    </div>
  </div>
  );
}

/* ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Variant components — explicit, composed, no boolean props
 * ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――― */

function ContadorTramoEditor() {
  const { selElement, activeNet, handleUpdateSel } = React.useContext(TramoEditorCtx)!
  return <ContadorEditor selElement={selElement as PlanoBajante} activeNet={activeNet} handleUpdateSel={handleUpdateSel} />
}

function CalentadorTramoEditor() {
  const { selElement, handleUpdateSel } = React.useContext(TramoEditorCtx)!
  return <CalentadorEditor selElement={selElement as PlanoBajante} handleUpdateSel={handleUpdateSel} />
}

function BajanteHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = React.useContext(TramoEditorCtx)!
  if (!rawSelElement) return null
  const selElement = rawSelElement as PlanoBajante
  return (
    <div>
      <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Código</div>
      <input value={selElement.code||''} placeholder="Código bajante" aria-label="Código"
        onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({code:v});setSelElement({...selElement,code:v})}}}
        style={TramoEditor_S21}/>
    </div>
  )
}

function AreaHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = React.useContext(TramoEditorCtx)!
  if (!rawSelElement) return null
  const selElement = rawSelElement as PlanoArea
  return (
    <>
      <div>
        <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Etiqueta</div>
        <input value={selElement.label||''} placeholder="Etiqueta área" aria-label="Etiqueta"
          onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({label:v});setSelElement({...selElement,label:v})}}}
          style={TramoEditor_S22}/>
      </div>
      <div>
        <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Área calculada</div>
        <div style={TramoEditor_S23}>
          {selElement.areaM2 ? `${selElement.areaM2} m²` : '—'}
        </div>
      </div>
      <div>
        <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Asociar Bajante</div>
        <select aria-label="Asociar bajante"
          value={(engineRef.current?.bajantes || []).find((b) => b.area_m2 === selElement.areaM2)?.id || ''}
          onChange={e => {
            const bajanteId = e.target.value;
            (engineRef.current?.bajantes || []).forEach((b) => {
              if (b.area_m2 === selElement.areaM2) { engineRef.current?.updateElementById(b.id, { area_m2: 0 }); }
            });
            if (bajanteId) { engineRef.current?.updateElementById(bajanteId, { area_m2: selElement.areaM2 }); }
            if (engineRef.current) engineRef.current._markDirty();
            setSelElement({...selElement});
          }}
          style={TramoEditor_S24}>
          <option value="">— Sin bajante —</option>
          {(engineRef.current?.bajantes || []).filter((b) => b.net === selElement.net).map((b) => (
            <option key={b.id} value={b.id}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</option>
          ))}
        </select>
      </div>
    </>
  )
}

function TextHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = React.useContext(TramoEditorCtx)!
  if (!rawSelElement) return null
  const selElement = rawSelElement as PlanoTextAnnotation
  return (
    <div>
      <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Texto</div>
      <input value={selElement.text||''} placeholder="Texto" aria-label="Texto adicional"
        onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({text:v});setSelElement({...selElement,text:v})}}}
        style={TramoEditor_S24}/>
    </div>
  )
}

function RamalHeaderFields() {
  const { selElement: rawSelElement, engineRef, setSelElement } = React.useContext(TramoEditorCtx)!
  if (!rawSelElement) return null
  const selElement = rawSelElement as PlanoRamal

  const displayLabelWithPiso = (label: string | null | undefined, pisoLabel: string) => {
    if (!label) return '';
    if (label.includes('-')) return label;
    if (!pisoLabel) return label;
    const n = engineRef.current?.nivelActual?.n;
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
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr',gap:3}}>
        <div>
          <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Nombre</div>
          <input value={displayLabelWithPiso(selElement.label, engineRef.current?.nivelActual?.label ?? '')} placeholder="Tramo" aria-label="Nombre del tramo"
            onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({label:v});setSelElement({...selElement,label:v})}}}
            style={TramoEditor_S22}/>
        </div>
        <div>
          <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Inicio</div>
          <input value={selElement.ini||''} placeholder="— inicial —" aria-label="Conexión de inicio"
            onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({ini:v});setSelElement({...selElement,ini:v})}}}
            style={TramoEditor_S22}/>
        </div>
        <div>
          <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",marginBottom:2,textTransform:'uppercase',letterSpacing:.3}}>Final</div>
          <input value={selElement.fin||''} placeholder="— final —" aria-label="Conexión de fin"
            onChange={e=>{if(engineRef.current){const v=e.target.value;engineRef.current.updateSelected({fin:v});setSelElement({...selElement,fin:v})}}}
            style={TramoEditor_S22}/>
        </div>
      </div>
    </div>
  )
}

/* ---------- Editor section variants ---------- */

function BajanteEditorSection() {
  const ctx = React.useContext(TramoEditorCtx)!
  const { engineRef, activeNet, plans } = ctx
  const selElement = ctx.selElement as ProbedElement | null
  const lvl = engineRef.current?.nivelActual?.label ?? ''

  const allBajantes = useMemo(() => {
    if (!plans) return [];
    const list: Array<{ key: string; id: string; label: string; planId: string; planName: string; planNivel: number; descargaEnId: string | null }> = [];
    for (const plan of plans) {
      if (plan.status !== 'confirmed') continue;
      const key = TRAZOS_PLAN_PREFIX + plan.id;
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
                planNivel: plan.nivel as number,
                descargaEnId: b.descargaEnId || null
              });
            }
          }
        } catch { /* ignore */ }
      }
    }
    return list;
  }, [plans, activeNet]);

  const adjacentLevels = useMemo(() => {
    const list: number[] = [];
    const currentPlanNivel = engineRef.current?.nivelActual?.n;
    if (typeof currentPlanNivel !== 'number') return [];
    if (ctx.pisos && ctx.pisos.length > 0) {
      const sorted = ctx.pisos.toSorted((a, b) => a.n - b.n);
      const currIdx = sorted.findIndex((s) => s.n === currentPlanNivel);
      if (currIdx !== -1) {
        if (currIdx > 0) list.push(sorted[currIdx - 1].n);
        if (currIdx < sorted.length - 1) list.push(sorted[currIdx + 1].n);
        return list;
      }
    }
    if (plans && plans.length > 0) {
      const uniqueLevels = Array.from(new Set(plans.map(p => p.nivel).filter((n) => typeof n === 'number'))) as number[];
      uniqueLevels.sort((a, b) => a - b);
      const currIdx = uniqueLevels.indexOf(currentPlanNivel);
      if (currIdx !== -1) {
        if (currIdx > 0) list.push(uniqueLevels[currIdx - 1]);
        if (currIdx < uniqueLevels.length - 1) list.push(uniqueLevels[currIdx + 1]);
      }
    }
    return list;
  }, [ctx.pisos, plans, engineRef.current?.nivelActual?.n]);

  const adjacentBajantes = useMemo(() => {
    if (adjacentLevels.length === 0) return allBajantes;
    const allowed = new Set(adjacentLevels);
    return allBajantes.filter(b => allowed.has(b.planNivel));
  }, [allBajantes, adjacentLevels]);

  const isGhostSel = (selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante') && engineRef.current?._isGhostSel) || false

  return (
    <BajanteEditor
      selElement={selElement as PlanoBajante}
      activeNet={activeNet}
      engineRef={engineRef}
      setSelElement={ctx.setSelElement}
      handleUpdateSel={ctx.handleUpdateSel}
      isGhostSel={isGhostSel}
      lvl={lvl}
      allBajantes={adjacentBajantes}
      plans={plans}
    />
  )
}

function RamalEditorSection() {
  const ctx = React.useContext(TramoEditorCtx)!
  const { engineRef, setSelElement, activeNet, plans, diamSel, gasMatSel, pendSel, pendInput, mats, matLongName, setDiamSel, setGasMatSel, setPendSel, setPendInput } = ctx
  const selElement = ctx.selElement as ProbedElement | null
  const isSelActiveNet = selElement && selElement.net === activeNet

  return (
    <>
      <RamalEditor
        selElement={selElement as PlanoRamal | null}
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
      {selElement && (['tributario', 'ramal'].includes(selElement.tipo ?? '')) && ['san', 'af', 'ac'].includes(activeNet) && (
        <ExtremeAccessoryEditor
          selElement={selElement as PlanoRamal}
          engineRef={engineRef}
          setSelElement={(el) => setSelElement(el)}
          diamList={(() => {
            const matList = mats?.[activeNet] || [];
            const matShort = matList[0]?.val || '—';
            return activeNet === 'vent'
              ? VENTILACION[0]?.rows.map((r) => ({ n: r.dn })) || []
              : DIAM_BY_MAT[matShort] || [];
          })()}
          activeNet={activeNet}
          plans={plans}
        />
      )}
      {selElement?.pts && (engineRef.current?.bajantes?.length ?? 0) > 0 && ['san', 'll'].includes(activeNet) && (
        <div style={{ padding: "10px 12px 8px", borderBottom: '1px solid #3a494a' }}>
          <div style={{ fontSize: 12, color: '#9BA8AA', fontFamily: "'Geist',monospace", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bajantes asociadas</div>
          <div style={TramoEditor_S8}>
            {(() => {
              const netBajs = (engineRef.current?.bajantes || []).filter((b) => b.net === activeNet && b.tipo !== 'tributario');
              if (netBajs.length === 0) return <div style={{ fontSize: 12, color: '#8AB4D6', fontFamily: "'Geist',monospace", padding: '4px', gridColumn: 'span 2' }}>Sin bajantes en esta red</div>;
              return netBajs.map((b) => {
                const isAssoc = (b.recibeDeIds || []).includes(selElement.id);
                return (
                  <label key={b.id} style={TramoEditor_S9}>
                    <input type="checkbox" checked={isAssoc}
                      onChange={e => {
                        const newRecibe = e.target.checked
                          ? (b.recibeDeIds.includes(selElement.id) ? b.recibeDeIds : [...b.recibeDeIds, selElement.id])
                          : b.recibeDeIds.filter((id: string) => id !== selElement.id);
                        engineRef.current?.updateElementById(b.id, { recibeDeIds: newRecibe });
                        engineRef.current?.render();
                        engineRef.current?._markDirty();
                      }}
                      style={{ accentColor: '#F5A623', margin: 0, flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word' }}>{bajanteLabel(b, engineRef.current?.nivelActual?.label)}</span>
                  </label>
                );
              });
            })()}
          </div>
        </div>
      )}
    </>
  )
}

/* ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Main component — provider wrapper + dispatch
 * ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――― */

interface TramoEditorProps {
  selElement: PlanoElement | null
  activeNet: string
  engineRef: RefObject<PlanoEngine | null>
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
  setSelElement: React.Dispatch<React.SetStateAction<PlanoElement | null>>
  handleUpdateSel: (field: string, value: unknown) => void
  handleRotateLabel: () => void
  plans?: PlanItem[]
  pisos?: Piso[]
}

export default function TramoEditor(props: TramoEditorProps) {
  const ctxValue: TramoEditorContextValue = {
    engineRef: props.engineRef as React.MutableRefObject<PlanoEngine | null>,
    selElement: props.selElement,
    setSelElement: props.setSelElement,
    activeNet: props.activeNet,
    handleUpdateSel: props.handleUpdateSel,
    handleRotateLabel: props.handleRotateLabel,
    diamSel: props.diamSel,
    setDiamSel: props.setDiamSel,
    gasMatSel: props.gasMatSel,
    setGasMatSel: props.setGasMatSel,
    pendSel: props.pendSel,
    setPendSel: props.setPendSel,
    pendInput: props.pendInput,
    setPendInput: props.setPendInput,
    mats: props.mats,
    matLongName: props.matLongName,
    plans: props.plans,
    pisos: props.pisos,
  }

  return (
    <TramoEditorCtx.Provider value={ctxValue}>
      <TramoEditorInner />
    </TramoEditorCtx.Provider>
  )
}

function TramoEditorInner() {
  const ctx = React.useContext(TramoEditorCtx)!
  const { engineRef, handleRotateLabel } = ctx
  const selElement = ctx.selElement as ProbedElement | null

  if (selElement && selElement.tipo === 'contador') return <ContadorTramoEditor />
  if (selElement && selElement.tipo === 'calentador') return <CalentadorTramoEditor />

  const isGhostSel = (selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante') && engineRef.current?._isGhostSel) || false
  const isBajMont = selElement && (selElement.tipo === 'bajante' || selElement.tipo === 'montante')
  const isArea = selElement && selElement.id?.startsWith('AR')
  const isText = selElement && selElement.id?.startsWith('T')
  const isRamal = selElement && (selElement.tipo === 'ramal' || selElement.tipo === 'tributario' || selElement.pts)

  return (
    <form onSubmit={e => e.preventDefault()}>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #3a494a" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Geist',monospace", fontSize: 12, color: "#9BA8AA", textTransform: "uppercase", letterSpacing: 1 }}>
            {isGhostSel ? 'Datos del bajante fantasma' : (isArea ? 'Datos del área' : 'Datos del tramo')}
          </div>
          {selElement && (selElement.pts || selElement.id?.startsWith('T')) && (
            <button type="button" onClick={handleRotateLabel} title="Rotar etiqueta (0°/45°/90°/-90°/-45°)" style={TramoEditor_S31}>
              <span style={{ fontSize: 12, lineHeight: 1 }}>↻</span>
              <span>{selElement.labelAngle || selElement.textAngle || 0}°</span>
            </button>
          )}
        </div>
        {selElement ? (
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            {isRamal && <RamalHeaderFields />}
            {isBajMont && <BajanteHeaderFields />}
            {isText && <TextHeaderFields />}
            {isArea && <AreaHeaderFields />}
            {selElement.pts && (
              <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace"}}>
                L={selElement.totalL}m · {selElement.pts.length} pts
                {selElement.tipo?` · ${selElement.tipo}`:''}
              </div>
            )}
          </div>
        ) : (
          <div style={{fontSize: 12,color:'#8AB4D6',fontFamily:"'Geist',monospace",padding:'4px 0'}}>
            Selecciona un elemento en el plano
          </div>
        )}
      </div>

      {selElement && !isArea && isBajMont && <BajanteEditorSection />}
      {selElement && !isArea && !isBajMont && <RamalEditorSection />}
    </form>
  )
}
