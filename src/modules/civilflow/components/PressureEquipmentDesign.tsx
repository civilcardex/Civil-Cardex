import { useState, useCallback, useMemo } from 'react';
import { usePersistedState } from '../../../hooks/usePersistedState';
import type { EPData } from './ep/EPShared';
import { EP_DEFAULTS } from './ep/EPShared';
import PageNav from './PageNav';
import EPInputPage from './ep/EPInputPage';
import EPVerificationPage from './ep/EPVerificationPage';

export default function PressureEquipmentDesign() {
  const [page, setPage] = useState(1);

  const [ep, setEP] = usePersistedState<EPData>('ep', EP_DEFAULTS, (saved) => ({
    ...EP_DEFAULTS,
    ...(saved as Partial<EPData>),
  }));

  const updEP = useCallback(
    (field: keyof EPData, val: EPData[keyof EPData]) => {
      setEP((prev) => ({ ...prev, [field]: val }));
    },
    [setEP],
  );

  const pages = useMemo(
    () => [
      {
        t: 'Datos de entrada',
        icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
        c: <EPInputPage ep={ep} updEP={updEP} />,
      },
      {
        t: 'Cálculo hidráulico y potencia',
        icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
        c: <EPVerificationPage section="params" ep={ep} updEP={updEP} />,
      },
      {
        t: 'Diámetros y especificación',
        icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
        c: <EPVerificationPage section="results" ep={ep} updEP={updEP} />,
      },
    ],
    [ep, updEP],
  );

  return (
    <div
      className="fu"
      style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}
    >
      <PageNav
        page={page}
        setPage={setPage}
        total={3}
        color="var(--ep)"
        labels={['Datos de entrada', 'Cálculo hidráulico y potencia', 'Diámetros y especificación']}
      />
      <div style={{ flex: 1, padding: 6, overflow: 'auto' }}>{pages[page - 1].c}</div>
    </div>
  );
}
