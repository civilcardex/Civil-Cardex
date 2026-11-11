/**
 * Cierre del visor: prefetch de todos los pisos (tope 4 s), validación pre-cierre con alerta,
 * guardado final y navegación de vuelta al área de trabajo con el proyecto en la URL.
 * Extraído verbatim de PdfViewer. Idempotente: el doble click no re-dispara el flujo.
 * Ej: cerrar con ramales sin UC dispara la alerta y NO navega hasta corregir o confirmar.
 */
import { useCallback, type MutableRefObject, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { getActiveProyectoId } from '../../services/storageService.ts';
import { validateBeforeClose } from './closeValidation.ts';
import { prefetchAllTrazos } from '../../utils/prefetchStrokes.ts';
import { sleep } from '../shared/sequentialLoad.ts';

interface UseCloseViewerArgs {
  cerrandoRef: MutableRefObject<boolean>;
  engineRef: RefObject<PlanoEngine | null>;
  planos: PlanItem[];
  onAlertHandler: (title: string, msg: string) => void;
  handleSave: () => void;
}

export function useCloseViewer({
  cerrandoRef,
  engineRef,
  planos,
  onAlertHandler,
  handleSave,
}: UseCloseViewerArgs): () => void {
  const navigate = useNavigate();
  // Deps = todo lo que el cuerpo lee por render (planos/handleSave cambian juntos al refrescar).
  return useCallback(() => {
    // Idempotente: el doble click no re-dispara el flujo. El prefetch que asegura la
    // caché de TODOS los pisos tiene tope de 4s — una red colgada no bloquea el cierre
    // para siempre (valida con la caché que haya, igual que si el prefetch fallara).
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    void (async () => {
      try {
        await Promise.race([prefetchAllTrazos(planos), sleep(4000)]);
      } catch {
        /* validar con la caché que haya */
      }
      const eng = engineRef.current;
      if (eng && !validateBeforeClose(eng, planos, onAlertHandler)) {
        cerrandoRef.current = false;
        return;
      }
      handleSave();
      // Volver con el proyecto en la URL (orig. usuario: se perdía el /:proyectoId).
      {
        const pid = getActiveProyectoId();
        navigate(pid ? `/civilflowareatrabajo/${pid}` : '/civilflowareatrabajo');
      }
    })();
  }, [planos, onAlertHandler, handleSave, navigate, cerrandoRef, engineRef]);
}
