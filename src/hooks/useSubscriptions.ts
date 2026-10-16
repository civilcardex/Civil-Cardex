/** Hook de suscripciones: lee las filas al entrar y las recarga cuando llega el evento
 *  de pago aprobado. `activos` son los módulos que el usuario puede usar HOY; para el
 *  candado estricto de rutas está RequireModule, que revisa la fecha de vencimiento
 *  en cada render. */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  EV_SUSCRIPCIONES,
  fetchModulosConAcceso,
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
  // Módulos del RPC mis_accesos (propias + asientos de empresa); [] sin sesión o
  // sin migración (fail-open — ver fetchModulosConAcceso).
  const [accesos, setAccesos] = useState<ModuloId[]>([]);

  useEffect(() => {
    // Precios desde BD (fuente única, deuda #4): pisa CATALOGO con app_precios antes de
    // que ningún modal muestre/mande un total. Fallback silencioso sin migración.
    void sincronizarPreciosBd();
    // Patrón del codebase (cf. ProfilePage): función async local + bandera
    // ignore — evita setState síncrono desde el effect (react-hooks).
    let ignore = false;
    async function cargar() {
      const [filas, hab, acc] = await Promise.all([
        user ? fetchSuscripciones() : Promise.resolve([]),
        // VITE off → ni siquiera se consulta el flag (resuelve false).
        SUSCRIPCIONES_ACTIVAS ? suscripcionesHabilitadas() : Promise.resolve(false),
        // Asientos de empresa: sin sesión no hay nada que unir (activos queda igual).
        user ? fetchModulosConAcceso() : Promise.resolve<ModuloId[]>([]),
      ]);
      if (!ignore) {
        setRows(filas);
        setFlagBD(hab);
        setAccesos(acc);
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

  // activos = suscripciones propias (RLS) + asientos de empresa (mis_accesos):
  // el gating cliente no puede ver los asientos con la lectura owner-only.
  const activos = useMemo(() => {
    const base = modulosActivos(rows ?? []);
    for (const m of accesos) base.add(m);
    return base;
  }, [rows, accesos]);
  const bloqueando = SUSCRIPCIONES_ACTIVAS && flagBD === true;
  const decidido = !SUSCRIPCIONES_ACTIVAS || flagBD !== null;

  return { rows: rows ?? [], activos, loading: rows === null, bloqueando, decidido };
}

export type { ModuloId };
