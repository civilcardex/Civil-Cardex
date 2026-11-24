/** Guard de ruta por módulo: sin suscripción vigente redirige a /pricing. */
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { SUSCRIPCIONES_ACTIVAS, type ModuloId } from '../../lib/subscriptions/catalog.ts';
import { verificarAccesoModulo } from '../../lib/subscriptions/subscriptionsService.ts';
import { useSuscripciones } from '../../hooks/useSubscriptions.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface Props {
  modulo: ModuloId;
  children: ReactNode;
}

/** Spinner compartido mientras se resuelve el flag de BD o las filas. */
function SpinnerVerificacion() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <span role="status" style={{ color: 'var(--on-surface-variant, #9ba8aa)', fontSize: 13 }}>
        Verificando suscripción...
      </span>
    </div>
  );
}

function ConfirmarAcceso({ modulo, children }: Props) {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<{ intento: number; acceso: boolean | null }>();

  useEffect(() => {
    let vigente = true;
    void verificarAccesoModulo(modulo).then((acceso) => {
      if (vigente) setResultado({ intento, acceso });
    });
    return () => {
      vigente = false;
    };
  }, [modulo, intento]);

  if (resultado?.intento !== intento) return <SpinnerVerificacion />;
  if (resultado.acceso === false) return <Navigate to={`/pricing?modulo=${modulo}`} replace />;
  if (resultado.acceso === null) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-6 py-12 text-center">
        <p role="alert">No pudimos comprobar tu suscripción.</p>
        <button
          type="button"
          className="rounded border border-outline-variant px-4 py-2 text-primary"
          onClick={() => setIntento((valor) => valor + 1)}
        >
          Reintentar
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

/** Confirma la vigencia al entrar. Ej: un enlace de Civil Manager sin acceso lleva a su precio. */
export default function RequireModule({ modulo, children }: Props) {
  const { user, loading } = useAuth();
  const { bloqueando, decidido } = useSuscripciones();
  if (SUSCRIPCIONES_ACTIVAS && loading) return <SpinnerVerificacion />;
  if (!decidido) return <SpinnerVerificacion />;
  if (!bloqueando) return <>{children}</>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <ConfirmarAcceso key={`${user.id}:${modulo}`} modulo={modulo}>
      {children}
    </ConfirmarAcceso>
  );
}
