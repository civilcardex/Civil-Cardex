import React, { Suspense } from 'react';
import { DIAMETROS_AF } from '../constants/hydraulicsData.ts';
import { lookupInterno } from '../utils/fittingsUtils.ts';

const WaterNetworkDesign = React.lazy(() => import('../components/WaterNetworkDesign.tsx'));

/** Pantalla de diseño de la acometida (la tubería que entra del acueducto al edificio, red af = Agua Fría) reusando el diseño de redes con `showOnlyAcometida`. */
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
