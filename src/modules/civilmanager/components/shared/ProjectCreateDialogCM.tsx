import { ModalShell } from '../../../../components/shared/ModalShell.tsx';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCmProyecto } from '../../services/cmProjectsService.ts';
import { devError } from '../../../../utils/devError.ts';
import { useSuscripciones } from '../../../../hooks/useSubscriptions.ts';
import SuscripcionInactivaModal, {
  codigoProyecto,
} from '../../../../components/shared/SubscriptionInactiveModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Diálogo "Nuevo proyecto" del módulo CM (Civil Manager): nombre -> createCmProyecto y navegación al área de trabajo. Con suscripciones apagadas (VITE_SUSCRIPCIONES) entra directo, sin candado. */
export default function ProjectCreateDialogCM({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { activos, loading: subsLoading, bloqueando: subsBloqueando } = useSuscripciones();

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [open]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const codigo = codigoProyecto('CM');
      const proyecto = await createCmProyecto(codigo, trimmed);
      if (!proyecto) {
        devError('Error creando proyecto CM');
        setCreating(false);
        return;
      }
      localStorage.setItem('cm_proyecto_activo_id', proyecto.id);
      localStorage.setItem('cm_proyecto_activo_nombre', proyecto.nombre);
      onClose();
      setName('');
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
    <ModalShell ariaLabel="Nuevo proyecto — Civil Manager">
      <h3 className="dialog-title">Nuevo proyecto — Civil Manager</h3>
      <p className="dialog-lead">
        Ingresa el nombre del proyecto. Se generará un código automático.
      </p>
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate();
          if (e.key === 'Escape') {
            onClose();
            setName('');
          }
        }}
        placeholder="Nombre del proyecto"
        aria-label="Nombre del proyecto"
        className="project-create-dialog-input"
      />
      <div className="dialog-actions">
        <button
          type="button"
          onClick={() => {
            onClose();
            setName('');
          }}
          className="dialog-btn dialog-btn-ghost"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          className="dialog-btn dialog-btn-primary"
        >
          {creating ? 'Creando...' : 'Crear Proyecto'}
        </button>
      </div>
    </ModalShell>
  );
}
