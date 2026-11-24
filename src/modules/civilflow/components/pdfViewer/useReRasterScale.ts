import { useEffect } from 'react';
import { escalaDeLamina } from '../../utils/planScale.ts';
import { EVENTO_ESCALA_CAMBIADA } from '../../utils/loadDiagnostics.ts';

interface Params {
  currentIdRef: React.RefObject<string | number | undefined>;
  pdfPlanIdRef: React.RefObject<string | null>;
  mountId: React.RefObject<number>;
  ultimoFullScRef: React.RefObject<number | null>;
  renderPage: (pageNum: number, sc: number, mountCheck: number) => Promise<void>;
}

/** Actualiza el fondo si llegó un dibujo guardado después del PDF de ese mismo plano. */
export function useReRasterEscala({
  currentIdRef,
  pdfPlanIdRef,
  mountId,
  ultimoFullScRef,
  renderPage,
}: Params): void {
  useEffect(() => {
    const onEscalaCambiada = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id !== String(currentIdRef.current) || id !== pdfPlanIdRef.current) return;
      const sc = escalaDeLamina(id) ?? 1;
      if (ultimoFullScRef.current !== sc) void renderPage(1, sc, mountId.current);
    };
    window.addEventListener(EVENTO_ESCALA_CAMBIADA, onEscalaCambiada);
    return () => window.removeEventListener(EVENTO_ESCALA_CAMBIADA, onEscalaCambiada);
  }, [renderPage, currentIdRef, pdfPlanIdRef, mountId, ultimoFullScRef]);
}
