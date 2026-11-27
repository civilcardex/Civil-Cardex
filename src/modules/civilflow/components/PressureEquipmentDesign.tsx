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
import { type EpUn } from './ep/epUnidades.ts';
import { getActiveProyectoId } from '../services/storageService.ts';
import { guardaConReintento } from '../../../utils/saveToCloud.ts';
import { loadEpDatos, saveEpDatos } from '../services/epService.ts';

// Diseño del Equipo de Presión (redes 'ep'). Página "Cisterna" solo existe con modo =
// cisterna (orig. usuario); con succión de red el nav muestra 3 páginas. La página Esquema
// del P&ID de montaje se retiró (ped. usuario 2026-11-20).

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
      // El loader omite las claves EPC ausentes/vacías: este spread conserva sus defaults
      // (dif, margen, usos…). Mandarlas como '' rompía el cálculo del tanque al recargar.
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
  /* Unidad de presentación del EPC (ped. usuario 2026-11-20): convierte lo que se VE en
   *  todas las páginas; el motor y la BD siguen en m.c.a. Persistida por navegador. */
  const [unidad, setUnidad] = usePersistedState<EpUn>('ep_unidad', 'mca');

  const pages = useMemo(
    () => [
      {
        t: 'Datos de entrada',
        icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
        c: <EPInputPage ep={ep} updEP={updEP} unidad={unidad} setUnidad={setUnidad} />,
      },
      ...(cisterna
        ? [
            {
              t: 'Cisterna',
              icon: '/iconos_civilflow/diseno_redes/equipos/succion_cisterna.webp',
              c: <EPCisternaPage ep={ep} updEP={updEP} unidad={unidad} />,
            },
          ]
        : []),
      {
        t: 'Cálculo hidráulico y potencia',
        icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
        c: <EPVerificationPage section="params" ep={ep} updEP={updEP} unidad={unidad} />,
      },
      {
        t: 'Diámetros y especificación',
        icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
        c: <EPVerificationPage section="results" ep={ep} updEP={updEP} unidad={unidad} />,
      },
    ],
    [ep, updEP, cisterna, unidad, setUnidad],
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
      <div className="cf-network-sheet" style={{ padding: 6 }}>
        {pages[pagina - 1].c}
      </div>
    </div>
  );
}
