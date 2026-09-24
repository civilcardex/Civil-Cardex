/**
 * Guard de ruta por módulo: sin suscripción vigente redirige a /pricing.
 * No-op mientras SUSCRIPCIONES_ACTIVAS esté apagado. La vigencia se evalúa
 * con la fecha actual en cada render: al vencer en medio de sesión, el
 * módulo se bloquea sin refetch.
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { SUSCRIPCIONES_ACTIVAS, type ModuloId } from '../../lib/suscripciones/catalogo';
import { estaActiva } from '../../lib/suscripciones/suscripcionesService';
import { useSuscripciones } from '../../hooks/useSuscripciones';

interface Props {
  modulo: ModuloId;
  children: ReactNode;
}

export default function RequireModule({ modulo, children }: Props) {
  const { rows, loading } = useSuscripciones();

  if (!SUSCRIPCIONES_ACTIVAS) return <>{children}</>;
  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <span style={{ color: 'var(--on-surface-variant, #9ba8aa)', fontSize: 13 }}>
          Verificando suscripción...
        </span>
      </div>
    );
  }
  const activo = rows.some((r) => r.modulo === modulo && estaActiva(r));
  if (!activo) return <Navigate to={`/pricing?modulo=${modulo}`} replace />;
  return <>{children}</>;
}
