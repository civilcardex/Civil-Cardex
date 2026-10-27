import { Suspense, lazy } from 'react';
import PageNav from '../PageNav.tsx';
import { DIAMETROS_AF, DIAMETROS_AC } from '../../constants/hydraulicsData.ts';
import { lookupInterno, lookupInternoAC } from '../../utils/fittingsUtils.ts';
import type { useWorkAreaState } from '../useWorkAreaState.ts';

const AccesoriosTable = lazy(() => import('../AccessoriesTable.tsx'));
const HeaterSelection = lazy(() => import('../HeaterSelection.tsx'));
const CalculoUD = lazy(() => import('../FixtureUnitCalc.tsx'));
const DisenosSanitarios = lazy(() => import('../SanitaryDesign.tsx'));
const BajantesTable = lazy(() => import('../DownpipesTable.tsx'));
const AccesoriosDiamPage = lazy(() => import('../FittingsDiamPage.tsx'));
const DisenoLluvias = lazy(() => import('../RainwaterDesign.tsx'));
const ChequeoBajantesLluvias = lazy(() => import('../RainDownpipesCheck.tsx'));
const ChequeoCanalesLluvias = lazy(() => import('../RainChannelsCheck.tsx'));
const CalculoUC = lazy(() => import('../CalcUC.tsx'));
const WaterNetworkDesign = lazy(() => import('../WaterNetworkDesign.tsx'));
const BombaARDesign = lazy(() => import('../PumpARDesign'));
const GasDesign = lazy(() => import('../GasDesign'));
const RejillasVentilacion = lazy(() => import('../RejillasVentilation'));
const PressureEquipmentDesign = lazy(() => import('../PressureEquipmentDesign.tsx'));
const AcometidaPage = lazy(() => import('../../pages/AcometidaPage.tsx'));

const FALLBACK = (
  <div role="status" style={{ minHeight: 400, padding: 24, color: 'var(--txt2)', fontSize: 13 }}>
    Cargando diseño…
  </div>
);

/** Precalienta los chunks de la primera página de cada red (el primer ingreso por sesión
 *  descargaba el chunk en frío y el fallback vacío parecía una recarga). */
export function prefetchRedesInicial(): void {
  prefetchSan(1);
  prefetchLl(1);
  prefetchAfAc(1);
}

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

const SR_ONLY_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const NET_BTN_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 'var(--r)',
  border: '1px solid',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'var(--body)',
  flex: 1,
  justifyContent: 'center',
} as const;

/** Chunks ya pedidos (hover+focus+PageNav disparan el mismo gesto varias veces). */
const chunksPedidos = new Set<string>();
/** Pide un chunk sin romper si falla (404 justo tras un deploy) y sin repetir el pedido.
 *  `clave` identifica el chunk para no pedirlo dos veces; `pedir` es el import dinámico. */
function pedirChunk(clave: string, pedir: () => Promise<unknown>): void {
  if (chunksPedidos.has(clave)) return;
  chunksPedidos.add(clave);
  pedir().catch(() => {
    chunksPedidos.delete(clave);
  });
}
const prefetchSan = (p: number) => {
  if (p === 1) pedirChunk('san1', () => import('../FixtureUnitCalc.tsx'));
  else if (p === 2) pedirChunk('san2', () => import('../SanitaryDesign.tsx'));
  else if (p === 3) pedirChunk('san3', () => import('../DownpipesTable.tsx'));
  else if (p === 4) pedirChunk('san4', () => import('../FittingsDiamPage.tsx'));
};
const prefetchLl = (p: number) => {
  if (p === 1) pedirChunk('ll1', () => import('../RainwaterDesign.tsx'));
  else if (p === 2) pedirChunk('ll2', () => import('../RainDownpipesCheck.tsx'));
  else if (p === 3) pedirChunk('ll3', () => import('../RainChannelsCheck.tsx'));
  else if (p === 4) pedirChunk('ll4', () => import('../FittingsDiamPage.tsx'));
};
const prefetchAfAc = (p: number) => {
  if (p === 1) pedirChunk('af1', () => import('../CalcUC.tsx'));
  else if (p === 2) pedirChunk('af2', () => import('../WaterNetworkDesign.tsx'));
  else if (p === 3) pedirChunk('af3', () => import('../../pages/AcometidaPage.tsx'));
  else if (p === 4) pedirChunk('af4', () => import('../AccessoriesTable.tsx'));
  else if (p === 5) pedirChunk('af5', () => import('../FittingsDiamPage.tsx'));
};
const prefetchHeavy = () => {
  pedirChunk('bom', () => import('../PumpARDesign'));
  pedirChunk('ep', () => import('../PressureEquipmentDesign.tsx'));
  pedirChunk('gas', () => import('../GasDesign'));
  pedirChunk('datos', () => import('../DesignParameters.tsx'));
  pedirChunk('crit', () => import('../Regulations/Regulations.tsx'));
};

export function RedesTab({ state }: { state: WorkAreaState }) {
  const {
    redesActivas,
    redes,
    redActiva,
    setRedActiva,
    sanPage,
    setSanPage,
    llPage,
    setLlPage,
    afPage,
    setAfPage,
    acPage,
    setAcPage,
    gasPage,
    setGasPage,
    tramosAf,
    tramosAc,
  } = state;

  return (
    <div
      className="fu"
      data-tour="cf-tab-redes"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}
    >
      <fieldset
        data-tour="redes-chips"
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', border: 'none', padding: 0, margin: 0 }}
      >
        <legend style={SR_ONLY_STYLE}>Redes</legend>
        {redesActivas.map((r) => (
          <button
            type="button"
            key={r.id}
            onClick={() => setRedActiva(r.id)}
            onMouseEnter={() => {
              if (r.id === 'san') prefetchSan(1);
              else if (r.id === 'll') prefetchLl(1);
              else if (r.id === 'af' || r.id === 'ac') prefetchAfAc(1);
              else if (r.id === 'bom' || r.id === 'ep' || r.id === 'gas') prefetchHeavy();
            }}
            onFocus={() => {
              if (r.id === 'san') prefetchSan(1);
              else if (r.id === 'll') prefetchLl(1);
              else if (r.id === 'af' || r.id === 'ac') prefetchAfAc(1);
            }}
            aria-pressed={redActiva === r.id}
            aria-label={r.lbl}
            style={{
              ...NET_BTN_STYLE,
              borderColor: redActiva === r.id ? r.col : 'var(--line)',
              color: redActiva === r.id ? r.col : 'var(--txt3)',
              background: redActiva === r.id ? 'rgba(0,0,0,.15)' : 'transparent',
              fontWeight: redActiva === r.id ? 700 : 400,
            }}
          >
            {r.icoImg ? (
              <img
                src={r.icoImg}
                alt=""
                width={24}
                height={24}
                style={{ width: 24, height: 24, verticalAlign: 'middle' }}
                loading="lazy"
              />
            ) : (
              <span style={{ fontSize: 18 }}>{r.ico}</span>
            )}
            <span>{r.lbl}</span>
          </button>
        ))}
      </fieldset>
      {redActiva === 'san' && redes.has('san') && (
        <div
          className="fu"
          data-tour="redes-contenido"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            data-tour="redes-paginas"
            page={sanPage}
            setPage={setSanPage}
            total={4}
            color="var(--san)"
            labels={[
              'Cálculo de unidades de descarga',
              'Diseño sanitario',
              'Bajantes y ventilación',
              'Resumen accesorios por diámetro',
            ]}
            onPageHover={prefetchSan}
          />
          {sanPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <CalculoUD />
            </Suspense>
          )}
          {sanPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <DisenosSanitarios />
            </Suspense>
          )}
          {sanPage === 3 && (
            <Suspense fallback={FALLBACK}>
              <BajantesTable />
            </Suspense>
          )}
          {sanPage === 4 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosDiamPage net="san" />
            </Suspense>
          )}
        </div>
      )}
      {redActiva === 'll' && redes.has('ll') && (
        <div
          className="fu"
          data-tour="redes-contenido"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            data-tour="redes-paginas"
            page={llPage}
            setPage={setLlPage}
            total={4}
            color="var(--ll)"
            labels={[
              'Diseño lluvias',
              'Chequeo bajantes',
              'Chequeo canales',
              'Resumen accesorios por diámetro',
            ]}
            onPageHover={prefetchLl}
          />
          {llPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <DisenoLluvias />
            </Suspense>
          )}
          {llPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <ChequeoBajantesLluvias />
            </Suspense>
          )}
          {llPage === 3 && (
            <Suspense fallback={FALLBACK}>
              <ChequeoCanalesLluvias />
            </Suspense>
          )}
          {llPage === 4 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosDiamPage net="ll" />
            </Suspense>
          )}
        </div>
      )}
      {redActiva === 'af' && redes.has('af') && (
        <div
          className="fu"
          data-tour="redes-contenido"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            data-tour="redes-paginas"
            page={afPage}
            setPage={setAfPage}
            total={5}
            color="var(--af)"
            labels={[
              'Cálculo de unidades de consumo',
              'Diseño de red agua fría',
              'Acometida',
              'Accesorios',
              'Resumen accesorios por diámetro',
            ]}
            onPageHover={prefetchAfAc}
          />
          {afPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <CalculoUC tipo="af" />
            </Suspense>
          )}
          {afPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <WaterNetworkDesign
                networkType="af"
                diamTable={DIAMETROS_AF}
                lookupFn={lookupInterno as (pulg: number) => number}
                hideAcometida
              />
            </Suspense>
          )}
          {afPage === 3 && (
            <Suspense fallback={FALLBACK}>
              <AcometidaPage />
            </Suspense>
          )}
          {afPage === 4 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosTable tramos={tramosAf} red="af" />
            </Suspense>
          )}
          {afPage === 5 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosDiamPage net="af" />
            </Suspense>
          )}
        </div>
      )}
      {redActiva === 'ac' && redes.has('ac') && (
        <div
          className="fu"
          data-tour="redes-contenido"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            data-tour="redes-paginas"
            page={acPage}
            setPage={setAcPage}
            total={5}
            color="var(--ac)"
            labels={[
              'Cálculo de unidades de consumo',
              'Diseño de red agua caliente',
              'Selección calentador',
              'Accesorios',
              'Resumen accesorios por diámetro',
            ]}
            onPageHover={prefetchAfAc}
          />
          {acPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <CalculoUC tipo="ac" />
            </Suspense>
          )}
          {acPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <WaterNetworkDesign
                networkType="ac"
                diamTable={DIAMETROS_AC}
                lookupFn={lookupInternoAC as (pulg: number) => number}
              />
            </Suspense>
          )}
          {acPage === 3 && (
            <Suspense fallback={FALLBACK}>
              <HeaterSelection />
            </Suspense>
          )}
          {acPage === 4 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosTable tramos={tramosAc} red="ac" />
            </Suspense>
          )}
          {acPage === 5 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosDiamPage net="ac" />
            </Suspense>
          )}
        </div>
      )}
      {redActiva === 'bom' && redes.has('bom') && (
        <Suspense fallback={FALLBACK}>
          <BombaARDesign />
        </Suspense>
      )}
      {redActiva === 'ep' && redes.has('ep') && (
        <Suspense fallback={FALLBACK}>
          <PressureEquipmentDesign />
        </Suspense>
      )}
      {redActiva === 'gas' && redes.has('gas') && (
        <div
          className="fu"
          data-tour="redes-contenido"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <PageNav
            data-tour="redes-paginas"
            page={gasPage}
            setPage={setGasPage}
            total={redes.has('rejillas') ? 5 : 4}
            color="var(--gas)"
            labels={[
              'Datos generales',
              'Cálculo de unidades de consumo',
              'Diseño de red',
              ...(redes.has('rejillas')
                ? ['Rejillas de ventilación', 'Resumen accesorios por diámetro']
                : ['Resumen accesorios por diámetro']),
            ]}
            onPageHover={prefetchHeavy}
          />
          {gasPage <= 3 && (
            <Suspense fallback={FALLBACK}>
              <GasDesign pagina={gasPage} />
            </Suspense>
          )}
          {gasPage === 4 && redes.has('rejillas') && (
            <Suspense fallback={FALLBACK}>
              <RejillasVentilacion />
            </Suspense>
          )}
          {(gasPage === 5 || (gasPage >= 4 && !redes.has('rejillas'))) && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosDiamPage net="gas" />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
