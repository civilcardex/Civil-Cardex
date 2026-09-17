import { useState, useMemo } from 'react';
import PageNav from './PageNav';
import EPInputPage from './ep/EPInputPage';
import EPVerificationPage from './ep/EPVerificationPage';
import { useEpSincronizado } from './ep/useEpSincronizado';

// Diseño del Equipo de Presión (redes 'ep'). La página "Esquema" se movió a la sub-pestaña
// "Equipo de presión constante" de Isometría (components/epc3d/) — aquí quedan solo
// las 3 páginas de diseño (orig. usuario).

export default function PressureEquipmentDesign() {
  const [page, setPage] = useState(1);
  const { ep, updEP } = useEpSincronizado();

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
      <div style={{ flex: 1, padding: 6, overflow: 'hidden', display: 'flex' }}>
        {pages[page - 1].c}
      </div>
    </div>
  );
}
