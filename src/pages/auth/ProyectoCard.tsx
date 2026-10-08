import { fechaCorta } from './profileHelpers';

/** Tarjeta de proyecto (grid del perfil): badge de módulo + Empresa, código, nombre, fecha,
 *  papelera al hover (desktop) y flecha de apertura. Un solo componente para CF y CM.
 *  El botón eliminar es HERMANO del div role="button" (envueltos en un relative): un
 *  interactivo anidado dentro de otro es HTML/AT inválido. */
export function ProyectoCard({
  badge,
  badgeColor,
  empresa,
  codigo,
  nombre,
  fecha,
  opening,
  blocked,
  onOpen,
  onDelete,
}: {
  badge: string;
  badgeColor: string;
  empresa: boolean;
  codigo: string;
  nombre: string;
  fecha?: string;
  opening: boolean;
  /** true si OTRA card está abriendo: atenúa y bloquea acciones (evita aperturas/borrados
   *  concurrentes que intercalan el hand-off de storage entre dos proyectos). */
  blocked: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const inactivo = opening || blocked;
  return (
    <div className="relative group">
      <div
        className="border border-outline-variant bg-surface-container-low hover:bg-surface-container transition-colors p-4 cursor-pointer"
        role="button"
        tabIndex={inactivo ? -1 : 0}
        aria-label={`Abrir proyecto ${nombre}`}
        aria-disabled={inactivo}
        onClick={() => {
          if (inactivo) return;
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (inactivo) return;
            onOpen();
          }
        }}
        style={{ opacity: opening ? 0.5 : 1 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 border"
            style={{ borderColor: badgeColor, color: badgeColor, fontFamily: 'Geist, monospace' }}
          >
            {badge}
          </span>
          {empresa && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 border"
              style={{ borderColor: '#52f2a5', color: '#52f2a5', fontFamily: 'Geist, monospace' }}
            >
              Empresa
            </span>
          )}
          <span className="ml-auto mr-6 text-[11px] text-on-surface-variant font-mono">
            {fechaCorta(fecha)}
          </span>
        </div>
        <div className="text-[13px] font-bold font-mono text-on-surface">{codigo}</div>
        <p className="text-[12px] text-on-surface-variant truncate mt-0.5 pr-6">
          {opening ? 'Abriendo proyecto...' : nombre}
        </p>
        <span
          aria-hidden
          className="absolute bottom-3 right-3 material-symbols-outlined text-on-surface-variant text-lg opacity-0 group-hover:opacity-100 transition-opacity"
        >
          arrow_forward
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          if (inactivo) return;
          onDelete();
        }}
        aria-label={`Eliminar proyecto ${codigo}`}
        title="Eliminar proyecto"
        disabled={inactivo}
        className="absolute top-[14px] right-[14px] shrink-0 material-symbols-outlined text-[18px] opacity-60 group-hover:opacity-100 transition-opacity"
        style={{
          cursor: inactivo ? 'default' : 'pointer',
          color: 'var(--error, #ff4444)',
        }}
      >
        delete
      </button>
    </div>
  );
}
