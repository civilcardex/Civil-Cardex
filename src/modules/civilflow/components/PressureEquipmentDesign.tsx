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
import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError.ts';
import { CF_TABLES } from '../constants/tableNames.ts';
import { guardaConReintento } from '../../../utils/saveToCloud.ts';

// Diseño del Equipo de Presión (redes 'ep'). La página "Esquema" se movió a la sub-pestaña
// "Equipo de presión constante" de Isometría (components/epc3d/). Página "Cisterna" solo
// existe con modo = cisterna (orig. usuario); con succión de red el nav muestra 3 páginas.

interface EpDatosRow {
  qac: string | null;
  qasc: string | null;
  hfac: string | null;
  hfacs: string | null;
  hfotros: string | null;
  pred: string | null;
  pmin: string | null;
  pmax: string | null;
  zbomba: string | null;
  ztop: string | null;
  zcis: string | null;
  hfcis: string | null;
  nt: string | null;
  nr: string | null;
  etab: string | null;
  etam: string | null;
  fs: string | null;
  ciclos: string | null;
  alfa: string | null;
  vsuc: string | null;
  vimp: string | null;
  dnsuc: string | null;
  dnimp: string | null;
  pcomercial: string | null;
  modo: 'red' | 'cisterna' | null;
  dot_l: string | null;
  n_usuarios: string | null;
  dias_aut: string | null;
  bci_l: string | null;
  patm: string | null;
  pv: string | null;
  npshr: string | null;
}

const FIELD_MAP: Record<keyof EPData, keyof EpDatosRow> = {
  qac: 'qac',
  qasc: 'qasc',
  hfac: 'hfac',
  hfacs: 'hfacs',
  hfotros: 'hfotros',
  pred: 'pred',
  pmin: 'pmin',
  pmax: 'pmax',
  zbomba: 'zbomba',
  ztop: 'ztop',
  zcis: 'zcis',
  hfcis: 'hfcis',
  nt: 'nt',
  nr: 'nr',
  etab: 'etab',
  etam: 'etam',
  fs: 'fs',
  ciclos: 'ciclos',
  alfa: 'alfa',
  vsuc: 'vsuc',
  vimp: 'vimp',
  dnsuc: 'dnsuc',
  dnimp: 'dnimp',
  pcomercial: 'pcomercial',
  modo: 'modo',
  dotL: 'dot_l',
  nUsuarios: 'n_usuarios',
  diasAut: 'dias_aut',
  bciL: 'bci_l',
  patm: 'patm',
  pv: 'pv',
  npshr: 'npshr',
};

/**
 * Carga los datos del equipo de presión (ep_datos_proyecto, 1:1 con el proyecto).
 * Devuelve null cuando la fila no existe aún — el llamador decide usar defaults.
 */
async function loadEpDatos(proyectoId: string): Promise<EPData | null> {
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.epDatos)
      .select(Object.values(FIELD_MAP).join(', '))
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (error) {
      devError('epService load:', error.message);
      return null;
    }
    if (!data) return null;

    const row = data as unknown as EpDatosRow;
    return {
      qac: row.qac ?? '',
      qasc: row.qasc ?? '',
      hfac: row.hfac ?? '',
      hfacs: row.hfacs ?? '',
      hfotros: row.hfotros ?? '',
      pred: row.pred ?? '',
      pmin: row.pmin ?? '',
      pmax: row.pmax ?? '',
      zbomba: row.zbomba ?? '',
      ztop: row.ztop ?? '',
      zcis: row.zcis ?? '',
      hfcis: row.hfcis ?? '',
      nt: row.nt ?? '',
      nr: row.nr ?? '',
      etab: row.etab ?? '',
      etam: row.etam ?? '',
      fs: row.fs ?? '',
      ciclos: row.ciclos ?? '',
      alfa: row.alfa ?? '',
      vsuc: row.vsuc ?? '',
      vimp: row.vimp ?? '',
      dnsuc: row.dnsuc ?? '',
      dnimp: row.dnimp ?? '',
      pcomercial: row.pcomercial ?? '',
      modo: row.modo === 'cisterna' ? 'cisterna' : 'red',
      dotL: row.dot_l ?? '',
      nUsuarios: row.n_usuarios ?? '',
      diasAut: row.dias_aut ?? '',
      bciL: row.bci_l ?? '',
      patm: row.patm ?? '',
      pv: row.pv ?? '',
      npshr: row.npshr ?? '',
    };
  } catch (e) {
    devError('epService load exception:', e);
    return null;
  }
}

/** Guarda lo del equipo a presión en la BD (una fila por proyecto, sin tocar lo demás). Lo usa la página de diseño con debounce. Lanza si el guardado falla: si no, el informe PDF generado desde la BD salía con los valores viejos. Ej: ep (Equipo de Presion) con caché viva en localStorage. */
async function saveEpDatos(proyectoId: string, ep: EPData): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.rpc('save_ep_datos', {
      p_proyecto_id: proyectoId,
      p_datos: Object.fromEntries(
        Object.entries(FIELD_MAP).map(([k, col]) => [col, ep[k as keyof EPData]]),
      ),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    devError('epService save exception:', e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

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
