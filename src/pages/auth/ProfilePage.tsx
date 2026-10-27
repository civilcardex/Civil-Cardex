import React, { useEffect, useState, useRef, useContext } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta.ts';
import { devError } from '../../utils/devError.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { ProjectContext } from '../../modules/civilflow/context/ProjectContext.tsx';
import { PlansContext } from '../../modules/civilflow/context/PlansContext.tsx';
import {
  fetchProyectos,
  deleteProyecto,
  type ProyectoRow,
} from '../../modules/civilflow/services/projectsService.ts';
import {
  fetchCmProyectos,
  deleteCmProyecto,
  type CmProyectoRow,
} from '../../modules/civilmanager/services/cmProjectsService.ts';
import {
  getActiveProyectoId,
  setActiveProyectoId,
} from '../../modules/civilflow/services/storageService.ts';
import ProjectCreateDialog from '../../modules/civilflow/components/shared/ProjectCreateDialog.tsx';
import ProjectCreateDialogCM from '../../modules/civilmanager/components/shared/ProjectCreateDialogCM.tsx';
import ModuleSelectDialog from '../../components/subscriptions/ModuleSelectDialog.tsx';
import { ConfirmModal } from '../../components/shared/ConfirmModal.tsx';
import { ProjectsSection } from './ProjectsSection.tsx';
import { abrirProyectoCf } from './workspaceHandoff.ts';
import type { ModuloId } from '../../lib/subscriptions/catalog.ts';
import { useSuscripciones } from '../../hooks/useSubscriptions.ts';
import SiteFooter from '../../components/landing/SiteFooter.tsx';
import { estaActiva } from '../../lib/subscriptions/subscriptionsService.ts';
import { CF_TABLES } from '../../modules/civilflow/constants/tableNames.ts';
import { clearLocalWorkspace } from '../../modules/civilflow/services/workspaceReset.ts';

const campos = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'profesion', label: 'Profesión' },
  { key: 'matricula', label: 'Matrícula Profesional' },
  { key: 'telefono', label: 'Teléfono' },
];

/** Días para la fecha_fin más próxima (reloj del cliente, igual que estaActiva).
 *  Vive fuera del render: react-hooks/purity prohíbe Date.now() directo en él. */
function diasParaVencer(fechasFin: string[]): number {
  const min = Math.min(...fechasFin.map((f) => new Date(f).getTime()));
  return Math.floor((min - Date.now()) / 86400000);
}

/** Iniciales para el avatar del header (2 palabras máx). */
function inicialesDe(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || '??'
  );
}

// fechaCorta y ProyectoCard viven en hermanos (ProfilePage.tsx / ProjectCard.tsx).

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
  const [cmProyectos, setCmProyectos] = useState<CmProyectoRow[]>([]);
  const [filtroModulo, setFiltroModulo] = useState<'todos' | 'cf' | 'cm'>('todos');
  const [proyLoading, setProyLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showModSel, setShowModSel] = useState(false);
  const {
    activos: modulosActivosUser,
    bloqueando: subsBloqueando,
    rows: subsRows,
  } = useSuscripciones();
  const [moduloElegido, setModuloElegido] = useState<ModuloId | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [cmDeleteConfirm, setCmDeleteConfirm] = useState<string | null>(null);
  const [errorApertura, setErrorApertura] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [cmOpeningId, setCmOpeningId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const projectCtx = useContext(ProjectContext);
  const plansCtx = useContext(PlansContext);

  async function openProyecto(proy: ProyectoRow) {
    // Guard de apertura concurrente (CF o CM): dos openProyecto intercalan el hand-off
    // de storage y dejan mezcla de dos proyectos; respaldo del disabled por blocked.
    if (openingId != null || cmOpeningId != null) return;
    setOpeningId(proy.id);
    // La secuencia de traspaso (pausar cloud-sync → cargar → reset → hand-off → navegar)
    // vive en workspaceHandoff.ts; el resume va en su finally.
    try {
      await abrirProyectoCf({
        proy,
        projectCtx,
        plansCtx,
        navigate,
        onError: setErrorApertura,
      });
    } finally {
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
        // 401 con JWT vencido/futuro (reloj desfasado o token justo expirado): un refresh
        // de sesión + un reintento lo resuelve sin mostrar error (orig. usuario consola).
        const queryPerfil = () =>
          supabase.from(CF_TABLES.perfiles).select('*').eq('id', user.id).single();
        let { data, error } = await queryPerfil();
        if (error && (error as unknown as { status?: number }).status === 401) {
          try {
            await supabase.auth.refreshSession();
          } catch {
            /* ignore */
          }
          ({ data, error } = await queryPerfil());
        }
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
  // time the user clicks to expand it. Ahora trae CF + CM en paralelo.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let ignore = false;
    async function loadProyectos() {
      setProyLoading(true);
      try {
        const [cf, cm] = await Promise.all([fetchProyectos(), fetchCmProyectos()]);
        if (!ignore) {
          setProyectos(cf);
          setCmProyectos(cm);
        }
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
      // save_perfil (RPC SECURITY DEFINER) hace upsert del CONJUNTO editable completo —
      // hay que mandar el perfil entero o los campos omitidos se rescriben a NULL.
      const { error } = await supabase.rpc('save_perfil', {
        p_perfil: {
          ...perfil,
          email: user?.email,
          [field]: editValue,
        },
      });
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

  async function handleDeleteProject(id: string) {
    if (!id) {
      window.alert('No se pudo identificar el proyecto.');
      return;
    }
    const ok = await deleteProyecto(id);
    if (ok) {
      setProyectos((prev) => prev.filter((p) => p.id !== id));
      // Si el proyecto borrado era el ACTIVO, limpiar el puntero: si no, el área de trabajo
      // seguía autoguardando sobre un proyecto inexistente (404/no_autorizado en cada sync).
      if (getActiveProyectoId() === id) setActiveProyectoId(null);
    } else {
      devError('Error eliminando proyecto');
      window.alert('No se pudo eliminar el proyecto (fallo del servidor o de conexión).');
    }
    setDeleteConfirm(null);
  }

  async function handleDeleteCmProyecto(id: string) {
    const ok = await deleteCmProyecto(id);
    if (ok) {
      setCmProyectos((prev) => prev.filter((p) => p.id !== id));
    } else {
      devError('Error eliminando proyecto CM');
    }
    setCmDeleteConfirm(null);
  }

  async function openCmProyecto(proy: CmProyectoRow) {
    // Guard de apertura concurrente (CF o CM): respaldo del disabled por blocked.
    if (cmOpeningId != null || openingId != null) return;
    setCmOpeningId(proy.id);
    try {
      localStorage.setItem('cm_proyecto_activo_id', proy.id);
      localStorage.setItem('cm_proyecto_activo_nombre', proy.nombre);
      navigate('/civilmanagerareatrabajo');
    } finally {
      setCmOpeningId(null);
    }
  }

  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ');

  // Chip de vencimiento (solo en esta tarjeta): sin polling a propósito — se re-evalúa en
  // cada render igual que RequireModule; la verdad de vencimiento es server-side
  // (acceso_modulo). Solo con sesión y filas reales (rows[] vacío a anónimos mostraría
  // "VENCIDA" falso).
  let chipVencimiento: { tipo: 'rojo' | 'ambar'; texto: string } | null = null;
  if (subsBloqueando && user && subsRows.length > 0) {
    const activas = subsRows.filter((r) => estaActiva(r));
    if (activas.length === 0) {
      chipVencimiento = { tipo: 'rojo', texto: 'SUSCRIPCIÓN VENCIDA' };
    } else {
      const dias = diasParaVencer(activas.map((r) => r.fecha_fin));
      if (dias <= 7) {
        chipVencimiento = {
          tipo: 'ambar',
          texto: dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias === 1 ? '' : 's'}`,
        };
      }
    }
  }

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
    <div className="flex flex-col flex-1 min-h-screen">
      <div className="space-y-6 max-w-[1200px] mx-auto w-full px-4 lg:px-6 flex-1">
        <script type="application/ld+json">{JSON.stringify(personJsonLd)}</script>
        {/* Con suscripciones activas, "Nuevo proyecto" pregunta primero por el módulo
          comprado; el flujo interno de cada módulo sigue intacto. */}
        <ModuleSelectDialog
          open={showModSel}
          onClose={() => setShowModSel(false)}
          onPick={(m) => {
            setShowModSel(false);
            setModuloElegido(m);
          }}
        />
        <ProjectCreateDialog
          open={showCreate || moduloElegido === 'flow'}
          onClose={() => {
            setShowCreate(false);
            if (moduloElegido === 'flow') setModuloElegido(null);
          }}
        />
        <ProjectCreateDialogCM
          open={moduloElegido === 'manage'}
          onClose={() => setModuloElegido(null)}
        />
        {deleteConfirm != null && (
          <ConfirmModal
            title="Eliminar Proyecto"
            message="¿Estás seguro de eliminar este proyecto? Esta acción no se puede deshacer."
            onClose={() => setDeleteConfirm(null)}
            onConfirm={() => handleDeleteProject(deleteConfirm)}
          />
        )}
        {cmDeleteConfirm != null && (
          <ConfirmModal
            title="Eliminar Proyecto CM"
            message="¿Estás seguro de eliminar este proyecto de Civil Manager? Esta acción no se puede deshacer."
            onClose={() => setCmDeleteConfirm(null)}
            onConfirm={() => handleDeleteCmProyecto(cmDeleteConfirm)}
          />
        )}
        <header className="border border-outline-variant bg-surface-container p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                aria-hidden
                className="w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-lg font-black select-none"
                style={{
                  background: 'linear-gradient(135deg, var(--primary, #4D8FF7), #7c5cf0)',
                  color: '#fff',
                  fontFamily: 'Geist, monospace',
                }}
              >
                {inicialesDe(nombreCompleto || 'CC')}
              </div>
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
            </div>
            {chipVencimiento && (
              <button
                type="button"
                onClick={() => navigate('/pricing')}
                aria-label={
                  chipVencimiento.tipo === 'rojo'
                    ? 'Suscripción vencida: ver planes'
                    : `${chipVencimiento.texto}: ver planes`
                }
                className="shrink-0 px-2.5 py-1 rounded-md uppercase text-[10px] tracking-[0.08em] font-bold cursor-pointer transition-all hover:brightness-110"
                style={{
                  fontFamily: 'Geist, monospace',
                  color: chipVencimiento.tipo === 'rojo' ? '#fecdd3' : '#fde68a',
                  background:
                    chipVencimiento.tipo === 'rojo'
                      ? 'rgba(244,63,94,0.16)'
                      : 'rgba(245,158,11,0.16)',
                  border: `1px solid ${chipVencimiento.tipo === 'rojo' ? '#f43f5e' : '#f59e0b'}`,
                }}
              >
                {chipVencimiento.texto}
              </button>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(300px,340px)_1fr] items-start">
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
            <ul
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              style={{ listStyle: 'none', margin: 0, padding: 0 }}
            >
              <li className="border-l-2 border-primary pl-3 py-2">
                <span className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant block mb-1">
                  Correo Electrónico
                </span>
                <span className="text-[13px] text-on-surface font-medium">
                  {user?.email || '—'}
                </span>
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
                      <span className="material-symbols-outlined text-xs! text-on-surface-variant opacity-0 group-hover:opacity-60 transition-opacity">
                        edit
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <ProjectsSection
            proyectosOpen={proyectosOpen}
            onToggleOpen={() => setProyectosOpen((prev) => !prev)}
            proyectos={proyectos}
            cmProyectos={cmProyectos}
            proyLoading={proyLoading}
            filtroModulo={filtroModulo}
            onFiltroModulo={setFiltroModulo}
            user={user}
            subsBloqueando={subsBloqueando}
            modulosActivosUser={modulosActivosUser}
            subsRows={subsRows}
            onNuevoDirecto={() => setShowCreate(true)}
            onNuevoModuloElegido={setModuloElegido}
            onNuevoSelector={() => setShowModSel(true)}
            errorApertura={errorApertura}
            openingId={openingId}
            cmOpeningId={cmOpeningId}
            onOpenCf={openProyecto}
            onOpenCm={openCmProyecto}
            onDeleteCf={setDeleteConfirm}
            onDeleteCm={setCmDeleteConfirm}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="px-5 py-2 text-xs font-bold tracking-widest uppercase border border-error text-error hover:bg-error hover:text-on-error transition-all"
            style={{ fontFamily: 'Geist, monospace' }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {confirmLogout && (
        <ConfirmModal
          compactMessage
          title="Cerrar sesión"
          message="¿Salir de tu cuenta? Tus proyectos quedan guardados."
          confirmLabel="Cerrar sesión"
          minWidth={340}
          onClose={() => setConfirmLogout(false)}
          onConfirm={async () => {
            setConfirmLogout(false);
            if (!supabase) return;
            // Logout manual = recordar siempre la próxima (la marca solo vive si el
            // usuario desmarcó "Recordarme" al entrar y NO pasó por este botón).
            localStorage.removeItem('civilflow_no_recordar');
            // Se borra el WORKSPACE local (dibujo completo del plano, conteos, hidros,
            // proyecto activo): sin esto, el proyecto anterior queda legible en el
            // navegador para el siguiente usuario que inicie sesión en este equipo.
            clearLocalWorkspace();
            try {
              await supabase.auth.signOut();
            } finally {
              navigate('/');
            }
          }}
        />
      )}

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </div>
  );
}

export default ProfilePage;
