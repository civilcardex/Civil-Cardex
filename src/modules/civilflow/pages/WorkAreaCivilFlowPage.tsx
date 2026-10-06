import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import WorkArea from '../components/WorkAreaCivilFlow';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { devError } from '../../../utils/devError';
import { ProjectContext, PROY_DEFAULTS, type Proyecto } from '../context/ProjectContext';
import { PlansContext } from '../context/PlansContext';
import { fetchProyectos } from '../services/projectsService';
import { loadProyectoData } from '../services/projectDataService';
import { clearLocalWorkspace } from '../services/workspaceReset';
import { clearAllPDFs } from '../services/idbStorage';
import { getActiveProyectoId, saveToStorage } from '../services/storageService';
import { ACTIVE_PROYECTO_ID_KEY, ACTIVE_NETS_KEY, PLANS_META_KEY } from '../constants/storage-keys';
import type { Piso, PlanMeta } from '../lib/shared/projectTypes';

const WorkAreaCivilFlowPage_S1: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const CARGANDO_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--txt2)',
  fontSize: 13,
};

/** Enlace legacy (id no-uuid): aviso centrado SIN workspace montado — abrir el activo
 *  en silencio haría dibujar al usuario en el proyecto equivocado. */
const ENLACE_LEGACY_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  height: '100%',
  padding: 24,
  textAlign: 'center',
};

const ENLACE_LEGACY_AVISO_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 16px',
  background: 'rgba(180, 83, 9, 0.15)',
  border: '1px solid rgba(217, 119, 6, 0.4)',
  borderRadius: 6,
  color: '#fbbf24',
  fontSize: 13,
  fontFamily: 'var(--body)',
};

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ruta /civilflowareatrabajo/:proyectoId? — deep-link con el id uuid del proyecto
 *  (cf_proyectos.id, paridad cm_proyectos). Sin id → redirect al uuid del activo. Con id
 *  distinto al activo → cambio de proyecto con el MISMO volcado de storage que ProfilePage +
 *  remontaje completo (window.location.replace): los contextos no están keyeados por proyecto
 *  y un remount suave dejaría estado del anterior en memoria (autosave cruzado). */
function WorkAreaCivilFlowPage() {
  usePageMeta(
    'Área de trabajo',
    'Área de trabajo de CivilCardex. Diseño de redes hidráulicas, sanitarias, gas, aguas lluvias y equipos a presión.',
  );
  const { proyectoId } = useParams<{ proyectoId?: string }>();
  const navigate = useNavigate();
  // wantsId crudo (parámetro tal cual llega): distingue "sin parámetro" de "parámetro
  // presente pero no-uuid" (id numérico legacy o basura).
  const wantsCrudo = proyectoId ?? null;
  const wantsId = wantsCrudo && ES_UUID.test(wantsCrudo) ? wantsCrudo : null;
  // Enlace con id no-uuid: el lookup num→uuid es imposible (la columna legacy_num fue
  // dropeada) — banner en vez de abrir el proyecto ACTIVO en silencio (el usuario dibujaría
  // creyendo estar en el proyecto del enlace viejo).
  const enlaceLegacy = wantsCrudo != null && wantsId == null;
  const projectCtx = useContext(ProjectContext);
  const plansCtx = useContext(PlansContext);
  // Switch pendiente evaluado EN RENDER: la URL ya apunta a otro proyecto — nunca montar
  // el workspace del proyecto viejo, aunque el efecto aún no haya arrancado.
  const switchPendiente = wantsId != null && wantsId !== getActiveProyectoId();
  const [switching, setSwitching] = useState(switchPendiente);
  const switchingRef = useRef(false);

  // SOLO sin parámetro: redirect al uuid del proyecto activo. Con parámetro presente NO se
  // redirige nunca al activo (uuid → switch de abajo; no-uuid → banner de enlace legacy):
  // redirigir abriría el proyecto equivocado sin aviso. Sin datos accesibles la página queda
  // funcional sin redirect (URL limpia es cosmética).
  // navigate SPA y NO window.location.replace: los botones internos (cerrar visor,
  // crear proyecto) llegan aquí con navigate('/civilflowareatrabajo') — un replace
  // recargaba TODO el navegador en pleno trabajo (recarga "de la nada"). El workspace
  // ya está vivo con el proyecto activo; solo se corrige la URL.
  useEffect(() => {
    if (proyectoId != null) return;
    const activeId = getActiveProyectoId();
    if (!activeId) return;
    let alive = true;
    void (async () => {
      try {
        const rows = await fetchProyectos();
        if (!alive) return;
        const found = rows.find((r) => r.id === activeId);
        if (found) navigate(`/civilflowareatrabajo/${found.id}`, { replace: true });
      } catch {
        /* cosmético: sin redirect */
      }
    })();
    return () => {
      alive = false;
    };
  }, [proyectoId, navigate]);

  useEffect(() => {
    if (wantsId == null || switchingRef.current) return;
    if (wantsId === getActiveProyectoId()) return;
    switchingRef.current = true;
    void (async () => {
      // Fuera del cuerpo síncrono del efecto (regla set-state-in-effect).
      await Promise.resolve();
      // Proyecto activo ANTES del switch: lo único que permite hacer rollback del puntero.
      const idAnterior = getActiveProyectoId();
      setSwitching(true);
      try {
        // Pausar PRIMERO (mismo orden que ProfilePage): los resets de abajo disparan los
        // efectos debounced de guardado — sin pausa vaciarían el proyecto en la nube.
        projectCtx?.pauseCloudSync();
        plansCtx?.pauseCloudSync();
        // Cargar ANTES de destruir: si el proyecto no existe o no es accesible, el
        // workspace actual debe quedar intacto (el catch recarga al proyecto previo).
        const data = await loadProyectoData(wantsId);
        if (!data) throw new Error('proyecto-no-encontrado-o-sin-acceso');
        clearLocalWorkspace();
        await clearAllPDFs();
        plansCtx?.resetPlans();
        projectCtx?.resetToDefaults();
        localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, wantsId);
        // Escritura vía saveToStorage (aplica el 2º prefijo civilflow_ que leen los
        // providers al montar — mismo contrato de hand-off documentado en ProfilePage).
        if (data?.pisos) saveToStorage('civilflow_pisos', data.pisos as Piso[]);
        const proyToSave =
          data?.proy && Object.keys(data.proy).length
            ? ({ ...PROY_DEFAULTS, ...(data.proy as Partial<Proyecto>) } as Proyecto)
            : PROY_DEFAULTS;
        saveToStorage('civilflow_proy', proyToSave);
        if (data?.mats && Object.keys(data.mats).length) saveToStorage('civilflow_mats', data.mats);
        if (data?.profs && data.profs.length) saveToStorage('civilflow_profs', data.profs);
        if (data?.crits && data.crits.length) saveToStorage('civilflow_crits', data.crits);
        if (data?.redesActivas && data.redesActivas.length)
          saveToStorage(ACTIVE_NETS_KEY, data.redesActivas);
        if (data?.plans_meta) saveToStorage(PLANS_META_KEY, data.plans_meta as PlanMeta[]);
        // Reload completo: providers re-nacen leyendo el storage recién volcado.
        window.location.replace(`/civilflowareatrabajo/${wantsId}`);
      } catch (e) {
        devError('abrir proyecto desde URL:', e);
        // Rollback: recarga completa — el workspace del proyecto previo ya no existe en
        // memoria (la destrucción pudo correr antes del fallo); los providers se re-nacen
        // con la recarga, un resume in situ dejaría un workspace vacío sin sync.
        if (idAnterior) localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, idAnterior);
        // Ruta limpia: el redirect al uuid del activo lo hace el efecto de entrada.
        window.location.replace(idAnterior ? '/civilflowareatrabajo' : '/perfil');
        return;
      }
    })();
    // El volcado corre una sola vez por id entrante; switchingRef evita re-entradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsId]);

  // Enlace con id no-uuid (numérico legacy): banner + link al perfil, SIN montar workspace.
  if (enlaceLegacy) {
    return (
      <main className="h-full" style={ENLACE_LEGACY_STYLE}>
        <h1 style={WorkAreaCivilFlowPage_S1}>Área de trabajo</h1>
        <div role="alert" style={ENLACE_LEGACY_AVISO_STYLE}>
          Este enlace corresponde a una versión antigua del proyecto — ábrelo desde tu lista de
          proyectos.
        </div>
        <Link to="/perfil" style={{ color: 'var(--acc, #4d8ff7)', fontSize: 13, fontWeight: 600 }}>
          Ir a mis proyectos
        </Link>
      </main>
    );
  }

  if (switchPendiente || switching) {
    return <div style={CARGANDO_STYLE}>Abriendo proyecto…</div>;
  }
  return (
    <main className="h-full">
      <h1 style={WorkAreaCivilFlowPage_S1}>Área de trabajo</h1>
      <WorkArea />
    </main>
  );
}

export default WorkAreaCivilFlowPage;
