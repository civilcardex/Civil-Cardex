/** Diseño de ep (Equipo de Presión): datos de entrada, cálculo de la demanda y verificación
 *  del sistema de bombeo. Ej: ajustar la presión mínima del sistema recalcula el ep necesario. */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import PageNav from './PageNav.tsx';
import EPInputPage from './ep/EPInputPage.tsx';
import EPVerificationPage from './ep/EPVerificationPage.tsx';
import EPCisternaPage from './ep/EPTankPage.tsx';
import { usePersistedState } from '../../../hooks/usePersistedState.ts';
import { useDebouncedEffect } from '../../../hooks/useDebouncedEffect.ts';
import { useProyecto } from '../context/ProjectContext.tsx';
import { perfilDe } from '../constants/countryStandards';
import type { EPData } from './ep/EPShared';
import { EP_DEFAULTS } from './ep/EPShared';
import { getActiveProyectoId } from '../services/storageService.ts';
import { loadEpDatos, saveEpDatos } from '../services/epService.ts';
import { guardaConReintento } from '../../../utils/saveToCloud.ts';

// Diseño del Equipo de Presión (redes 'ep'). La página "Esquema" se movió a la sub-pestaña
// "Equipo de presión constante" de Isometría (components/epc3d/). Página "Cisterna" solo
// existe con modo = cisterna (orig. usuario); con succión de red el nav muestra 3 páginas.

/** Estado EP (Equipo de Presion) sincronizado con la BD (ep_datos_proyecto, 1:1 con el proyecto) — compartido por el diseño EP (Equipo de Presion) en Redes y el esquema
 * solo-lectura en la sub-pestaña de Isometría, para que ambos vean/editen el MISMO dato. */
function useEpSincronizado(): {
  ep: EPData;
  updEP: (field: keyof EPData, val: EPData[keyof EPData]) => void;
} {
  const { proy } = useProyecto();
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
      else {
        // Proyecto nuevo sin datos: pmin/pmax del país (pMinRed/pMax del perfil).
        // Solo si siguen en el default — nunca se pisa lo que el usuario ya editó.
        const perfil = perfilDe(proy?.pais);
        setEP((prev) => ({
          ...prev,
          pmin: prev.pmin === EP_DEFAULTS.pmin ? String(perfil.af.pMinRed) : prev.pmin,
          pmax: prev.pmax === EP_DEFAULTS.pmax ? String(perfil.af.pMax) : prev.pmax,
        }));
      }
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [setEP, proy?.pais]);

  useDebouncedEffect(
    () => {
      if (!hydratedRef.current) return;
      const proyectoId = getActiveProyectoId();
      if (!proyectoId) return;
      // Si el guardado falla, se reintenta y se avisa: el informe PDF se genera desde la BD,
      // así que un fallo silencioso entregaba la bomba con los valores viejos.
      void guardaConReintento('equipo-presion', () => saveEpDatos(proyectoId, ep));
    },
    1200,
    [ep],
  );

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
