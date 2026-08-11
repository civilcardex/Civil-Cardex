import React, { Suspense } from 'react';
import { DIAMETROS_AF } from '../constants/hydraulicData';
import { lookupInterno } from '../utils/accesoriosUtils';

const WaterNetworkDesign = React.lazy(() => import('../components/WaterNetworkDesign'));

export default function AcometidaPage() {
  return (
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
      <Suspense fallback={<div style={{ padding: 16, color: 'var(--txt3)' }}>Cargando...</div>}>
        <WaterNetworkDesign
          networkType="af"
          diamTable={DIAMETROS_AF}
          lookupFn={lookupInterno as (pulg: number) => number}
          showOnlyAcometida
        />
      </Suspense>
    </div>
  );
}
