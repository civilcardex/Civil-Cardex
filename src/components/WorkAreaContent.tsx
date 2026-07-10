import { Suspense, lazy, useMemo } from "react";
import { pisoLbl } from "../constants";
import PageNav from "./PageNav";
import { RainwaterProvider } from "../context/RainwaterContext";
import { DIAMETROS_AF, DIAMETROS_AC } from "../constants/hydraulicData";
import { lookupInterno, lookupInternoAC } from "../utils/accesoriosUtils";
import InfoTab from "./workarea/InfoTab";
import type { useWorkAreaState } from "./useWorkAreaState";
const WorkAreaContent_S1: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const WorkAreaContent_S2: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--line)', marginBottom: 6 };
const WorkAreaContent_S3: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const WorkAreaContent_S4: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const WorkAreaContent_S5: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const WorkAreaContent_S6: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const WorkAreaContent_S7: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const WorkAreaContent_S8: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const WorkAreaContent_S9: React.CSSProperties = { position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const WorkAreaContent_S10: React.CSSProperties = { display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:'var(--r)',border:'1px solid',cursor:'pointer',fontSize:13,fontFamily:'var(--body)',flex:1,justifyContent:'center' } as const;


const PlanosTab = lazy(() => import("./workarea/PlanosTab"));
const AccesoriosTable = lazy(() => import('./AccessoriesTable'));
const HeaterSelection = lazy(() => import('./HeaterSelection'));
const CalculoUD = lazy(() => import('./FixtureUnitCalc'));
const DisenosSanitarios = lazy(() => import('./SanitaryDesign'));
const BajantesTable = lazy(() => import('./DownpipesTable'));
const SanAccesoriosPage = lazy(() => import('./SanAccesoriosPage'));
const DisenoLluvias = lazy(() => import('./RainwaterDesign'));
const ChequeoBajantesLluvias = lazy(() => import('./RainDownpipesCheck'));
const ChequeoCanalesLluvias = lazy(() => import('./RainChannelsCheck'));
const CalculoUC = lazy(() => import('./CalculoUC'));
const WaterNetworkDesign = lazy(() => import('./WaterNetworkDesign'));
const BombaARDesign = lazy(() => import('./BombaARDesign'));
const GasDesign = lazy(() => import('./GasDesign'));
const PressureEquipmentDesign = lazy(() => import('./PressureEquipmentDesign'));
const BaseDatos = lazy(() => import('./DesignParameters'));
const Normativa = lazy(() => import('./Regulations/Regulations'));
const IsometriaTab = lazy(() => import('./workarea/IsometriaTab').then(m => ({ default: m.IsometriaTab })));

const FALLBACK = <div style={{ minHeight: 400 }} />;

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface WorkAreaContentProps {
  state: WorkAreaState;
}

const prefetchSan = (p: number) => {
  if (p === 1) import('./FixtureUnitCalc');
  else if (p === 2) import('./SanitaryDesign');
  else if (p === 3) import('./DownpipesTable');
  else if (p === 4) import('./SanAccesoriosPage');
};
const prefetchLl = (p: number) => {
  if (p === 1) import('./RainwaterDesign');
  else if (p === 2) import('./RainDownpipesCheck');
  else if (p === 3) import('./RainChannelsCheck');
};
const prefetchAfAc = (p: number) => {
  if (p === 1) import('./CalculoUC');
  else if (p === 2) import('./WaterNetworkDesign');
  else if (p === 3) import('./AccessoriesTable');
};
const prefetchHeavy = () => {
  import('./BombaARDesign');
  import('./PressureEquipmentDesign');
  import('./GasDesign');
  import('./DesignParameters');
  import('./Regulations/Regulations');
};

function RedesTab({ state }: { state: WorkAreaState }) {
  const {
    redesActivas, redes,
    redActiva, setRedActiva,
    sanPage, setSanPage,
    llPage, setLlPage,
    afPage, setAfPage,
    acPage, setAcPage,
    tramosAf, tramosAc,
  } = state;

  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <fieldset style={{ display: 'flex', gap: 6, flexWrap: 'wrap', border: 'none', padding: 0, margin: 0 }}>
        <legend style={WorkAreaContent_S1}>Redes</legend>
        {redesActivas.map(r => (
          <button type="button" key={r.id} onClick={() => setRedActiva(r.id)} onMouseEnter={() => { if (r.id === 'bom' || r.id === 'ep' || r.id === 'gas') prefetchHeavy(); }} aria-pressed={redActiva === r.id} aria-label={r.lbl} style={{ ...WorkAreaContent_S10, borderColor: redActiva === r.id ? r.col : 'var(--line)', color: redActiva === r.id ? r.col : 'var(--txt3)', background: redActiva === r.id ? 'rgba(0,0,0,.15)' : 'transparent', fontWeight: redActiva === r.id ? 700 : 400 }}>
            {r.icoImg ? <img src={r.icoImg} alt=""  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle' }}  loading="lazy" /> : <span style={{ fontSize: 18 }}>{r.ico}</span>}
            <span>{r.lbl}</span>
          </button>
        ))}
      </fieldset>
      {redActiva === 'san' && redes.has('san') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <PageNav page={sanPage} setPage={setSanPage} total={4} color="var(--san)" labels={['Cálculo de unidades de descarga', 'Diseño sanitario', 'Bajantes y ventilación', 'Accesorios']} onPageHover={prefetchSan} />
          {sanPage === 1 && <Suspense fallback={FALLBACK}><CalculoUD /></Suspense>}
          {sanPage === 2 && <Suspense fallback={FALLBACK}><DisenosSanitarios /></Suspense>}
          {sanPage === 3 && <Suspense fallback={FALLBACK}><BajantesTable /></Suspense>}
          {sanPage === 4 && <Suspense fallback={FALLBACK}><SanAccesoriosPage /></Suspense>}
        </div>
      )}
      {redActiva === 'll' && redes.has('ll') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <PageNav page={llPage} setPage={setLlPage} total={3} color="var(--ll)" labels={['Diseño lluvias', 'Chequeo bajantes', 'Chequeo canales']} onPageHover={prefetchLl} />
          {llPage === 1 && <Suspense fallback={FALLBACK}><DisenoLluvias /></Suspense>}
          {llPage === 2 && <Suspense fallback={FALLBACK}><ChequeoBajantesLluvias /></Suspense>}
          {llPage === 3 && <Suspense fallback={FALLBACK}><ChequeoCanalesLluvias /></Suspense>}
        </div>
      )}
      {redActiva === 'af' && redes.has('af') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <PageNav page={afPage} setPage={setAfPage} total={3} color="var(--af)" labels={['Cálculo de unidades de consumo', 'Diseño de red agua fría', 'Accesorios']} onPageHover={prefetchAfAc} />
          {afPage === 1 && <Suspense fallback={FALLBACK}><CalculoUC tipo="af" /></Suspense>}
          {afPage === 2 && <Suspense fallback={FALLBACK}><WaterNetworkDesign networkType="af" diamTable={DIAMETROS_AF} lookupFn={lookupInterno as any} /></Suspense>}
          {afPage === 3 && <Suspense fallback={FALLBACK}><AccesoriosTable tramos={tramosAf} /></Suspense>}
        </div>
      )}
      {redActiva === 'ac' && redes.has('ac') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <PageNav page={acPage} setPage={setAcPage} total={4} color="var(--ac)" labels={['Cálculo de unidades de consumo', 'Diseño de red agua caliente', 'Selección calentador', 'Accesorios']} onPageHover={prefetchAfAc} />
          {acPage === 1 && <Suspense fallback={FALLBACK}><CalculoUC tipo="ac" /></Suspense>}
          {acPage === 2 && <Suspense fallback={FALLBACK}><WaterNetworkDesign networkType="ac" diamTable={DIAMETROS_AC} lookupFn={lookupInternoAC as any} /></Suspense>}
          {acPage === 3 && <Suspense fallback={FALLBACK}><HeaterSelection /></Suspense>}
          {acPage === 4 && <Suspense fallback={FALLBACK}><AccesoriosTable tramos={tramosAc} /></Suspense>}
        </div>
      )}
      {redActiva === 'bom' && redes.has('bom') && (
        <Suspense fallback={FALLBACK}><BombaARDesign /></Suspense>
      )}
      {redActiva === 'ep' && redes.has('ep') && (
        <Suspense fallback={FALLBACK}><PressureEquipmentDesign /></Suspense>
      )}
      {redActiva === 'gas' && redes.has('gas') && (
        <Suspense fallback={FALLBACK}><GasDesign /></Suspense>
      )}
      {redesActivas.filter(r => r.id !== 'san' && r.id !== 'll' && r.id !== 'af' && r.id !== 'ac' && r.id !== 'bom' && r.id !== 'ep' && r.id !== 'gas').map(r => redActiva === r.id && redes.has(r.id) && (
        <div key={r.id} className="fu" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, flex: 1, minHeight: 250 }}>
          <div style={{ fontSize: 48, opacity: .5 }}>&#x1F6A7;</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--txt2)' }}>{r.lbl}</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
            El módulo de <strong>{r.lbl}</strong> está en desarrollo.<br />Pronto estará disponible para uso en CivilFlow.</div>
        </div>
      ))}
    </div>
  );
}

function InfTab({ state }: { state: WorkAreaState }) {
  const { proy, redesActivas, pisos, tramosSan, tramosLl } = state;
  const okSAN = tramosSan.length > 0 && tramosSan.every(t => { const r = t as any; const v=r.v_real||0; const y=r.yD||0; const q=r.qQ0||0; return v>=0.45&&v<=4.0&&y<=0.75&&q<=1.0; });
  const okLL = tramosLl.length > 0 && tramosLl.every(t => { const r = t as any; const v=r.v_real||0; const y=r.yD||0; const q=r.qQ0||0; return v>=0.45&&v<=4.0&&y<=0.75&&q<=1.0; });
  const items = useMemo<[string, string][]>(() => [
    ['PROYECTO', proy.nombre],
    ['UBICACIÓN', [proy.mun, proy.dep].filter(Boolean).join(', ')],
    ['USO', proy.uso],
    ['EMPRESA', proy.empresa],
    ['P RED', proy.p_red + ' mca'],
    ['DOTACIÓN', proy.dot + ' L/hab/d'],
    ['REDES', redesActivas.map((r: any) => r.lbl).join(' · ')],
    ['NIVELES', pisos.toSorted((a: any, b: any) => a.n - b.n).map((p: any) => pisoLbl(p.n)).join(' · ')],
    ['SANITARIA', okSAN ? '✓ OK' : '✗ Revisar'],
    ['AGUAS LLUVIAS', okLL ? '✓ OK' : '✗ Revisar'],
  ], [proy, redesActivas, pisos, okSAN, okLL]);
  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <section className="card">
        <div className="card-h">
          <h2 className="card-t">
            <img src="/Informes.svg" alt="Informes"  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle', marginRight: 4 }}  loading="lazy" />
            Resumen del proyecto
          </h2>
        </div>
        <div className="card-b">
          <dl style={{ margin: 0 }}>
          {items.map(([k, v]) => (
            <div key={k} style={WorkAreaContent_S2}>
              <dt style={{ fontSize: 12, color: 'var(--txt3)', minWidth: 130, flexShrink: 0, textTransform: 'uppercase', fontWeight: 600 }}>{k}</dt>
              <dd style={{ fontSize: 14, fontWeight: 500, margin: 0, color: String(v).includes('✗') ? 'var(--err)' : String(v).includes('✓') ? 'var(--ok)' : 'var(--txt)' }}>{v}</dd>
            </div>
          ))}
          </dl>
        </div>
      </section>
    </div>
  );
}

export default function WorkAreaContent({ state }: WorkAreaContentProps) {
  const { tab, redes } = state;

  return (
    <RainwaterProvider>
      {tab === 'info' && <section aria-label="Información del proyecto" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}><h2 style={WorkAreaContent_S3}>Información del proyecto</h2><InfoTab state={state} /></section>}
      {tab === 'planos' && <section aria-label="Carga de planos" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}><h2 style={WorkAreaContent_S4}>Carga de planos</h2><Suspense fallback={FALLBACK}><PlanosTab state={state} /></Suspense></section>}
      {tab === 'redes' && state.redesActivas.length > 0 && <section aria-label="Diseño de red" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}><h2 style={WorkAreaContent_S5}>Diseño de red</h2><RedesTab state={state} /></section>}
      {tab === 'datos' && <section aria-label="Parámetros de diseño" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}><h2 style={WorkAreaContent_S6}>Parámetros de diseño</h2><Suspense fallback={FALLBACK}><BaseDatos redes={redes} /></Suspense></section>}
      {tab === 'crit' && <section aria-label="Criterios y normativa" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}><h2 style={WorkAreaContent_S7}>Criterios y normativa</h2><Suspense fallback={FALLBACK}><Normativa /></Suspense></section>}
      {tab === 'inf' && <section aria-label="Resumen del proyecto" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}><h2 style={WorkAreaContent_S8}>Resumen del proyecto</h2><InfTab state={state} /></section>}
      {tab === 'iso' && <section aria-label="Isometría de red" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}><h2 style={WorkAreaContent_S9}>Isometría de red</h2><Suspense fallback={FALLBACK}><IsometriaTab state={state} /></Suspense></section>}
    </RainwaterProvider>
  );
}
