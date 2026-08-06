import React, { useEffect, useState, useRef, useContext } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import { devError } from '../../utils/devError';
import { useAuth } from '../../context/AuthContext';
import {
  ProjectContext,
  PROY_DEFAULTS,
  type Proyecto,
} from '../../modules/civilflow/context/ProjectContext';
import type { Piso } from '../../modules/civilflow/components/useWorkAreaState';
import { PlansContext } from '../../modules/civilflow/context/PlansContext';
import type { PlanMeta } from '../../modules/civilflow/lib/shared/projectTypes';
import {
  fetchProyectos,
  deleteProyecto,
  type ProyectoRow,
} from '../../modules/civilflow/services/proyectosService';
import { loadProyectoData } from '../../modules/civilflow/services/proyectoDataService';
import { downloadPlanPDF } from '../../modules/civilflow/services/pdfStorageService';
import { storePDF, clearAllPDFs } from '../../modules/civilflow/services/idbStorage';
import { clearLocalWorkspace } from '../../modules/civilflow/services/workspaceReset';
import { saveToStorage } from '../../modules/civilflow/services/storageService';
import ProjectCreateDialog from '../../modules/civilflow/components/shared/ProjectCreateDialog';
import {
  ACTIVE_PROYECTO_ID_KEY,
  ACTIVE_NETS_KEY,
  PLANS_META_KEY,
} from '../../modules/civilflow/constants/storage-keys';

const campos = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'profesion', label: 'Profesión' },
  { key: 'matricula', label: 'Matrícula Profesional' },
  { key: 'telefono', label: 'Teléfono' },
];

function ProfilePage() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState({
    nombre: '',
    apellido: '',
    profesion: '',
    matricula: '',
    telefono: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [proyectosOpen, setProyectosOpen] = useState(false);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [proyLoading, setProyLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const projectCtx = useContext(ProjectContext);
  const plansCtx = useContext(PlansContext);

  async function openProyecto(proy: ProyectoRow) {
    if (openingId != null) return;
    setOpeningId(proy.id);
    try {
      // Local workspace always starts blank before loading the selected project —
      // clearing localStorage alone doesn't touch state already sitting in the context
      // providers (they wrap the whole app and don't remount on navigation).
      // Pause the debounced cloud-save effects before resetting — otherwise the reset's
      // transient empty state gets written to Supabase (wiping the project) before the
      // manual restore below has a chance to run, since it's separated from the reset by
      // an await and therefore lands in its own render commit.
      projectCtx?.pauseCloudSync();
      plansCtx?.pauseCloudSync();
      clearLocalWorkspace();
      await clearAllPDFs();
      plansCtx?.resetPlans();
      projectCtx?.resetToDefaults();
      localStorage.setItem(ACTIVE_PROYECTO_ID_KEY, String(proy.id));

      const data = await loadProyectoData(proy.id);

      // The context setters below (setPisos/setProyAll/setMats/.../restorePlans) are no-ops
      // on this route — CivilFlowProviders only wraps /civilflowareatrabajo, so projectCtx and
      // plansCtx are both null here. The real hand-off to the work area is via localStorage:
      // ProyectoProvider/PisosProvider/etc each read their own key on mount via
      // usePersistedState, which internally prefixes the key AGAIN (usePersistedState is
      // already called with the prefixed 'civilflow_proy'/'civilflow_pisos'/etc), so the actual
      // storage key is the DOUBLED civilflow_civilflow_proy — must go through saveToStorage
      // (which applies that same second prefix), never a raw localStorage.setItem, or the
      // write lands on a key nobody reads.
      if (data) {
        if (data.pisos) saveToStorage('civilflow_pisos', data.pisos as Piso[]);
        const proyToSave =
          data.proy && Object.keys(data.proy).length
            ? { ...PROY_DEFAULTS, ...(data.proy as Partial<Proyecto>) }
            : { ...PROY_DEFAULTS, nombre: proy.nombre };
        saveToStorage('civilflow_proy', proyToSave);
        if (data.mats && Object.keys(data.mats).length) saveToStorage('civilflow_mats', data.mats);
        if (data.profs && data.profs.length) saveToStorage('civilflow_profs', data.profs);
        if (data.crits && data.crits.length) saveToStorage('civilflow_crits', data.crits);
        if (data.redesActivas && data.redesActivas.length)
          saveToStorage(ACTIVE_NETS_KEY, data.redesActivas);
      } else {
        // No saved data yet for this project (created before this feature, or never
        // touched) — at least show the right name instead of the reset default.
        saveToStorage('civilflow_proy', { ...PROY_DEFAULTS, nombre: proy.nombre });
      }

      const plansMeta = (data?.plans_meta as PlanMeta[]) || [];
      const restoredMeta: PlanMeta[] = [];
      for (const m of plansMeta) {
        const file = await downloadPlanPDF(proy.id, m.id, m.name || `plano_${m.id}.pdf`);
        if (file) {
          await storePDF(m.id, file);
          restoredMeta.push(m);
        }
      }
      if (restoredMeta.length > 0) saveToStorage(PLANS_META_KEY, restoredMeta);

      navigate('/civilflowareatrabajo');
    } catch (err) {
      devError('Error abriendo proyecto:', err);
    } finally {
      projectCtx?.resumeCloudSync();
      plansCtx?.resumeCloudSync();
      setOpeningId(null);
    }
  }

  usePageMeta(
    'Perfil',
    'Gestione su perfil de CivilCardex: datos personales, proyectos activos y configuración de cuenta de ingeniería.',
  );
  // Fetch-on-mount from Supabase — a legitimate external-system sync, not state
  // derivable from props/state already available during render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let ignore = false;
    async function fetchPerfil() {
      if (!supabase || !user) {
        setLoading(false);
        return;
      }
      try {
        userIdRef.current = user.id;
        const { data, error } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (ignore) return;
        if (error) {
          devError('Error cargando perfil:', error.message);
          return;
        }
        if (data) {
          setPerfil({
            nombre: data.nombre || '',
            apellido: data.apellido || '',
            profesion: data.profesion || '',
            matricula: data.matricula || '',
            telefono: data.telefono || '',
          });
        }
      } catch (err) {
        if (!ignore) devError('Error:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchPerfil();
    return () => {
      ignore = true;
    };
  }, [user]);
  // Fetch-on-mount from Supabase — loads as soon as the profile page opens, not when the
  // "Proyectos" accordion is expanded, so the list is already there (no loading flash) by the
  // time the user clicks to expand it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let ignore = false;
    async function loadProyectos() {
      setProyLoading(true);
      try {
        const data = await fetchProyectos();
        if (!ignore) setProyectos(data);
      } finally {
        if (!ignore) setProyLoading(false);
      }
    }
    loadProyectos();
    return () => {
      ignore = true;
    };
  }, []);

  function handleEditStart(field: string) {
    setEditField(field);
    setEditValue((perfil as Record<string, string>)[field] || '');
  }

  function handleEditCancel() {
    setEditField(null);
    setEditValue('');
  }

  async function handleEditSave(field: string) {
    if (editValue === (perfil as Record<string, string>)[field]) {
      handleEditCancel();
      return;
    }
    setSaving(field);
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ [field]: editValue })
        .eq('id', userIdRef.current);
      if (error) {
        devError('Error guardando:', error.message);
        return;
      }
      setPerfil((prev) => ({ ...prev, [field]: editValue }));
    } catch (err) {
      devError('Error:', err);
    } finally {
      setSaving(null);
      setEditField(null);
      setEditValue('');
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent, field: string) {
    if (e.key === 'Enter') handleEditSave(field);
    if (e.key === 'Escape') handleEditCancel();
  }

  async function handleDeleteProject(id: number) {
    const ok = await deleteProyecto(id);
    if (ok) {
      setProyectos((prev) => prev.filter((p) => p.id !== id));
    } else {
      devError('Error eliminando proyecto');
    }
    setDeleteConfirm(null);
  }

  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-on-surface-variant text-sm">Cargando perfil...</span>
      </div>
    );
  }

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: nombreCompleto || 'Usuario',
    jobTitle: perfil.profesion || undefined,
    identifier: perfil.matricula || undefined,
    telephone: perfil.telefono || undefined,
    email: user?.email || undefined,
  };

  return (
    <div className="space-y-6">
      <script type="application/ld+json">{JSON.stringify(personJsonLd)}</script>
      <ProjectCreateDialog open={showCreate} onClose={() => setShowCreate(false)} />
      {deleteConfirm != null && (
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
              Eliminar Proyecto
            </h3>
            <p
              style={{
                fontSize: 12,
                color: 'var(--on-surface-variant, #9ba8aa)',
                margin: '0 0 16px',
              }}
            >
              ¿Estás seguro de eliminar este proyecto? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
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
                onClick={() => handleDeleteProject(deleteConfirm)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--error, #ff4444)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="border border-outline-variant bg-surface-container p-6">
        <div>
          <h1 className="text-headline-md font-bold text-on-surface">
            {nombreCompleto || 'Sin nombre'}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {perfil.profesion || 'Profesión no definida'}
          </p>
          {perfil.matricula && (
            <div className="flex items-center gap-2 mt-3">
              <span className="px-2 py-1 text-[11px] font-bold tracking-wider uppercase bg-secondary text-on-secondary-container border border-outline-variant">
                {perfil.matricula}
              </span>
            </div>
          )}
        </div>
      </header>

      <section
        aria-labelledby="info-personal-heading"
        className="border border-outline-variant bg-surface-container p-6"
      >
        <h2
          id="info-personal-heading"
          className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant mb-4"
        >
          Información Personal
        </h2>
        <ul className="grid grid-cols-2 gap-4" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <li className="border-l-2 border-primary pl-3 py-2">
            <span className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant block mb-1">
              Correo Electrónico
            </span>
            <span className="text-[13px] text-on-surface font-medium">{user?.email || '—'}</span>
          </li>
          {campos.map(({ key, label }) => (
            <li key={key} className="border-l-2 border-primary pl-3 py-2 group">
              <span className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant block mb-1">
                {label}
              </span>
              {editField === key ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    aria-label={label}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, key)}
                    // autoFocus intencional: al entrar en modo edición inline el foco debe caer en
                    // el input editado, no quedarse en el botón que lo abrió.
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    className="flex-1 h-8 px-2 border text-sm bg-surface-container-low text-on-surface focus:outline-none"
                    style={{ borderColor: 'var(--primary)', fontFamily: 'var(--mono)' }}
                  />
                  <button
                    type="button"
                    aria-label="Guardar"
                    onClick={() => handleEditSave(key)}
                    disabled={saving === key}
                    className="h-8 w-8 flex items-center justify-center bg-primary text-on-primary text-sm"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar edición"
                    onClick={handleEditCancel}
                    className="h-8 w-8 flex items-center justify-center border border-outline-variant text-on-surface-variant text-sm hover:text-error"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors bg-transparent border-0 p-0 text-left font-inherit w-full"
                  onClick={() => handleEditStart(key)}
                >
                  <span className="text-[13px] text-on-surface font-medium">
                    {(perfil as Record<string, string>)[key] || (
                      <span className="text-on-surface-variant italic opacity-50">
                        Click para editar
                      </span>
                    )}
                  </span>
                  <span className="material-symbols-outlined text-xs text-on-surface-variant opacity-0 group-hover:opacity-60 transition-opacity">
                    edit
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="proyectos-heading"
        className="border border-outline-variant bg-surface-container"
      >
        <button
          type="button"
          onClick={() => setProyectosOpen((prev) => !prev)}
          aria-expanded={proyectosOpen}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">folder_open</span>
            <div>
              <h2
                id="proyectos-heading"
                className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant"
              >
                Proyectos
              </h2>
              <span className="text-[13px] text-on-surface font-medium">
                {proyectos.length} proyectos
              </span>
            </div>
          </div>
          <span
            className={`material-symbols-outlined text-on-surface-variant transition-transform ${proyectosOpen ? 'rotate-180' : ''}`}
          >
            expand_more
          </span>
        </button>

        {proyectosOpen && (
          <div className="border-t border-outline-variant">
            <div className="px-6 py-3 border-b border-outline-variant bg-surface-container-low">
              <button
                type="button"
                className="flex items-center gap-2 text-primary hover:text-primary-fixed text-[13px] font-medium transition-colors"
                onClick={() => setShowCreate(true)}
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Nuevo proyecto
              </button>
            </div>

            {proyLoading ? (
              <div className="px-6 py-8 text-center text-on-surface-variant text-sm">
                Cargando proyectos...
              </div>
            ) : proyectos.length === 0 ? (
              <div className="px-6 py-8 text-center text-on-surface-variant text-sm">
                Aún no hay proyectos. Crea uno desde "Nuevo proyecto".
              </div>
            ) : (
              <ul
                className="divide-y divide-outline-variant"
                style={{ listStyle: 'none', margin: 0, padding: 0 }}
              >
                {proyectos.map((proy) => (
                  <li
                    key={proy.id}
                    className="px-6 py-3 flex items-center gap-4 hover:bg-surface-container-low transition-colors"
                  >
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={`Abrir proyecto ${proy.nombre}`}
                      onClick={() => openProyecto(proy)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openProyecto(proy);
                        }
                      }}
                      style={{ opacity: openingId != null && openingId !== proy.id ? 0.5 : 1 }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-bold font-mono text-on-surface">
                          {proy.codigo}
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant truncate">
                        {openingId === proy.id ? 'Abriendo proyecto...' : proy.nombre}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(proy.id);
                      }}
                      aria-label="Eliminar proyecto"
                      disabled={openingId != null}
                      style={{
                        background: 'none',
                        border: '1px solid var(--outline-variant, #3a3a44)',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: openingId != null ? 'default' : 'pointer',
                        color: 'var(--text-error, #ff4444)',
                        fontSize: 11,
                      }}
                    >
                      Eliminar
                    </button>
                    <span
                      className="material-symbols-outlined text-on-surface-variant text-lg cursor-pointer"
                      aria-hidden="true"
                      onClick={() => openProyecto(proy)}
                    >
                      arrow_forward
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <div className="border border-outline-variant bg-surface-container p-6 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            if (!supabase) return;
            await supabase.auth.signOut();
            navigate('/');
          }}
          className="px-5 py-2 text-xs font-bold tracking-widest uppercase border border-error text-error hover:bg-error hover:text-on-error transition-all"
          style={{ fontFamily: 'Geist, monospace' }}
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;
