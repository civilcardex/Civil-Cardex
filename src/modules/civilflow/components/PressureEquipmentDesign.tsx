import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import PageNav from './PageNav';
import EPInputPage from './ep/EPInputPage';
import EPVerificationPage from './ep/EPVerificationPage';
import EPCisternaPage from './ep/EPCisternaPage';
import { usePersistedState } from '../../../hooks/usePersistedState';
import type { EPData } from './ep/EPShared';
import { EP_DEFAULTS } from './ep/EPShared';
import { getActiveProyectoId } from '../services/storageService';
import { loadEpDatos, saveEpDatos } from '../services/epService';

// Diseño del Equipo de Presión (redes 'ep'). La página "Esquema" se movió a la sub-pestaña
// "Equipo de presión constante" de Isometría (components/epc3d/). Página "Cisterna" solo
// existe con modo = cisterna (orig. usuario); con succión de red el nav muestra 3 páginas.

/** Estado EP sincronizado con la BD (ep_datos_proyecto, 1:1 con el proyecto) — compartido por
 *  el diseño EP en Redes y el esquema solo-lectura en la sub-pestaña de Isometría, para que
 *  ambos vean/editen el MISMO dato. Hidratación al montar (gana sobre caché localStorage) y
 *  persistencia debounced (1200 ms) que no corre hasta terminar la hidratación. */
function useEpSincronizado(): {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
} {
  const [ep, setEP] = usePersistedState<EPData>('ep', EP_DEFAULTS, (saved) => ({
    ...EP_DEFAULTS,
    ...(saved as Partial<EPData>),
  }));

  const hydratedRef = useRef(false);
  useEffect(() => {
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let cancelled = false;
    void loadEpDatos(proyectoId).then((d) => {
      if (cancelled) return;
      if (d) setEP({ ...EP_DEFAULTS, ...d });
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [setEP]);

  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydratedRef.current) return;
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveEpDatos(proyectoId, ep);
    }, 1200);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [ep]);

  const updEP = useCallback(
    (field: keyof EPData, val: EPData[keyof EPData]) => {
      setEP((prev) => ({ ...prev, [field]: val }));
    },
    [setEP],
  );

  return { ep, updEP };
}

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
  // Sin cisterna las páginas son [Datos, Cálculo, Diámetros]: la 2 es Cálculo válido.
  // Con cisterna son [Datos, Cisterna, Cálculo, Diámetros]: venir de Cisterna (2) a modo
  // red aterriza en Cálculo (2), válido — no se fuerza a Datos. El min() cubre el caso
  // inverso (Diámetros 4 → fuera de rango en red).
  const pagina = Math.min(page, pages.length);

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
      {/* overflow auto (antes hidden): habilita el sticky de thead si las tablas crecen
          (hidden crea scroll container sin scroll y mata position:sticky — Req 7). */}
      <div style={{ flex: 1, padding: 6, overflow: 'auto', display: 'flex' }}>
        {pages[pagina - 1].c}
      </div>
    </div>
  );
}
