import { Link } from 'react-router-dom';
import { ProyectoCard } from './ProjectCard.tsx';
import { estaActiva, type SuscripcionRow } from '../../lib/subscriptions/subscriptionsService.ts';
import type { ProyectoRow } from '../../modules/civilflow/services/projectsService.ts';
import type { CmProyectoRow } from '../../modules/civilmanager/services/cmProjectsService.ts';
import type { ModuloId } from '../../lib/subscriptions/catalog.ts';

interface ProjectsSectionProps {
  proyectosOpen: boolean;
  onToggleOpen: () => void;
  proyectos: ProyectoRow[];
  cmProyectos: CmProyectoRow[];
  proyLoading: boolean;
  filtroModulo: 'todos' | 'cf' | 'cm';
  onFiltroModulo: (f: 'todos' | 'cf' | 'cm') => void;
  user: { id: string; email?: string } | null;
  subsBloqueando: boolean;
  modulosActivosUser: Set<ModuloId>;
  subsRows: SuscripcionRow[];
  onNuevoDirecto: () => void;
  onNuevoModuloElegido: (m: ModuloId) => void;
  onNuevoSelector: () => void;
  errorApertura: string | null;
  openingId: string | null;
  cmOpeningId: string | null;
  onOpenCf: (p: ProyectoRow) => void;
  onOpenCm: (p: CmProyectoRow) => void;
  onDeleteCf: (id: string) => void;
  onDeleteCm: (id: string) => void;
}

/** Acordeón de proyectos (CF + CM) del perfil: filtro por módulo, tarjetas y acciones.
 *  Extraído verbatim de ProfilePage — solo cambia el paso de callbacks por props. */
export function ProjectsSection({
  proyectosOpen,
  onToggleOpen,
  proyectos,
  cmProyectos,
  proyLoading,
  filtroModulo,
  onFiltroModulo,
  user,
  subsBloqueando,
  modulosActivosUser,
  subsRows,
  onNuevoDirecto,
  onNuevoModuloElegido,
  onNuevoSelector,
  errorApertura,
  openingId,
  cmOpeningId,
  onOpenCf,
  onOpenCm,
  onDeleteCf,
  onDeleteCm,
}: ProjectsSectionProps) {
  return (
    <section
      aria-labelledby="proyectos-heading"
      className="border border-outline-variant bg-surface-container"
    >
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={proyectosOpen}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-container-low transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-xl!">folder_open</span>
          <div>
            <h2
              id="proyectos-heading"
              className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant"
            >
              Proyectos
            </h2>
            <span className="text-[13px] text-on-surface font-medium">
              {proyectos.length + cmProyectos.length} proyectos
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
              onClick={() => {
                // 1 módulo activo → directo al modal de nombre; 0 o 2+ → selector
                // (0 muestra el aviso de pricing dentro del selector).
                if (!subsBloqueando) onNuevoDirecto();
                else if (modulosActivosUser.size === 1)
                  onNuevoModuloElegido([...modulosActivosUser][0]);
                else onNuevoSelector();
              }}
            >
              <span className="material-symbols-outlined text-lg!">add_circle</span>
              Nuevo proyecto
            </button>
            {user &&
              subsRows.some(
                (r) => r.user_id === user.id && (r.puestos ?? 1) > 1 && estaActiva(r),
              ) && (
                <Link
                  to="/empresa"
                  className="flex items-center gap-2 text-primary hover:text-primary-fixed text-[13px] font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-lg!">group</span>
                  Gestionar equipo
                </Link>
              )}
          </div>

          {errorApertura ? (
            <div
              role="alert"
              className="px-6 py-3 text-sm"
              style={{
                color: 'var(--error, #ff4444)',
                borderBottom: '1px solid var(--outline-variant)',
              }}
            >
              {errorApertura}
            </div>
          ) : null}

          {proyLoading ? (
            <div className="px-6 py-8 text-center text-on-surface-variant text-sm">
              Cargando proyectos...
            </div>
          ) : proyectos.length + cmProyectos.length === 0 ? (
            <div className="px-6 py-8 text-center text-on-surface-variant text-sm">
              Aún no hay proyectos. Crea uno desde "Nuevo proyecto".
            </div>
          ) : (
            <>
              <div className="px-6 py-2 flex gap-2 border-b border-outline-variant bg-surface-container-low">
                {(['todos', 'cf', 'cm'] as const).map((mod) => (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => onFiltroModulo(mod)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: '1px solid var(--outline-variant, #3a3a44)',
                      background: filtroModulo === mod ? 'var(--primary, #4D8FF7)' : 'transparent',
                      color:
                        filtroModulo === mod
                          ? 'var(--on-primary, #fff)'
                          : 'var(--on-surface-variant, #9ba8aa)',
                      cursor: 'pointer',
                    }}
                  >
                    {(mod === 'todos'
                      ? 'Todos'
                      : mod === 'cf'
                        ? 'CivilFlow'
                        : 'Civil Manager'
                    ).toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-3">
                {(filtroModulo === 'todos' || filtroModulo === 'cf') &&
                  proyectos.map((proy) => (
                    <ProyectoCard
                      key={`cf-${proy.id}`}
                      badge="CF"
                      badgeColor="var(--primary)"
                      empresa={!!user && proy.user_id !== user.id}
                      codigo={proy.codigo}
                      nombre={proy.nombre}
                      fecha={proy.created_at}
                      opening={openingId === proy.id}
                      blocked={openingId != null || cmOpeningId != null}
                      onOpen={() => onOpenCf(proy)}
                      onDelete={() => onDeleteCf(proy.id)}
                    />
                  ))}
                {(filtroModulo === 'todos' || filtroModulo === 'cm') &&
                  cmProyectos.map((proy) => (
                    <ProyectoCard
                      key={`cm-${proy.id}`}
                      badge="CM"
                      badgeColor="#cca043"
                      empresa={!!user && proy.user_id !== user.id}
                      codigo={proy.codigo}
                      nombre={proy.nombre}
                      fecha={proy.created_at}
                      opening={cmOpeningId === proy.id}
                      blocked={openingId != null || cmOpeningId != null}
                      onOpen={() => onOpenCm(proy)}
                      onDelete={() => onDeleteCm(proy.id)}
                    />
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
