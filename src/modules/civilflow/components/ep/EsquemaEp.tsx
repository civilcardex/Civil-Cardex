import { Suspense, lazy, type JSX } from 'react';
import { useEpSincronizado } from './useEpSincronizado';

const EPSchemePage = lazy(() => import('./EPSchemePage'));

/** Esquema 3D del Equipo de Presión Constante, SOLO (sub-pestaña de Isometría — orig. usuario:
 *  el diseño con tablas queda en Redes; aquí únicamente la página "Esquema"). Mismo estado EP
 *  sincronizado con la BD que el diseño de Redes. */
export default function EsquemaEp(): JSX.Element {
  const { ep, updEP } = useEpSincronizado();
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: 380,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--txt3)',
          }}
        >
          Cargando esquema 3D…
        </div>
      }
    >
      <EPSchemePage ep={ep} updEP={updEP} />
    </Suspense>
  );
}
