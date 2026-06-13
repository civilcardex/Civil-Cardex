import type { Dispatch, SetStateAction, ChangeEvent, FocusEvent } from "react";
import { REDES, USOS, pisoLbl } from "../../constants";
import type { useWorkAreaState } from "../useWorkAreaState";

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface InfoTabProps {
  state: WorkAreaState;
}

function ProjectIdCard({ proy, setP }: { proy: any; setP: (k: string, v: any) => void }) {
  return (
    <div className="card" style={{ flex: '0 1 auto', minWidth: 200 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_info_general/identificacion_del_proyecto.webp" alt="" style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }} />
            Identificación del proyecto
          </span>
          <span className="card-s" style={{ fontSize: 11 }}>Datos para memorias de cálculo</span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div className="f" style={{ marginBottom: 3 }}><label style={{ fontSize: 12 }}>Nombre del proyecto</label><input value={proy.nombre} onChange={e => setP('nombre', e.target.value)} style={{ fontSize: 12, padding: '3px 6px' }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label style={{ fontSize: 12 }}>Dirección / Sector</label><input value={proy.dir} onChange={e => setP('dir', e.target.value)} style={{ fontSize: 12, padding: '3px 6px' }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label style={{ fontSize: 12 }}>Municipio</label><input value={proy.mun} onChange={e => setP('mun', e.target.value)} style={{ fontSize: 12, padding: '3px 6px' }} /></div>
        <div className="f" style={{ marginBottom: 3 }}><label style={{ fontSize: 12 }}>Departamento</label><input value={proy.dep} onChange={e => setP('dep', e.target.value)} style={{ fontSize: 12, padding: '3px 6px' }} /></div>
        <div className="f" style={{ marginBottom: 0 }}><label style={{ fontSize: 12 }}>Uso</label>
          <select value={proy.uso} onChange={e => setP('uso', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', width: '100%' }}><option value="">—</option>{USOS.map(u => <option key={u}>{u}</option>)}</select></div>
      </div>
    </div>
  );
}

function ActiveNetsCard({ redes, setRedes, netColors, setNetColors }: { redes: Set<string>; setRedes: Dispatch<SetStateAction<Set<string>>>; netColors: Record<string, string>; setNetColors: Dispatch<SetStateAction<Record<string, string>>> }) {
  return (
    <div className="card" style={{ flex: '0 1 auto', minWidth: 190 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_info_general/redes_activas.webp" alt="" style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }} />
            Redes activas
          </span>
          <span className="card-s" style={{ fontSize: 11 }}>
            {[...redes].filter(id => id !== 'ep' && id !== 'bom').length} de {REDES.filter(r => r.id !== 'ep' && r.id !== 'bom').length}
          </span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
          {REDES.filter(r => r.id !== 'ep' && r.id !== 'bom').map(r => {
            const on = redes.has(r.id);
            const cssVar = `--${r.id}`;
            const currentColor = netColors[r.id] || '#666';
            return (
              <button key={r.id} onClick={() => { const n = new Set(redes); on ? n.delete(r.id) : n.add(r.id); setRedes(n); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, padding: '3px 5px', cursor: 'pointer',
                  background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', transition: 'all .15s', width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left'
                }}>
                {r.icoImg ? <img src={r.icoImg} alt="" style={{ width: 22, height: 22, verticalAlign: 'middle' }} /> : <span style={{ fontSize: 13 }}>{r.ico}</span>}
                <span style={{ fontWeight: 600, fontSize: 12, color: on ? currentColor : 'var(--txt2)', whiteSpace: 'nowrap', flex: 1 }}>{r.lbl}</span>
                <input type="color" value={currentColor}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    const c = e.target.value;
                    setNetColors(prev => ({ ...prev, [r.id]: c }));
                    document.documentElement.style.setProperty(cssVar, c);
                    try {
                      const net = (window as any).__NETS?.find?.((n: any) => n.id === r.id);
                      if (net) net.col = c;
                    } catch (e) { console.error(e); }
                    try { localStorage.setItem('civilflow_net_' + r.id, c); } catch (_) { }
                  }}
                  style={{ width: 14, height: 14, border: 'none', padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: on ? currentColor : 'transparent', border: '1.5px solid ' + (on ? currentColor : 'var(--txt3)') }} />
                <span className="visually-hidden">{on ? 'Activa' : 'Inactiva'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActiveEquiposCard({ redes, setRedes }: { redes: Set<string>; setRedes: Dispatch<SetStateAction<Set<string>>> }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 190, display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_info_general/equipos_activos.webp" alt="" style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }} />
            Equipos activos
          </span>
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
              <button key={r.id} onClick={() => { const n = new Set(redes); on ? n.delete(r.id) : n.add(r.id); setRedes(n); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, padding: '3px 5px', cursor: 'pointer',
                  background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', transition: 'all .15s', width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left'
                }}>
                {r.icoImg ? <img src={r.icoImg} alt="" style={{ width: 22, height: 22, verticalAlign: 'middle' }} /> : <span style={{ fontSize: 13 }}>{r.ico}</span>}
                <span style={{ fontWeight: 600, fontSize: 12, color: on ? '#22c55e' : 'var(--txt2)', whiteSpace: 'nowrap', flex: 1 }}>{r.lbl}</span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: on ? '#22c55e' : 'transparent', border: '1.5px solid ' + (on ? '#22c55e' : 'var(--txt3)') }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FloorGeneratorCard(props: {
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
  return (
    <div className="card" style={{ flex: '0 0 auto', minWidth: 0 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_info_general/generador_de_pisos.webp" alt="" style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }} />
            Generador de pisos
          </span>
          <span className="card-s" style={{ fontSize: 11 }}>Generación automática de pisos y sótanos</span>
        </div>
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, alignItems: 'end' }}>
          <div className="f" style={{ marginBottom: 0 }}><label style={{ fontSize: 12 }}>Sótanos</label><input type="text" inputMode="numeric" value={props.nSotanos} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px' }} onChange={props.onIntChange(props.setNSotanos)} onBlur={props.onIntBlur(props.setNSotanos)} /></div>
          <div className="f" style={{ marginBottom: 0 }}><label style={{ fontSize: 12 }}>Pisos</label><input type="text" inputMode="numeric" value={props.nPisos} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px' }} onChange={props.onIntChange(props.setNPisos)} onBlur={props.onIntBlur(props.setNPisos)} /></div>
          <div className="f" style={{ marginBottom: 0 }}><label style={{ fontSize: 12 }}>Altura entrepiso</label><input type="text" inputMode="decimal" value={props.altPiso} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px' }} onChange={props.onDecChange(props.setAltPiso)} onBlur={props.onDecBlur(props.setAltPiso)} /></div>
          <div className="f" style={{ marginBottom: 0 }}><label style={{ fontSize: 12 }}>Altura sótano</label><input type="text" inputMode="decimal" value={props.altSotano} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px' }} onChange={props.onDecChange(props.setAltSotano)} onBlur={props.onDecBlur(props.setAltSotano)} /></div>
          <div className="f" style={{ marginBottom: 0 }}><label style={{ fontSize: 12 }}>NPT P1</label><input type="text" inputMode="decimal" value={props.nptPiso1} style={{ textAlign: 'center', fontSize: 12, padding: '3px 5px' }} onChange={props.onDecChange(props.setNptPiso1)} onBlur={props.onDecBlur(props.setNptPiso1)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 24, paddingBottom: 2 }}>
            <button onClick={() => props.setConCubierta(!props.conCubierta)} title="Incluir cubierta" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', padding: '4px 8px', borderRadius: 4, flexShrink: 0, border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', width: '100%', textAlign: 'inherit' }}>
              <div style={{ width: 28, height: 15, borderRadius: 8, background: props.conCubierta ? 'var(--ll)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: props.conCubierta ? 15 : 2, transition: 'left .2s' }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt2)' }}>Incluir cubierta</span>
            </button>
          </div>
        </div>
        <button onClick={props.generarPisos} style={{ width: '100%', padding: '6px', marginTop: 6, background: 'var(--acc)', border: 'none', borderRadius: 'var(--r)', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Generar niveles automáticamente</button>
      </div>
    </div>
  );
}

function LevelsCard({ pisos, delPiso, addPiso, addSotano, setPisos }: { pisos: any[]; delPiso: (id: string | number) => void; addPiso: () => void; addSotano: () => void; setPisos: (p: any[] | ((prev: any[]) => any[])) => void }) {
  return (
    <div className="card" style={{ flex: '1 1 auto', minWidth: 220, display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ padding: '4px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_info_general/niveles_generados.webp" alt="" style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }} />
            Niveles generados
          </span>
          <span className="card-s" style={{ fontSize: 11 }}>{pisos.length} niveles</span>
        </div>
      </div>
      <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {pisos.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', padding: '12px 0' }}>Presione "Generar niveles"</div>
        )}
        {pisos.length > 0 && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {[...pisos].sort((a, b) => (b.tipo === 'cubierta' ? 999 : b.n) - (a.tipo === 'cubierta' ? 999 : a.n)).map((p: any) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 4px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', borderLeft: '3px solid ' + (p.tipo === 'cubierta' ? 'var(--ll)' : p.n < 0 ? 'var(--txt3)' : 'var(--acc2)'), marginBottom: 2 }}>
                  <span className={p.tipo === 'cubierta' ? 'piso-tag cub' : p.n < 0 ? 'piso-tag sot' : 'piso-tag'} style={{ fontSize: 11, padding: '2px 5px', minWidth: 48 }}>{pisoLbl(p.n)}</span>
                  <input type="text" inputMode="decimal" defaultValue={p.npt ?? ''} key={p.id + 'npt'} className="npt-in" style={{ fontSize: 12, width: 52, padding: '2px 4px' }} onBlur={e => { const v = parseFloat(e.target.value.replace(/,/g, '.')); if (!isNaN(v) && e.target.value.trim() !== '') { const npt = v; setPisos((prev: any[]) => prev.map(x => x.id === p.id ? { ...x, npt } : x)); } }} />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 20 }}><span style={{ fontSize: 11, color: 'var(--txt3)' }}>m</span></div>
                  <div className={`pdot ${p.ok ? 'ok' : ''}`} />
                  <button onClick={() => delPiso(p.id)} title="Eliminar nivel" style={{ padding: '1px 5px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--txt3)', cursor: 'pointer', fontSize: 10, lineHeight: 1, flexShrink: 0, marginLeft: 2 }} onMouseEnter={e => { e.currentTarget.style.color = '#ef5350'; e.currentTarget.style.borderColor = 'rgba(211,47,47,.5)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt3)'; e.currentTarget.style.borderColor = 'var(--line)'; }}>&#x2715;</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 2, flexShrink: 0 }}>
              <button className="btn-xs" onClick={addSotano} style={{ padding: '3px 6px', fontSize: 10 }}>+ Sótano</button>
              <button className="btn-xs" onClick={addPiso} style={{ padding: '3px 6px', fontSize: 10 }}>+ Piso</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UsageGuideCard() {
  return (
    <div className="card" style={{ flex: '0 1 auto', minWidth: 0 }}>
      <div className="card-h" style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_info_general/guia_de_uso.webp" alt="" style={{ width: 22, height: 22, verticalAlign: 'middle', marginRight: 2 }} />
            Guía de uso
          </span>
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
    </div>
  );
}

export default function InfoTab({ state }: InfoTabProps) {
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
        <div role="alert" style={{
          flexShrink: 0, padding: '7px 14px', fontSize: 12, fontWeight: 600,
          background: 'rgba(239,68,68,0.92)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          ⚠ {alertMsg}
          <button onClick={() => setAlertMsg(null)} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 8px', flexShrink: 0 }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 6, flex: 1, minHeight: 0, overflowY: 'hidden', overflowX: 'auto', alignItems: 'stretch' }}>
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
