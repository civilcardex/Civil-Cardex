import { Suspense, lazy } from 'react';
import PageNav from '../PageNav';
import { DIAMETROS_AF, DIAMETROS_AC } from '../../constants/hydraulicData';
import { lookupInterno, lookupInternoAC } from '../../utils/accesoriosUtils';
import type { useWorkAreaState } from '../useWorkAreaState';

const AccesoriosTable = lazy(() => import('../AccessoriesTable'));
const HeaterSelection = lazy(() => import('../HeaterSelection'));
const CalculoUD = lazy(() => import('../FixtureUnitCalc'));
const DisenosSanitarios = lazy(() => import('../SanitaryDesign'));
const BajantesTable = lazy(() => import('../DownpipesTable'));
const AccesoriosDiamPage = lazy(() => import('../AccesoriosDiamPage'));
const DisenoLluvias = lazy(() => import('../RainwaterDesign'));
const ChequeoBajantesLluvias = lazy(() => import('../RainDownpipesCheck'));
const ChequeoCanalesLluvias = lazy(() => import('../RainChannelsCheck'));
const CalculoUC = lazy(() => import('../CalculoUC'));
const WaterNetworkDesign = lazy(() => import('../WaterNetworkDesign'));
const BombaARDesign = lazy(() => import('../BombaARDesign'));
const GasDesign = lazy(() => import('../GasDesign'));
const PressureEquipmentDesign = lazy(() => import('../PressureEquipmentDesign'));
const AcometidaPage = lazy(() => import('../../pages/AcometidaPage'));

const FALLBACK = <div style={{ minHeight: 400 }} />;

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

const prefetchSan = (p: number) => {
  if (p === 1) import('../FixtureUnitCalc');
  else if (p === 2) import('../SanitaryDesign');
  else if (p === 3) import('../DownpipesTable');
  else if (p === 4) import('../AccesoriosDiamPage');
};
const prefetchLl = (p: number) => {
  if (p === 1) import('../RainwaterDesign');
  else if (p === 2) import('../RainDownpipesCheck');
  else if (p === 3) import('../RainChannelsCheck');
  else if (p === 4) import('../AccesoriosDiamPage');
};
const prefetchAfAc = (p: number) => {
  if (p === 1) import('../CalculoUC');
  else if (p === 2) import('../WaterNetworkDesign');
  else if (p === 3) import('../../pages/AcometidaPage');
  else if (p === 4) import('../AccessoriesTable');
  else if (p === 5) import('../AccesoriosDiamPage');
};
const prefetchHeavy = () => {
  import('../BombaARDesign');
  import('../PressureEquipmentDesign');
  import('../GasDesign');
  import('../DesignParameters');
  import('../Regulations/Regulations');
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
      style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}
    >
      <fieldset
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', border: 'none', padding: 0, margin: 0 }}
      >
        <legend style={SR_ONLY_STYLE}>Redes</legend>
        {redesActivas.map((r) => (
          <button
            type="button"
            key={r.id}
            onClick={() => setRedActiva(r.id)}
            onMouseEnter={() => {
              if (r.id === 'bom' || r.id === 'ep' || r.id === 'gas') prefetchHeavy();
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
              <AccesoriosTable tramos={tramosAf} />
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
              <AccesoriosTable tramos={tramosAc} />
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
            page={gasPage}
            setPage={setGasPage}
            total={2}
            color="var(--gas)"
            labels={['Diseño de gas', 'Resumen accesorios por diámetro']}
            onPageHover={prefetchHeavy}
          />
          {gasPage === 1 && (
            <Suspense fallback={FALLBACK}>
              <GasDesign />
            </Suspense>
          )}
          {gasPage === 2 && (
            <Suspense fallback={FALLBACK}>
              <AccesoriosDiamPage net="gas" />
            </Suspense>
          )}
        </div>
      )}
      {redesActivas
        .filter(
          (r) =>
            r.id !== 'san' &&
            r.id !== 'll' &&
            r.id !== 'af' &&
            r.id !== 'ac' &&
            r.id !== 'bom' &&
            r.id !== 'ep' &&
            r.id !== 'gas',
        )
        .map(
          (r) =>
            redActiva === r.id &&
            redes.has(r.id) && (
              <div
                key={r.id}
                className="fu"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  flex: 1,
                  minHeight: 250,
                }}
              >
                <div style={{ fontSize: 48, opacity: 0.5 }}>&#x1F6A7;</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--txt2)' }}>{r.lbl}</div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--txt3)',
                    textAlign: 'center',
                    maxWidth: 380,
                    lineHeight: 1.6,
                  }}
                >
                  El módulo de <strong>{r.lbl}</strong> está en desarrollo.
                  <br />
                  Pronto estará disponible para uso en CivilFlow.
                </div>
              </div>
            ),
        )}
    </div>
  );
}
