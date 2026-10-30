/** Conmutador de pestañas del área de trabajo: carga perezosa (lazy) de cada pantalla
 *  (planos, isometría, tablas, Base de Datos…) sobre el estado compartido del workarea.
 *  Ej: clic en «Isometría» -> monta el visor solo en ese momento. */
import { Suspense, lazy } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { RainwaterProvider } from '../context/RainwaterContext.tsx';
import InfoTab from './workarea/InfoTab.tsx';
import { RedesTab } from './workareaContent/networksTab.tsx';
import { InfTab } from './workareaContent/reportTab.tsx';
import type { useWorkAreaState } from './useWorkAreaState.ts';

import { SR_ONLY_STYLE } from '../../../components/shared/sharedStyles.ts';
const PlanosTab = lazy(() => import('./workarea/PlanosTab.tsx'));
const BaseDatos = lazy(() => import('./DesignParameters.tsx'));
const Normativa = lazy(() => import('./Regulations/Regulations.tsx'));
const IsometriaTab = lazy(() =>
  import('./workarea/IsometryTab.tsx').then((m) => ({ default: m.IsometriaTab })),
);

const FALLBACK = <div style={{ minHeight: 400 }} />;

const SECCION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
};

/** Sección-tab estándar del conmutador: label accesible (aria + h2 oculto) y contenido que llena
 *  el alto. Ej: <Seccion label="Carga de planos"><Suspense fallback={FALLBACK}><PlanosTab/></Suspense></Seccion>. */
function Seccion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} style={SECCION_STYLE}>
      <h2 style={SR_ONLY_STYLE}>{label}</h2>
      {children}
    </section>
  );
}

type WorkAreaState = ReturnType<typeof useWorkAreaState>;

interface WorkAreaContentProps {
  state: WorkAreaState;
}

export default function WorkAreaContent({ state }: WorkAreaContentProps) {
  const { tab, redes, redesRestoreDone, redesActivas } = state;

  return (
    <RainwaterProvider>
      {tab === 'info' && (
        <Seccion label="Información del proyecto">
          <InfoTab state={state} />
        </Seccion>
      )}
      {tab === 'planos' && (
        <Seccion label="Carga de planos">
          <Suspense fallback={FALLBACK}>
            <PlanosTab state={state} />
          </Suspense>
        </Seccion>
      )}
      {tab === 'redes' && !redesRestoreDone && (
        <div role="status" style={{ padding: 24, color: 'var(--txt2)', fontSize: 13 }}>
          Cargando redes…
        </div>
      )}
      {tab === 'redes' && redesRestoreDone && redesActivas.length > 0 && (
        <Seccion label="Diseño de red">
          <RedesTab state={state} />
        </Seccion>
      )}
      {tab === 'redes' && redesRestoreDone && redesActivas.length === 0 && (
        <div role="status" style={{ padding: 24, color: 'var(--txt2)', fontSize: 13 }}>
          Sin redes activas: actívalas en Información del proyecto para diseñar.
        </div>
      )}
      {tab === 'datos' && (
        <Seccion label="Parámetros de diseño">
          <Suspense fallback={FALLBACK}>
            <BaseDatos redes={redes} />
          </Suspense>
        </Seccion>
      )}
      {tab === 'crit' && (
        <Seccion label="Criterios y normativa">
          <Suspense fallback={FALLBACK}>
            <Normativa />
          </Suspense>
        </Seccion>
      )}
      {tab === 'inf' && (
        <Seccion label="Resumen del proyecto">
          <InfTab state={state} />
        </Seccion>
      )}
      {tab === 'iso' && (
        <Seccion label="Isometría de red">
          <Suspense fallback={FALLBACK}>
            <IsometriaTab state={state} />
          </Suspense>
        </Seccion>
      )}
    </RainwaterProvider>
  );
}
