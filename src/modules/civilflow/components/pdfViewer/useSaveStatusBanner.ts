import { useEffect, useState } from 'react';

interface UseSaveStatusBannerArgs {
  /** Setter del estado de guardado del autosave (el botón Guardar lee su texto). */
  setSaveStatus: (s: string) => void;
}

/** Franja roja de errores de guardado: escucha los 4 eventos globales de storageService
 *  (BD error/ok, cuota local llena/ok) y expone el motivo. Sin esto, un fallo de push a
 *  BD era silencioso y abajo decía "✔ Guardado". */
export function useSaveStatusBanner({ setSaveStatus }: UseSaveStatusBannerArgs): string | null {
  // Error de guardado a BD (evento de storageService.saveTrazosToDB): franja en rojo + motivo
  // en el botón Guardar — el fallo ya no es silencioso (orig. usuario).
  const [bdError, setBdError] = useState<string | null>(null);
  useEffect(() => {
    const onBdError = (e: Event) => {
      const detail = (e as CustomEvent<{ reason: string; message: string }>).detail;
      setBdError(
        detail?.message ? `${detail.reason}: ${detail.message}` : detail?.reason || 'error',
      );
      // El texto del botón Guardar usa saveStatus (que doSave pone en 'saved' sin mirar el
      // resultado del push a BD): sin esto, la franja quedaba roja mientras abajo decía
      // "✔ Guardado" (orig. usuario).
      setSaveStatus('error');
    };
    window.addEventListener('civilflow_bd_save_error', onBdError);
    const onBdOk = () => setBdError(null);
    window.addEventListener('civilflow_bd_save_ok', onBdOk);
    // Cuota local llena (evento de saveToStorage): misma franja roja — un guardado local
    // fallido congelaba la caché del piso y el GC borraba sus UDs (orig. usuario piso 2).
    const onQuota = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      setBdError(
        `almacenamiento local lleno (clave ${detail?.key || '?'}): libera espacio del navegador`,
      );
      setSaveStatus('error');
    };
    window.addEventListener('civilflow_local_quota', onQuota);
    const onQuotaOk = () => setBdError(null);
    window.addEventListener('civilflow_local_quota_ok', onQuotaOk);
    return () => {
      window.removeEventListener('civilflow_bd_save_error', onBdError);
      window.removeEventListener('civilflow_bd_save_ok', onBdOk);
      window.removeEventListener('civilflow_local_quota', onQuota);
      window.removeEventListener('civilflow_local_quota_ok', onQuotaOk);
    };
  }, [setSaveStatus]);
  return bdError;
}
