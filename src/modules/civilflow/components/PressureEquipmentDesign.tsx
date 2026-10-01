import { useState, useMemo } from 'react';
import PageNav from './PageNav';
import EPInputPage from './ep/EPInputPage';
import EPVerificationPage from './ep/EPVerificationPage';
import EPCisternaPage from './ep/EPCisternaPage';
import { useEpSincronizado } from './ep/useEpSynchronized';

// Diseño del Equipo de Presión (redes 'ep'). La página "Esquema" se movió a la sub-pestaña
// "Equipo de presión constante" de Isometría (components/epc3d/). Página "Cisterna" solo
// existe con modo = cisterna (orig. usuario); con succión de red el nav muestra 3 páginas.

export default function PressureEquipmentDesign() {
  const [page, setPage] = useState(1);
  const { ep, updEP } = useEpSincronizado();
  const cisterna = ep.modo === 'cisterna';

  const pages = useMemo(
    () => [
      {
        t: 'Datos de entrada',
        icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
        c: <EPInputPage ep={ep} updEP={updEP} />,
      },
      ...(cisterna
        ? [
            {
              t: 'Cisterna',
              icon: '/iconos_civilflow/diseno_redes/equipos/succion_cisterna.webp',
              c: <EPCisternaPage ep={ep} updEP={updEP} />,
            },
          ]
        : []),
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
    [ep, updEP, cisterna],
  );

  // Clamp derivado en render (sin effect: el setState dentro causaba cascada de renders).
  // Si se pasa a modo RED con la página Cisterna activa, retrocede a Datos de entrada;
  // cualquier página que quede fuera del nav del modo actual también se ajusta.
  let pagina = Math.min(page, pages.length);
  if (!cisterna && page === 2) pagina = 1;

  return (
    <div
      className="fu"
      style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}
    >
      <PageNav
        page={pagina}
        setPage={setPage}
        total={pages.length}
        color="var(--ep)"
        labels={pages.map((p) => p.t)}
      />
      <div style={{ flex: 1, padding: 6, overflow: 'hidden', display: 'flex' }}>
        {pages[pagina - 1].c}
      </div>
    </div>
  );
}
