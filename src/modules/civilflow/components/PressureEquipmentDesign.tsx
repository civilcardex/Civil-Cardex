import { useState, useCallback, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import { usePersistedState } from '../../../hooks/usePersistedState';
import type { EPData } from './ep/EPShared';
import { EP_DEFAULTS } from './ep/EPShared';
import { getActiveProyectoId } from '../services/storageService';
import { loadEpDatos, saveEpDatos } from '../services/epService';
import PageNav from './PageNav';
import EPInputPage from './ep/EPInputPage';
import EPVerificationPage from './ep/EPVerificationPage';

const EPSchemePage = lazy(() => import('./ep/EPSchemePage'));

export default function PressureEquipmentDesign() {
  const [page, setPage] = useState(1);

  const [ep, setEP] = usePersistedState<EPData>('ep', EP_DEFAULTS, (saved) => ({
    ...EP_DEFAULTS,
    ...(saved as Partial<EPData>),
  }));

  // Hidratar desde la fuente de verdad (ep_datos_proyecto, 1:1 con el proyecto) al
  // montar — gana sobre el caché de localStorage ('ep', global); si no hay fila, se
  // mantienen los defaults/caché de la sesión.
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

  // Persistir a la BD debounced (1200 ms). No se guarda hasta que la hidratación
  // terminó, para no pisar la fila existente con defaults.
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
      {
        t: 'Esquema',
        icon: '/iconos_civilflow/diseno_redes/general/datos_de_entrada.webp',
        c: (
          <Suspense
            fallback={
              <div
                style={{
                  minHeight: 380,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--txt3)',
                }}
              >
                Cargando esquema 3D…
              </div>
            }
          >
            <EPSchemePage ep={ep} updEP={updEP} />
          </Suspense>
        ),
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
        total={4}
        color="var(--ep)"
        labels={[
          'Datos de entrada',
          'Cálculo hidráulico y potencia',
          'Diámetros y especificación',
          'Esquema',
        ]}
      />
      <div style={{ flex: 1, padding: 6, overflow: 'auto' }}>{pages[page - 1].c}</div>
    </div>
  );
}
