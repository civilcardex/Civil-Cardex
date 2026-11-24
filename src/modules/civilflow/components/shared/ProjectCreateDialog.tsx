/** Diálogo de creación de proyecto (nombre, datos básicos): comparte lógica con el gating de
 *  suscripciones — sin módulo activo muestra el aviso pero la BD es el candado real. */
import { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { PlansContext } from '../../context/PlansContext.tsx';
import { ProjectContext } from '../../context/ProjectContext.tsx';
import { createProyecto } from '../../services/projectsService.ts';
import { clearAllPDFs } from '../../services/idbStorage.ts';
import { clearLocalWorkspace } from '../../services/workspaceReset.ts';
import { saveToStorage, setActiveProyectoId } from '../../services/storageService.ts';
import { devError } from '../../../../utils/devError.ts';
import { useSuscripciones } from '../../../../hooks/useSubscriptions.ts';
import { NombreProyectoDialog } from '../../../../components/shared/NombreProyectoDialog.tsx';
import SuscripcionInactivaModal, {
  codigoProyecto,
} from '../../../../components/shared/SubscriptionInactiveModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProjectCreateDialog({ open, onClose }: Props) {
  const [creating, setCreating] = useState(false);
  const plansCtx = useContext(PlansContext);
  const projectCtx = useContext(ProjectContext);
  const navigate = useNavigate();
  const { activos, loading: subsLoading, bloqueando: subsBloqueando } = useSuscripciones();

  async function handleCreate(trimmed: string) {
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const codigo = codigoProyecto('CF');
      const res = await createProyecto(codigo, trimmed);
      if (!res.ok) {
        devError('Error creando proyecto:', res.msg);
        // El candado real (BD) habla: distinguirlo del fallo genérico de red.
        alert(
          res.msg === 'suscripcion_requerida'
            ? 'Tu suscripción a este módulo está vencida — renuévala en Precios para crear proyectos.'
            : 'No se pudo crear el proyecto. Revisa tu conexión e inténtalo de nuevo.',
        );
        setCreating(false);
        return;
      }
      const proyecto = res.row;
      // Pausa los efectos de guardado en la nube (debounced) durante el reset de abajo — misma lógica que
      // ProfilePage.openProyecto (ver ProjectContext.pauseCloudSync).
      projectCtx?.pauseCloudSync();
      plansCtx?.pauseCloudSync();
      // El workspace local siempre empieza en blanco para un proyecto nuevo; los datos de Supabase
      // quedan aislados por proyecto_id, no hace falta borrar nada del lado del servidor.
      clearLocalWorkspace({ conservarRescates: true });
      await clearAllPDFs();
      // Marca este proyecto como activo (sesión + storage) para que trazos/plans/proyecto_data
      // queden acotados a él. La maquinaria interna (RPCs, claves) sigue numerada: proyecto_num.
      setActiveProyectoId(proyecto.id);
      // Los providers de contexto no están montados en la ruta de perfil (CivilFlowProviders está
      // acotado al área de trabajo), así que setP de abajo no hace nada ahí. Persiste el nombre
      // directamente — ProyectoProvider lo restaura desde esta clave al montarse, y el área de
      // trabajo lo muestra en el campo "Identificación del proyecto" de inmediato. Debe pasar por
      // saveToStorage (no por un localStorage.setItem crudo) — usePersistedState de ProyectoContext
      // ya pasa la clave prefijada 'civilflow_proy', y saveToStorage la prefija OTRA VEZ
      // internamente (civilflow_civilflow_proy), así que esa es la clave real que lee al montarse.
      saveToStorage('civilflow_proy', { nombre: trimmed });
      // Resetea también el estado React en memoria — limpiar solo localStorage no toca
      // el estado ya cargado en los providers de contexto (envuelven toda la app y
      // no se remontan al navegar).
      plansCtx?.resetPlans();
      projectCtx?.resetToDefaults();
      // Asigna el nombre del proyecto para que InfoTab lo muestre de inmediato
      projectCtx?.setP('nombre', trimmed);
      projectCtx?.resumeCloudSync();
      plansCtx?.resumeCloudSync();
      navigate('/civilflowareatrabajo');
    } catch (err) {
      devError('Error creando proyecto:', err);
      projectCtx?.resumeCloudSync();
      plansCtx?.resumeCloudSync();
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  // Candado de UX; el real es el check de suscripción dentro de save_proyecto.
  // Bloquea solo si VITE y el flag de BD están encendidos; mientras cargan se
  // deja pasar (la BD decide al final).
  if (subsBloqueando && !subsLoading && !activos.has('flow')) {
    return <SuscripcionInactivaModal modulo="CivilFlow" onClose={onClose} />;
  }

  return (
    <NombreProyectoDialog
      open={open}
      titulo="Nuevo proyecto"
      creating={creating}
      onCreate={(n) => void handleCreate(n)}
      onClose={onClose}
    />
  );
}
