/**
 * Hook de suscripciones: fetch inicial + refetch ante el evento de pago
 * aprobado. `activos` se memoiza por filas; para el gating estricto de rutas
 * usar RequireModule, que re-evalúa la fecha en cada render.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  EV_SUSCRIPCIONES,
  fetchSuscripciones,
  modulosActivos,
  type SuscripcionRow,
} from '../lib/suscripciones/suscripcionesService';
import type { ModuloId } from '../lib/suscripciones/catalogo';

export function useSuscripciones() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SuscripcionRow[] | null>(null);

  const refetch = useCallback(async () => {
    // setRows es la única llamada y ocurre SIEMPRE tras un await — el efecto
    // de montaje no dispara setState síncrono (react-hooks/set-state-in-effect).
    const filas = await (user ? fetchSuscripciones() : Promise.resolve([]));
    setRows(filas);
  }, [user]);

  useEffect(() => {
    // Patrón del codebase (cf. ProfilePage): función async local + bandera
    // ignore — evita setState síncrono desde el effect (react-hooks).
    let ignore = false;
    async function cargar() {
      const filas = user ? await fetchSuscripciones() : [];
      if (!ignore) setRows(filas);
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

  return { rows: rows ?? [], activos, loading: rows === null, refetch };
}

export type { ModuloId };
