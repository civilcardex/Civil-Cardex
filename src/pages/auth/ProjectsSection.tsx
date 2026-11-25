import { Link } from 'react-router';
import { ProyectoCard } from './ProjectCard.tsx';
import {
  estaActiva,
  vigenciaDe,
  type SuscripcionRow,
} from '../../lib/subscriptions/subscriptionsService.ts';
import type { ProyectoRow } from '../../modules/civilflow/services/projectsService.ts';
import type { CmProyectoRow } from '../../modules/civilmanager/services/cmProjectsService.ts';
import { CATALOGO } from '../../lib/subscriptions/catalog.ts';

interface ProjectsSectionProps {
  cmHasMore?: boolean;
  cmLoadingMore?: boolean;
  cmMoreError?: boolean;
  onLoadMoreCm?: () => void;
  proyectosOpen: boolean;
  onToggleOpen: () => void;
  proyectos: ProyectoRow[];
  cmProyectos: CmProyectoRow[];
  cmListError: boolean;
  onRetryList: () => void;
  proyLoading: boolean;
  filtroModulo: 'todos' | 'cf' | 'cm';
  onFiltroModulo: (f: 'todos' | 'cf' | 'cm') => void;
  user: { id: string; email?: string } | null;
  subsRows: SuscripcionRow[];
  onNuevoSelector: () => void;
  errorApertura: string | null;
  openingId: string | null;
  cmOpeningId: string | null;
  onOpenCf: (p: ProyectoRow) => void;
  onOpenCm: (p: CmProyectoRow) => void;
  onDeleteCf: (id: string) => void;
  onDeleteCm: (id: string) => void;
}

/** Color de cada tono de vigencia: normal, por vencer (7 días o menos) o vencida. */
const TONO_VIGENCIA = {
  ok: 'var(--on-surface-variant, #9ba8aa)',
  ambar: '#f59e0b',
  rojo: 'var(--error, #ff4444)',
} as const;

/** Acordeón de proyectos (CF + CM) del perfil: cuánto le queda a cada suscripción, filtro por módulo, tarjetas y acciones. "Nuevo proyecto" siempre pregunta el módulo (onNuevoSelector). */
export function ProjectsSection({
  proyectosOpen,
  onToggleOpen,
  proyectos,
  cmProyectos,
  cmHasMore,
  cmLoadingMore,
  cmMoreError,
  onLoadMoreCm,
  cmListError,
  onRetryList,
  proyLoading,
  filtroModulo,
  onFiltroModulo,
  user,
  subsRows,
  onNuevoSelector,
  errorApertura,
  openingId,
  cmOpeningId,
  onOpenCf,
  onOpenCm,
  onDeleteCf,
  onDeleteCm,
}: ProjectsSectionProps) {
  // La que vence primero arriba. Copia ordenada: subsRows es una prop.
  const suscripciones = [...subsRows].sort(
    (a, b) => new Date(a.fecha_fin).getTime() - new Date(b.fecha_fin).getTime(),
  );

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
              {proyectos.length + cmProyectos.length} proyectos{cmHasMore ? ' cargados' : ''}
            </span>
          </div>
        </div>
        <span
          className={`material-symbols-outlined text-on-surface-variant transition-transform ${proyectosOpen ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      {/* Siempre visible (también con el acordeón cerrado): es lo que explica en qué
          módulos puede crear proyecto y cuánto le queda a cada uno. Solo filas propias —
          los asientos de empresa no exponen la vigencia del titular. */}
      {suscripciones.length > 0 && (
        <div className="px-6 py-3 border-t border-outline-variant">
          <h3
            id="suscripciones-heading"
            className="text-[11px] font-bold tracking-widest uppercase text-on-surface-variant"
          >
            Suscripciones
          </h3>
          <ul
            aria-labelledby="suscripciones-heading"
            className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-[13px]"
          >
            {suscripciones.map((r) => {
              const vigencia = vigenciaDe(r);
              return (
                <li key={r.id}>
                  <span className="font-semibold text-on-surface">
                    {CATALOGO.find((c) => c.id === r.modulo)?.nombre ?? r.modulo}
                  </span>
                  <span style={{ color: TONO_VIGENCIA[vigencia.tono] }}> · {vigencia.texto}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {proyectosOpen && (
        <div className="border-t border-outline-variant">
          <div className="px-6 py-3 border-b border-outline-variant bg-surface-container-low">
            <button
              type="button"
              className="flex items-center gap-2 text-primary hover:text-primary-fixed text-[13px] font-medium transition-colors"
              onClick={onNuevoSelector}
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

          {!proyLoading && cmListError && (
            <div className="px-6 py-3 text-sm">
              <p role="alert">No se pudieron consultar los proyectos de CivilManager.</p>
              <button type="button" className="underline" onClick={onRetryList}>
                Reintentar
              </button>
            </div>
          )}

          {proyLoading ? (
            <div className="px-6 py-8 text-center text-on-surface-variant text-sm">
              Cargando proyectos...
            </div>
          ) : proyectos.length + cmProyectos.length === 0 ? (
            !cmListError && (
              <div className="px-6 py-8 text-center text-on-surface-variant text-sm">
                Aún no hay proyectos. Crea uno desde "Nuevo proyecto".
              </div>
            )
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
              {filtroModulo !== 'cf' && cmHasMore && (
                <div className="px-4 pb-4">
                  {cmMoreError && (
                    <p role="alert">No se pudieron cargar más proyectos de CivilManager.</p>
                  )}
                  <button
                    type="button"
                    disabled={cmLoadingMore}
                    onClick={onLoadMoreCm}
                    className="rounded border border-outline-variant px-3 py-2"
                  >
                    {cmLoadingMore ? 'Cargando…' : 'Cargar más proyectos de CivilManager'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
