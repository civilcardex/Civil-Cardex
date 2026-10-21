import React, { Suspense } from 'react';
import { DIAMETROS_AF } from '../constants/hidraulicoDatos.ts';
import { lookupInterno } from '../utils/accesoriosUtiles.ts';

const WaterNetworkDesign = React.lazy(() => import('../components/WaterRedDesign.tsx'));

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
