import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { CargandoProyecto } from '../modules/civilflow/components/shared/CargandoProyecto';

/** Puerta de las rutas que exigen sesión.
 *  - Mientras la sesión se resuelve: pantalla de carga (NUNCA null: un null deja la página
 *    en blanco y el usuario no sabe si la app arrancó).
 *  - Sin sesión: redirección al login.
 *  - Con sesión: deja pasar al Outlet. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <CargandoProyecto texto="Comprobando sesión…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
