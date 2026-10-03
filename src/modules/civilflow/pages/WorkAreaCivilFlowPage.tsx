import React, { useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import WorkArea from '../components/WorkAreaCivilFlow';
import { usePageMeta } from '../../../hooks/usePageMeta';
import { devError } from '../../../utils/devError';
import { ProjectContext, PROY_DEFAULTS, type Proyecto } from '../context/ProjectContext';
import { PlansContext } from '../context/PlansContext';
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

/** Ruta /civilflowareatrabajo/:proyectoId? — el id en la URL es deep-linkable (compartir,
 *  refrescar, back/forward). Sin id → redirect al activo. Con id distinto al activo →
 *  cambio de proyecto con el MISMO volcado de storage que ProfilePage + remontaje completo
 *  (window.location.replace): los contextos no están keyeados por proyecto y un remount
 *  suave dejaría estado del proyecto anterior en memoria (autosave cruzado). */
function WorkAreaCivilFlowPage() {
  usePageMeta(
    'Área de trabajo',
    'Área de trabajo de CivilCardex. Diseño de redes hidráulicas, sanitarias, gas, aguas lluvias y equipos a presión.',
  );
  const { proyectoId } = useParams<{ proyectoId?: string }>();
  const wantsId = proyectoId && /^\d+$/.test(proyectoId) ? Number(proyectoId) : null;
  const activeId = wantsId != null ? null : getActiveProyectoId();
  const projectCtx = useContext(ProjectContext);
  const plansCtx = useContext(PlansContext);
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);

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
        clearLocalWorkspace();
        await clearAllPDFs();
        plansCtx?.resetPlans();
        projectCtx?.resetToDefaults();
        localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, String(wantsId));
        const data = await loadProyectoData(wantsId);
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
        // Rollback: el switch fracasó — restaurar el proyecto activo anterior y re-activar
        // el guardado en la nube; sin esto el usuario edita en un workspace vacío que
        // jamás sube a BD (sync pausado) y el puntero activo quedó movido.
        if (idAnterior != null) localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, String(idAnterior));
        projectCtx?.resumeCloudSync();
        plansCtx?.resumeCloudSync();
        switchingRef.current = false;
        setSwitching(false);
      }
    })();
    // El volcado corre una sola vez por id entrante; switchingRef evita re-entradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsId]);

  if (wantsId == null && activeId) {
    return <Navigate to={`/civilflowareatrabajo/${activeId}`} replace />;
  }
  if (switching) {
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
