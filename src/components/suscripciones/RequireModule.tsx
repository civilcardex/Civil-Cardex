/**
 * Guard de ruta por módulo: sin suscripción vigente redirige a /pricing.
 * No-op mientras VITE_SUSCRIPCIONES o el flag de BD (suscripciones_activas)
 * estén apagados — la BD decide el bloqueo, VITE solo la UI. La vigencia se
 * evalúa con la fecha actual en cada render: al vencer en medio de sesión, el
 * módulo se bloquea sin refetch.
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { ModuloId } from '../../lib/suscripciones/catalogo';
import { estaActiva } from '../../lib/suscripciones/suscripcionesService';
import { useSuscripciones } from '../../hooks/useSuscripciones';

interface Props {
  modulo: ModuloId;
  children: ReactNode;
}

/** Spinner compartido mientras se resuelve el flag de BD o las filas. */
function SpinnerVerificacion() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <span style={{ color: 'var(--on-surface-variant, #9ba8aa)', fontSize: 13 }}>
        Verificando suscripción...
      </span>
    </div>
  );
}

export default function RequireModule({ modulo, children }: Props) {
  const { rows, loading, bloqueando, decidido } = useSuscripciones();

  // flag de BD sin resolver (null): spinner ANTES del check de !bloqueando,
  // que con flag null es false y montaría el contenido para luego redirigir.
  if (!decidido) return <SpinnerVerificacion />;
  if (!bloqueando) return <>{children}</>;
  if (loading) return <SpinnerVerificacion />;
  const activo = rows.some((r) => r.modulo === modulo && estaActiva(r));
  if (!activo) return <Navigate to={`/pricing?modulo=${modulo}`} replace />;
  return <>{children}</>;
}
