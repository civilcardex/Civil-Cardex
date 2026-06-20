import { useMemo } from "react";
import { pisoLbl } from "../constants";
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
import WaterNetworkDesign from "./WaterNetworkDesign";
import { RainwaterProvider } from "../context/RainwaterContext";
import { DIAMETROS_AF, DIAMETROS_AC } from "../utils/calcHydraulics";
import { lookupInterno, lookupInternoAC } from "../utils/accesoriosUtils";
import BombaARDesign from "./BombaARDesign";
import GasDesign from "./GasDesign";
import PressureEquipmentDesign from "./PressureEquipmentDesign";
import BaseDatos from "./DesignParameters";
import Normativa from "./Regulations";
import InfoTab from "./workarea/InfoTab";
import PlanosTab from "./workarea/PlanosTab";
import { IsometriaTab } from "./workarea/IsometriaTab";
import type { useWorkAreaState } from "./useWorkAreaState";

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface WorkAreaContentProps {
  state: WorkAreaState;
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
      <fieldset style={{ display: 'flex', gap: 6, flexWrap: 'wrap', border: 'none', padding: 0, margin: 0 }}>
        <legend style={{position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>Redes</legend>
        {redesActivas.map(r => (
          <button key={r.id} onClick={() => setRedActiva(r.id)} aria-pressed={redActiva === r.id} aria-label={r.lbl} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--r)', border: '1px solid',
            cursor: 'pointer', fontSize: 13, fontFamily: 'var(--body)', flex: 1, justifyContent: 'center',
            borderColor: redActiva === r.id ? r.col : 'var(--line)',
            color: redActiva === r.id ? r.col : 'var(--txt3)',
            background: redActiva === r.id ? 'rgba(0,0,0,.15)' : 'transparent',
            fontWeight: redActiva === r.id ? 700 : 400,
          }}>
            {r.icoImg ? <img src={r.icoImg} alt=""  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle' }}  loading="lazy" /> : <span style={{ fontSize: 18 }}>{r.ico}</span>}
            <span>{r.lbl}</span>
          </button>
        ))}
      </fieldset>
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
        <RainwaterProvider>
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PageNav page={llPage} setPage={setLlPage} total={3} color="var(--ll)" labels={['Diseño lluvias', 'Chequeo bajantes', 'Chequeo canales']} />
          {llPage === 1 && <DisenoLluvias />}
          {llPage === 2 && <ChequeoBajantesLluvias />}
          {llPage === 3 && <ChequeoCanalesLluvias />}
        </div>
        </RainwaterProvider>
      )}
      {redActiva === 'af' && redes.has('af') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PageNav page={afPage} setPage={setAfPage} total={3} color="var(--af)" labels={['Cálculo UC', 'Diseño de red agua fría', 'Accesorios']} />
          {afPage === 1 && <CalculoUC tipo="af" />}
          {afPage === 2 && <WaterNetworkDesign networkType="af" diamTable={DIAMETROS_AF} lookupFn={lookupInterno as any} />}
          {afPage === 3 && <AccesoriosTable tramos={tramosAf} updAcc={updTramoAfAcc} net="af" readOnly />}
        </div>
      )}
      {redActiva === 'ac' && redes.has('ac') && (
        <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PageNav page={acPage} setPage={setAcPage} total={3} color="var(--ac)" labels={['Cálculo UC', 'Diseño de red agua caliente', 'Accesorios']} />
          {acPage === 1 && <CalculoUC tipo="ac" />}
          {acPage === 2 && <WaterNetworkDesign networkType="ac" diamTable={DIAMETROS_AC} lookupFn={lookupInternoAC as any} />}
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
    ['NIVELES', [...pisos].sort((a: any, b: any) => a.n - b.n).map((p: any) => pisoLbl(p.n)).join(' · ')],
    ['SANITARIA', okSAN ? '✓ OK' : '✗ Revisar'],
    ['AGUAS LLUVIAS', okLL ? '✓ OK' : '✗ Revisar'],
  ], [proy, redesActivas, pisos, okSAN, okLL]);
  return (
    <div className="fu" style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div className="card">
        <div className="card-h">
          <h3 className="card-t">
            <img src="/Informes.webp" alt=""  width={24} height={24} style={{width:24,height:24, verticalAlign: 'middle', marginRight: 4 }}  loading="lazy" />
            Resumen del proyecto
          </h3>
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
      {tab === 'iso' && <IsometriaTab state={state} />}
    </>
  );
}
