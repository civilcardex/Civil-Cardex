import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import WorkAreaCivilManager from '../modules/civilmanager/WorkAreaCivilManager.tsx';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { parseManagerSplat } from '../modules/civilflow/components/workarea/tabRoute.ts';
import { devError } from '../utils/devError.ts';
import { marcarNavInterna } from '../utils/internalNavigation.ts';
import { fetchCmProyectoById } from '../modules/civilmanager/services/cmProjectsService.ts';
import { CargandoProyecto } from '../modules/civilflow/components/shared/LoadingProject';

// Reutilizada por <CargandoProyecto> (el loader compartido de la app).

/** Ruta /civilmanagerareatrabajo/:proyectoId? — deep-link por proyecto (espejo de la ruta de flow). Sin id → redirect al activo. */
function WorkAreaCivilManagerPage() {
  usePageMeta(
    'Área de trabajo CivilManager',
    'Presupuestos de obra civil: catálogos, análisis de precios unitarios (APU) y presupuestos con AIU.',
  );
  const { '*': splat } = useParams<{ '*': string }>();
  const { proyectoId, seccion, catalogoTab } = parseManagerSplat(splat);
  const cola = seccion ? (catalogoTab ? `/${seccion}/${catalogoTab}` : `/${seccion}`) : '';
  const idActivo = localStorage.getItem('cm_proyecto_activo_id');
  const activeId = !proyectoId ? idActivo : null;
  // Switch pendiente evaluado EN RENDER: la URL ya apunta a otro proyecto — nunca montar
  // el workspace del proyecto viejo, aunque el efecto aún no haya arrancado.
  const switchPendiente = proyectoId != null && proyectoId !== idActivo;
  const [failedSwitch, setFailedSwitch] = useState<{ id: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!proyectoId || !switchPendiente) return;
    let cancelled = false;
    void (async () => {
      try {
        const project = await fetchCmProyectoById(proyectoId);
        if (cancelled) return;
        if (!project) {
          setFailedSwitch({ id: proyectoId, message: 'Proyecto no encontrado o sin acceso.' });
          return;
        }
        localStorage.setItem('cm_proyecto_activo_id', proyectoId);
        localStorage.setItem('cm_proyecto_activo_nombre', project.nombre);
        marcarNavInterna();
        window.location.replace(`/civilmanagerareatrabajo/${proyectoId}${cola}`);
      } catch (e) {
        if (!cancelled) {
          devError('abrir proyecto CM desde URL:', e);
          setFailedSwitch({ id: proyectoId, message: 'No se pudo consultar el proyecto.' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proyectoId, switchPendiente, cola, retry]);

  if (!proyectoId && activeId) {
    return <Navigate to={`/civilmanagerareatrabajo/${activeId}${cola}`} replace />;
  }
  // Misma pantalla que el resto de la app (CargandoProyecto) para no encadenar dos al abrir.
  if (switchPendiente && failedSwitch && failedSwitch.id === proyectoId) {
    return (
      <div className="cm-stub">
        <p role="alert">{failedSwitch.message}</p>
        <button
          type="button"
          className="cm-btn"
          onClick={() => {
            setFailedSwitch(null);
            setRetry((value) => value + 1);
          }}
        >
          Reintentar
        </button>{' '}
        <Link to="/perfil">Volver al perfil</Link>
      </div>
    );
  }
  if (switchPendiente) {
    return <CargandoProyecto />;
  }
  return (
    <div className="h-full">
      <h1 className="sr-only">Área de trabajo CivilManager</h1>
      <WorkAreaCivilManager />
    </div>
  );
}

export default WorkAreaCivilManagerPage;
