import React, { useState } from "react";
import type { Dispatch, SetStateAction, ChangeEvent, FocusEvent } from "react";
import { REDES, USOS, pisoLbl } from "../../constants";
import { NETS } from "../../lib/PlanoEngine/PlanoState";
import type { useWorkAreaState } from "../useWorkAreaState";
import EditButton from "../shared/EditButton";
import { devError } from "../../utils/devError";
const InfoTab_S1: React.CSSProperties = { padding: '3px 6px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 11, lineHeight: 1, flexShrink: 0, marginLeft: 2 };
const InfoTab_S2: React.CSSProperties = { flexShrink: 0, padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.92)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, };
const InfoTab_S3: React.CSSProperties = { background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 8px', flexShrink: 0 };
const InfoTab_S4: React.CSSProperties = { display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 6, flex: 1, minHeight: 0, overflowY: 'hidden', overflowX: 'auto', alignItems: 'stretch' };
const InfoTab_netBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 3,
  background: 'var(--bg3)', borderTop: '1px solid var(--line)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', borderLeft: '1px solid var(--line)', borderRadius: 'var(--r)', transition: 'all .15s', font: 'inherit', color: 'inherit', textAlign: 'left',
};
const InfoTab_equipoBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 3, padding: '3px 5px',
  background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', transition: 'all .15s', width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left',
};
const InfoTab_cubiertaToggle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none', padding: '4px 8px', borderRadius: 4, flexShrink: 0, border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', width: '100%', textAlign: 'inherit' };
const InfoTab_generarBtn: React.CSSProperties = { width: '100%', padding: '6px', marginTop: 6, background: 'var(--acc)', border: 'none', borderRadius: 'var(--r)', color: '#fff', fontWeight: 600, fontSize: 12 };
const InfoTab_pisoLi: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 3, padding: '2px 4px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', marginBottom: 2 };


type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface InfoTabProps {
  state: WorkAreaState;
}

const ProjectIdCard = React.memo(function ProjectIdCard({ proy, setP }: { proy: any; setP: (k: string, v: any) => void }) {
  const [isEditing, setIsEditing] = React.useState(false);
  return (
    <section className="card" style={{ flex: '0 1 auto', minWidth: 200 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img src="/iconos_info_general/identificacion_del_proyecto.svg" alt="Identificación del proyecto"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
            Identificación del proyecto
            <EditButton edit={isEditing} setEdit={setIsEditing} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>Datos para memorias de cálculo</span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div className="f" style={{ marginBottom: 3 }}><label htmlFor="proj-nombre" style={{ fontSize: 12 }}>Nombre del proyecto</label><input id="proj-nombre" disabled={!isEditing} value={proy.nombre} onChange={e => setP('nombre', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label htmlFor="proj-dir" style={{ fontSize: 12 }}>Dirección / Sector</label><input id="proj-dir" disabled={!isEditing} value={proy.dir} onChange={e => setP('dir', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label htmlFor="proj-mun" style={{ fontSize: 12 }}>Municipio</label><input id="proj-mun" disabled={!isEditing} value={proy.mun} onChange={e => setP('mun', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label htmlFor="proj-dep" style={{ fontSize: 12 }}>Departamento</label><input id="proj-dep" disabled={!isEditing} value={proy.dep} onChange={e => setP('dep', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', opacity: isEditing ? 1 : 0.7 }} /></div>
        <div className="f" style={{ marginBottom: 0 }}><label htmlFor="proj-uso" style={{ fontSize: 12 }}>Uso</label>
          <select id="proj-uso" disabled={!isEditing} value={proy.uso} onChange={e => setP('uso', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', width: '100%', opacity: isEditing ? 1 : 0.7 }}><option value="">—</option>{USOS.map(u => <option key={u}>{u}</option>)}</select></div>
      </div>
    </section>
  );
});

const ActiveNetsCard = React.memo(function ActiveNetsCard({ redes, setRedes, netColors, setNetColors }: { redes: Set<string>; setRedes: Dispatch<SetStateAction<Set<string>>>; netColors: Record<string, string>; setNetColors: Dispatch<SetStateAction<Record<string, string>>> }) {
  const [isEditing, setIsEditing] = React.useState(false);
  return (
    <section className="card" style={{ flex: '0 1 auto', minWidth: 190 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img src="/iconos_info_general/redes_activas.svg" alt="Redes activas"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
            Redes activas
            <EditButton edit={isEditing} setEdit={setIsEditing} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>
            {[...redes].filter(id => id !== 'ep' && id !== 'bom' && id !== 'vent' && id !== 'recolectora').length} de {REDES.filter(r => r.id !== 'ep' && r.id !== 'bom' && r.id !== 'vent' && r.id !== 'recolectora').length}
          </span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
          {(() => {
            const mainNets = REDES.filter(r => r.id !== 'ep' && r.id !== 'bom' && r.id !== 'san' && r.id !== 'vent' && r.id !== 'recolectora');
            const sanRede = REDES.find(x => x.id === 'san');
            const ventRede = REDES.find(x => x.id === 'vent');
            const llRede = REDES.find(x => x.id === 'll');
            const recolectoraRede = REDES.find(x => x.id === 'recolectora');
            const ordered = [...mainNets];
            if (sanRede) ordered.push(sanRede);
            if (ventRede) ordered.push(ventRede);
            if (llRede && recolectoraRede) {
              const llIdx = ordered.indexOf(llRede);
              if (llIdx >= 0) ordered.splice(llIdx + 1, 0, recolectoraRede);
            }

            return ordered.map(r => {
              const isVent = r.id === 'vent';
              const isRecolectora = r.id === 'recolectora';
              const isSub = isVent || isRecolectora;
              const on = redes.has(r.id);
              const sanOn = redes.has('san');
              const llOn = redes.has('ll');
              const parentOn = isVent ? sanOn : isRecolectora ? llOn : true;
              const cssVar = `--${r.id === 'recolectora' ? 'll' : r.id}`;
              const currentColor = r.id === 'recolectora' ? (netColors['ll'] || '#8B5CF6') : (netColors[r.id] || '#666');
              return (
                <button type="button" key={r.id} disabled={!isEditing || (isSub && !parentOn)} onClick={() => { if (isSub && !parentOn) return; const n = new Set(redes); if (isRecolectora && !llOn && !on) { n.add('ll'); n.add(r.id); } else if (isVent && !sanOn && !on) { n.add(r.id); } else { if (on) n.delete(r.id); else n.add(r.id); } setRedes(n); }}
                  style={{
                    ...InfoTab_netBtn,
                    padding: isSub ? '2px 5px 2px 12px' : '3px 5px',
                    marginLeft: isSub ? 10 : 0,
                    cursor: isEditing && (!isSub || parentOn) ? 'pointer' : 'default',
                    width: isSub ? 'calc(100% - 10px)' : '100%',
                    opacity: (isEditing && (!isSub || parentOn)) ? 1 : 0.5
                  }}>
                  {r.icoImg ? <img src={r.icoImg} alt="" width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle' }} loading="lazy" /> : <span style={{ fontSize: 13 }}>{r.ico}</span>}
                  <span style={{ fontWeight: 600, fontSize: 12, color: on ? currentColor : 'var(--txt2)', whiteSpace: 'nowrap', flex: 1 }}>{r.lbl}</span>
                  {!isRecolectora && (
                    <input type="color" value={currentColor} disabled={!isEditing || (isSub && !parentOn)} aria-label="Color de red"
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        const c = e.target.value;
                        setNetColors(prev => ({ ...prev, [r.id]: c }));
                        document.documentElement.style.setProperty(cssVar, c);
                        try {
                          const net = NETS.find((n: any) => n.id === r.id);
                          if (net) net.col = c;
                        } catch (e) { devError(e); }
                        try { localStorage.setItem('civilflow_net_' + r.id, c); } catch { /* ignore */ }
                      }}
                      style={{ width: 14, height: 14, border: 'none', padding: 0, cursor: isEditing && (!isSub || parentOn) ? 'pointer' : 'default', background: 'none', flexShrink: 0, opacity: isEditing && (!isSub || parentOn) ? 1 : 0.5 }} />
                  )}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: on ? currentColor : 'transparent', border: '1.5px solid ' + (on ? currentColor : 'var(--txt3)') }} />
                  <span className="visually-hidden">{on ? 'Activa' : 'Inactiva'}</span>
                </button>
              );
            });
          })()}
        </div>
      </div>
    </section>
  );
});

const ActiveEquiposCard = React.memo(function ActiveEquiposCard({ redes, setRedes }: { redes: Set<string>; setRedes: Dispatch<SetStateAction<Set<string>>> }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="card" style={{ flex: 1, minWidth: 190, display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <h3 className="card-t" style={{ fontSize: 13, flex: 1, whiteSpace: 'nowrap' }}>
              <img src="/iconos_info_general/equipos_activos.svg" alt="Equipos activos"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
              Equipos activos
            </h3>
            <EditButton edit={editing} setEdit={setEditing} />
          </div>
          <span className="card-s" style={{ fontSize: 11 }}>{[...redes].filter(id => id === 'ep' || id === 'bom').length} de 2</span>
        </div>
      </div>
      <div style={{ flex: 1, padding: '4px 6px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
          {['ep', 'bom'].map(id => {
            const r = REDES.find(x => x.id === id);
            if (!r) return null;
            const on = redes.has(r.id);
            return (
              <button type="button" key={r.id} disabled={!editing} onClick={() => { if (!editing) return; const n = new Set(redes); if (on) n.delete(r.id); else n.add(r.id); setRedes(n); }}
                style={{ ...InfoTab_equipoBtn, cursor: editing ? 'pointer' : 'default', opacity: editing ? 1 : 0.5 }}>
                {r.icoImg ? <img src={r.icoImg} alt=""  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle' }}  loading="lazy" /> : <span style={{ fontSize: 13 }}>{r.ico}</span>}
                <span style={{ fontWeight: 600, fontSize: 12, color: on ? '#ffffff' : 'var(--txt2)', whiteSpace: 'nowrap', flex: 1 }}>{r.lbl}</span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: on ? '#ffffff' : 'transparent', border: '1.5px solid ' + (on ? '#ffffff' : 'var(--txt3)') }} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
});

const FloorGeneratorCard = React.memo(function FloorGeneratorCard(props: {
  nSotanos: string; nPisos: string; altPiso: string; altSotano: string; nptPiso1: string;
  conCubierta: boolean; setConCubierta: (v: boolean) => void;
  setNSotanos: (v: string) => void; setNPisos: (v: string) => void;
  setAltPiso: (v: string) => void; setAltSotano: (v: string) => void; setNptPiso1: (v: string) => void;
  onIntChange: (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => void;
  onIntBlur: (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => void;
  onDecChange: (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => void;
  onDecBlur: (setter: (v: string) => void) => (e: FocusEvent<HTMLInputElement>) => void;
  generarPisos: () => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  return (
    <section className="card" style={{ flex: '0 0 auto', minWidth: 0 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img src="/iconos_info_general/generador_de_pisos.svg" alt="Generador de pisos"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
            Generador de pisos
            <EditButton edit={isEditing} setEdit={setIsEditing} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>Generación automática de pisos y sótanos</span>
        </div>
      </div>
        <div style={{ padding: '4px 6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, alignItems: 'end' }}>
            <div className="f" style={{ marginBottom: 0 }}><label htmlFor="fg-pisos" style={{ fontSize: 12 }}>Pisos</label><input id="fg-pisos" type="text" disabled={!isEditing} inputMode="numeric" value={props.nPisos} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px', opacity: isEditing ? 1 : 0.7 }} onChange={props.onIntChange(props.setNPisos)} onBlur={props.onIntBlur(props.setNPisos)} /></div>
            <div className="f" style={{ marginBottom: 0 }}><label htmlFor="fg-altpiso" style={{ fontSize: 12 }}>Altura entrepiso</label><input id="fg-altpiso" type="text" disabled={!isEditing} inputMode="decimal" value={props.altPiso} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px', opacity: isEditing ? 1 : 0.7 }} onChange={props.onDecChange(props.setAltPiso)} onBlur={props.onDecBlur(props.setAltPiso)} /></div>
            <div className="f" style={{ marginBottom: 0 }}><label htmlFor="fg-sotanos" style={{ fontSize: 12 }}>Sótanos</label><input id="fg-sotanos" type="text" disabled={!isEditing} inputMode="numeric" value={props.nSotanos} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px', opacity: isEditing ? 1 : 0.7 }} onChange={props.onIntChange(props.setNSotanos)} onBlur={props.onIntBlur(props.setNSotanos)} /></div>
            <div className="f" style={{ marginBottom: 0 }}><label htmlFor="fg-altsot" style={{ fontSize: 12 }}>Altura sótano</label><input id="fg-altsot" type="text" disabled={!isEditing} inputMode="decimal" value={props.altSotano} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px', opacity: isEditing ? 1 : 0.7 }} onChange={props.onDecChange(props.setAltSotano)} onBlur={props.onDecBlur(props.setAltSotano)} /></div>
            <div className="f" style={{ marginBottom: 0 }}><label htmlFor="fg-npt" style={{ fontSize: 12 }}>NPT P1</label><input id="fg-npt" type="text" disabled={!isEditing} inputMode="decimal" value={props.nptPiso1} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px', opacity: isEditing ? 1 : 0.7 }} onChange={props.onDecChange(props.setNptPiso1)} onBlur={props.onDecBlur(props.setNptPiso1)} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 2 }}>
              <button type="button" disabled={!isEditing} role="switch" aria-checked={props.conCubierta} onClick={() => props.setConCubierta(!props.conCubierta)} title="Incluir cubierta" style={{ ...InfoTab_cubiertaToggle, cursor: isEditing ? 'pointer' : 'default', opacity: isEditing ? 1 : 0.7 }}>
                <div style={{ width: 28, height: 15, borderRadius: 8, background: props.conCubierta ? 'var(--ll)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                  <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: props.conCubierta ? 15 : 2, transition: 'left .2s' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt2)' }}>Incluir cubierta</span>
              </button>
            </div>
          </div>
          <button type="button" disabled={!isEditing} onClick={props.generarPisos} style={{ ...InfoTab_generarBtn, cursor: isEditing ? 'pointer' : 'default', opacity: isEditing ? 1 : 0.5 }}>Generar niveles automáticamente</button>
        </div>
    </section>
  );
});

const LevelsCard = React.memo(function LevelsCard({ pisos, delPiso, addPiso, addSotano, setPisos }: { pisos: any[]; delPiso: (id: string | number) => void; addPiso: () => void; addSotano: () => void; setPisos: (p: any[] | ((prev: any[]) => any[])) => void }) {
  const [isEditing, setIsEditing] = React.useState(false);
  return (
    <section className="card" style={{ flex: '1 1 auto', minWidth: 220, display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ padding: '4px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 className="card-t" style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}>
            <img src="/iconos_info_general/niveles_generados.svg" alt="Niveles generados"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
            Niveles generados
            <EditButton edit={isEditing} setEdit={setIsEditing} />
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>{pisos.length} niveles</span>
        </div>
      </div>
      <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {pisos.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '12px 0' }}>Presione "Generar niveles"</div>
        )}
        {pisos.length > 0 && (
          <>
            <ul role="list" style={{ flex: 1, overflowY: 'auto', minHeight: 0, listStyle: 'none', margin: 0, padding: 0 }}>
              {pisos.toSorted((a, b) => (b.tipo === 'cubierta' ? 999 : b.n) - (a.tipo === 'cubierta' ? 999 : a.n)).map((p: any) => (
                <li key={p.id} style={{ ...InfoTab_pisoLi, borderLeft: '3px solid ' + (p.tipo === 'cubierta' ? 'var(--ll)' : p.n < 0 ? 'var(--txt3)' : 'var(--acc2)') }}>
                  <span className={p.tipo === 'cubierta' ? 'piso-tag cub' : p.n < 0 ? 'piso-tag sot' : 'piso-tag'} style={{ fontSize: 11, padding: '2px 5px', minWidth: 48 }}>{pisoLbl(p.n)}</span>
                  <input type="text" disabled={!isEditing} inputMode="decimal" value={p.npt ?? ''} key={p.id + 'npt'} className="npt-in" aria-label={`NPT para ${pisoLbl(p.n)}`} style={{ fontSize: 12, width: 52, padding: '2px 4px', opacity: isEditing ? 1 : 0.7 }}
                    onChange={e => {
                      const raw = e.target.value.replace(/,/g, '.');
                      if (raw === '' || raw === '-' || raw === '.' || /^-?\d*\.?\d*$/.test(raw)) {
                        setPisos((prev: any[]) => prev.map(x => x.id === p.id ? { ...x, npt: raw } : x));
                      }
                    }}
                    onBlur={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) {
                        setPisos((prev: any[]) => prev.map(x => x.id === p.id ? { ...x, npt: v.toFixed(2) } : x));
                      }
                    }}
                  />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 20 }}><span style={{ fontSize: 11, color: 'var(--txt3)' }}>m</span></div>
                  <div className={`pdot ${p.ok ? 'ok' : ''}`} />
                  {isEditing && <button type="button" onClick={() => delPiso(p.id)} title="Eliminar nivel" style={InfoTab_S1} onMouseEnter={e => { e.currentTarget.style.color = '#ef5350'; e.currentTarget.style.borderColor = 'rgba(211,47,47,.5)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt3)'; e.currentTarget.style.borderColor = 'var(--line)'; }}>&#x2715;</button>}
                </li>
              ))}
            </ul>
            {isEditing && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 2, flexShrink: 0 }}>
              <button type="button" className="btn-xs" onClick={addSotano} style={{ padding: '3px 6px', fontSize: 10 }}>+ Sótano</button>
              <button type="button" className="btn-xs" onClick={addPiso} style={{ padding: '3px 6px', fontSize: 10 }}>+ Piso</button>
            </div>}
          </>
        )}
      </div>
    </section>
  );
});

const UsageGuideCard = React.memo(function UsageGuideCard() {
  return (
    <section className="card" style={{ flex: '0 1 auto', minWidth: 0 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_info_general/guia_de_uso.svg" alt="Guía de uso"  width={22} height={22} style={{width:22,height:22, verticalAlign: 'middle', marginRight: 2 }}  loading="lazy" />
            Guía de uso
          </h3>
          <span className="card-s" style={{ fontSize: 11 }}>Recomendaciones</span>
        </div>
      </div>
      <div style={{ padding: '4px 8px', fontSize: 11, lineHeight: 1.6, color: 'var(--txt2)' }}>
        <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal', fontWeight: 600 }}>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Complete los datos del proyecto con la información de la memoria de cálculo.</li>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Active las redes que requiere el diseño según el uso del edificio.</li>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Configure la cantidad de pisos y sótanos, luego pulse <strong>"Generar niveles automáticamente"</strong>.</li>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Verifique los NPT generados y ajústelos si es necesario.</li>
          <li style={{ marginBottom: 5, fontWeight: 400, paddingLeft: 3 }}>Vaya a la pestaña <strong>Diseño de Redes y Equipos</strong> para iniciar el cálculo hidráulico de cada red activa.</li>
        </ol>
      </div>
    </section>
  );
});

function InfoTab({ state }: InfoTabProps) {
  const {
    proy, setP,
    redes, setRedes, netColors, setNetColors,
    nSotanos, nPisos, altPiso, altSotano, nptPiso1, conCubierta, setConCubierta,
    generarPisos, alertMsg, setAlertMsg,
    onIntChange, onIntBlur, onDecChange, onDecBlur,
    pisos, delPiso, addPiso, addSotano,
  } = state;

  return (
    <div className="fu info-gral" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {alertMsg && (
        <div role="alert" style={InfoTab_S2}>
          ⚠ {alertMsg}
          <button type="button" onClick={() => setAlertMsg(null)} style={InfoTab_S3}>✕</button>
        </div>
      )}
      <div style={InfoTab_S4}>
        <ProjectIdCard proy={proy} setP={setP} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 auto' }}>
          <ActiveNetsCard redes={redes} setRedes={setRedes} netColors={netColors} setNetColors={setNetColors} />
          <ActiveEquiposCard redes={redes} setRedes={setRedes} />
        </div>
        <FloorGeneratorCard
          nSotanos={nSotanos} nPisos={nPisos} altPiso={altPiso} altSotano={altSotano} nptPiso1={nptPiso1}
          conCubierta={conCubierta} setConCubierta={setConCubierta}
          onIntChange={onIntChange} onIntBlur={onIntBlur}
          onDecChange={onDecChange} onDecBlur={onDecBlur}
          setNSotanos={state.setNSotanos} setNPisos={state.setNPisos}
          setAltPiso={state.setAltPiso} setAltSotano={state.setAltSotano}
          setNptPiso1={state.setNptPiso1}
          generarPisos={generarPisos}
        />
        <LevelsCard pisos={pisos} delPiso={delPiso} addPiso={addPiso} addSotano={addSotano} setPisos={state.setPisos} />
        <UsageGuideCard />
      </div>
    </div>
  );
}
export default React.memo(InfoTab);