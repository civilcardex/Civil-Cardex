// Estado de redes ocultas/bloqueadas del visor (extraído de PdfViewer): persistencia en
// localStorage (preferencia de DISPOSITIVO — sobrevive al reset del workspace), toggles,
// restauración en el motor al (re)montar y prune de redes que dejaron de ser visibles.
import { useCallback, useEffect, useState } from 'react';
import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import { PDF_HIDDEN_NETS_KEY, PDF_LOCKED_NETS_KEY } from '../../constants/storage-keys.ts';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';

interface Params {
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  engineReady: boolean;
  /** Redes visibles en la barra (las ocultas por suscripción activa no entran al estado). */
  finalVisibleNets: { id: string; name?: string }[];
  activeNet: string;
  setActiveNet: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Redes ocultas (no se dibujan) y bloqueadas (no se puede dibujar en ellas): el usuario
 * las manipula en la barra de redes y su preferencia persiste por navegador.
 * @returns los dos Sets + sus 3 handlers (toggle oculta, toggle bloqueada, seleccionar
 *   con aviso si la red elegida está oculta).
 */
export function useNetVisibilityState({
  engineRef,
  engineReady,
  finalVisibleNets,
  activeNet,
  setActiveNet,
}: Params) {
  const [hiddenNets, setHiddenNets] = useState<Set<string>>(() => {
    try {
      const saved = loadFromStorage<string[] | null>(PDF_HIDDEN_NETS_KEY, null);
      if (saved) return new Set(saved);
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const [lockedNets, setLockedNets] = useState<Set<string>>(() => {
    try {
      const saved = loadFromStorage<string[] | null>(PDF_LOCKED_NETS_KEY, null);
      if (saved) return new Set(saved);
    } catch {
      /* ignore */
    }
    return new Set();
  });

  const handleToggleHidden = useCallback(
    (id: string) => {
      const next = new Set(hiddenNets);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setHiddenNets(next);
      saveToStorage(PDF_HIDDEN_NETS_KEY, [...next]);
      if (engineRef.current) engineRef.current.setNetHidden(id, next.has(id));
    },
    [hiddenNets, setHiddenNets, engineRef],
  );
  // Restaurar visibilidad al (re)cargar el visor (orig. usuario: tras recargar la página la
  // red reaparecía pero el botón seguía en "oculta" — el set solo se aplicaba desde el
  // toggle). engineReady gatea: el motor no existe en el primer render.
  useEffect(() => {
    if (!engineReady) return;
    const eng = engineRef.current;
    if (!eng) return;
    for (const id of hiddenNets) eng.setNetHidden(id, true);
    // hiddenNets deliberadamente fuera: el estado inicial ya trae lo persistido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady]);

  // Seleccionar red en la barra (orig. usuario): si la red está OCULTA, el aviso sale
  // EN CUANTO se selecciona — no al intentar dibujar.
  const handleSelectNet = useCallback(
    (id: string) => {
      setActiveNet(id);
      if (hiddenNets.has(id)) {
        const nombre = finalVisibleNets.find((n) => n.id === id)?.name || id;
        engineRef.current?.triggerAlert(
          'Red oculta',
          `${nombre} está oculta. Muéstrala en la barra de redes para dibujar en ella.`,
        );
      }
    },
    [hiddenNets, finalVisibleNets, engineRef, setActiveNet],
  );

  const handleToggleLocked = useCallback(
    (id: string) => {
      const next = new Set(lockedNets);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setLockedNets(next);
      saveToStorage(PDF_LOCKED_NETS_KEY, [...next]);
      if (engineRef.current) engineRef.current.setNetLocked(id, next.has(id));
    },
    [lockedNets, setLockedNets, engineRef],
  );

  // Prune: una red que deja de estar visible no debe seguir oculta/seleccionada.
  useEffect(() => {
    if (finalVisibleNets.length === 0) return;
    if (!finalVisibleNets.some((n) => n.id === activeNet)) setActiveNet(finalVisibleNets[0].id);
    setHiddenNets((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of [...next]) {
        if (!finalVisibleNets.some((n) => n.id === id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [finalVisibleNets, activeNet, setActiveNet]);

  return {
    hiddenNets,
    setHiddenNets,
    lockedNets,
    handleToggleHidden,
    handleToggleLocked,
    handleSelectNet,
  };
}
