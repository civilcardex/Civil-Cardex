import { Suspense, lazy } from 'react';
import { RainwaterProvider } from '../context/RainwaterContext';
import InfoTab from './workarea/InfoTab';
import { RedesTab } from './workareaContent/redesTab';
import { InfTab } from './workareaContent/infTab';
import type { useWorkAreaState } from './useWorkAreaState';

const PlanosTab = lazy(() => import('./workarea/PlanosTab'));
const BaseDatos = lazy(() => import('./DesignParameters'));
const Normativa = lazy(() => import('./Regulations/Regulations'));
const IsometriaTab = lazy(() =>
  import('./workarea/IsometriaTab').then((m) => ({ default: m.IsometriaTab })),
);

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
const FALLBACK = <div style={{ minHeight: 400 }} />;

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface WorkAreaContentProps {
  state: WorkAreaState;
}

export default function WorkAreaContent({ state }: WorkAreaContentProps) {
  const { tab, redes } = state;

  return (
    <RainwaterProvider>
      {tab === 'info' && (
        <section
          aria-label="Información del proyecto"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={SR_ONLY_STYLE}>Información del proyecto</h2>
          <InfoTab state={state} />
        </section>
      )}
      {tab === 'planos' && (
        <section
          aria-label="Carga de planos"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={SR_ONLY_STYLE}>Carga de planos</h2>
          <Suspense fallback={FALLBACK}>
            <PlanosTab state={state} />
          </Suspense>
        </section>
      )}
      {tab === 'redes' && state.redesActivas.length > 0 && (
        <section
          aria-label="Diseño de red"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={SR_ONLY_STYLE}>Diseño de red</h2>
          <RedesTab state={state} />
        </section>
      )}
      {tab === 'datos' && (
        <section
          aria-label="Parámetros de diseño"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={SR_ONLY_STYLE}>Parámetros de diseño</h2>
          <Suspense fallback={FALLBACK}>
            <BaseDatos redes={redes} />
          </Suspense>
        </section>
      )}
      {tab === 'crit' && (
        <section
          aria-label="Criterios y normativa"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={SR_ONLY_STYLE}>Criterios y normativa</h2>
          <Suspense fallback={FALLBACK}>
            <Normativa />
          </Suspense>
        </section>
      )}
      {tab === 'inf' && (
        <section
          aria-label="Resumen del proyecto"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={SR_ONLY_STYLE}>Resumen del proyecto</h2>
          <InfTab state={state} />
        </section>
      )}
      {tab === 'iso' && (
        <section
          aria-label="Isometría de red"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <h2 style={SR_ONLY_STYLE}>Isometría de red</h2>
          <Suspense fallback={FALLBACK}>
            <IsometriaTab state={state} />
          </Suspense>
        </section>
      )}
    </RainwaterProvider>
  );
}
