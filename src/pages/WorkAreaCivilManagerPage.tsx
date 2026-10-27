import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import WorkAreaCivilManager from '../modules/civilmanager/WorkAreaCivilManager.tsx';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import { parseManagerSplat } from '../modules/civilflow/components/workarea/tabRoute.ts';
import { devError } from '../utils/devError.ts';
import { marcarNavInterna } from '../utils/internalNavigation.ts';
import { fetchCmProyectos } from '../modules/civilmanager/services/cmProjectsService.ts';
import { CargandoProyecto } from '../modules/civilflow/components/shared/LoadingProject';

import { SR_ONLY_STYLE } from '../components/shared/sharedStyles.ts';
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
  const [switching, setSwitching] = useState(switchPendiente);
  const switchingRef = useRef(false);

  useEffect(() => {
    if (!proyectoId || switchingRef.current) return;
    if (proyectoId === localStorage.getItem('cm_proyecto_activo_id')) return;
    switchingRef.current = true;
    void (async () => {
      // Fuera del cuerpo síncrono del efecto (regla set-state-in-effect).
      await Promise.resolve();
      // Puntero ANTES del switch: lo único que permite hacer rollback.
      const idAnterior = localStorage.getItem('cm_proyecto_activo_id');
      setSwitching(true);
      try {
        const rows = await fetchCmProyectos();
        // Validar ANTES de mover el puntero: RLS filtra proyectos ajenos o sin acceso —
        // un id ausente de rows (o fetch fallido, devuelve []) no debe robar el activo.
        if (!rows.some((r) => r.id === proyectoId)) {
          throw new Error('proyecto-no-encontrado-o-sin-acceso');
        }
        const nombre = rows.find((r) => r.id === proyectoId)?.nombre || '';
        localStorage.setItem('cm_proyecto_activo_id', proyectoId);
        localStorage.setItem('cm_proyecto_activo_nombre', nombre);
        marcarNavInterna();
        window.location.replace(`/civilmanagerareatrabajo/${proyectoId}${cola}`);
      } catch (e) {
        devError('abrir proyecto CM desde URL:', e);
        // Rollback: recarga completa — el workspace del proyecto previo solo existe
        // en storage tras restaurar el puntero; los providers se re-nacen con la recarga.
        if (idAnterior != null) localStorage.setItem('cm_proyecto_activo_id', idAnterior);
        marcarNavInterna();
        window.location.replace(
          idAnterior != null ? `/civilmanagerareatrabajo/${idAnterior}${cola}` : '/perfil',
        );
      }
    })();
  }, [proyectoId, switching, cola]);

  if (!proyectoId && activeId) {
    return <Navigate to={`/civilmanagerareatrabajo/${activeId}${cola}`} replace />;
  }
  // Misma pantalla que el resto de la app (CargandoProyecto) para no encadenar dos al abrir.
  if (switchPendiente || switching) {
    return <CargandoProyecto />;
  }
  return (
    <div className="h-full">
      <h1 style={SR_ONLY_STYLE}>Área de trabajo CivilManager</h1>
      <WorkAreaCivilManager />
    </div>
  );
}

export default WorkAreaCivilManagerPage;
