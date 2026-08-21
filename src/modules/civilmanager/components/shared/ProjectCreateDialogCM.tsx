import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCmProyecto } from '../../services/cmProyectosService';
import { devError } from '../../../../utils/devError';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProjectCreateDialogCM({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
        'CM-' +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        '-' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');
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
          Nuevo proyecto — Civil Manager
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
