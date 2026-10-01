/**
 * Hook de suscripciones: fetch inicial + refetch ante el evento de pago
 * aprobado. `activos` se memoiza por filas; para el gating estricto de rutas
 * usar RequireModule, que re-evalúa la fecha en cada render.
 * `bloqueando` = VITE_SUSCRIPCIONES && flag BD: la UI nueva la decide VITE,
 * el bloqueo real lo decide la BD (flag OFF → nunca bloquea el cliente).
 * `decidido` = false mientras el flag de BD está sin resolver (null): evita el
 * flash de contenido protegido en RequireModule (montar y luego redirigir).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  EV_SUSCRIPCIONES,
  fetchSuscripciones,
  modulosActivos,
  suscripcionesHabilitadas,
  type SuscripcionRow,
} from '../lib/subscriptions/subscriptionsService';
import {
  SUSCRIPCIONES_ACTIVAS,
  sincronizarPreciosBd,
  type ModuloId,
} from '../lib/subscriptions/catalog';

export function useSuscripciones() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SuscripcionRow[] | null>(null);
  // null = aún consultando el flag de BD (evita el flash en RequireModule).
  const [flagBD, setFlagBD] = useState<boolean | null>(null);

  const refetch = useCallback(async () => {
    // setRows es la única llamada y ocurre SIEMPRE tras un await — el efecto
    // de montaje no dispara setState síncrono (react-hooks/set-state-in-effect).
    const filas = await (user ? fetchSuscripciones() : Promise.resolve([]));
    setRows(filas);
  }, [user]);

  useEffect(() => {
    // Precios desde BD (fuente única, deuda #4): pisa CATALOGO con app_precios antes de
    // que ningún modal muestre/mande un total. Fallback silencioso sin migración.
    void sincronizarPreciosBd();
    // Patrón del codebase (cf. ProfilePage): función async local + bandera
    // ignore — evita setState síncrono desde el effect (react-hooks).
    let ignore = false;
    async function cargar() {
      const [filas, hab] = await Promise.all([
        user ? fetchSuscripciones() : Promise.resolve([]),
        // VITE off → ni siquiera se consulta el flag (resuelve false).
        SUSCRIPCIONES_ACTIVAS ? suscripcionesHabilitadas() : Promise.resolve(false),
      ]);
      if (!ignore) {
        setRows(filas);
        setFlagBD(hab);
      }
    }
    void cargar();
    const onCambio = () => void cargar();
    window.addEventListener(EV_SUSCRIPCIONES, onCambio);
    return () => {
      ignore = true;
      window.removeEventListener(EV_SUSCRIPCIONES, onCambio);
    };
  }, [user]);

  const activos = useMemo(() => modulosActivos(rows ?? []), [rows]);
  const bloqueando = SUSCRIPCIONES_ACTIVAS && flagBD === true;
  const decidido = !SUSCRIPCIONES_ACTIVAS || flagBD !== null;

  return { rows: rows ?? [], activos, loading: rows === null, bloqueando, decidido, refetch };
}

export type { ModuloId };
