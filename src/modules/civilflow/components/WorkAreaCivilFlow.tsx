import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkAreaState } from './useWorkAreaState';
import { prefetchAllTrazos } from '../utils/prefetchTrazos';
import { fetchProyectosOrThrow } from '../services/proyectosService';
import { getActiveProyectoId } from '../services/storageService';
import { ACTIVE_PROYECTO_ID_KEY } from '../constants/storage-keys';
import { WorkAreaSidebar } from './WorkAreaSidebar';
import WorkAreaContent from './WorkAreaContent';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { REDES } from '../constants';
const WorkAreaCivilFlow_S1: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '7px 12px',
  background: 'var(--bg2)',
  borderTop: '1px solid var(--line)',
  flexShrink: 0,
  overflowX: 'auto',
};
const WorkAreaCivilFlow_S6: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 11px',
  borderRadius: 'var(--r)',
  border: '1px solid',
  flexShrink: 0,
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'var(--body)',
  fontWeight: 600,
};

interface NetworkBarProps {
  redesActivas: (typeof REDES)[number][];
  tab: string;
  redActiva: string;
  setTab: (v: string) => void;
  setRedActiva: (v: string) => void;
}

function NetworkBar({ redesActivas, tab, redActiva, setTab, setRedActiva }: NetworkBarProps) {
  return (
    <div style={WorkAreaCivilFlow_S1}>
      {redesActivas.map((r) => {
        const active = tab === 'redes' && redActiva === r.id;
        const netColor = r.col || '#666';
        return (
          <button
            type="button"
            key={r.id}
            onClick={() => {
              setTab('redes');
              setRedActiva(r.id);
            }}
            style={{
              ...WorkAreaCivilFlow_S6,
              borderColor: active ? netColor : 'var(--line)',
              color: active ? netColor : 'var(--txt3)',
              background: active ? 'rgba(0,0,0,.15)' : 'transparent',
            }}
          >
            {r.icoImg ? (
              <img
                src={r.icoImg}
                alt=""
                width={22}
                height={22}
                style={{ width: 22, height: 22, verticalAlign: 'middle' }}
                loading="lazy"
              />
            ) : (
              <span style={{ fontSize: 16 }}>{r.ico}</span>
            )}
            <span>{r.lbl}</span>
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
    </div>
  );
}

function CivilFlowInner() {
  const state = useWorkAreaState();
  // null = sin decidir aún; true = hay proyecto activo o se auto-activó; false = no se pudo
  // (sin proyectos o fallo de red tras los reintentos) → banner visible. Init perezoso: con
  // proyecto activo no hay efecto que correr ni setState síncrono.
  const [proyectoResuelto, setProyectoResuelto] = useState<boolean | null>(() =>
    getActiveProyectoId() ? true : null,
  );

  // Validación/auto-activación del proyecto: la clave `civilflow_active_proyecto_id` puede
  // quedar apuntando a un proyecto BORRADO (cascada de cf_planos) — entonces TODOS los
  // guardados de la nube fallan con no_autorizado en silencio y el dibujo solo vive en
  // localStorage. Reglas: id válido → ok; id muerto o ausente → limpiar y auto-activar si el
  // usuario tiene exactamente uno; con varios/ninguno/BD caída → banner en vez de silencio.
  // La sesión de Supabase puede tardar en restaurarse al montar: reintentar unos segundos.
  useEffect(() => {
    let ignore = false;
    let intentos = 0;
    const intentar = async () => {
      intentos += 1;
      try {
        const proyectos = await fetchProyectosOrThrow();
        if (ignore) return;
        const activo = getActiveProyectoId();
        const activoVivo = activo != null && proyectos.some((p) => String(p.id) === String(activo));
        if (activoVivo) {
          setProyectoResuelto(true);
          return;
        }
        if (activo != null) localStorage.removeItem(ACTIVE_PROYECTO_ID_KEY);
        if (proyectos.length === 1) {
          localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, String(proyectos[0].id));
          window.location.reload();
          return;
        }
        setProyectoResuelto(false);
      } catch {
        if (!ignore && intentos < 10) setTimeout(intentar, 1000);
        else setProyectoResuelto(false);
      }
    };
    intentar();
    return () => {
      ignore = true;
    };
  }, []);

  // Prefetch global de trazos (orig. usuario): las tablas muestran todos los pisos sin
  // necesidad de abrir el visor 2D piso por piso. Trae de la BD lo que falte en caché local,
  // migra asociaciones y re-escribe las claves de sync (los eventos refrescan TramosContext).
  useEffect(() => {
    if (!state.plans?.length) return;
    void prefetchAllTrazos(state.plans);
  }, [state.plans]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {proyectoResuelto === false && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 14px',
            background: 'rgba(180, 83, 9, 0.15)',
            borderBottom: '1px solid rgba(217, 119, 6, 0.4)',
            color: '#fbbf24',
            fontSize: 12,
            fontFamily: 'var(--body)',
            flexShrink: 0,
          }}
        >
          <span>Sin proyecto activo: el área está vacía y no se guarda nada en la nube.</span>
          <Link to="/perfil" style={{ color: '#f59e0b', fontWeight: 600, flexShrink: 0 }}>
            Selecciona un proyecto en Perfil
          </Link>
        </div>
      )}
      <div className="app" style={{ flex: 1, minHeight: 0 }}>
        <WorkAreaSidebar tab={state.tab} setTab={state.setTab} />
        <div className="layout">
          <div className="content" style={{ padding: state.tab === 'planos' ? 0 : undefined }}>
            <WorkAreaContent state={state} />
          </div>
        </div>
      </div>
      <NetworkBar
        redesActivas={state.redesActivas}
        tab={state.tab}
        redActiva={state.redActiva}
        setTab={state.setTab}
        setRedActiva={state.setRedActiva}
      />
    </div>
  );
}

export default function CivilFlow() {
  return (
    <ErrorBoundary>
      <CivilFlowInner />
    </ErrorBoundary>
  );
}
