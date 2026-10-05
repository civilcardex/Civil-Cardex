import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import WorkAreaCivilManager from '../modules/civilmanager/WorkAreaCivilManager';
import { usePageMeta } from '../hooks/usePageMeta';
import { devError } from '../utils/devError';
import { fetchCmProyectos } from '../modules/civilmanager/services/cmProjectsService';

const WorkAreaCivilManagerPage_S1: React.CSSProperties = {
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

/** Ruta /civilmanagerareatrabajo/:proyectoId? — deep-link por proyecto (espejo de la ruta
 *  de flow). Sin id → redirect al activo. Con id distinto → actualizar las 2 claves CM y
 *  reload completo: WorkAreaCivilManager lee storage al montar y no está keyeado por id. */
function WorkAreaCivilManagerPage() {
  usePageMeta(
    'Área de trabajo CivilManager',
    'Presupuestos de obra civil: catálogos, análisis de precios unitarios (APU) y presupuestos con AIU.',
  );
  const { proyectoId } = useParams<{ proyectoId?: string }>();
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
        window.location.replace(`/civilmanagerareatrabajo/${proyectoId}`);
      } catch (e) {
        devError('abrir proyecto CM desde URL:', e);
        // Rollback: recarga completa — el workspace del proyecto previo solo existe
        // en storage tras restaurar el puntero; los providers se re-nacen con la recarga.
        if (idAnterior != null) localStorage.setItem('cm_proyecto_activo_id', idAnterior);
        window.location.replace(
          idAnterior != null ? `/civilmanagerareatrabajo/${idAnterior}` : '/perfil',
        );
      }
    })();
  }, [proyectoId, switching]);

  if (!proyectoId && activeId) {
    return <Navigate to={`/civilmanagerareatrabajo/${activeId}`} replace />;
  }
  if (switchPendiente || switching) {
    return <div style={CARGANDO_STYLE}>Abriendo proyecto…</div>;
  }
  return (
    <div className="h-full">
      <h1 style={WorkAreaCivilManagerPage_S1}>Área de trabajo CivilManager</h1>
      <WorkAreaCivilManager />
    </div>
  );
}

export default WorkAreaCivilManagerPage;
