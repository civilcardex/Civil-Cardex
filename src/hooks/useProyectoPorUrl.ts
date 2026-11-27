import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchProyectos } from '../modules/civilflow/services/projectsService.ts';
import {
  getActiveProyectoId,
  setActiveProyectoId,
} from '../modules/civilflow/services/storageService.ts';
import { abrirProyectoDesdeUrl } from '../modules/civilflow/services/workspaceReset.ts';
interface CtxsPausables {
  pauseCloudSync?: () => void;
  resetPlans?: () => void;
  resetToDefaults?: () => void;
  resumeCloudSync?: () => void;
}

/** Máquina de estado de "abrir el proyecto de la URL" COMPARTIDA por workarea y visor
 *  (H: los dos copiaban los 3 efectos): reset del ref al asentarse, redirect al activo
 *  cuando la URL viene sin id, y el volcado con pausa/reset/resume del workspace.
 *  `rutaConId` es el builder de ruta de cada página. Ej:
 *  useProyectoPorUrl(proyectoId, (id) => rutaFlow(id, tab), (id) => `/dibujoRedes/${id}`). */
export function useProyectoPorUrl(
  proyectoId: string | undefined,
  rutaConId: (id: string) => string,
  ctxs: {
    projectCtx?: CtxsPausables | null;
    plansCtx?: CtxsPausables | null;
  },
): { switching: boolean } {
  const navigate = useNavigate();
  const wantsId = proyectoId ?? null;
  const switchPendiente = wantsId != null && wantsId !== getActiveProyectoId();
  const [switching, setSwitching] = useState(switchPendiente);
  const switchingRef = useRef(false);
  const { projectCtx, plansCtx } = ctxs;

  // Un segundo switch en la misma sesión quedaba bloqueado (ref sin reset): al asentarse
  // la URL se permite de nuevo (setState idéntico no re-renderiza, no cascada).
  useEffect(() => {
    if (wantsId == null || wantsId === getActiveProyectoId()) {
      switchingRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSwitching(false);
    }
  }, [wantsId]);

  // SOLO sin parámetro: redirect al uuid del proyecto activo. Con parámetro presente NO se
  // redirige nunca al activo (uuid → switch; no-uuid → banner legacy del llamador):
  // redirigir abriría el proyecto equivocado sin aviso. navigate SPA y NO replace de
  // window: los botones internos navegan aquí y un replace recargaba TODO el navegador.
  useEffect(() => {
    if (proyectoId != null) return;
    const activeId = getActiveProyectoId();
    if (!activeId) return;
    let alive = true;
    void (async () => {
      try {
        const rows = await fetchProyectos();
        if (!alive) return;
        const found = rows.find((r) => r.id === activeId);
        if (found) navigate(rutaConId(found.id), { replace: true });
      } catch {
        /* cosmético: sin redirect */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rutaConId cambia por render
  }, [proyectoId, navigate]);

  useEffect(() => {
    if (wantsId == null || switchingRef.current) return;
    if (wantsId === getActiveProyectoId()) return;
    switchingRef.current = true;
    void (async () => {
      // Fuera del cuerpo síncrono del efecto (regla set-state-in-effect).
      await Promise.resolve();
      setSwitching(true);
      await abrirProyectoDesdeUrl({
        wantsId,
        pausar: () => {
          projectCtx?.pauseCloudSync?.();
          plansCtx?.pauseCloudSync?.();
        },
        resetear: () => {
          plansCtx?.resetPlans?.();
          projectCtx?.resetToDefaults?.();
        },
        activar: (id) => setActiveProyectoId(String(id)),
        rutaConId: rutaConId(wantsId),
        rutaBase: rutaConId('').replace(/\/$/, ''),
      });
    })();
    // El volcado corre una sola vez por id entrante; switchingRef evita re-entradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsId]);

  return { switching };
}
