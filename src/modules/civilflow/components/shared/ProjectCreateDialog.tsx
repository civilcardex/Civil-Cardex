/** Diálogo de creación de proyecto (nombre, datos básicos): comparte lógica con el gating de
 *  suscripciones — sin módulo activo muestra el aviso pero la BD es el candado real. */
import { useState, useContext, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { PlansContext } from '../../context/PlansContext.tsx';
import { ProjectContext } from '../../context/ProjectContext.tsx';
import { createProyecto } from '../../services/projectsService.ts';
import { clearAllPDFs } from '../../services/idbStorage.ts';
import { clearLocalWorkspace } from '../../services/workspaceReset.ts';
import { saveToStorage, setActiveProyectoId } from '../../services/storageService.ts';
import { devError } from '../../../../utils/devError.ts';
import { useSuscripciones } from '../../../../hooks/useSubscriptions.ts';
import { ModalShell } from '../../../../components/shared/ModalShell.tsx';
import { NORMAS_PAIS } from '../../constants/countryStandards.ts';
import { USOS } from '../../constants/uiConfig.ts';
import SuscripcionInactivaModal, {
  codigoProyecto,
} from '../../../../components/shared/SubscriptionInactiveModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FIELD_ERRORS = {
  nombre: 'Escribe el nombre del proyecto.',
  pais: 'Selecciona un país para continuar.',
  uso: 'Selecciona un tipo de uso para continuar.',
} as const;
type ProjectField = keyof typeof FIELD_ERRORS;

export default function ProjectCreateDialog({ open, onClose }: Props) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProjectField, boolean>>>({});
  const plansCtx = useContext(PlansContext);
  const projectCtx = useContext(ProjectContext);
  const navigate = useNavigate();
  const { activos, loading: subsLoading, bloqueando: subsBloqueando } = useSuscripciones();

  function closeDialog() {
    if (creating) return;
    setError('');
    setFieldErrors({});
    onClose();
  }

  function fieldFeedback(field: ProjectField, id: string) {
    return {
      'aria-invalid': fieldErrors[field] ?? false,
      'aria-describedby': fieldErrors[field] ? `${id}-error` : undefined,
      onChange: () => {
        if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: false }));
      },
    };
  }

  function fieldMessage(field: ProjectField, id: string) {
    return fieldErrors[field] ? (
      <p id={`${id}-error`} className="cf-form-error cf-field-error">
        {FIELD_ERRORS[field]}
      </p>
    ) : null;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const trimmed = String(fields.get('nombre') ?? '').trim();
    const pais = String(fields.get('pais') ?? '');
    const uso = String(fields.get('uso') ?? '');
    const invalidFields = {
      nombre: !trimmed,
      pais: !NORMAS_PAIS.some((p) => p.nombre === pais),
      uso: !USOS.includes(uso),
    };
    const firstInvalid = (Object.keys(invalidFields) as ProjectField[]).find(
      (field) => invalidFields[field],
    );
    if (firstInvalid) {
      // El aviso debe existir antes de enfocar el campo, para que se lea junto a su etiqueta.
      flushSync(() => {
        setError('');
        setFieldErrors(invalidFields);
      });
      const control = form.elements.namedItem(firstInvalid);
      if (control instanceof HTMLElement) control.focus();
      return;
    }
    setError('');
    setCreating(true);
    try {
      const codigo = codigoProyecto('CF');
      const res = await createProyecto(codigo, trimmed, pais, uso);
      if (!res.ok) {
        devError('Error creando proyecto:', res.msg);
        // El candado real (BD) habla: distinguirlo del fallo genérico de red.
        setError(
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
      saveToStorage('civilflow_proy', { nombre: trimmed, pais, uso });
      // Resetea también el estado React en memoria — limpiar solo localStorage no toca
      // el estado ya cargado en los providers de contexto (envuelven toda la app y
      // no se remontan al navegar).
      plansCtx?.resetPlans();
      projectCtx?.resetToDefaults();
      // Asigna el nombre del proyecto para que InfoTab lo muestre de inmediato
      projectCtx?.setP('nombre', trimmed);
      projectCtx?.setP('pais', pais);
      projectCtx?.setP('uso', uso);
      projectCtx?.resumeCloudSync();
      plansCtx?.resumeCloudSync();
      navigate('/civilflowareatrabajo');
    } catch (err) {
      devError('Error creando proyecto:', err);
      setError('No se pudo abrir el proyecto. Revisa si aparece en tu perfil.');
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
    <ModalShell
      ariaLabel="Nuevo proyecto"
      onClose={closeDialog}
      dismissOnBackdrop={false}
      nativeInitialFocus
    >
      <form noValidate onSubmit={(event) => void handleCreate(event)} className="cf-new-project">
        <h3 className="dialog-title">Nuevo proyecto</h3>
        <p className="dialog-lead">Completa los tres campos para configurar el proyecto.</p>
        <label htmlFor="cf-new-name">Nombre del proyecto</label>
        <input
          id="cf-new-name"
          name="nombre"
          className="project-create-dialog-input"
          required
          maxLength={200}
          readOnly={creating}
          {...fieldFeedback('nombre', 'cf-new-name')}
        />
        {fieldMessage('nombre', 'cf-new-name')}
        <label htmlFor="cf-new-country">País</label>
        <select
          id="cf-new-country"
          name="pais"
          required
          defaultValue=""
          disabled={creating}
          {...fieldFeedback('pais', 'cf-new-country')}
        >
          <option value="" disabled>
            Selecciona un país
          </option>
          {NORMAS_PAIS.map((p) => (
            <option key={p.id}>{p.nombre}</option>
          ))}
        </select>
        {fieldMessage('pais', 'cf-new-country')}
        <label htmlFor="cf-new-use">Tipo de uso</label>
        <select
          id="cf-new-use"
          name="uso"
          required
          defaultValue=""
          disabled={creating}
          {...fieldFeedback('uso', 'cf-new-use')}
        >
          <option value="" disabled>
            Selecciona un tipo de uso
          </option>
          {USOS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        {fieldMessage('uso', 'cf-new-use')}
        {error && (
          <p role="alert" className="cf-form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            disabled={creating}
            onClick={closeDialog}
            className="dialog-btn dialog-btn-ghost"
          >
            Cancelar
          </button>
          <button type="submit" disabled={creating} className="dialog-btn dialog-btn-primary">
            {creating ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
