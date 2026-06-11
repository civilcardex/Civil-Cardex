import type { Dispatch, SetStateAction, ChangeEvent, FocusEvent } from "react";
import { REDES, USOS, EMPRES, REQ_ITEMS, pisoLbl } from "../constants";
import { parseDecimalInput } from "../utils/parseDecimal";
import { validateTramo } from "../utils/validatePipeSegment";
import { NETS } from "../lib/PlanoEngine";
import PageNav from "./PageNav";
import AccesoriosTable from "./AccessoriesTable";
import CalculoUD from "./FixtureUnitCalc";
import DisenosSanitarios from "./SanitaryDesign";
import BajantesTable from "./DownpipesTable";
import SanAccesoriosPage from "./SanAccesoriosPage";
import DisenoLluvias from "./RainwaterDesign";
import ChequeoBajantesLluvias from "./RainDownpipesCheck";
import ChequeoCanalesLluvias from "./RainChannelsCheck";
import CalculoUC from "./CalculoUC";
import DisenoRedAguaFria from "./ColdWaterDesign";
import DisenoRedAguaCaliente from "./HotWaterDesign";
import BombaARDesign from "./BombaARDesign";
import GasDesign from "./GasDesign";
import PressureEquipmentDesign from "./PressureEquipmentDesign";
import BaseDatos from "./DesignParameters";
import Normativa from "./Regulations";
import type { useWorkAreaState } from "./useWorkAreaState";

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface WorkAreaContentProps {
  state: WorkAreaState;
}

function InfoTab({ state }: { state: WorkAreaState }) {
  const {
    proy, setP,
    redes, setRedes, netColors, setNetColors,
    nSotanos, nPisos, altPiso, altSotano, nptPiso1, conCubierta, setConCubierta,
    generarPisos,
    onIntChange, onIntBlur, onDecChange, onDecBlur,
    pisos, delPiso, addPiso, addSotano,
  } = state;

  return (
    <div className="fu info-gral" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
        <div className="f" style={{ marginBottom: 3 }}><label style={{ fontSize: 12 }}>Uso</label>
          <select value={proy.uso} onChange={e => setP('uso', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', width: '100%' }}><option value="">—</option>{USOS.map(u => <option key={u}>{u}</option>)}</select></div>
        <div className="f" style={{ marginBottom: 0 }}><label style={{ fontSize: 12 }}>Empresa</label>
          <select value={proy.empresa} onChange={e => setP('empresa', e.target.value)} style={{ fontSize: 12, padding: '3px 6px', width: '100%' }}><option value="">—</option>{EMPRES.map(u => <option key={u}>{u}</option>)}</select></div>
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
              <div key={r.id} onClick={() => { const n = new Set(redes); on ? n.delete(r.id) : n.add(r.id); setRedes(n); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, padding: '3px 5px', cursor: 'pointer',
                  background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', transition: 'all .15s'
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
                      const net = NETS.find(n => n.id === r.id);
                      if (net) net.col = c;
                    } catch (e) { console.error(e); }
                    try { localStorage.setItem('civilflow_net_' + r.id, c); } catch (_) { /* ignore */ }
                  }}
                  style={{ width: 14, height: 14, border: 'none', padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: on ? currentColor : 'transparent', border: '1.5px solid ' + (on ? currentColor : 'var(--txt3)') }} />
              </div>
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
              <div key={r.id} onClick={() => { const n = new Set(redes); on ? n.delete(r.id) : n.add(r.id); setRedes(n); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, padding: '3px 5px', cursor: 'pointer',
                  background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', transition: 'all .15s'
                }}>
                {r.icoImg ? <img src={r.icoImg} alt="" style={{ width: 22, height: 22, verticalAlign: 'middle' }} /> : <span style={{ fontSize: 13 }}>{r.ico}</span>}
                <span style={{ fontWeight: 600, fontSize: 12, color: on ? '#22c55e' : 'var(--txt2)', whiteSpace: 'nowrap', flex: 1 }}>{r.lbl}</span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: on ? '#22c55e' : 'transparent', border: '1.5px solid ' + (on ? '#22c55e' : 'var(--txt3)') }} />
              </div>
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
            <div onClick={() => props.setConCubierta(!props.conCubierta)} title="Incluir cubierta" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', padding: '4px 8px', borderRadius: 4, flexShrink: 0 }}>
              <div style={{ width: 28, height: 15, borderRadius: 8, background: props.conCubierta ? 'var(--ll)' : 'var(--line)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: props.conCubierta ? 15 : 2, transition: 'left .2s' }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt2)' }}>Incluir cubierta</span>
            </div>
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
                  <input type="text" inputMode="decimal" defaultValue={p.npt ?? ''} key={p.id + 'npt'} className="npt-in" style={{ fontSize: 12, width: 52, padding: '2px 4px' }} onBlur={e => { const v = parseDecimalInput(e.target.value); if (v !== null) { const npt = v; setPisos((prev: any[]) => prev.map(x => x.id === p.id ? { ...x, npt } : x)); } }} />
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

function PlanosTab({ state }: { state: WorkAreaState }) {
  const {
    plans, addPlans, removePlan, updatePlan, confirmPlan,
    planDrag, setPlanDrag,
    selectedPlanId, setSelectedPlanId,
    selectedPlan, selectedPlanUrl,
    pendingPlanos, confirmedPlanos,
    pisos, fileRef,
  } = state;

  return (
    <div className="fu" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', padding: 0 }}>
      <div style={{ width: 170, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', borderRadius: 'var(--r2)' }}>
        <div className="card-h" style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'none' }}>
          <span className="card-t" style={{ fontSize: 13 }}>
            <img src="/iconos_carga_planos/requisitos_del_plano.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} />
            Requisitos del plano
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REQ_ITEMS.map(({ ico, icoImg, t, s }) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icoImg ? <img src={icoImg} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} /> : ico}</span>
              <div><div style={{ fontSize: 12, fontWeight: 500 }}>{t}</div><div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.4 }}>{s}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}
        onDragOver={e => { e.preventDefault(); setPlanDrag(true); }}
        onDragLeave={() => setPlanDrag(false)}
        onDrop={e => { e.preventDefault(); setPlanDrag(false); const fl = e.dataTransfer?.files; if (fl && fl.length > 0) addPlans(fl); }}>
        <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) addPlans(e.target.files); e.target.value = ''; }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg)', minHeight: 36 }}>
          {selectedPlan ? (
            <>
              <span style={{ fontSize: 14, flexShrink: 0 }}>&#x1F4C4;</span>
              <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedPlan.name}</span>
              {selectedPlan.nivel !== null && <span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--bg3)', borderRadius: 'var(--r)', color: 'var(--txt3)', flexShrink: 0 }}>{pisoLbl(selectedPlan.nivel)}</span>}
              <span style={{ fontSize: 9, color: 'var(--txt3)', flexShrink: 0 }}>1:{selectedPlan.scale}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setSelectedPlanId(null)}
                style={{ padding: '4px 12px', background: 'rgba(211,47,47,0.15)', border: '1px solid rgba(211,47,47,0.35)', borderRadius: 'var(--r)', color: '#ef5350', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(211,47,47,0.3)'; e.currentTarget.style.borderColor = 'rgba(211,47,47,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(211,47,47,0.15)'; e.currentTarget.style.borderColor = 'rgba(211,47,47,0.35)'; }}
                title="Cerrar vista">&#x2715; Cerrar</button>
              {confirmedPlanos.length > 0 && (
                <a href="#/visor" style={{ padding: '3px 10px', background: 'rgba(0,220,229,0.08)', border: '1px solid rgba(0,220,229,0.3)', borderRadius: 'var(--r)', color: '#00dce5', fontWeight: 600, fontSize: 9, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  IR A DIBUJO DE REDES &rarr;
                </a>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Vista previa del plano</span>
          )}
        </div>

        {selectedPlan && selectedPlanUrl ? (
          <div style={{ flex: 1, background: '#141416', position: 'relative' }}>
            {planDrag && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0,220,229,.12)', border: '3px dashed rgba(0,220,229,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</span>
              </div>
            )}
            <embed key={selectedPlanUrl} src={selectedPlanUrl} type="application/pdf" style={{ width: '100%', height: '100%' }} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg)', cursor: 'pointer', position: 'relative' }}
            onClick={() => fileRef.current?.click()}>
            {planDrag ? (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,220,229,.08)', border: '3px dashed rgba(0,220,229,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 40, opacity: .25 }}>&#x1F4D0;</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt3)' }}>Vista previa del plano</div>
                <div style={{ fontSize: 10, color: 'var(--txt4)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
                  Sube un plano desde el panel derecho o arrastra un PDF aquí
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line)', background: 'var(--bg)' }}>
        <div style={{ padding: '10px 10px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <button onClick={() => fileRef.current?.click()}
            style={{ width: '100%', padding: '10px', background: 'rgba(0,220,229,0.06)', border: '1.5px dashed rgba(0,220,229,0.3)', borderRadius: 'var(--r)', color: '#00dce5', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,220,229,0.12)'; e.currentTarget.style.borderColor = 'rgba(0,220,229,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,220,229,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,220,229,0.3)'; }}>
            <img src="/iconos_carga_planos/subir_plano.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} /> SUBIR PLANO
          </button>
        </div>

        <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}
          onDragOver={e => { e.preventDefault(); setPlanDrag(true); }}
          onDragLeave={() => setPlanDrag(false)}
          onDrop={e => { e.preventDefault(); setPlanDrag(false); const fl = e.dataTransfer?.files; if (fl && fl.length > 0) addPlans(fl); }}>
          <div style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: .5 }}>
            <img src="/iconos_carga_planos/pendientes.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} />
            Pendientes {pendingPlanos.length > 0 && `(${pendingPlanos.length})`}
          </div>
          {pendingPlanos.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--txt4)', textAlign: 'center', lineHeight: 1.6 }}
              onClick={() => fileRef.current?.click()}>
              {planDrag ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#00dce5' }}>&#x1F4D0; SOLTAR PARA SUBIR</div>
              ) : (
                <>
                  <div style={{ fontSize: 24, opacity: .3 }}>&#x1F4D0;</div>
                  <span>Arrastra PDFs aquí o haz clic para subir varios plans</span>
                </>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {pendingPlanos.map((p: any) => (
                <div key={p.id} onClick={() => setSelectedPlanId(p.id)}
                  style={{ cursor: 'pointer', padding: '8px 10px', borderBottom: '1px solid var(--line)', background: selectedPlanId === p.id ? 'rgba(27,110,243,.08)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 4, transition: 'background .1s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>&#x1F4C4;</span>
                    <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{p.name}</span>
                    <button onClick={e => { e.stopPropagation(); removePlan(p.id); }}
                      style={{ padding: '2px 8px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt3)', cursor: 'pointer', fontSize: 10, flexShrink: 0 }} title="Cancelar">Cancelar</button>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <select value={p.nivel ?? ''} onClick={e => e.stopPropagation()} onChange={e => updatePlan(p.id, { nivel: e.target.value ? Number(e.target.value) : null })}
                      style={{ flex: 1, fontSize: 11, padding: '3px 5px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer', minWidth: 0 }}>
                      <option value="">— Nivel —</option>
                      {[...pisos].sort((a, b) => b.n - a.n).map((s: any) => {
                        const ocupado = plans.some((x: any) => x.id !== p.id && x.status === 'confirmed' && x.nivel === s.n);
                        return <option key={s.id} value={s.n} disabled={ocupado}>{pisoLbl(s.n)} ({s.npt} m){ocupado ? ' (ocup)' : ''}</option>;
                      })}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt3)' }}>Escala</label>
                    <select value={p.scale || ''} onClick={e => e.stopPropagation()} onChange={e => updatePlan(p.id, { scale: Number(e.target.value) || 100 })}
                      style={{ width: '100%', fontSize: 11, padding: '3px 5px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt2)', cursor: 'pointer' }}>
                      <option value="">— Escala —</option>
                      <option value="50">1:50</option>
                      <option value="75">1:75</option>
                      <option value="100">1:100</option>
                      <option value="125">1:125</option>
                      <option value="200">1:200</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    {p.nivel !== null && p.nivel !== undefined && (
                      <button onClick={e => {
                        e.stopPropagation();
                        if (plans.some((x: any) => x.id !== p.id && x.status === 'confirmed' && x.nivel === p.nivel)) {
                          alert('Este nivel ya tiene un plano asociado.');
                          return;
                        }
                        confirmPlan(p.id);
                      }} style={{ padding: '3px 10px', background: 'rgba(0,220,229,.1)', border: '1px solid rgba(0,220,229,.25)', borderRadius: 'var(--r)', color: '#00dce5', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>&#x2713; Confirmar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: .5 }}>
            <img src="/iconos_carga_planos/cargados.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} />
            Cargados {confirmedPlanos.length > 0 && `(${confirmedPlanos.length})`}
          </div>
          {confirmedPlanos.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontSize: 11, color: 'var(--txt4)', textAlign: 'center', lineHeight: 1.6 }}>
              Aún no hay plans cargados
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {confirmedPlanos.map((p: any) => (
                <div key={p.id} onClick={() => setSelectedPlanId(p.id)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--line)', background: selectedPlanId === p.id ? 'rgba(27,110,243,.08)' : 'transparent', transition: 'background .1s' }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>&#x1F4C4;</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--txt3)', display: 'flex', gap: 5 }}>
                      {p.nivel !== null && <span>{pisoLbl(p.nivel)}</span>}
                      <span>1:{p.scale}</span>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setSelectedPlanId(p.id); }}
                    style={{ padding: '3px 7px', background: 'var(--bg2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--acc2)', cursor: 'pointer', fontSize: 10, flexShrink: 0 }} title="Vista previa">&#x1F441;</button>
                  <button onClick={e => { e.stopPropagation(); removePlan(p.id); }}
                    style={{ padding: '3px 7px', background: 'var(--bg3)', border: '1px solid var(--line)', borderRadius: 'var(--r)', color: 'var(--txt3)', cursor: 'pointer', fontSize: 10, flexShrink: 0 }} title="Eliminar">&#x2715;</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RedesTab({ state }: { state: WorkAreaState }) {
  const {
    redesActivas, redes,
    redActiva, setRedActiva,
    sanPage, setSanPage,
    llPage, setLlPage,
    afPage, setAfPage,
    acPage, setAcPage,
    bomPage, setBomPage,
    gasPage, setGasPage,
    tramosAf, tramosAc, updTramoAfAcc, updTramoAcAcc,
  } = state;

  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {redesActivas.map(r => (
          <button key={r.id} onClick={() => setRedActiva(r.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--r)', border: '1px solid',
            cursor: 'pointer', fontSize: 13, fontFamily: 'var(--body)', flex: 1, justifyContent: 'center',
            borderColor: redActiva === r.id ? r.col : 'var(--line)',
            color: redActiva === r.id ? r.col : 'var(--txt3)',
            background: redActiva === r.id ? 'rgba(0,0,0,.15)' : 'transparent',
            fontWeight: redActiva === r.id ? 700 : 400,
          }}>
            {r.icoImg ? <img src={r.icoImg} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} /> : <span style={{ fontSize: 18 }}>{r.ico}</span>}
            <span>{r.lbl}</span>
          </button>
        ))}
      </div>
      {redActiva === 'san' && redes.has('san') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PageNav page={sanPage} setPage={setSanPage} total={4} color="var(--san)" labels={['Cálculo UD', 'Diseño sanitario', 'Bajantes y ventilación', 'Accesorios']} />
          {sanPage === 1 && <CalculoUD />}
          {sanPage === 2 && <DisenosSanitarios />}
          {sanPage === 3 && <BajantesTable />}
          {sanPage === 4 && <SanAccesoriosPage />}
        </div>
      )}
      {redActiva === 'll' && redes.has('ll') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PageNav page={llPage} setPage={setLlPage} total={3} color="var(--ll)" labels={['Diseño lluvias', 'Chequeo bajantes', 'Chequeo canales']} />
          {llPage === 1 && <DisenoLluvias />}
          {llPage === 2 && <ChequeoBajantesLluvias />}
          {llPage === 3 && <ChequeoCanalesLluvias />}
        </div>
      )}
      {redActiva === 'af' && redes.has('af') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PageNav page={afPage} setPage={setAfPage} total={3} color="var(--af)" labels={['Cálculo UC', 'Diseño de red agua fría', 'Accesorios']} />
          {afPage === 1 && <CalculoUC tipo="af" />}
          {afPage === 2 && <DisenoRedAguaFria />}
          {afPage === 3 && <AccesoriosTable tramos={tramosAf} updAcc={updTramoAfAcc} net="af" readOnly />}
        </div>
      )}
      {redActiva === 'ac' && redes.has('ac') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PageNav page={acPage} setPage={setAcPage} total={3} color="var(--ac)" labels={['Cálculo UC', 'Diseño de red agua caliente', 'Accesorios']} />
          {acPage === 1 && <CalculoUC tipo="ac" />}
          {acPage === 2 && <DisenoRedAguaCaliente />}
          {acPage === 3 && <AccesoriosTable tramos={tramosAc} updAcc={updTramoAcAcc} net="ac" readOnly />}
        </div>
      )}
      {redActiva === 'bom' && redes.has('bom') && (
        <BombaARDesign />
      )}
      {redActiva === 'ep' && redes.has('ep') && (
        <PressureEquipmentDesign />
      )}
      {redActiva === 'gas' && redes.has('gas') && (
        <GasDesign />
      )}
      {redesActivas.filter(r => r.id !== 'san' && r.id !== 'll' && r.id !== 'af' && r.id !== 'ac' && r.id !== 'bom' && r.id !== 'ep' && r.id !== 'gas').map(r => redActiva === r.id && redes.has(r.id) && (
        <div key={r.id} className="fu" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, flex: 1, minHeight: 250 }}>
          <div style={{ fontSize: 48, opacity: .5 }}>&#x1F6A7;</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--txt2)' }}>{r.lbl}</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
            El módulo de <strong>{r.lbl}</strong> está en desarrollo.<br />Pronto estará disponible para uso en CIVILFLOW.</div>
        </div>
      ))}
    </div>
  );
}

function InfTab({ state }: { state: WorkAreaState }) {
  const { proy, redesActivas, pisos, tramosSan, tramosLl } = state;
  const okSAN = tramosSan.length > 0 && tramosSan.every(validateTramo);
  const okLL = tramosLl.length > 0 && tramosLl.every(validateTramo);
  const items: [string, string][] = [
    ['PROYECTO', proy.nombre],
    ['UBICACIÓN', [proy.mun, proy.dep].filter(Boolean).join(', ')],
    ['USO', proy.uso],
    ['EMPRESA', proy.empresa],
    ['P RED', proy.p_red + ' mca'],
    ['DOTACIÓN', proy.dot + ' L/hab/d'],
    ['REDES', redesActivas.map((r: any) => r.lbl).join(' · ')],
    ['NIVELES', [...pisos].sort((a: any, b: any) => a.n - b.n).map((p: any) => pisoLbl(p.n)).join(' · ')],
    ['SANITARIA', okSAN ? '✓ OK' : '✗ Revisar'],
    ['Aguas lluvias', okLL ? '✓ OK' : '✗ Revisar'],
  ];
  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div className="card">
        <div className="card-h">
          <span className="card-t">
            <img src="/Informes.webp" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }} />
            Resumen del proyecto
          </span>
        </div>
        <div className="card-b">
          {items.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--line)', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--txt3)', minWidth: 130, flexShrink: 0, textTransform: 'uppercase', fontWeight: 600 }}>{k}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: String(v).includes('✗') ? 'var(--err)' : String(v).includes('✓') ? 'var(--ok)' : 'var(--txt)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkAreaContent({ state }: WorkAreaContentProps) {
  const { tab, redes } = state;

  return (
    <>
      {tab === 'info' && <InfoTab state={state} />}
      {tab === 'planos' && <PlanosTab state={state} />}
      {tab === 'redes' && state.redesActivas.length > 0 && <RedesTab state={state} />}
      {tab === 'datos' && <BaseDatos redes={redes} />}
      {tab === 'crit' && <Normativa />}
      {tab === 'inf' && <InfTab state={state} />}
    </>
  );
}
