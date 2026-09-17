import React, { Suspense, useState } from 'react';
import PageNav from '../PageNav';
import { IsometriaGeneral } from './IsometriaGeneral';
import type { useWorkAreaState } from '../useWorkAreaState';

// Pestaña Isometría con 4 sub-pestañas (orig. usuario): Isometría (el contenido histórico),
// Aparatos (visor 3D del detalle de instalación), Bomba red contra incendio (solo el visor 3D
// del cuarto de bombas) y Equipo de presión constante (solo el esquema 3D — el diseño EP queda
// en Redes). Estado local de sub-pestaña (variante PressureEquipmentDesign).

const Aparatos3D = React.lazy(() => import('../aparatos3d'));
const RciCuartoBombasViewer = React.lazy(() => import('../RciCuartoBombasViewer'));
const Epc3D = React.lazy(() => import('../epc3d'));

const FALLBACK = <div style={{ minHeight: 400 }} />;
const SUBTABS = ['Redes', 'Aparatos', 'Bomba red contra incendio', 'Equipo de presión constante'];

function IsometriaTabBase({ state }: { state: ReturnType<typeof useWorkAreaState> }) {
  const [sub, setSub] = useState(1);
  return (
    <div
      className="fu"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <PageNav page={sub} setPage={setSub} total={4} labels={SUBTABS} color="var(--acc)" />
      {sub === 1 && <IsometriaGeneral state={state} />}
      {sub === 2 && (
        <Suspense fallback={FALLBACK}>
          <Aparatos3D />
        </Suspense>
      )}
      {sub === 3 && (
        <Suspense fallback={FALLBACK}>
          <RciCuartoBombasViewer />
        </Suspense>
      )}
      {sub === 4 && (
        <Suspense fallback={FALLBACK}>
          <Epc3D />
        </Suspense>
      )}
    </div>
  );
}

const IsometriaTab = React.memo(IsometriaTabBase);
export { IsometriaTab };
