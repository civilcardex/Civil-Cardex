import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCmProyecto } from '../../services/cmProjectsService.ts';
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

/** Diálogo "Nuevo proyecto" del módulo CM (Civil Manager): nombre -> createCmProyecto y navegación al área de trabajo. Con suscripciones apagadas (VITE_SUSCRIPCIONES) entra directo, sin candado. */
export default function ProjectCreateDialogCM({ open, onClose }: Props) {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { activos, loading: subsLoading, bloqueando: subsBloqueando } = useSuscripciones();

  async function handleCreate(name: string) {
    if (!name || creating) return;
    setCreating(true);
    try {
      const codigo = codigoProyecto('CM');
      const proyecto = await createCmProyecto(codigo, name);
      if (!proyecto) {
        devError('Error creando proyecto CM');
        return;
      }
      localStorage.setItem('cm_proyecto_activo_id', proyecto.id);
      localStorage.setItem('cm_proyecto_activo_nombre', proyecto.nombre);
      onClose();
      requestAnimationFrame(() => navigate('/civilmanagerareatrabajo'));
    } catch (err) {
      devError('Error creando proyecto CM:', err);
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  // Candado de UX; el real es la política INSERT de cm_proyectos con
  // acceso_modulo(). Bloquea solo si VITE y el flag de BD están encendidos;
  // mientras cargan se deja pasar.
  if (subsBloqueando && !subsLoading && !activos.has('manage')) {
    return <SuscripcionInactivaModal modulo="CivilManager" onClose={onClose} />;
  }

  return (
    <NombreProyectoDialog
      open={open}
      titulo="Nuevo proyecto — Civil Manager"
      ariaLabel="Nuevo proyecto — Civil Manager"
      creating={creating}
      onCreate={(n) => void handleCreate(n)}
      onClose={onClose}
    />
  );
}
