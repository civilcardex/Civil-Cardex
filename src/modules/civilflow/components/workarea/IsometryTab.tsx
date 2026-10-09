import React, { Suspense, useEffect, useState } from 'react';
import PageNav from '../PageNav';
import { IsometriaGeneral } from './IsometryGeneral';
import type { useWorkAreaState } from '../useWorkAreaState';
import { setAyudaContext } from '../../../../components/help/helpContext';

// Pestaña Isometría con 4 sub-pestañas (orig. usuario): Isometría (el contenido histórico),
// Aparatos (visor 3D del detalle de instalación), Bomba red contra incendio (solo el visor 3D
// del cuarto de bombas) y Equipo de presión constante (solo el esquema 3D — el diseño EP queda
// en Redes). Estado local de sub-pestaña (variante PressureEquipmentDesign).

const Aparatos3D = React.lazy(() => import('../aparatos3d/DetailAparatosViewer'));
const RciCuartoBombasViewer = React.lazy(() => import('../rci3d/RciViewer'));
const Epc3D = React.lazy(() => import('../epc3d/EpcViewer'));
const RciRed3D = React.lazy(() => import('../rci-red3d/RciRedViewer'));

const FALLBACK = <div style={{ minHeight: 400 }} />;
const SUBTABS = [
  'Redes',
  'Aparatos',
  'Cuarto bomba red contra incendio',
  'Equipo de presión constante',
  'Red contra incendio',
];

/** Sub-pestaña → intro para la ayuda contextual. */
const AYUDA_ISO: Record<number, { intro: string }> = {
  1: { intro: 'Vista isométrica general de las redes dibujadas en el visor.' },
  2: {
    intro: 'Detalle 3D de la instalación de cada aparato sanitario.',
  },
  3: { intro: 'Cuarto de bombas de la red contra incendio según NFPA 20.' },
  4: {
    intro: 'Esquema 3D del equipo de presión constante y sus criterios de selección.',
  },
  5: {
    intro: 'Red contra incendio en 3D: componentes y referencias normativas.',
  },
};

function IsometriaTabBase({ state }: { state: ReturnType<typeof useWorkAreaState> }) {
  const [sub, setSub] = useState(1);
  // Ayuda contextual: reporta la sub-pestaña activa (el padre omite 'iso' por esto).
  useEffect(() => {
    setAyudaContext({
      key: `cf:iso:${sub}`,
      modulo: 'Civil Flow',
      seccion: `Isometría · ${SUBTABS[sub - 1]}`,
      intro: AYUDA_ISO[sub]?.intro || AYUDA_ISO[1].intro,
    });
    return () => setAyudaContext(null);
  }, [sub]);
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
      <PageNav page={sub} setPage={setSub} total={5} labels={SUBTABS} color="var(--acc)" />
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
      {sub === 5 && (
        <Suspense fallback={FALLBACK}>
          <RciRed3D />
        </Suspense>
      )}
    </div>
  );
}

const IsometriaTab = React.memo(IsometriaTabBase);
export { IsometriaTab };
