import { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlansContext } from '../../context/PlansContext';
import { ProjectContext } from '../../context/ProjectContext';
import { createProyecto } from '../../services/proyectosService';
import { clearAllPDFs } from '../../services/idbStorage';
import { clearLocalWorkspace } from '../../services/workspaceReset';
import { saveToStorage } from '../../services/storageService';
import { devError } from '../../../../utils/devError';
import { ACTIVE_PROYECTO_ID_KEY } from '../../constants/storage-keys';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProjectCreateDialog({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const plansCtx = useContext(PlansContext);
  const projectCtx = useContext(ProjectContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [open]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const now = new Date();
      const codigo =
        'PR-' +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        '-' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
      const proyecto = await createProyecto(codigo, trimmed);
      if (!proyecto) {
        devError('Error creando proyecto');
        setCreating(false);
        return;
      }
      // Pausa los efectos de guardado en la nube (debounced) durante el reset de abajo — misma lógica que
      // ProfilePage.openProyecto (ver ProjectContext.pauseCloudSync).
      projectCtx?.pauseCloudSync();
      plansCtx?.pauseCloudSync();
      // El workspace local siempre empieza en blanco para un proyecto nuevo; los datos de Supabase
      // quedan aislados por proyecto_id, no hace falta borrar nada del lado del servidor.
      clearLocalWorkspace();
      await clearAllPDFs();
      // Marca este proyecto como activo para que trazos/plans/proyecto_data queden acotados a él
      localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, String(proyecto.id));
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          background: 'var(--surface-container, #1e1e24)',
          border: '1px solid var(--outline-variant, #3a3a44)',
          borderRadius: 8,
          padding: 24,
          minWidth: 360,
          maxWidth: 420,
          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--on-surface, #e2e2e8)',
            margin: '0 0 4px',
          }}
        >
          Nuevo proyecto
        </h3>
        <p
          style={{ fontSize: 12, color: 'var(--on-surface-variant, #9ba8aa)', margin: '0 0 16px' }}
        >
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
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 13,
            background: 'var(--surface-container-low, #141418)',
            border: '1px solid var(--outline-variant, #3a3a44)',
            borderRadius: 4,
            color: 'var(--on-surface, #e2e2e8)',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'Geist, monospace',
          }}
        />
        <style>{`.project-create-dialog-input:focus-visible { outline: 2px solid var(--color-accent, #4D8FF7); outline-offset: 2px; }`}</style>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              setName('');
            }}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              border: '1px solid var(--outline-variant, #3a3a44)',
              borderRadius: 4,
              color: 'var(--on-surface, #e2e2e8)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              background:
                !name.trim() || creating
                  ? 'var(--surface-container-low, #141418)'
                  : 'var(--primary, #4D8FF7)',
              border: 'none',
              borderRadius: 4,
              color:
                !name.trim() || creating
                  ? 'var(--on-surface-variant, #9ba8aa)'
                  : 'var(--on-primary, #fff)',
              cursor: !name.trim() || creating ? 'default' : 'pointer',
            }}
          >
            {creating ? 'Creando...' : 'Crear Proyecto'}
          </button>
        </div>
      </div>
    </div>
  );
}
